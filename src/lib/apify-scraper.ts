type ScrapeTarget = 'listing' | 'shop';

const APIFY_BASE = 'https://api.apify.com/v2';
const DEFAULT_ETSY_LISTING_ACTOR = 'epctex~etsy-scraper';

type ApifyRunOptions = {
  timeoutSecs?: number;
  maxItems?: number;
  actorIdOverride?: string;
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
  return parseActorId(process.env.APIFY_ACTOR_SHOP_ID) || null;
}

function getActorCandidates(target: ScrapeTarget, override?: string): string[] {
  const candidates = [
    parseActorId(override),
    target === 'listing' ? DEFAULT_ETSY_LISTING_ACTOR : null,
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

function defaultTimeoutSecs(): number {
  const raw = process.env.APIFY_TIMEOUT_SECS;
  const n = Number.parseInt(raw || '', 10);
  if (Number.isFinite(n) && n >= 10 && n <= 180) return n;
  return 45;
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

  const timeoutSecs = options.timeoutSecs ?? defaultTimeoutSecs();
  const maxItems = options.maxItems ?? 5;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const fetchDatasetItems = async (datasetId: string): Promise<unknown[]> => {
    const datasetEndpoint =
      `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items` +
      `?token=${encodeURIComponent(token)}` +
      `&clean=true&format=json&limit=${encodeURIComponent(String(maxItems))}`;
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
      throw new Error(`Apify dataset HTTP ${dsRes.status}: ${dsText.slice(0, 220)}`);
    }
    if (Array.isArray(dsJson)) return dsJson;
    if (dsJson && typeof dsJson === 'object') return [dsJson];
    return [];
  };
  let lastError = '';
  for (const actorId of actorCandidates) {
    try {
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

      // 2) Poll jusqu'à fin du run (évite les faux timeouts du sync endpoint)
      const deadline = Date.now() + Math.max(timeoutSecs, 70) * 1000;
      let finalStatus = '';
      while (Date.now() < deadline) {
        const runStatusEndpoint =
          `${APIFY_BASE}/actor-runs/${encodeURIComponent(runId)}` +
          `?token=${encodeURIComponent(token)}`;
        const runRes = await fetch(runStatusEndpoint, {
          method: 'GET',
          signal: AbortSignal.timeout(10_000),
        });
        const runText = await runRes.text();
        let runJson: unknown = null;
        try {
          runJson = runText ? JSON.parse(runText) : null;
        } catch {
          runJson = null;
        }
        if (!runRes.ok) {
          throw new Error(`Apify run status HTTP ${runRes.status}: ${runText.slice(0, 220)}`);
        }

        const data = (runJson as { data?: Record<string, unknown> } | null)?.data || {};
        finalStatus = typeof data.status === 'string' ? data.status : '';
        if (!datasetId && typeof data.defaultDatasetId === 'string') datasetId = data.defaultDatasetId;

        if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(finalStatus)) break;
        await sleep(2000);
      }

      if (!datasetId) {
        throw new Error(`Apify: dataset manquant pour run ${runId}.`);
      }

      // 3) Récupère les items du dataset.
      // Même si le run est encore RUNNING, certains items peuvent déjà être disponibles.
      const firstBatch = await fetchDatasetItems(datasetId);
      if (firstBatch.length > 0) return firstBatch;

      // Si run encore en cours mais dataset vide, on attend un peu plus avant d'échouer.
      if (finalStatus === 'RUNNING' || finalStatus === 'READY' || finalStatus === '') {
        const extraDeadline = Date.now() + 45_000;
        while (Date.now() < extraDeadline) {
          await sleep(3000);
          const batch = await fetchDatasetItems(datasetId);
          if (batch.length > 0) return batch;
        }
        throw new Error(`Apify run ${runId} toujours en cours et dataset vide (statut ${finalStatus || 'unknown'}).`);
      }

      if (finalStatus && finalStatus !== 'SUCCEEDED') {
        throw new Error(`Apify run ${runId} terminé avec statut ${finalStatus}.`);
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

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 20);
}

function tagsFromUnknown(value: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === 'string' && v.trim()) out.push(normalizeTag(v));
      else if (v && typeof v === 'object') {
        const rec = v as Record<string, unknown>;
        const s = rec.tag || rec.name || rec.keyword || rec.value;
        if (typeof s === 'string' && s.trim()) out.push(normalizeTag(s));
      }
    }
  } else if (typeof value === 'string' && value.trim()) {
    for (const p of value.split(/[,\n|]/g)) {
      if (p.trim()) out.push(normalizeTag(p));
    }
  }
  return [...new Set(out)].filter((t) => t.length >= 2).slice(0, 13);
}

function generateTagsFromTitle(title: string | null): string[] {
  if (!title) return [];
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && w.length <= 20);
  const uniq = [...new Set(words)];
  return uniq.slice(0, 13);
}

export function mapApifyItemToListing(item: unknown): ApifyMappedListing | null {
  if (!item || typeof item !== 'object') return null;
  const rec = item as Record<string, unknown>;

  const title = firstString(rec, ['title', 'name', 'productTitle', 'product_name', 'itemTitle']);
  const description = firstString(rec, ['description', 'productDescription', 'summary']);
  const image = firstImage(rec);

  let price = 0;
  for (const key of ['price', 'productPrice', 'salePrice', 'minPrice', 'maxPrice']) {
    price = extractNumericPrice(rec[key]);
    if (price > 0) break;
  }

  const images = image ? [image] : [];
  let tags: string[] = [];

  for (const key of [
    'tags',
    'tag',
    'keywords',
    'keyword',
    'searchKeywords',
    'search_terms',
    'seoTags',
    'listingTags',
    'materials',
    'attributes',
  ]) {
    const fromKey = tagsFromUnknown(rec[key]);
    if (fromKey.length > 0) {
      tags = fromKey;
      break;
    }
  }

  if (tags.length === 0) {
    tags = generateTagsFromTitle(title);
  }

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
