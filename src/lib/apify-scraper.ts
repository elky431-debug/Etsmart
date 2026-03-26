import { extractListingPriceFromItem } from '@/lib/listing-price-extract';
import { extractListingTagsFromItem } from '@/lib/listing-tags-extract';

type ScrapeTarget = 'listing' | 'shop' | 'search-count';

const APIFY_BASE = 'https://api.apify.com/v2';
const DEFAULT_ETSY_LISTING_ACTOR = 'epctex~etsy-scraper';
const DEFAULT_CHEERIO_SCRAPER_ACTOR = 'apify~cheerio-scraper';

type ApifyRunOptions = {
  timeoutSecs?: number;
  maxItems?: number;
  actorIdOverride?: string;
  /** Budget max pour polls + attente dataset (défaut ~175 s). À augmenter pour maxItems élevés ou runs lents. */
  maxTotalWaitMs?: number;
};

function parseActorId(raw?: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  // Accept either actor id (abc123) or full URL (https://console.apify.com/actors/abc123).
  const urlMatch = value.match(/\/actors\/([^/?#]+)/i);
  if (urlMatch?.[1]) return urlMatch[1];
  // Accept console format "username/actor-name" and convert to API format "username~actor-name".
  if (value.includes('/') && !value.includes('~')) {
    const [owner, name] = value.split('/');
    if (owner && name) return `${owner}~${name}`;
  }
  return value;
}

function getActorId(target: ScrapeTarget): string | null {
  if (target === 'listing') {
    return (
      DEFAULT_ETSY_LISTING_ACTOR ||
      parseActorId(process.env.APIFY_ACTOR_LISTING_ID) ||
      parseActorId(process.env.APIFY_ACTOR_SHOP_ID) ||
      parseActorId(process.env.APIFY_ACTOR_ID) ||
      null
    );
  }
  if (target === 'search-count') {
    return (
      parseActorId(process.env.APIFY_ACTOR_ETSY_COUNT_ID) ||
      DEFAULT_CHEERIO_SCRAPER_ACTOR ||
      parseActorId(process.env.APIFY_ACTOR_ID) ||
      null
    );
  }
  return parseActorId(process.env.APIFY_ACTOR_SHOP_ID) || null;
}

function getActorCandidates(target: ScrapeTarget, override?: string): string[] {
  const candidates = [
    parseActorId(override),
    target === 'listing' ? DEFAULT_ETSY_LISTING_ACTOR : null,
    target === 'search-count' ? parseActorId(process.env.APIFY_ACTOR_ETSY_COUNT_ID) : null,
    target === 'search-count' ? DEFAULT_CHEERIO_SCRAPER_ACTOR : null,
    target === 'listing' ? parseActorId(process.env.APIFY_ACTOR_LISTING_ID) : null,
    parseActorId(process.env.APIFY_ACTOR_SHOP_ID),
    parseActorId(process.env.APIFY_ACTOR_ID),
  ].filter(Boolean) as string[];
  return [...new Set(candidates)];
}

function getApifyToken(): string | null {
  const token =
    process.env.APIFY_API_TOKEN?.trim() ||
    process.env.APIFY_TOKEN?.trim() ||
    process.env.APIFY_API_KEY?.trim();
  return token || null;
}

function extractNumericPrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const n = Number.parseFloat(normalized);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    for (const key of ['value', 'amount', 'price', 'min', 'minPrice']) {
      const n = extractNumericPrice(rec[key]);
      if (n > 0) return n;
    }
  }
  return 0;
}

function firstString(input: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstImage(input: Record<string, unknown>): string | null {
  for (const key of ['image', 'imageUrl', 'mainImage', 'thumbnail', 'thumbnailUrl']) {
    const val = input[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  for (const key of ['images', 'imageUrls', 'gallery']) {
    const val = input[key];
    if (Array.isArray(val)) {
      const first = val.find((x) => typeof x === 'string' && x.trim()) as string | undefined;
      if (first) return first.trim();
    }
  }
  return null;
}

export function isApifyConfigured(target: ScrapeTarget): boolean {
  return !!(getApifyToken() && getActorId(target));
}

export function getApifyConfigState(target: ScrapeTarget, actorIdOverride?: string) {
  const token = getApifyToken();
  const actorFromOverride = parseActorId(actorIdOverride);
  const actorFromEnv = getActorId(target);
  const resolvedActorId = actorFromOverride || actorFromEnv || null;
  return {
    hasToken: !!token,
    hasActorInEnv: !!actorFromEnv,
    hasActorOverride: !!actorFromOverride,
    resolvedActorId,
  };
}

export async function runApifyActorByTarget(
  target: ScrapeTarget,
  input: Record<string, unknown>,
  options: ApifyRunOptions = {}
): Promise<unknown[]> {
  const token = getApifyToken();
  const actorCandidates = getActorCandidates(target, options.actorIdOverride);
  if (!token || actorCandidates.length === 0) {
    throw new Error(`Configuration Apify manquante pour la cible "${target}".`);
  }

  const maxItems = options.maxItems ?? 5;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const isRetryableApifyStatus = (status: number) => status === 502 || status === 503 || status === 504;

  const fetchDatasetItems = async (datasetId: string): Promise<unknown[]> => {
    const datasetEndpoint =
      `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items` +
      `?token=${encodeURIComponent(token)}` +
      `&clean=true&format=json&limit=${encodeURIComponent(String(maxItems))}`;
    const maxAttempts = 3;
    let lastErr: unknown = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const dsRes = await fetch(datasetEndpoint, {
          method: 'GET',
          signal: AbortSignal.timeout(15_000),
        });
        const dsText = await dsRes.text();
        let dsJson: unknown = [];
        try {
          dsJson = dsText ? JSON.parse(dsText) : [];
        } catch {
          dsJson = [];
        }
        if (!dsRes.ok) {
          if (isRetryableApifyStatus(dsRes.status) && attempt < maxAttempts - 1) {
            lastErr = new Error(`Apify dataset HTTP ${dsRes.status}`);
            await sleep(700 * (attempt + 1));
            continue;
          }
          throw new Error(`Apify dataset HTTP ${dsRes.status}: ${dsText.slice(0, 220)}`);
        }
        if (Array.isArray(dsJson)) return dsJson;
        if (dsJson && typeof dsJson === 'object') return [dsJson];
        return [];
      } catch (e: unknown) {
        lastErr = e;
        if (attempt >= maxAttempts - 1) break;
        await sleep(700 * (attempt + 1));
      }
    }

    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    throw new Error(`Apify dataset fetch failed (dataset ${datasetId}): ${msg}`);
  };
  let lastError = '';
  for (const actorId of actorCandidates) {
    try {
      /** Budget global (démarrage + polls + dataset). */
      const wallStart = Date.now();
      // Défaut 60s (aligné prod) ; scrapes boutique/listings lourds passent maxTotalWaitMs (ex. shop-scrape-service).
      const MAX_TOTAL_MS =
        options.maxTotalWaitMs != null
          ? Math.min(600_000, Math.max(60_000, options.maxTotalWaitMs))
          : 60_000;

      // 1) Lance le run de façon asynchrone
      const runStartEndpoint =
        `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs` +
        `?token=${encodeURIComponent(token)}` +
        `&memory=4096`;

      const startRes = await fetch(runStartEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(25_000),
      });
      const startText = await startRes.text();
      let startJson: unknown = null;
      try {
        startJson = startText ? JSON.parse(startText) : null;
      } catch {
        startJson = null;
      }

      if (!startRes.ok) {
        lastError = `Apify start HTTP ${startRes.status}: ${startText.slice(0, 220)}`;
        if (startRes.status === 404 && /record-not-found/i.test(startText)) continue;
        throw new Error(lastError);
      }

      const runData = (startJson as { data?: Record<string, unknown> } | null)?.data || {};
      const runId = typeof runData.id === 'string' ? runData.id : '';
      let datasetId = typeof runData.defaultDatasetId === 'string' ? runData.defaultDatasetId : '';
      if (!runId) {
        throw new Error('Apify: run id manquant au démarrage.');
      }

      const runStatusEndpoint =
        `${APIFY_BASE}/actor-runs/${encodeURIComponent(runId)}` +
        `?token=${encodeURIComponent(token)}`;

      const readRunStatus = async (): Promise<string> => {
        const maxAttempts = 3;
        let lastErr: unknown = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const runRes = await fetch(runStatusEndpoint, {
              method: 'GET',
              signal: AbortSignal.timeout(12_000),
            });
            const runText = await runRes.text();
            let runJson: unknown = null;
            try {
              runJson = runText ? JSON.parse(runText) : null;
            } catch {
              runJson = null;
            }
            if (!runRes.ok) {
              if (isRetryableApifyStatus(runRes.status) && attempt < maxAttempts - 1) {
                lastErr = new Error(`Apify run status HTTP ${runRes.status}`);
                await sleep(900 * (attempt + 1));
                continue;
              }
              throw new Error(`Apify run status HTTP ${runRes.status}: ${runText.slice(0, 220)}`);
            }

            const data = (runJson as { data?: Record<string, unknown> } | null)?.data || {};
            const status = typeof data.status === 'string' ? data.status : '';
            if (!datasetId && typeof data.defaultDatasetId === 'string') {
              datasetId = data.defaultDatasetId as string;
            }
            return status;
          } catch (e: unknown) {
            lastErr = e;
            if (attempt >= maxAttempts - 1) break;
            await sleep(900 * (attempt + 1));
          }
        }

        const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
        throw new Error(`Apify run status fetch failed (run ${runId}): ${msg}`);
      };

      // 2) Poll jusqu'à fin du run (évite les faux timeouts du sync endpoint)
      let finalStatus = '';
      while (Date.now() - wallStart < MAX_TOTAL_MS) {
        finalStatus = await readRunStatus();
        if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(finalStatus)) break;
        await sleep(1500);
      }

      if (!datasetId) {
        throw new Error(`Apify: dataset manquant pour run ${runId}.`);
      }

      // 3) Récupère les items du dataset.
      // Même si le run est encore RUNNING, certains items peuvent déjà être disponibles.
      let firstBatch = await fetchDatasetItems(datasetId);
      if (firstBatch.length > 0) return firstBatch;

      // Dataset pas encore peuplé : RUNNING long ou écriture retardée dans le dataset.
      while (Date.now() - wallStart < MAX_TOTAL_MS) {
        await sleep(2000);
        finalStatus = await readRunStatus();
        firstBatch = await fetchDatasetItems(datasetId);
        if (firstBatch.length > 0) return firstBatch;
        if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(finalStatus)) {
          throw new Error(`Apify run ${runId} terminé avec statut ${finalStatus}.`);
        }
      }

      if (finalStatus === 'RUNNING' || finalStatus === 'READY' || finalStatus === '') {
        throw new Error(`Apify run ${runId} toujours en cours et dataset vide (statut ${finalStatus || 'unknown'}).`);
      }

      if (finalStatus && finalStatus !== 'SUCCEEDED') {
        throw new Error(`Apify run ${runId} terminé avec statut ${finalStatus}.`);
      }
      if (finalStatus === 'SUCCEEDED' && firstBatch.length === 0) {
        throw new Error(`Apify run ${runId} terminé avec succès mais dataset vide.`);
      }
      return firstBatch;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      // on tente candidat suivant seulement pour actor introuvable
      if (/record-not-found|actor was not found/i.test(msg)) continue;
      throw new Error(msg);
    }
  }

  throw new Error(lastError || 'Apify actor introuvable');
}

export type ApifyMappedListing = {
  title: string | null;
  description: string | null;
  price: number;
  images: string[];
  tags: string[];
  sourceItem: Record<string, unknown>;
};

export function mapApifyItemToListing(item: unknown): ApifyMappedListing | null {
  if (!item || typeof item !== 'object') return null;
  const rec = item as Record<string, unknown>;

  const title = firstString(rec, ['title', 'name', 'productTitle', 'product_name', 'itemTitle']);
  const description = firstString(rec, ['description', 'productDescription', 'summary']);
  const image = firstImage(rec);

  const { amount: price } = extractListingPriceFromItem(item);

  const images = image ? [image] : [];
  const tags = extractListingTagsFromItem(item);

  return {
    title: title || null,
    description: description || title || null,
    price,
    images,
    tags,
    sourceItem: rec,
  };
}

export type { ScrapeTarget };
