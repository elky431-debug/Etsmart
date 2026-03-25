/**
 * Analyse keywords : autosuggest Etsy (sans clé) + listings via Apify (epctex~etsy-scraper) + GPT-4o mini.
 */

import { runApifyActorByTarget, mapApifyItemToListing } from '@/lib/apify-scraper';

/** Acteur Etsy Search documenté côté Apify (epctex / etsy-scraper). */
const ETSY_SCRAPER_ACTOR = 'epctex~etsy-scraper';

const ETSY_OPENAPI_PING = 'https://api.etsy.com/v3';

export type RelatedTagScores = {
  tag: string;
  demandScore: number;
  competitionScore: number;
  globalScore: number;
};

export type TrendDirection = 'up' | 'stable' | 'down';

export type TopListing = {
  title: string;
  url: string | null;
  image: string | null;
  price: number | null;
  sellerRating: number | null;
  reviews: number | null;
};

export type SimilarKeywordRow = {
  keyword: string;
  totalListings: number;
  avgFavorites: number;
  competitionScore: number;
  demandScore: number;
  globalScore: number;
  conversionRate: number;
  trendDirection: TrendDirection;
};

export type KeywordAnalysisPayload = {
  keyword: string;
  metrics: {
    competitionScore: number;
    demandScore: number;
    globalScore: number;
    totalListings: number;
    avgFavorites: number;
    prices: {
      min: string;
      bargain: string;
      midrange: string;
      premium: string;
      max: string;
    };
  };
  suggestions: string[];
  relatedTags: RelatedTagScores[];
  /** Similar keywords façon Alura (avec métriques light). */
  similarKeywords?: SimilarKeywordRow[];
  /**
   * Anciennement rempli par OpenAI.
   * Conservé optionnel pour compatibilité (UI n'en dépend plus).
   */
  analysis?: {
    verdict: string;
    verdictColor: string;
    explanation: string;
    prixConseil: string;
    opportunite: string;
  };
  sampleTitles: string[];
  topListings?: TopListing[];
  conversionRate?: number;
  trendDirection?: TrendDirection;
};

export function competitionScoreFromTotalListings(totalListings: number): number {
  if (totalListings < 5000) return 20;
  if (totalListings < 20000) return 40;
  if (totalListings < 50000) return 60;
  if (totalListings < 100000) return 80;
  return 95;
}

/** Mêmes seuils que l’ancienne métrique « favoris » ; ici alimenté par `seller.numberOfReviews` (Apify). */
export function demandScoreFromAvgReviews(avgReviews: number): number {
  if (avgReviews > 500) return 90;
  if (avgReviews > 200) return 70;
  if (avgReviews > 50) return 50;
  if (avgReviews > 10) return 30;
  return 15;
}

export function demandScoreFromAvgFavorites(avgFavorites: number): number {
  return demandScoreFromAvgReviews(avgFavorites);
}

export function globalScoreFrom(competitionScore: number, demandScore: number): number {
  return Math.round(demandScore * 0.6 + (100 - competitionScore) * 0.4);
}

type NormalizedScrapedListing = {
  title: string;
  price: number;
  reviews: number;
};

