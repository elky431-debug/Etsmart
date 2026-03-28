/**
 * Client de génération d'images:
 * - stratégie rapide: 1 requête par image (single), plusieurs requêtes en parallèle.
 * - évite les gros POST quantity>1 qui déclenchent des 504 Netlify.
 */
import { getImagePollDeadlineMs, getImagePollIntervalMs } from '@/lib/image-gen-polling';

export type ImageEngineMode = 'flash' | 'pro';

export const QUOTA_MESSAGE_FR =
  'Crédits insuffisants. Passe à un plan supérieur ou attends le prochain cycle.';

/** Quota / plafond de dépenses du projet Google (Gemini), pas les crédits Etsmart. */
export const GEMINI_PROVIDER_LIMIT_MESSAGE_FR =
  'Google Gemini refuse les images : quota ou plafond de dépenses atteint sur la clé API (message type « spending cap » / 429). À corriger dans Google AI Studio ou Google Cloud (budget du projet), puis réessaie. Ce n’est pas un bug du slot 5 ni des crédits Etsmart.';

function responseIndicatesGeminiProviderLimit(json: Record<string, unknown>, message: string | null | undefined): boolean {
  if (json.error === 'GEMINI_PROVIDER_LIMIT') return true;
  const blob = `${message ?? ''} ${typeof json.message === 'string' ? json.message : ''}`.toLowerCase();
  return (
    /spending cap|resource_exhausted|resource exhausted|exceeded its spending|quota exceeded|limit exceeded|\b429\b/.test(
      blob,
    )
  );
}

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

/** POST génération image : peut être long (Gemini + upload). Évite un fetch infini qui bloque les autres slots. */
const GENERATE_IMAGES_POST_TIMEOUT_MS = 240_000;
/** Poll statut tâche image : sans timeout, un slot peut pendre indéfiniment pendant qu’un autre slot finit (concurrence 2). */
const CHECK_IMAGE_STATUS_FETCH_MS = 45_000;

/** Job async Netlify : premier poll sans attendre 2 s ; évite impression de blocage sur la dernière image. */
const ASYNC_JOB_POLL_INTERVAL_MS = 1400;
const ASYNC_JOB_MAX_WAIT_MS = 10 * 60_000;
/** Si le job reste « pending » (worker pas lancé), abandon avant 15 min. */
const ASYNC_JOB_STALE_PENDING_MS = 90_000;
const ASYNC_JOB_PROGRESS_LOG_MS = 18_000;

