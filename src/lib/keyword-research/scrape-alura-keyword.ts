/**
 * Keyword Research Alura via ScraperAPI (scraping / proxy).
 * Plus besoin de coller un Bearer toutes les heures : utilise ALURA_COOKIE (en-tête Cookie
 * complet copié depuis l’onglet Réseau → une requête vers app.alura.io ou alura-api).
 *
 * Variables :
 * - SCRAPER_API_KEY (obligatoire)
 * - ALURA_COOKIE (recommandé) — tout l’en-tête Cookie d’une requête authentifiée
 * - ALURA_BEARER_TOKEN (optionnel) — combiné au cookie si l’API l’exige encore
 *
 * Ordre : proxy API (premium → ultra_premium) puis page keyword-finder-prod rendue (JS).
 */

import type { AluraOverviewMetrics, AluraVolumeMonth, EtsyKeywordListing } from './types';

const ALURA_API_BASE = 'https://alura-api-3yk57ena2a-uc.a.run.app/api';
const SCRAPER_BASE = 'https://api.scraperapi.com';

export class AluraKeywordResearchError extends Error {
  constructor(
    message: string,
    public readonly code: 'CONFIG' | 'AUTH' | 'HTTP' | 'PARSE' | 'EMPTY'
  ) {
    super(message);
    this.name = 'AluraKeywordResearchError';
  }
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function emptyAluraOverview(): AluraOverviewMetrics {
  return {
    keywordScore: null,
    etsyVolumeMonthly: null,
    googleVolumeMonthly: null,
    competingListings: null,
    avgConversionRate: null,
    competitionLevel: null,
    competitionGoogle: null,
    searchCompetitionRatio: null,
    viewsTopListings: null,
    avgViewsPerListing: null,
    avgFavorers: null,
    salesTotal: null,
    avgSalesPerListing: null,
    revenueTotal: null,
    avgRevenuePerListing: null,
    avgPriceUsd: null,
    avgListingAgeDays: null,
    avgReviewCount: null,
    avgReviewScore: null,
    etsyChangeQr: null,
    etsyChangeYr: null,
    googleChangeQr: null,
    googleChangeYr: null,
    longTailKeyword: null,
    etsyVolumes: [],
    googleVolumes: [],
    listingsAnalyzed: 100,
  };
}

function parseVolumeMonth(x: unknown): AluraVolumeMonth | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const y = str(o.year);
  const m = str(o.month);
  const ms = str(o.monthlySearches);
  if (!y || !m || !ms) return null;
  return { year: y, month: m, monthlySearches: ms };
}

function tryParseJsonObjectAt(html: string, startBrace: number): Record<string, unknown> | null {
  if (html[startBrace] !== '{') return null;
  let depth = 0;
  for (let k = startBrace; k < html.length; k++) {
    const c = html[k];
    if (c === '"' && (k === 0 || html[k - 1] !== '\\')) {
      k++;
      while (k < html.length) {
        if (html[k] === '\\') {
          k += 2;
          continue;
        }
        if (html[k] === '"') break;
        k++;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          const o = JSON.parse(html.slice(startBrace, k + 1)) as Record<string, unknown>;
          if (num(o.etsy_volume_mo) != null || num(o.keyword_score) != null) return o;
        } catch {
          /* ignore */
        }
        return null;
      }
    }
  }
  return null;
}

