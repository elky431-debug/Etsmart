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

/**
 * Concurrence : Flash → 2 slots. Pro → 1 en local ; sur site déployé, 2 slots (test Netlify : moins de sérialisation pour 7 images).
 * Désactive avec `NEXT_PUBLIC_IMAGE_PRO_CONCURRENCY=1` sur Netlify si trop de 504 / 429.
 */
export function getImageChunkConcurrency(engineMode: ImageEngineMode): number {
  if (engineMode === 'pro') {
    if (typeof window !== 'undefined') {
      const h = window.location.hostname;
      const isLocal = h === 'localhost' || h === '127.0.0.1';
      const forceSerial =
        typeof process.env.NEXT_PUBLIC_IMAGE_PRO_CONCURRENCY === 'string' &&
        process.env.NEXT_PUBLIC_IMAGE_PRO_CONCURRENCY.trim() === '1';
      if (!isLocal && !forceSerial) return 2;
    }
    return 1;
  }
  if (typeof window === 'undefined') return 2;
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

function pickApiMessage(json: Record<string, unknown>): string | null {
  const m = json.message;
  if (typeof m === 'string' && m.trim().length > 0) return m.trim();
  if (m != null && typeof m === 'object') {
    try {
      const s = JSON.stringify(m);
      return s.length > 400 ? `${s.slice(0, 400)}…` : s;
    } catch {
      return null;
    }
  }
  const err = json.error;
  if (typeof err === 'string' && err.trim().length > 0) return err.trim();
  if (err != null && typeof err === 'object' && 'message' in err) {
    const em = (err as { message?: unknown }).message;
    if (typeof em === 'string' && em.trim().length > 0) return em.trim();
  }
  return null;
}

export function parseGenerateImageResponse(json: Record<string, unknown>) {
  const imageTaskIds: string[] = Array.isArray(json.imageTaskIds)
    ? (json.imageTaskIds as unknown[]).filter((t): t is string => typeof t === 'string' && t.length > 0)
    : [];
  const imageDataUrls: string[] = Array.isArray(json.imageDataUrls)
    ? (json.imageDataUrls as unknown[]).filter((u): u is string => {
        if (typeof u !== 'string') return false;
        const t = u.trim();
        if (t.length < 12) return false;
        return t.startsWith('http') || t.startsWith('data:image/');
      })
    : [];
  const message = pickApiMessage(json);
  const errorCode = typeof json.error === 'string' ? json.error : null;
  const provider = typeof json.provider === 'string' ? json.provider : null;
  const model = typeof json.model === 'string' ? json.model : null;
  const requestedEngine = typeof json.requestedEngine === 'string' ? json.requestedEngine : null;
  return { imageTaskIds, imageDataUrls, message, errorCode, provider, model, requestedEngine };
}

export async function pollSingleTaskImage(
  taskId: string,
  quantityForDeadline = 1
): Promise<string | null> {
  const deadline = Date.now() + getImagePollDeadlineMs(quantityForDeadline);
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

/** Netlify Background Function : attend la fin du job puis renvoie le même JSON que l’API synchrone. */
async function pollImageGenJobUntilDone(jobId: string, token: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 15 * 60_000;
  const interval = 2000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    const pr = await fetch(`/api/generate-images/status?jobId=${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let pj: Record<string, unknown>;
    try {
      pj = (await pr.json()) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (pj.status === 'done' && pj.result && typeof pj.result === 'object') {
      return pj.result as Record<string, unknown>;
    }
    if (pj.status === 'error') {
      return {
        success: false,
        imageTaskIds: [],
        imageDataUrls: [],
        error: 'IMAGE_SUBMIT_FAILED',
        message: typeof pj.message === 'string' ? pj.message : 'Erreur génération',
      };
    }
  }
  return {
    success: false,
    imageTaskIds: [],
    imageDataUrls: [],
    error: 'IMAGE_JOB_TIMEOUT',
    message: 'Délai dépassé en attendant les images (job async).',
  };
}

async function runWithConcurrency<T>(
  items: T[],
  maxConcurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const cap = Math.max(1, Math.min(maxConcurrency, items.length));
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

    const isProdSite =
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';
    const slotHttpAttempts = isProdSite ? 2 : retryAttemptsPerSlot;
    const slotInnerTries = isProdSite ? 1 : 2;
    const retryBackoffMs = isProdSite ? 700 : 1200;

    for (let attempt = 0; attempt < slotInnerTries; attempt++) {
      const payload = {
        ...imageBase,
        quantity: 1,
        clientChunkedSingle: true,
        singlePromptIndex: index,
        promptStartIndex: index,
        clientChunkAttempt: attempt,
      };
      const res = await fetchGenerateImagesWithRetry(payload, token, slotHttpAttempts, retryBackoffMs);
      let json: Record<string, unknown> = {};
      let httpOk = res.ok;
      let httpStatus = res.status;
      if (res.status === 202) {
        try {
          json = (await res.json()) as Record<string, unknown>;
        } catch {
          json = {};
        }
        if (json.accepted === true && typeof json.jobId === 'string') {
          console.log(`[CHUNKED] Slot ${index} job async ${json.jobId} (poll)…`);
          json = await pollImageGenJobUntilDone(json.jobId, token);
          const urls = Array.isArray(json.imageDataUrls) ? json.imageDataUrls : [];
          httpOk =
            json.success === true ||
            urls.some((u) => typeof u === 'string' && u.length > 12);
          httpStatus = httpOk ? 200 : 500;
        } else {
          httpOk = false;
        }
      } else {
        try {
          json = (await res.json()) as Record<string, unknown>;
        } catch {
          json = {};
        }
      }
      const parsed = parseGenerateImageResponse(json);
      const apiDeclined = json.success === false;
      const successStr =
        json.success === true ? 'true' : json.success === false ? 'false' : '∅';
      const payloadHint = `status=${httpStatus} ok=${httpOk} success=${successStr} urls=${parsed.imageDataUrls.length} tasks=${parsed.imageTaskIds.length}`;
      console.log(
        `[CHUNKED] Slot ${index} attempt=${attempt}`,
        payloadHint,
        `engine=${parsed.requestedEngine ?? 'n/a'} provider=${parsed.provider ?? 'n/a'} model=${parsed.model ?? 'n/a'}`,
      );
      if (!httpOk) {
        if (
          httpStatus === 403 &&
          (parsed.errorCode === 'SUBSCRIPTION_REQUIRED' || parsed.errorCode === 'QUOTA_EXCEEDED')
        ) {
          firstQuotaError = normalizeQuotaMessage(parsed.message);
          markDone(index);
          console.log(`[CHUNKED] Slot ${index} done — success=${!!slots[index]}`);
          return;
        }
        lastError =
          parsed.message ||
          (parsed.errorCode
            ? `Image ${index + 1}: ${parsed.errorCode} (HTTP ${httpStatus})`
            : `Image ${index + 1}: erreur API ${httpStatus}`);
        console.error(`[CHUNKED] Slot ${index} HTTP ${httpStatus}`, parsed.errorCode, parsed.message);
        continue;
      }

      if (apiDeclined && parsed.imageDataUrls.length === 0 && parsed.imageTaskIds.length === 0) {
        lastError =
          parsed.message ||
          (parsed.errorCode
            ? `Image ${index + 1}: ${parsed.errorCode} (réponse success=false)`
            : `Image ${index + 1}: réponse API success=false sans détail`);
        console.error(`[CHUNKED] Slot ${index} success=false`, lastError);
        continue;
      }

      let url = parsed.imageDataUrls[0] || null;
      if (!url && parsed.imageTaskIds.length > 0) {
        url = await pollSingleTaskImage(parsed.imageTaskIds[0], 1);
      }
      if (url) {
        slots[index] = { id: `img-${Date.now()}-${index}`, url };
        markDone(index);
        console.log(`[CHUNKED] Slot ${index} done — success=${!!slots[index]}`);
        return;
      }
      lastError =
        parsed.message ||
        (parsed.errorCode
          ? `Image ${index + 1}: ${parsed.errorCode}`
          : `Image ${index + 1}: aucun visuel retourné`);
      console.error(`[CHUNKED] Slot ${index} pas d’URL après réponse OK`, lastError, payloadHint);
    }

    errors.push(lastError);
    markDone(index);
    console.error(`[CHUNKED] Slot ${index} terminé en échec — ${lastError}`);
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
  if (errors.length === 0) {
    if (images.length === 0) {
      return { images, warning: `Aucun visuel retourné (${imageCount} tentative(s)).` };
    }
    return { images, warning: null };
  }
  return {
    images,
    warning: images.length > 0
      ? `Seulement ${images.length} image(s) sur ${imageCount}. ${errors[0]}`
      : errors[0],
  };
}