function firstNumber(input: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = input[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number.parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function firstUrl(input: Record<string, unknown>): string | null {
  for (const key of ['url', 'listingUrl', 'productUrl', 'itemUrl', 'etsyUrl']) {
    const v = input[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function extractListingCreatedAtMs(input: Record<string, unknown>): number | null {
  const raw =
    input.createdAt ??
    input.created_at ??
    input.dateCreated ??
    input.date_created ??
    input.listingCreatedAt ??
    input.listing_created_at ??
    null;
  if (!raw) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 10_000_000_000 ? raw : raw * 1000;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'string' && raw.trim()) {
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function extractTotalListingsFromRaw(rawItems: unknown[]): number {
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    for (const key of [
      'totalSearchResults',
      'searchResultsCount',
      'totalResults',
      'totalListings',
      'resultCount',
      'total',
      'pagination',
    ]) {
      const v =
        key === 'pagination'
          ? (rec[key] as Record<string, unknown> | undefined)?.totalResults
          : rec[key];
      if (typeof v === 'number' && v > 0) return v;
      if (typeof v === 'string') {
        const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
        if (n > 0) return n;
      }
    }
  }
  return 0;
}

function trendFromRawItems(rawItems: unknown[]): TrendDirection {
  const dates: number[] = [];
  for (const it of rawItems) {
    if (!it || typeof it !== 'object') continue;
    const rec = it as Record<string, unknown>;
    const t = extractListingCreatedAtMs(rec);
    if (t) dates.push(t);
  }
  if (dates.length < 3) return 'stable';
  const avg = dates.reduce((a, b) => a + b, 0) / dates.length;
  const ageDays = (Date.now() - avg) / (24 * 3600 * 1000);
  if (ageDays < 120) return 'up';
  if (ageDays > 365) return 'down';
  return 'stable';
}

function conversionRateFromListings(listings: NormalizedScrapedListing[], totalListings: number): number {
  if (!totalListings) return 0;
  const withReviews = listings.filter((l) => l.reviews > 0).length;
  return Math.round((withReviews / totalListings) * 1000) / 10;
}

function extractTopListings(rawItems: unknown[], max: number): TopListing[] {
  const out: TopListing[] = [];
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const mapped = mapApifyItemToListing(item);
    const title = listingTitleFromApify(rec) || mapped?.title || 'Listing';
    const url = firstUrl(rec);
    const image =
      (mapped?.images && mapped.images.length ? mapped.images[0] : null) ||
      (typeof rec.image === 'string' ? rec.image : null);
    const price = mapped && mapped.price > 0 ? mapped.price : null;
    const reviews = sellerNumberOfReviews(rec) || null;
    const sellerRating =
      firstNumber(rec, ['rating', 'shopRating', 'sellerRating', 'stars', 'averageRating']) ?? null;
    out.push({ title, url, image, price, sellerRating, reviews });
    if (out.length >= max) break;
  }
  return out;
}

function listingTitleFromApify(rec: Record<string, unknown>): string {
  if (typeof rec.name === 'string' && rec.name.trim()) return rec.name.trim();
  if (typeof rec.title === 'string' && rec.title.trim()) return rec.title.trim();
  return '';
}

function sellerNumberOfReviews(rec: Record<string, unknown>): number {
  const seller = rec.seller;
  if (!seller || typeof seller !== 'object') return 0;
  const n = (seller as Record<string, unknown>).numberOfReviews;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
}

function listingDemandSignal(rec: Record<string, unknown>): number {
  // Priorité : favoris listing > reviews listing > reviews seller
  for (const key of ['favoriteCount', 'favorites', 'numFavorers', 'favorers', 'wishlistCount']) {
    const v = rec[key];
    if (typeof v === 'number' && v >= 0) return v;
  }
  for (const key of ['numberOfReviews', 'reviewCount', 'reviewsCount']) {
    const v = rec[key];
    if (typeof v === 'number' && v >= 0) return v;
  }
  // Fallback : seller reviews (signal moins représentatif)
  return sellerNumberOfReviews(rec);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx]!;
}

function fmt(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0.00';
  return n.toFixed(2);
}

/**
 * epctex/etsy-scraper exige un objet `proxy` (doc Apify).
 * Par défaut : Apify Proxy résidentiel. Surcharge possible :
 * - `APIFY_ETSY_PROXY_JSON` = JSON complet du bloc proxy
 * - ou `APIFY_ETSY_PROXY_GROUPS` = ex. `RESIDENTIAL` ou `DATACENTER,RESIDENTIAL` (séparés par des virgules)
 */
export function buildEtsyScraperProxyInput(): Record<string, unknown> {
  const raw = process.env.APIFY_ETSY_PROXY_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore invalid JSON */
    }
  }
  const groupsRaw = process.env.APIFY_ETSY_PROXY_GROUPS?.trim();
  const groups = groupsRaw
    ? groupsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['RESIDENTIAL'];
  return {
    useApifyProxy: true,
    apifyProxyGroups: groups.length ? groups : ['RESIDENTIAL'],
  };
}

function buildEtsyScraperRunInput(keyword: string, maxItems: number): Record<string, unknown> {
  return {
    search: keyword,
    maxItems,
    proxy: buildEtsyScraperProxyInput(),
  };
}

/**
 * Test keystring:secret (utilisé par `/api/keywords/etsy-ping` uniquement).
 */
export async function pingEtsyOpenApi(etsyXApiKey: string): Promise<{
  ok: boolean;
  application_id?: number;
  status: number;
  errorMessage: string;
}> {
  const url = `${ETSY_OPENAPI_PING}/application/openapi-ping`;
  const res = await fetch(url, {
    headers: { 'x-api-key': etsyXApiKey, Accept: 'application/json' },
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { ok: false, status: res.status, errorMessage: text.slice(0, 200) };
  }
  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data).slice(0, 200);
    return { ok: false, status: res.status, errorMessage: msg };
  }
  const application_id = typeof data.application_id === 'number' ? data.application_id : undefined;
  return { ok: true, status: res.status, application_id, errorMessage: '' };
}