/** Réponse API embarquée dans le HTML (plusieurs formats possibles). */
function parseEmbeddedAluraApiResponse(html: string): Record<string, unknown> | null {
  const patterns = [
    /"status"\s*:\s*"success"/g,
    /"status"\s*:\s*'success'/g,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const hit = m.index;
      let i = hit;
      while (i > 0 && html[i] !== '{') i--;
      if (html[i] !== '{') continue;
      try {
        const root = JSON.parse(html.slice(i, findMatchingBraceEnd(html, i) + 1)) as Record<
          string,
          unknown
        >;
        if (root.results && typeof root.results === 'object' && !Array.isArray(root.results)) {
          const r = root.results as Record<string, unknown>;
          if (num(r.etsy_volume_mo) != null || num(r.keyword_score) != null) return r;
        }
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

function findMatchingBraceEnd(html: string, start: number): number {
  let depth = 0;
  for (let k = start; k < html.length; k++) {
    const c = html[k];
    if (c === '"' && (k === 0 || html[k - 1] !== '\\')) {
      k++;
      while (k < html.length) {
        if (html[k] === '\\') {
          k += 2;
          continue;
        }
        if (html[k] === '"') break;
        k++;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return k;
    }
  }
  return start;
}

/** Extrait l’objet `results` depuis le HTML (hydratation / chunks JS / payload API). */
function parseResultsObjectFromHtml(html: string): Record<string, unknown> | null {
  const embedded = parseEmbeddedAluraApiResponse(html);
  if (embedded) return embedded;

  const needles = ['"results"', "'results'"];
  for (const needle of needles) {
    let from = 0;
    while (from < html.length) {
      const idx = html.indexOf(needle, from);
      if (idx === -1) break;
      let j = idx + needle.length;
      while (j < html.length && /[\s:=]/.test(html[j])) j++;
      if (html[j] !== '{') {
        from = idx + 1;
        continue;
      }
      const o = tryParseJsonObjectAt(html, j);
      if (o) return o;
      from = idx + needle.length;
    }
  }

  const volIdx = html.indexOf('"etsy_volume_mo"');
  if (volIdx !== -1) {
    for (let back = volIdx; back >= Math.max(0, volIdx - 800_000); back--) {
      if (html[back] === '{') {
        const o = tryParseJsonObjectAt(html, back);
        if (o) return o;
      }
    }
  }
  return null;
}

function extractOverviewFromResults(r: Record<string, unknown>): AluraOverviewMetrics {
  const ap = r.avg_prices;
  let usd: number | null = null;
  if (ap && typeof ap === 'object' && ap !== null) {
    usd = num((ap as Record<string, unknown>).USD);
  }
  const ev = Array.isArray(r.etsy_volumes)
    ? (r.etsy_volumes as unknown[]).map(parseVolumeMonth).filter(Boolean) as AluraVolumeMonth[]
    : [];
  const gv = Array.isArray(r.google_volumes)
    ? (r.google_volumes as unknown[]).map(parseVolumeMonth).filter(Boolean) as AluraVolumeMonth[]
    : [];
  return {
    keywordScore: num(r.keyword_score),
    etsyVolumeMonthly: num(r.etsy_volume_mo),
    googleVolumeMonthly: num(r.google_volume_mo),
    competingListings: num(r.competing_listings),
    avgConversionRate: num(r.avg_conversion_rate),
    competitionLevel: str(r.competition_level),
    competitionGoogle: str(r.competition_google),
    searchCompetitionRatio: str(r.search_competition_ratio),
    viewsTopListings: num(r.views),
    avgViewsPerListing: num(r.avg_views),
    avgFavorers: num(r.avg_num_favorers),
    salesTotal: num(r.sales),
    avgSalesPerListing: num(r.avg_sales),
    revenueTotal: num(r.revenue),
    avgRevenuePerListing: num(r.avg_revenue),
    avgPriceUsd: usd,
    avgListingAgeDays: num(r.avg_listing_age),
    avgReviewCount: num(r.avg_review_count),
    avgReviewScore: num(r.avg_review_score),
    etsyChangeQr: str(r.etsy_change_qr),
    etsyChangeYr: str(r.etsy_change_yr),
    googleChangeQr: str(r.google_change_qr),
    googleChangeYr: str(r.google_change_yr),
    longTailKeyword: r.long_tail_keyword === true,
    etsyVolumes: ev,
    googleVolumes: gv,
    listingsAnalyzed: 100,
  };
}

function extractOverview(json: unknown): AluraOverviewMetrics {
  if (json && typeof json === 'object') {
    const j = json as Record<string, unknown>;
    if (j.status === 'success' && j.results && typeof j.results === 'object') {
      return extractOverviewFromResults(j.results as Record<string, unknown>);
    }
  }
  return emptyAluraOverview();
}

function findOverviewObject(root: unknown): Record<string, unknown> | null {
  if (!root || typeof root !== 'object') return null;
  const seen = new WeakSet<object>();
  const stack: object[] = [root as object];
  while (stack.length) {
    const cur = stack.pop() as Record<string, unknown>;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (num(cur.etsy_volume_mo) != null || num(cur.keyword_score) != null) return cur;
    for (const v of Object.values(cur)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) stack.push(v as object);
    }
  }
  return null;
}

function findListingsArray(root: unknown): Record<string, unknown>[] {
  if (!root || typeof root !== 'object') return [];
  const r = root as Record<string, unknown>;
  for (const key of ['listings', 'results', 'data']) {
    const arr = r[key];
    if (Array.isArray(arr) && arr.length && typeof arr[0] === 'object') {
      const first = arr[0] as Record<string, unknown>;
      if (str(first.title) || str(first.listing_title)) return arr as Record<string, unknown>[];
    }
  }
  const seen = new WeakSet<object>();
  const stack: object[] = [root as object];
  while (stack.length) {
    const cur = stack.pop() as Record<string, unknown>;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const v of Object.values(cur)) {
      if (!Array.isArray(v) || !v[0] || typeof v[0] !== 'object') continue;
      const row = v[0] as Record<string, unknown>;
      if (
        str(row.title) &&
        (num(row.price) != null || str(row.listing_id))
      ) {
        return v as Record<string, unknown>[];
      }
    }
    for (const v of Object.values(cur)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) stack.push(v as object);
    }
  }
  return [];
}

function mapAluraListing(raw: Record<string, unknown>, rank: number): EtsyKeywordListing | null {
  const title =
    str(raw.title) || str(raw.listing_title) || str(raw.name) || str(raw.product_title);
  if (!title) return null;
  const listingId =
    str(raw.listing_id) || str(raw.id) || str(raw.etsy_listing_id) || `alura-${rank}`;
  let listingUrl =
    str(raw.url) || str(raw.listing_url) || str(raw.etsy_url) || str(raw.link) || '';
  if (listingUrl && !listingUrl.startsWith('http')) {
    listingUrl = listingUrl.startsWith('/') ? `https://www.etsy.com${listingUrl}` : '';
  }
  const price = num(raw.price) ?? num(raw.price_usd) ?? num(raw.product_price);
  const monthlySales =
    num(raw.monthly_sales) ?? num(raw.est_monthly_sales) ?? num(raw.sales_per_month);
  const totalSales = num(raw.total_sales) ?? num(raw.est_sales);
  const views = num(raw.views) ?? num(raw.listing_views);
  const rating = num(raw.rating) ?? num(raw.avg_rating) ?? num(raw.review_score);
  const reviewCount =
    num(raw.review_count) ?? num(raw.num_reviews) ?? monthlySales ?? totalSales ?? views;
  const shopName =
    str(raw.shop_name) || str(raw.shop_title) || str(raw.seller_name) || str(raw.shop);
  const imageUrl =
    str(raw.image_url) ||
    str(raw.image) ||
    str(raw.thumbnail) ||
    (Array.isArray(raw.images) ? str((raw.images as unknown[])[0]) : null);
  return {
    id: listingId,
    rank,
    title,
    listingUrl:
      listingUrl || `https://www.etsy.com/search?q=${encodeURIComponent(title.slice(0, 40))}`,
    imageUrl,
    price,
    currency: price != null ? 'USD' : null,
    reviewCount,
    rating,
    shopName,
    isBestSeller: false,
    hasFreeShipping: false,
    aluraMonthlySales: monthlySales ?? undefined,
    aluraViews: views ?? undefined,
    aluraFavorites: undefined,
  };
}

function isScraperErrorBody(t: string): boolean {
  return (
    /not be charged|premium=true|ultra_premium|Protected domains|scraperapi\.com/i.test(t) &&
    !t.trim().startsWith('{')
  );
}

async function fetchThroughScraper(
  targetUrl: string,
  scraperKey: string,
  forwardHeaders: Record<string, string>,
  extraParams: Record<string, string>[],
  requireJson = false
): Promise<{ ok: boolean; text: string; status: number }> {
  let lastSnippet = '';
  for (const extra of extraParams) {
    const q = new URLSearchParams({
      api_key: scraperKey,
      url: targetUrl,
      keep_headers: 'true',
      ...extra,
    });
    const res = await fetch(`${SCRAPER_BASE}?${q.toString()}`, {
      headers: forwardHeaders,
      signal: AbortSignal.timeout(120000),
    });
    const text = await res.text();
    lastSnippet = text.slice(0, 280);
    if (!res.ok || isScraperErrorBody(text)) continue;
    if (requireJson) {
      const t = text.trim();
      if (!t.startsWith('{') && !t.startsWith('[')) continue;
    }
    return { ok: true, text, status: res.status };
  }
  return { ok: false, text: lastSnippet, status: 0 };
}

function buildForwardHeaders(cookie: string, bearer: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Origin: 'https://app.alura.io',
    Referer: 'https://app.alura.io/keyword-finder-prod',
  };
  if (cookie) h.Cookie = cookie;
  if (bearer) h.Authorization = `Bearer ${bearer}`;
  return h;
}

