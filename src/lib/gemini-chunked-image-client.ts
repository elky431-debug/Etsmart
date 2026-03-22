/**
 * Client : génération d’images « 1 requête HTTP = 1 visuel » (clientChunkedSingle).
 * Indispensable sur Netlify (~26s / fonction) : un POST avec quantity=7 dépasse toujours le timeout.
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

/** En prod : 1 requête à la fois (évite 429 + 504). En local : un peu de parallèle. */
export function getImageChunkConcurrency(engineMode: ImageEngineMode): number {
  if (typeof window === 'undefined') return 1;
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (!isLocal) return 1;
  return engineMode === 'pro' ? 2 : 3;
}

/** Retries sur 502/503/504 ; clientChunkAttempt alterne le modèle côté API. */
export async function fetchGenerateImagesWithRetry(
  payload: Record<string, unknown>,
  token: string,
  attempts = 6
): Promise<Response> {
  let last: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      last = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, clientChunkAttempt: i }),
      });
    } catch {
      last = new Response(null, { status: 503, statusText: 'Network error' });
    }
    if (last.ok) return last;
    const retryable = last.status === 502 || last.status === 503 || last.status === 504;
    if (!retryable || i === attempts - 1) return last;
    await new Promise((r) => setTimeout(r, 2000 + 1800 * i));
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
  return { imageTaskIds, imageDataUrls, message, errorCode };
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
    retryAttemptsPerSlot = 6,
    onPendingDecrement,
  } = opts;

  const concurrency = getImageChunkConcurrency(engineMode);
  const maxWorkers = Math.max(1, Math.min(concurrency, imageCount));
  const slots: Array<ChunkedGeneratedImage | null> = Array.from({ length: imageCount }, () => null);
  const errors: string[] = [];
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= imageCount) return;

      try {
        const payload = {
          ...imageBase,
          quantity: 1,
          clientChunkedSingle: true,
          singlePromptIndex: index,
          promptStartIndex: index,
        };
        const res = await fetchGenerateImagesWithRetry(payload, token, retryAttemptsPerSlot);
        let json: Record<string, unknown> = {};
        try {
          json = (await res.json()) as Record<string, unknown>;
        } catch {
          json = {};
        }
        const parsed = parseGenerateImageResponse(json);

        if (!res.ok) {
          if (
            res.status === 403 &&
            (parsed.errorCode === 'SUBSCRIPTION_REQUIRED' || parsed.errorCode === 'QUOTA_EXCEEDED')
          ) {
            throw new Error(normalizeQuotaMessage(parsed.message));
          }
          errors.push(parsed.message || `Image ${index + 1}: erreur API ${res.status}`);
          continue;
        }

        let url: string | null = parsed.imageDataUrls[0] || null;
        if (!url && parsed.imageTaskIds.length > 0) {
          url = await pollSingleTaskImage(parsed.imageTaskIds[0], 1);
        }
        if (url) {
          slots[index] = { id: `img-${Date.now()}-${index}`, url };
        } else {
          errors.push(parsed.message || `Image ${index + 1}: aucun visuel retourné`);
        }
      } finally {
        onPendingDecrement?.();
      }
    }
  };

  await Promise.all(Array.from({ length: maxWorkers }, () => worker()));

  const images = slots.filter((img): img is ChunkedGeneratedImage => img !== null);
  if (errors.length === 0) return { images, warning: null };
  return {
    images,
    warning: images.length > 0
      ? `Seulement ${images.length} image(s) sur ${imageCount}. ${errors[0]}`
      : errors[0],
  };
}