export async function fetchEtsySearchSuggestions(keyword: string): Promise<string[]> {
  const params = new URLSearchParams({ q: keyword, limit: '10' });
  const url = `https://www.etsy.com/api/v3/ajax/bespoke/member/neu/specs/async/search-suggestions?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      Referer: 'https://www.etsy.com/',
      Origin: 'https://www.etsy.com',
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    return [];
  }
  const root = json as Record<string, unknown>;
  const data = (root.data as Record<string, unknown>) || root;
  const output = (data.output as Record<string, unknown>) || {};
  const results = Array.isArray(output.results) ? output.results : [];
  const queries: string[] = [];
  for (const r of results) {
    if (r && typeof r === 'object' && 'query' in r && typeof (r as { query: unknown }).query === 'string') {
      const q = ((r as { query: string }).query || '').trim();
      if (q) queries.push(q);
    }
  }
  return [...new Set(queries)].slice(0, 10);
}

const TITLE_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'your',
  'our',
  'are',
  'was',
  'not',
  'but',
  'all',
  'can',
  'has',
  'have',
  'voir',
  'avec',
  'dans',
  'pour',
  'une',
  'des',
  'les',
  'aux',
  'home',
  'decor',
  'gift',
  'handmade',
  'free',
  'shipping',
  'new',
  'sale',
  'size',
  'inch',
  'cm',
  'xl',
  'large',
  'small',
]);

/**
 * Si l’autosuggest Etsy renvoie vide (IP serveur, anti-bot), on dérive des requêtes de recherche
 * depuis les mots les plus fréquents des titres scrapés.
 */
function extractFallbackSearchTags(
  keyword: string,
  listings: NormalizedScrapedListing[],
  max: number,
  already: Set<string>
): string[] {
  const kw = keyword.toLowerCase().trim();
  const counts = new Map<string, number>();
  for (const { title } of listings) {
    const words = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    for (const w of words) {
      if (TITLE_STOPWORDS.has(w) || w === kw || already.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .filter((w) => !already.has(w))
    .slice(0, max);
}

function buildTagsToScore(
  suggestions: string[],
  keyword: string,
  listings: NormalizedScrapedListing[],
  max: number
): string[] {
  const trimmed = suggestions.map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of trimmed) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) return out;
  }
  if (out.length < max && listings.length > 0) {
    const need = max - out.length;
    const fallback = extractFallbackSearchTags(keyword, listings, need + 4, seen);
    for (const t of fallback) {
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= max) break;
    }
  }
  return out.slice(0, max);
}

async function fetchApifyEtsySearchListings(keyword: string, maxItems: number): Promise<NormalizedScrapedListing[]> {
  let rawItems: unknown[];
  try {
    rawItems = await runApifyActorByTarget(
      'listing',
      buildEtsyScraperRunInput(keyword, maxItems),
      {
        maxItems,
        actorIdOverride: ETSY_SCRAPER_ACTOR,
      }
    );
  } catch (e) {
    // Fast-mode : on dégrade gracieusement si Apify échoue/timeout (sinon tout le job passe en error).
    // On log pour debugging côté serveur.
    console.error('[etsy-keyword-analytics] Apify listings failed', e);
    return [];
  }
  const out: NormalizedScrapedListing[] = [];
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const mapped = mapApifyItemToListing(item);
    const title = listingTitleFromApify(rec) || (mapped?.title ?? '');
    const price = mapped && mapped.price > 0 ? mapped.price : 0;
    const reviews = listingDemandSignal(rec);
    if (title || price > 0 || reviews > 0) {
      out.push({ title: title || 'Listing', price, reviews });
    }
  }
  return out;
}

async function fetchApifyEtsySearchRaw(keyword: string, maxItems: number): Promise<unknown[]> {
  try {
    return await runApifyActorByTarget('listing', buildEtsyScraperRunInput(keyword, maxItems), {
      maxItems,
      actorIdOverride: ETSY_SCRAPER_ACTOR,
    });
  } catch (e) {
    console.error('[etsy-keyword-analytics] Apify raw failed', e);
    return [];
  }
}

function buildMetricsFromScrapedListings(
  listings: NormalizedScrapedListing[],
  totalListings: number
): KeywordAnalysisPayload['metrics'] {
  const prices = listings.map((l) => l.price).filter((p) => p > 0 && Number.isFinite(p));
  const sorted = [...prices].sort((a, b) => a - b);
  const minPrice = sorted.length ? sorted[0]! : 0;
  const maxPrice = sorted.length ? sorted[sorted.length - 1]! : 0;
  const bargainPrice = percentile(sorted, 0.25) || minPrice;
  const midrangePrice =
    percentile(sorted, 0.5) || (sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0);
  const premiumPrice = percentile(sorted, 0.75) || maxPrice;

  const avgReviews = listings.length
    ? listings.reduce((a, l) => a + l.reviews, 0) / listings.length
    : 0;

  const competitionScore = competitionScoreFromTotalListings(totalListings);
  const demandScore = demandScoreFromAvgReviews(avgReviews);
  const globalScore = globalScoreFrom(competitionScore, demandScore);

  return {
    competitionScore,
    demandScore,
    globalScore,
    totalListings,
    avgFavorites: Math.round(avgReviews),
    prices: {
      min: fmt(minPrice),
      bargain: fmt(bargainPrice),
      midrange: fmt(midrangePrice),
      premium: fmt(premiumPrice),
      max: fmt(maxPrice),
    },
  };
}

async function analyzeRelatedTagApify(tag: string, maxItems: number): Promise<RelatedTagScores> {
  const norm = await fetchApifyEtsySearchListings(tag, maxItems);
  const tagTotal = norm.length;
  const avgRev = norm.length ? norm.reduce((a, n) => a + n.reviews, 0) / norm.length : 0;
  const tagCompetition = competitionScoreFromTotalListings(tagTotal);
  const tagDemand = demandScoreFromAvgReviews(avgRev);
  const tagScore = globalScoreFrom(tagCompetition, tagDemand);
  return {
    tag,
    demandScore: tagDemand,
    competitionScore: tagCompetition,
    globalScore: tagScore,
  };
}

async function generateLongTailKeywordsWithOpenAi(
  keyword: string,
  titles: string[],
  openaiApiKey: string
): Promise<string[]> {
  const titlesText = titles.slice(0, 20).join(' | ').slice(0, 2500);
  const prompt =
    `Génère 10 keywords Etsy long-tail similaires à "${keyword}".\n` +
    `Basé sur ces titres de listings réels : ${titlesText}\n` +
    `Réponds en JSON : { "keywords": string[] }`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 220,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const raw = await res.text();
    if (!res.ok) return [];
    const parsed = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const content = parsed.choices?.[0]?.message?.content?.trim() || '';
    const obj = content ? (JSON.parse(content) as { keywords?: unknown }) : {};
    const arr = Array.isArray(obj.keywords) ? obj.keywords : [];
    const out = arr.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean);
    return [...new Set(out)].slice(0, 10);
  } catch {
    return [];
  }
}

function buildTitleDerivedLongTail(keyword: string, listings: NormalizedScrapedListing[]): string[] {
  const base = keyword.toLowerCase().trim();
  const seen = new Set<string>([base]);
  const words = extractFallbackSearchTags(keyword, listings, 12, seen);
  const out: string[] = [];
  for (const w of words) {
    const k = `${base} ${w}`.trim();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= 10) break;
  }
  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  let idx = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      const v = await fn(items[i]!);
      out[i] = v;
    }
  });
  await Promise.all(workers);
  return out;
}

async function analyzeKeywordLight(keyword: string): Promise<SimilarKeywordRow> {
  // Pas d'Apify — scoring heuristique basé sur la structure du keyword.
  const words = keyword.trim().split(/\s+/).length;
  const hasModifier = /\b(personalized|custom|handmade|vintage|gift|for|with|wooden|leather)\b/i.test(keyword);

  // Long-tail = moins de concurrence, demande plus ciblée.
  const competitionScore = words >= 3 ? 25 : words === 2 ? 45 : 70;
  const demandScore = hasModifier ? 55 : words >= 3 ? 40 : 60;
  const globalScore = globalScoreFrom(competitionScore, demandScore);
  return {
    keyword,
    totalListings: 0,
    avgFavorites: 0,
    competitionScore,
    demandScore,
    globalScore,
    conversionRate: 0,
    trendDirection: 'stable',
  };
}

export async function runFullKeywordAnalysisPipeline(
  keyword: string,
  env: {
    openaiApiKey?: string | null;
    mainMaxItems?: number;
    relatedMaxItems?: number;
    /** Limite les runs Apify parallèles (tags) — gros impact durée / coût. */
    maxRelatedTags?: number;
  }
): Promise<KeywordAnalysisPayload> {
  const mainMax = env.mainMaxItems ?? 24;
  const relatedMax = env.relatedMaxItems ?? 12;
  const maxRelatedTags = Math.min(8, Math.max(0, env.maxRelatedTags ?? 4));

  const [rawMain, normalizedMain, suggestions] = await Promise.all([
    fetchApifyEtsySearchRaw(keyword, mainMax),
    fetchApifyEtsySearchListings(keyword, mainMax),
    fetchEtsySearchSuggestions(keyword),
  ]);

  const scrapedCount = normalizedMain.length;
  const totalListings = extractTotalListingsFromRaw(rawMain) || scrapedCount;
  const metrics = buildMetricsFromScrapedListings(normalizedMain, totalListings);
  const sampleTitles = normalizedMain.map((n) => n.title).filter(Boolean).slice(0, 15);
  const topListings = extractTopListings(rawMain, 6);
  const conversionRate = conversionRateFromListings(normalizedMain, totalListings);
  const trendDirection = trendFromRawItems(rawMain);

  const titlesPreview = normalizedMain
    .slice(0, 8)
    .map((n) => n.title)
    .filter(Boolean)
    .join(' | ');

  const tagsToScore = buildTagsToScore(suggestions, keyword, normalizedMain, maxRelatedTags);
  const relatedTags = tagsToScore.length
    ? await Promise.allSettled(tagsToScore.map((tag) => analyzeRelatedTagApify(tag, relatedMax))).then((rows) => {
        const ok = rows
          .filter((r): r is PromiseFulfilledResult<RelatedTagScores> => r.status === 'fulfilled')
          .map((r) => r.value);
        ok.sort((a, b) => b.globalScore - a.globalScore);
        return ok;
      })
    : [];

  const titleLongTail = buildTitleDerivedLongTail(keyword, normalizedMain);
  const gptLongTail = env.openaiApiKey
    ? await generateLongTailKeywordsWithOpenAi(keyword, sampleTitles, env.openaiApiKey)
    : [];
  const seed = [...suggestions, ...titleLongTail, ...gptLongTail].map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>([keyword.toLowerCase().trim()]);
  const similarSeeds: string[] = [];
  for (const s of seed) {
    const k = s.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    similarSeeds.push(s);
    if (similarSeeds.length >= 20) break;
  }

  const similarKeywords = similarSeeds.length
    ? await mapWithConcurrency(similarSeeds, 5, analyzeKeywordLight).then((rows) =>
        rows
          .filter(Boolean)
          .sort((a, b) => b.globalScore - a.globalScore)
          .slice(0, 20)
      )
    : [];

  return {
    keyword,
    metrics,
    suggestions,
    relatedTags,
    similarKeywords,
    sampleTitles,
    topListings,
    conversionRate,
    trendDirection,
  };
}