const API_SCRAPER_MODES: Record<string, string>[] = [
  { premium: 'true' },
  { ultra_premium: 'true' },
  { premium: 'true', country_code: 'us' },
  { ultra_premium: 'true', country_code: 'us' },
];

const PAGE_SCRAPER_MODES: Record<string, string>[] = [
  { render: 'true', premium: 'true', wait: '18000' },
  { render: 'true', ultra_premium: 'true', wait: '22000' },
  { render: 'true', premium: 'true', wait: '25000', country_code: 'us' },
];

async function fetchJsonViaScraperApi(
  pathAndQuery: string,
  scraperKey: string,
  headers: Record<string, string>
): Promise<unknown> {
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const url = `${ALURA_API_BASE}${path}`;
  const r = await fetchThroughScraper(url, scraperKey, headers, API_SCRAPER_MODES, true);
  if (!r.ok) {
    throw new AluraKeywordResearchError(
      `ScraperAPI / API Alura : ${r.text ? r.text.slice(0, 120) : 'tous les modes (premium / ultra_premium) ont échoué.'}`,
      'HTTP'
    );
  }
  try {
    const j = JSON.parse(r.text) as unknown;
    const rec = j as Record<string, unknown>;
    if (rec.status === 'success') return j;
    if (rec.error || rec.message === 'Unauthorized') {
      throw new AluraKeywordResearchError(
        'Session Alura refusée. Copie l’en-tête **Cookie** complet depuis Réseau (requête vers alura-api ou app.alura.io) dans ALURA_COOKIE.',
        'AUTH'
      );
    }
    return j;
  } catch (e) {
    if (e instanceof AluraKeywordResearchError) throw e;
    throw new AluraKeywordResearchError('Réponse API non JSON via ScraperAPI', 'PARSE');
  }
}

