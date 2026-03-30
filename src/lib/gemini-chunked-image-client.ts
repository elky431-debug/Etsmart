/**
 * Client de génération d'images:
 * - stratégie rapide: 1 requête par image (single), plusieurs requêtes en parallèle.
 * - évite les gros POST quantity>1 qui déclenchent des 504 Netlify.
 */
import { getImagePollDeadlineMs, getImagePollIntervalMs } from '@/lib/image-gen-polling';

export type ImageEngineMode = 'flash' | 'pro';

export const QUOTA_MESSAGE_FR =
  'Crédits insuffisants. Passe à un plan supérieur ou attends le prochain cycle.';

export function normalizeQuotaMessage(msg: string | undefined | null): string {
  if (!msg) return QUOTA_MESSAGE_FR;
  if (/the quota has been exceeded|quota.*exceeded|crédits.*insuffisant/i.test(msg)) return QUOTA_MESSAGE_FR;
  return msg;
}

/** Concurrence par mode :
 *  - Flash : 2 en parallèle — Gemini rate-limite vite.
 *  - Pro : 3 en parallèle — équilibre vitesse vs rate-limit gemini-3.1.
 */
export function getImageChunkConcurrency(engineMode: ImageEngineMode): number {
  if (engineMode === 'pro') return 3;
  return 2;
}

/** Retries sur 502/503/504 / erreurs transitoires. */
export async function fetchGenerateImagesWithRetry(
  payload: Record<string, unknown>,
  token: string,
  attempts = 3,
  backoffBaseMs = 900
): Promise<Response> {
  let last: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      last = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    } catch {
      last = new Response(null, { status: 503, statusText: 'Network error' });
    }
    if (last.ok) return last;
    const retryable = last.status === 502 || last.status === 503 || last.status === 504;
    if (!retryable || i === attempts - 1) return last;
    await new Promise((r) => setTimeout(r, backoffBaseMs * (i + 1)));
  }
  return last!;
}

export function parseGenerateImageResponse(json: Record<string, unknown>) {
  const imageTaskIds: string[] = Array.isArray(json.imageTaskIds)
    ? (json.imageTaskIds as unknown[]).filter((t): t is string => typeof t === 'string' && t.length > 0)
    : [];
  const imageDataUrls: string[] = Array.isArray(json.imageDataUrls)
    ? (json.imageDataUrls as unknown[]).filter((u): u is string => typeof u === 'string' && u.length > 20)
    : [];
  const message = typeof json.message === 'string' && json.message.trim().length > 0 ? json.message.trim() : null;
  const errorCode = typeof json.error === 'string' ? json.error : null;
  const provider = typeof json.provider === 'string' ? json.provider : null;
  const model = typeof json.model === 'string' ? json.model : null;
  const requestedEngine = typeof json.requestedEngine === 'string' ? json.requestedEngine : null;
  return { imageTaskIds, imageDataUrls, message, errorCode, provider, model, requestedEngine };
}

export async function pollSingleTaskImage(
  taskId: string,
  quantityForDeadline = 1,
  customDeadlineMs?: number
): Promise<string | null> {
  const deadline = Date.now() + (customDeadlineMs ?? getImagePollDeadlineMs(quantityForDeadline));
  const pollMs = getImagePollIntervalMs(quantityForDeadline);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    try {
      const res = await fetch(`/api/check-image-status?taskId=${encodeURIComponent(taskId)}`);
      if (!res.ok) continue;
      const statusData = await res.json();
      if (statusData.status === 'ready' && statusData.url && String(statusData.url).startsWith('http')) {
        return statusData.url as string;
      }
      if (statusData.status === 'error') return null;
    } catch {
      /* retry */
    }
  }
  return null;
}

export interface ChunkedGeneratedImage {
  id: string;
  url: string;
}

