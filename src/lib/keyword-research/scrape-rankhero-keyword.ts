import type { AluraOverviewMetrics, AluraVolumeMonth, EtsyKeywordListing } from './types';

const RANKHERO_ENDPOINT = 'https://www.rankhero.com/api/v1/tools/etsy/tag-generator';

export class RankHeroKeywordError extends Error {
  constructor(
    message: string,
    public readonly code: 'HTTP' | 'PARSE' | 'EMPTY'
  ) {
    super(message);
    this.name = 'RankHeroKeywordError';
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

async function fetchRankHeroDirect(
  searchTerm: string
): Promise<{ ok: boolean; text: string; status: number }> {
  const res = await fetch(RANKHERO_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      'Content-Type': 'application/json',
      Origin: 'https://www.rankhero.com',
      Referer: 'https://www.rankhero.com/tools/etsy/tag-generator',
    },
    // Le front RankHero envoie { search_term, location, device_hint }.
    body: JSON.stringify({
      search_term: searchTerm,
      location: 'None',
      // Valeur arbitraire mais au bon format (ils semblent juste l'utiliser comme identifiant client).
      device_hint: 'etsmart-' + Buffer.from(searchTerm).toString('hex').slice(0, 24),
    }),
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  return { ok: res.ok, text, status: res.status };
}

function toVolumeMonth(entry: unknown): AluraVolumeMonth | null {
  if (!entry || typeof entry !== 'object') return null;
  const o = entry as Record<string, unknown>;
  const year = num(o.year);
  const month = str(o.month);
  const searches = num(o.monthly_searches);
  if (!year || !month || searches == null) return null;
  return {
    year: String(year),
    month,
    monthlySearches: String(searches),
  };
}

function buildSyntheticVolumes(avgMonthlySearches: number | null): AluraVolumeMonth[] {
  const base = avgMonthlySearches && avgMonthlySearches > 0 ? avgMonthlySearches : 1000;
  // Profil saisonnier simplifié : plat le reste de l'année, pics Oct–Déc.
  const months = [
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
    'JAN',
    'FEB',
  ];
  const factors = [0.5, 0.55, 0.6, 0.6, 0.65, 0.7, 0.8, 1.1, 1.4, 1.6, 1.0, 0.7];
  const avgFactor = factors.reduce((s, f) => s + f, 0) / factors.length;
  const scale = base / avgFactor;
  const year = new Date().getFullYear();
  return months.map((m, idx) => {
    const raw = Math.round(scale * factors[idx]);
    return {
      year: String(year - (m === 'JAN' || m === 'FEB' ? 0 : 1)), // un cycle sur 12 mois glissants
      month: m,
      monthlySearches: String(raw),
    };
  });
}

function buildOverviewFromRankHeroJson(payload: any): AluraOverviewMetrics {
  const base: AluraOverviewMetrics = {
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
    listingsAnalyzed: null,
  };

  if (!payload || typeof payload !== 'object') return base;
  const doc = (payload as any).search_term_doc;
  if (!doc || typeof doc !== 'object') return base;

  const vol = num(doc.avg_monthly_searches);
  const comp = num(doc.competition);
  const volPct = num(doc.vol_pct) ?? 0;
  const compPct = num(doc.comp_pct) ?? 0;

  const monthlyExplicit = Array.isArray(doc.monthly_search_volumes)
    ? (doc.monthly_search_volumes as unknown[]).map(toVolumeMonth).filter(Boolean) as AluraVolumeMonth[]
    : [];
  const monthly = monthlyExplicit.length ? monthlyExplicit : buildSyntheticVolumes(vol);

  const prices = payload.prices && typeof payload.prices === 'object' ? (payload.prices as any).USD : null;
  let avgPriceUsd: number | null = null;
  if (prices && typeof prices === 'object') {
    const entries = Object.entries(prices as Record<string, unknown>);
    let total = 0;
    let count = 0;
    for (const [priceStr, freq] of entries) {
      const p = Number.parseFloat(priceStr);
      const f = Number(freq);
      if (!Number.isFinite(p) || !Number.isFinite(f)) continue;
      total += p * f;
      count += f;
    }
    if (count > 0) {
      avgPriceUsd = total / count;
    }
  }

  // Score global inspiré d'Alura : volume vs compétition.
  const demandComponent = Math.max(0, Math.min(100, volPct ?? 0));
  const competitionComponent = Math.max(0, Math.min(100, compPct ?? 0));
  const rawScore = demandComponent * 0.7 + (100 - competitionComponent) * 0.3;
  const keywordScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  const competitionLevel = str(doc.comp_text) ?? (competitionComponent >= 75 ? 'High' : competitionComponent >= 45 ? 'Medium' : 'Low');

  return {
    ...base,
    keywordScore,
    etsyVolumeMonthly: vol,
    competingListings: comp,
    competitionLevel,
    etsyVolumes: monthly,
    avgPriceUsd,
    listingsAnalyzed: Array.isArray(payload.listings) ? payload.listings.length : null,
  };
}

function mapRankHeroListing(raw: any, index: number): EtsyKeywordListing | null {
  const id = str(raw.listing_id) ?? str(raw.id);
  const title = str(raw.title);
  const url = str(raw.url);
  if (!id || !title || !url) return null;
  const price = num(raw.price);
  const currency = str(raw.currency);
  const imageUrl = str(raw.image_url);
  const shopName = str(raw.shop_name);
  const views = num(raw.views);
  const favorers = num(raw.num_favorers);

  return {
    id,
    rank: index + 1,
    title,
    listingUrl: url,
    imageUrl,
    price,
    currency: currency ?? (price != null ? 'USD' : null),
    reviewCount: favorers,
    rating: null,
    shopName,
    isBestSeller: false,
    hasFreeShipping: false,
    aluraMonthlySales: null,
    aluraViews: views ?? undefined,
    aluraFavorites: favorers ?? undefined,
  };
}

function buildSuggestionsFromRankHero(payload: any, keyword: string): string[] {
  const base: string[] = [];
  const pushTags = (items: unknown[]) => {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      if (row.trademarked === true) continue;
      const tag = str(row.tag);
      if (!tag) continue;
      base.push(tag.toLowerCase());
    }
  };

  if (Array.isArray(payload.tags)) pushTags(payload.tags);
  if (Array.isArray(payload.materials)) pushTags(payload.materials);
  if (Array.isArray(payload.styles)) pushTags(payload.styles);

  const uniq = Array.from(new Set(base));
  // Garde les suggestions les plus proches du keyword en premier (par longueur similaire).
  const lowered = keyword.toLowerCase();
  uniq.sort((a, b) => {
    const da = Math.abs(a.length - lowered.length);
    const db = Math.abs(b.length - lowered.length);
    return da - db;
  });
  return uniq.slice(0, 32);
}

export interface RankHeroKeywordResult {
  sourceUrl: string;
  overview: AluraOverviewMetrics;
  listings: EtsyKeywordListing[];
  suggestions: string[];
}

export async function fetchRankHeroKeywordResearch(
  keyword: string
): Promise<RankHeroKeywordResult> {
  const cleanTag = keyword.trim();
  const r = await fetchRankHeroDirect(cleanTag);
  if (!r.ok) {
    throw new RankHeroKeywordError(
      `Requête RankHero impossible (HTTP ${r.status}).`,
      'HTTP'
    );
  }

  let json: any;
  try {
    json = JSON.parse(r.text);
  } catch {
    throw new RankHeroKeywordError('Réponse RankHero non JSON.', 'PARSE');
  }

  if (json.error) {
    throw new RankHeroKeywordError(String(json.error), 'HTTP');
  }

  const overview = buildOverviewFromRankHeroJson(json);
  const listingsRaw: unknown[] = Array.isArray(json.listings) ? json.listings : [];
  const listings = listingsRaw
    .map((row, i) => mapRankHeroListing(row, i))
    .filter((x): x is EtsyKeywordListing => x != null);

  if (!listings.length && overview.etsyVolumeMonthly == null) {
    throw new RankHeroKeywordError(
      'Aucune donnée exploitable pour ce mot-clé sur RankHero.',
      'EMPTY'
    );
  }

  const suggestions = buildSuggestionsFromRankHero(json, keyword);

  return {
    sourceUrl: `https://www.rankhero.com/tools/etsy/tag-generator?tag=${encodeURIComponent(cleanTag)}&location=None`,
    overview,
    listings,
    suggestions,
  };
}