function fetchSignalWithTimeout(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  return undefined;
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
        signal: fetchSignalWithTimeout(GENERATE_IMAGES_POST_TIMEOUT_MS),
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
      const res = await fetch(`/api/check-image-status?taskId=${encodeURIComponent(taskId)}`, {
        signal: fetchSignalWithTimeout(CHECK_IMAGE_STATUS_FETCH_MS),
      });
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
async function pollImageGenJobUntilDone(
  jobId: string,
  token: string,
  logLabel: string
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + ASYNC_JOB_MAX_WAIT_MS;
  const pollFetchTimeoutMs = 45_000;
  const started = Date.now();
  let pendingSince: number | null = null;
  let lastProgressLog = started;
  let firstPoll = true;

  while (Date.now() < deadline) {
    if (!firstPoll) {
      await new Promise((r) => setTimeout(r, ASYNC_JOB_POLL_INTERVAL_MS));
    }
    firstPoll = false;

    let pr: Response;
    try {
      pr = await fetch(`/api/generate-images/status?jobId=${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: fetchSignalWithTimeout(pollFetchTimeoutMs),
      });
    } catch {
      continue;
    }

    if (pr.status === 404) {
      return {
        success: false,
        imageTaskIds: [],
        imageDataUrls: [],
        error: 'IMAGE_JOB_NOT_FOUND',
        message: 'Job de génération introuvable (session expirée ou id invalide). Réessaie une génération.',
      };
    }

    let pj: Record<string, unknown>;
    try {
      pj = (await pr.json()) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (pj.status === 'done' && pj.result && typeof pj.result === 'object') {
      const elapsed = Math.round((Date.now() - started) / 1000);
      console.log(`[CHUNKED] ${logLabel} job async terminé en ~${elapsed}s`);
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

    const st = typeof pj.status === 'string' ? pj.status : '';
    if (st === 'pending') {
      if (pendingSince == null) pendingSince = Date.now();
      else if (Date.now() - pendingSince > ASYNC_JOB_STALE_PENDING_MS) {
        return {
          success: false,
          imageTaskIds: [],
          imageDataUrls: [],
          error: 'IMAGE_JOB_STUCK',
          message:
            'La génération côté serveur n’a pas démarré (job resté en attente trop longtemps). Réessaie ; vérifie aussi les fonctions Netlify « generate-images-background » et la table image_gen_jobs.',
        };
      }
    } else {
      pendingSince = null;
    }

    const now = Date.now();
    if (now - lastProgressLog >= ASYNC_JOB_PROGRESS_LOG_MS) {
      lastProgressLog = now;
      const sec = Math.round((now - started) / 1000);
      console.log(
        `[CHUNKED] ${logLabel} job async en cours — statut « ${st || '…'} » (~${sec}s). La dernière image est souvent seule en file ; compte 1–4 min selon Gemini.`,
      );
    }
  }

  return {
    success: false,
    imageTaskIds: [],
    imageDataUrls: [],
    error: 'IMAGE_JOB_TIMEOUT',
    message:
      'Délai dépassé en attendant la fin du job image (Netlify). Relance la génération ; la dernière image est souvent la plus longue (une seule requête en cours à la fin).',
  };
}

/**
 * Pool d’indices 0..total-1 : chaque worker prend le prochain index après await (pas de course sur cursor partagé).
 */
async function runIndexPool(
  total: number,
  maxConcurrency: number,
  worker: (index: number) => Promise<void>
): Promise<void> {
  if (total <= 0) return;
  const workers = Math.max(1, Math.min(maxConcurrency, total));
  let next = 0;
  const runWorker = async () => {
    while (next < total) {
      const index = next;
      next += 1;
      await worker(index);
    }
  };
  await Promise.all(Array.from({ length: workers }, () => runWorker()));
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
  let geminiProviderLimitWarning: string | null = null;

  const markDone = (index: number) => {
    if (!slotDone[index]) {
      slotDone[index] = true;
      onPendingDecrement?.();
    }
  };

  const runSingleIndex = async (index: number): Promise<void> => {
    try {
      await runSingleIndexBody(index);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Image ${index + 1}: ${msg}`);
      console.error(`[CHUNKED] Image ${index + 1}/${imageCount} exception`, e);
      markDone(index);
    }
  };

  const runSingleIndexBody = async (index: number): Promise<void> => {
    if (geminiProviderLimitWarning) {
      markDone(index);
      return;
    }

    let lastError = `Image ${index + 1}: aucun visuel retourné`;
    console.log(`[CHUNKED] Image ${index + 1}/${imageCount} start (index ${index})`);

    const isProdSite =
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';
    const slotHttpAttempts = isProdSite ? 2 : retryAttemptsPerSlot;
    const slotInnerTries = isProdSite ? 1 : 2;
    const retryBackoffMs = isProdSite ? 700 : 1200;

    for (let attempt = 0; attempt < slotInnerTries; attempt++) {
      if (geminiProviderLimitWarning) {
        markDone(index);
        return;
      }

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
          console.log(`[CHUNKED] Image ${index + 1}/${imageCount} job async ${json.jobId} (poll)…`);
          json = await pollImageGenJobUntilDone(
            json.jobId,
            token,
            `Image ${index + 1}/${imageCount}`,
          );
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
        `[CHUNKED] Image ${index + 1}/${imageCount} attempt=${attempt}`,
        payloadHint,
        `engine=${parsed.requestedEngine ?? 'n/a'} provider=${parsed.provider ?? 'n/a'} model=${parsed.model ?? 'n/a'}`,
      );
      if (!httpOk) {
        if (
          responseIndicatesGeminiProviderLimit(json, parsed.message) ||
          parsed.errorCode === 'GEMINI_PROVIDER_LIMIT'
        ) {
          geminiProviderLimitWarning = GEMINI_PROVIDER_LIMIT_MESSAGE_FR;
          markDone(index);
          console.warn(`[CHUNKED] Image ${index + 1}/${imageCount} — limite Google Gemini (arrêt des autres slots).`);
          return;
        }
        if (
          httpStatus === 403 &&
          (parsed.errorCode === 'SUBSCRIPTION_REQUIRED' || parsed.errorCode === 'QUOTA_EXCEEDED')
        ) {
          firstQuotaError = normalizeQuotaMessage(parsed.message);
          markDone(index);
          console.log(`[CHUNKED] Image ${index + 1}/${imageCount} done — success=${!!slots[index]}`);
          return;
        }
        lastError =
          parsed.message ||
          (parsed.errorCode
            ? `Image ${index + 1}: ${parsed.errorCode} (HTTP ${httpStatus})`
            : `Image ${index + 1}: erreur API ${httpStatus}`);
        console.error(`[CHUNKED] Image ${index + 1}/${imageCount} HTTP ${httpStatus}`, parsed.errorCode, parsed.message);
        continue;
      }

      if (apiDeclined && parsed.imageDataUrls.length === 0 && parsed.imageTaskIds.length === 0) {
        if (
          parsed.errorCode === 'GEMINI_PROVIDER_LIMIT' ||
          responseIndicatesGeminiProviderLimit(json, parsed.message)
        ) {
          geminiProviderLimitWarning = GEMINI_PROVIDER_LIMIT_MESSAGE_FR;
          markDone(index);
          console.warn(`[CHUNKED] Image ${index + 1}/${imageCount} — limite Google Gemini (arrêt des autres slots).`);
          return;
        }
        lastError =
          parsed.message ||
          (parsed.errorCode
            ? `Image ${index + 1}: ${parsed.errorCode} (réponse success=false)`
            : `Image ${index + 1}: réponse API success=false sans détail`);
        console.error(`[CHUNKED] Image ${index + 1}/${imageCount} success=false`, lastError);
        continue;
      }

      let url = parsed.imageDataUrls[0] || null;
      if (!url && parsed.imageTaskIds.length > 0) {
        url = await pollSingleTaskImage(parsed.imageTaskIds[0], 1);
      }
      if (url) {
        slots[index] = { id: `img-${Date.now()}-${index}`, url };
        markDone(index);
        console.log(`[CHUNKED] Image ${index + 1}/${imageCount} done — success=${!!slots[index]}`);
        return;
      }
      lastError =
        parsed.message ||
        (parsed.errorCode
          ? `Image ${index + 1}: ${parsed.errorCode}`
          : `Image ${index + 1}: aucun visuel retourné`);
      console.error(`[CHUNKED] Image ${index + 1}/${imageCount} pas d’URL après réponse OK`, lastError, payloadHint);
    }

    errors.push(lastError);
    markDone(index);
    console.error(`[CHUNKED] Image ${index + 1}/${imageCount} terminé en échec — ${lastError}`);
  };

  await runIndexPool(imageCount, getImageChunkConcurrency(engineMode), runSingleIndex);

  const filled = slots.filter((s) => s !== null).length;
  console.log(`[CHUNKED] Pool terminé — ${filled}/${imageCount} image(s), tous les workers ont fini.`);

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

  if (geminiProviderLimitWarning) {
    const images = slots.filter((img): img is ChunkedGeneratedImage => img !== null);
    return { images, warning: geminiProviderLimitWarning };
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
