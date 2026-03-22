/**
 * Client de génération d'images:
 * - stratégie rapide: blocs (3/2/1) en parallèle, pour retrouver un temps proche d'avant.
 * - fallback: singles par slot si un bloc échoue.
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

/** Par défaut: parallélisme modéré pour garder la vitesse sans exploser les erreurs transientes. */
export function getImageChunkConcurrency(engineMode: ImageEngineMode): number {
  if (typeof window === 'undefined') return engineMode === 'pro' ? 2 : 3;
  return engineMode === 'pro' ? 2 : 3;
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

type ImageBatchChunk = { start: number; qty: 1 | 2 | 3 };

function buildImageChunks(imageCount: number): ImageBatchChunk[] {
  const chunks: ImageBatchChunk[] = [];
  let i = 0;
  while (i < imageCount) {
    const left = imageCount - i;
    if (left >= 3) {
      chunks.push({ start: i, qty: 3 });
      i += 3;
    } else if (left === 2) {
      chunks.push({ start: i, qty: 2 });
      i += 2;
    } else {
      chunks.push({ start: i, qty: 1 });
      i += 1;
    }
  }
  return chunks;
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
    const payload = {
      ...imageBase,
      quantity: 1,
      clientChunkedSingle: true,
      singlePromptIndex: index,
      promptStartIndex: index,
    };
    const res = await fetchGenerateImagesWithRetry(payload, token, retryAttemptsPerSlot, 1200);
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
        firstQuotaError = normalizeQuotaMessage(parsed.message);
      } else {
        errors.push(parsed.message || `Image ${index + 1}: erreur API ${res.status}`);
      }
      markDone(index);
      return;
    }

    let url = parsed.imageDataUrls[0] || null;
    if (!url && parsed.imageTaskIds.length > 0) {
      url = await pollSingleTaskImage(parsed.imageTaskIds[0], 1);
    }
    if (url) {
      slots[index] = { id: `img-${Date.now()}-${index}`, url };
    } else {
      errors.push(parsed.message || `Image ${index + 1}: aucun visuel retourné`);
    }
    markDone(index);
  };

  const runChunk = async (chunk: ImageBatchChunk): Promise<void> => {
    const { start, qty } = chunk;
    const indexes = qty === 3 ? [start, start + 1, start + 2] : qty === 2 ? [start, start + 1] : [start];
    const payload =
      qty === 1
        ? {
            ...imageBase,
            quantity: 1,
            clientChunkedSingle: true,
            singlePromptIndex: start,
            promptStartIndex: start,
          }
        : {
            ...imageBase,
            quantity: qty,
            promptStartIndex: start,
          };

    const res = await fetchGenerateImagesWithRetry(payload, token, 2, 900);
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
        firstQuotaError = normalizeQuotaMessage(parsed.message);
        indexes.forEach(markDone);
        return;
      }
      await Promise.all(indexes.map((idx) => runSingleIndex(idx)));
      return;
    }

    // Réponse d'un lot: mappe les URLs directes puis fallback par slot si manquant.
    indexes.forEach((idx, local) => {
      const url = parsed.imageDataUrls[local];
      if (typeof url === 'string' && url.length > 20) {
        slots[idx] = { id: `img-${Date.now()}-${idx}`, url };
        markDone(idx);
      }
    });

    const pendingFromTasks: Promise<void>[] = [];
    indexes.forEach((idx, local) => {
      if (slotDone[idx]) return;
      const taskId = parsed.imageTaskIds[local];
      if (typeof taskId === 'string' && taskId.length > 0) {
        pendingFromTasks.push(
          (async () => {
            const url = await pollSingleTaskImage(taskId, qty);
            if (url) {
              slots[idx] = { id: `img-${Date.now()}-${idx}`, url };
            } else {
              errors.push(`Image ${idx + 1}: aucun visuel retourné`);
            }
            markDone(idx);
          })()
        );
      }
    });

    if (pendingFromTasks.length > 0) await Promise.all(pendingFromTasks);

    const missing = indexes.filter((idx) => !slotDone[idx]);
    if (missing.length > 0) {
      await Promise.all(missing.map((idx) => runSingleIndex(idx)));
    }
  };

  const chunks = buildImageChunks(imageCount);
  await runWithConcurrency(chunks, getImageChunkConcurrency(engineMode), runChunk);

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