async function fetchOverviewViaRenderedPage(
  keyword: string,
  scraperKey: string,
  headers: Record<string, string>
): Promise<AluraOverviewMetrics> {
  const q = encodeURIComponent(keyword.trim());
  const pageUrl = `https://app.alura.io/keyword-finder-prod?q=${q}`;
  const h = { ...headers, Accept: 'text/html,application/xhtml+xml,*/*' };
  const r = await fetchThroughScraper(pageUrl, scraperKey, h, PAGE_SCRAPER_MODES);
  if (!r.ok) {
    throw new AluraKeywordResearchError(
      'Impossible de charger la page Alura via ScraperAPI (render JS).',
      'HTTP'
    );
  }
  const html = r.text;
  const results = parseResultsObjectFromHtml(html);
  if (results) return extractOverviewFromResults(results);

  /** Évite les faux positifs : "sign_in", "assign_in" dans le JSON matchent sign.?in */
  const looksLikeAluraLoginWall =
    /\bConnect your Etsy (shop|account)\b/i.test(html) ||
    /\bPlease log in to continue\b/i.test(html) ||
    /\/login\b.*alura/i.test(html) ||
    (/\bUnauthorized access\b/i.test(html) && !html.includes('keyword_score'));

  if (looksLikeAluraLoginWall) {
    throw new AluraKeywordResearchError(
      'Session Alura expirée pour ScraperAPI : recopie ALURA_COOKIE depuis une requête réseau (connecté sur app.alura.io).',
      'AUTH'
    );
  }
  throw new AluraKeywordResearchError(
    'Données keyword introuvables dans la page rendue. Vérifie ALURA_COOKIE et relance une recherche sur Alura dans le navigateur.',
    'EMPTY'
  );
}

function encodeKeyword(keyword: string): string {
  return encodeURIComponent(keyword.trim());
}

export interface AluraKeywordScrapeResult {
  sourceUrl: string;
  overview: AluraOverviewMetrics;
  listings: EtsyKeywordListing[];
  similarKeywords: string[];
  rawOverviewPayload: Record<string, unknown> | null;
}