async function runWithConcurrency<T>(
  items: T[],
  maxConcurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const cap = Math.max(1, Math.min(maxConcurrency, items.length || 1));
  let cursor = 0;
  const runners = Array.from({ length: cap }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

export async function runChunkedImageGeneration(opts: {
  token: string;
  imageBase: Record<string, unknown>;
  imageCount: number;
  engineMode: ImageEngineMode;
  retryAttemptsPerSlot?: number;
  onPendingDecrement?: () => void;
}): Promise<{ images: ChunkedGeneratedImage[]; warning: string | null }> {
  const {
    token,
    imageBase,
    imageCount,
    engineMode,
    retryAttemptsPerSlot = 2,
    onPendingDecrement,
  } = opts;

  const slots: Array<ChunkedGeneratedImage | null> = Array.from({ length: imageCount }, () => null);
  const slotDone: boolean[] = Array.from({ length: imageCount }, () => false);
  const errors: string[] = [];
  let firstQuotaError: string | null = null;

  const markDone = (index: number) => {
    if (!slotDone[index]) {
      slotDone[index] = true;
      onPendingDecrement?.();
    }
  };

  const runSingleIndex = async (index: number): Promise<void> => {
    let lastError = `Image ${index + 1}: aucun visuel retourné`;
    console.log(`[CHUNKED] Slot ${index} start`);

    const maxAttempts = Math.max(1, retryAttemptsPerSlot);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        // Délai croissant entre les tentatives pour laisser Gemini respirer
        await new Promise((r) => setTimeout(r, 1500 + attempt * 1000));
        console.log(`[CHUNKED] Slot ${index} retry attempt ${attempt}`);
      }
      const payload = {
        ...imageBase,
        quantity: 1,
        clientChunkedSingle: true,
        singlePromptIndex: index,
        promptStartIndex: index,
        clientChunkAttempt: attempt,
      };
      const res = await fetchGenerateImagesWithRetry(payload, token, 2, 1200);
      let json: Record<string, unknown> = {};
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        json = {};
      }
      const parsed = parseGenerateImageResponse(json);
      if (parsed.model || parsed.provider || parsed.requestedEngine) {
        console.log(
          `[CHUNKED] Slot ${index} engine=${parsed.requestedEngine ?? 'n/a'} provider=${parsed.provider ?? 'n/a'} model=${parsed.model ?? 'n/a'}`
        );
      }
      if (!res.ok) {
        if (
          res.status === 403 &&
          (parsed.errorCode === 'SUBSCRIPTION_REQUIRED' || parsed.errorCode === 'QUOTA_EXCEEDED')
        ) {
          firstQuotaError = normalizeQuotaMessage(parsed.message);
          markDone(index);
          console.log(`[CHUNKED] Slot ${index} done — success=${!!slots[index]}`);
          return;
        }
        lastError = parsed.message || `Image ${index + 1}: erreur API ${res.status}`;
        continue;
      }

      let url = parsed.imageDataUrls[0] || null;
      if (!url && parsed.imageTaskIds.length > 0) {
        // gemini-bg : 60s max avant retry client (gemini-3.1 répond en ~20-55s)
        const customDeadline = parsed.provider === 'gemini-bg' ? 60_000 : undefined;
        url = await pollSingleTaskImage(parsed.imageTaskIds[0], 1, customDeadline);
      }
      if (url) {
        slots[index] = { id: `img-${Date.now()}-${index}`, url };
        markDone(index);
        console.log(`[CHUNKED] Slot ${index} done — success=${!!slots[index]}`);
        return;
      }
      lastError = parsed.message || `Image ${index + 1}: aucun visuel retourné`;
    }

    errors.push(lastError);
    markDone(index);
    console.log(`[CHUNKED] Slot ${index} done — success=${!!slots[index]}`);
  };

  const indexes = Array.from({ length: imageCount }, (_, i) => i);
  await runWithConcurrency(indexes, getImageChunkConcurrency(engineMode), runSingleIndex);

  // Filet de sécurité: fermer les slots non marqués (ne devrait pas arriver).
  for (let i = 0; i < imageCount; i++) {
    if (!slotDone[i]) {
      errors.push(`Image ${i + 1}: traitement incomplet`);
      markDone(i);
    }
  }

  if (firstQuotaError) {
    const images = slots.filter((img): img is ChunkedGeneratedImage => img !== null);
    return { images, warning: firstQuotaError };
  }

  const images = slots.filter((img): img is ChunkedGeneratedImage => img !== null);
  if (errors.length === 0) return { images, warning: null };
  return {
    images,
    warning: images.length > 0
      ? `Seulement ${images.length} image(s) sur ${imageCount}. ${errors[0]}`
      : errors[0],
  };
}