export async function fetchAluraKeywordResearch(
  keyword: string,
  maxListings: number
): Promise<AluraKeywordScrapeResult> {
  const scraperKey = (process.env.SCRAPER_API_KEY || '').trim();
  const cookie = (process.env.ALURA_COOKIE || '').trim();
  const bearer = (process.env.ALURA_BEARER_TOKEN || '').trim();

  if (!scraperKey) {
    throw new AluraKeywordResearchError(
      'SCRAPER_API_KEY est requis pour le mode scraping Alura.',
      'CONFIG'
    );
  }
  if (!cookie && !bearer) {
    throw new AluraKeywordResearchError(
      'Configure ALURA_COOKIE : onglet Réseau → clique une requête (app.alura.io ou alura-api) → En-têtes → copie la valeur complète de **Cookie**. Optionnel : ALURA_BEARER_TOKEN en plus.',
      'CONFIG'
    );
  }

  const headers = buildForwardHeaders(cookie, bearer);
  const lang = process.env.ALURA_KEYWORD_LANGUAGE || 'en';
  const kw = encodeKeyword(keyword);
  const commonQs = `language=${lang}&forceUpdate=true&tool=keyword-finder-new&source=etsmart`;

  let overviewJson: unknown;
  try {
    overviewJson = await fetchJsonViaScraperApi(`/v3/keywords/${kw}?${commonQs}`, scraperKey, headers);
  } catch (e) {
    if (e instanceof AluraKeywordResearchError && e.code === 'AUTH') throw e;
    console.warn('[ALURA] API via ScraperAPI échouée, repli page rendue:', e);
    const overview = await fetchOverviewViaRenderedPage(keyword, scraperKey, headers);
    return finalizeResult(keyword, kw, overview, [], [], null);
  }

  let overview = extractOverview(overviewJson);
  const j = overviewJson && typeof overviewJson === 'object' ? (overviewJson as Record<string, unknown>) : null;
  let overviewObj =
    j?.results && typeof j.results === 'object'
      ? (j.results as Record<string, unknown>)
      : findOverviewObject(overviewJson);

  if (
    overview.keywordScore == null &&
    overview.etsyVolumeMonthly == null &&
    overview.competingListings == null
  ) {
    try {
      overview = await fetchOverviewViaRenderedPage(keyword, scraperKey, headers);
      overviewObj = null;
    } catch {
      throw new AluraKeywordResearchError(
        'Réponse API vide et page rendue sans données. Rafraîchis ALURA_COOKIE.',
        'EMPTY'
      );
    }
  }

  let listings: EtsyKeywordListing[] = [];
  try {
    const listingsJson = await fetchJsonViaScraperApi(
      `/v3/keywords/${kw}/listings?forceUpdate=true`,
      scraperKey,
      headers
    );
    const rows = findListingsArray(listingsJson);
    listings = rows
      .map((row, i) => mapAluraListing(row, i + 1))
      .filter((x): x is EtsyKeywordListing => x != null)
      .slice(0, maxListings);
  } catch {
    /* listings optionnels */
  }

  let similarKeywords: string[] = [];
  try {
    const simJson = await fetchJsonViaScraperApi(`/v3/keywords/${kw}/similar?${commonQs}`, scraperKey, headers);
    const walk = (o: unknown, depth = 0): string[] => {
      if (depth > 12 || !o) return [];
      if (Array.isArray(o)) {
        const out: string[] = [];
        for (const el of o) {
          if (el && typeof el === 'object') {
            const row = el as Record<string, unknown>;
            const k = str(row.keyword) || str(row.term) || str(row.query);
            if (k && k.length > 1 && k.length < 140) out.push(k);
            else out.push(...walk(el, depth + 1));
          }
        }
        return out;
      }
      if (typeof o === 'object') {
        return Object.values(o as Record<string, unknown>).flatMap((v) => walk(v, depth + 1));
      }
      return [];
    };
    similarKeywords = [...new Set(walk(simJson))].slice(0, 24);
  } catch {
    /* ignore */
  }

  return finalizeResult(keyword, kw, overview, listings, similarKeywords, overviewObj);
}

function finalizeResult(
  keyword: string,
  kwEncoded: string,
  overview: AluraOverviewMetrics,
  listings: EtsyKeywordListing[],
  similarKeywords: string[],
  overviewObj: Record<string, unknown> | null
): AluraKeywordScrapeResult {
  const hasOverview =
    overview.keywordScore != null ||
    overview.etsyVolumeMonthly != null ||
    overview.competingListings != null ||
    overview.viewsTopListings != null;
  if (!listings.length && !hasOverview) {
    throw new AluraKeywordResearchError(
      'Aucune métrique exploitable. Mets à jour ALURA_COOKIE (session Alura active).',
      'EMPTY'
    );
  }
  return {
    sourceUrl: `https://app.alura.io/keyword-finder-prod?q=${kwEncoded}`,
    overview,
    listings,
    similarKeywords,
    rawOverviewPayload: overviewObj,
  };
}
