/**
 * Scraping boutique Etsy (HTML + enrichissement par listing).
 * Utilisé par /api/shop/scrape et /api/etsy/competitor-shop-analysis.
 */

import * as cheerio from 'cheerio';
import { decodeListingTitleEntities } from '@/lib/etsy/decode-listing-title';
import { scrapeEtsyPageHtmlWithZenRowsBrowser } from '@/services/scraping/zenrowsBrowser';

export type ScrapedListing = {
  title: string;
  url: string;
  price: number;
  sales?: number;
  reviews?: number;
  rating?: number;
  images?: string[];
  tags?: string[];
  materials?: string[];
  description?: string;
  hasVideo?: boolean;
  createdAt?: string;
  updatedAt?: string;
  isPartialData?: boolean;
};

/** Indicateurs calculés depuis l’échantillon scrapé (prix moyen, tags, ratios). */
export type ShopDerivedStats = {
  averagePrice: number | null;
  /** Ventes totales boutique / listings actifs (si les deux connus). */
  salesPerListing: number | null;
  /** Avis / ventes × 100 (indicatif). */
  reviewRatePercent: number | null;
  /** Tags les plus présents sur l’échantillon (% de listings qui contiennent le tag). */
  tagTop: { tag: string; count: number; percentOfListings: number }[];
};

export type ShopPayload = {
  shopName: string;
  shopUrl: string;
  salesCount: number;
  rating: number;
  reviewCount: number;
  shopAge: string;
  location: string;
  /** Bannière boutique (ex. 760×100 sur CDN Etsy) si trouvée dans le HTML / JSON embarqué */
  bannerUrl?: string | null;
  /** Logo / avatar rond boutique */
  logoUrl?: string | null;
  listings: ScrapedListing[];
  /** Compteurs souvent présents dans le JSON embarqué de la page boutique. */
  activeListingCount?: number | null;
  favoritesCount?: number | null;
  /** Agrégats (échantillon + données publiques). */
  derived?: ShopDerivedStats;
};

async function fetchEtsyHtmlWithFallback(url: string, language: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': language,
      },
      cache: 'no-store',
    });
    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 1000) return html;
    }
  } catch {
    // fallback below
  }

  try {
    return await scrapeEtsyPageHtmlWithZenRowsBrowser(url);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[SHOP_SCRAPE] ZenRows fallback failed:', msg);
    return null;
  }
}

/**
 * Fiches listing : le `fetch` seul renvoie souvent un HTML sans JSON-LD avis (hydratation JS).
 * Si ZenRows est configuré, on charge d’abord la page comme un navigateur pour récupérer la note.
 */
async function fetchListingHtmlForEnrich(url: string, language: string): Promise<string | null> {
  const isListing = /\/listing\/\d+/i.test(url);
  const hasZen = Boolean(process.env.ZENROWS_BROWSER_WS_URL?.trim());
  if (isListing && hasZen) {
    try {
      const html = await scrapeEtsyPageHtmlWithZenRowsBrowser(url);
      if (html && html.length > 2500) return html;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('[SHOP_SCRAPE] ZenRows listing primary failed, fetch fallback:', msg);
    }
  }
  return fetchEtsyHtmlWithFallback(url, language);
}

function parseCompactNumber(value: string): number {
  const raw = value
    .trim()
    .toLowerCase()
    .replace(/[ \u00A0\u202F]/g, '')
    .replace(/,/g, '.');
  const match = raw.match(/(\d+(?:\.\d+)?)(k|m)?/);
  if (!match) return 0;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n)) return 0;
  if (match[2] === 'k') return Math.round(n * 1000);
  if (match[2] === 'm') return Math.round(n * 1000000);
  return Math.round(n);
}

function parsePriceValue(value: string): number {
  const cleaned = value
    .replace(/[^\d,.\s\u00A0\u202F]/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .trim();
  if (!cleaned) return 0;

  const token = cleaned.match(/(\d{1,3}(?:[ .]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/);
  if (!token?.[1]) return 0;
  let n = token[1].replace(/ /g, '');

  if (n.includes(',') && n.includes('.')) {
    n = n.replace(/,/g, '');
  } else if (n.includes(',')) {
    n = n.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = n.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      n = n.replace(/\./g, '');
    }
  }
  const parsed = Number.parseFloat(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Inclut les URLs localisées : etsy.com/fr/shop/, etsy.com/de/shop/, etc. */
const ETSY_SHOP_PATH = /etsy\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?shop\//i;

export function isEtsyShopUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return ETSY_SHOP_PATH.test(url.trim());
}

export function normalizeShopUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) return raw.split('?')[0].split('#')[0];
  if (ETSY_SHOP_PATH.test(raw)) {
    const rest = raw.replace(/^\/+/, '').replace(/^https?:\/\//i, '');
    return `https://${rest}`.split('?')[0].split('#')[0];
  }

  const slug = raw
    .replace(/^@/, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return `https://www.etsy.com/shop/${slug}`;
}

function extractListingsFromLdJson($: cheerio.CheerioAPI, cap: number): ScrapedListing[] {
  const listings: ScrapedListing[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (!content) return;
    try {
      const parsed = JSON.parse(content);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of candidates) {
        const itemList = node?.itemListElement;
        if (!Array.isArray(itemList)) continue;
        for (const entry of itemList) {
          const item = entry?.item || entry;
          if (!item) continue;
          const title = String(item.name || '').trim();
          const url = String(item.url || '').trim();
          if (!title || !url || !url.includes('/listing/')) continue;
          const images = Array.isArray(item.image)
            ? item.image.filter(Boolean).map(String)
            : item.image
              ? [String(item.image)]
              : [];
          const price = Number(item.offers?.price || 0);
          listings.push({
            title,
            url,
            price: Number.isFinite(price) ? price : 0,
            images,
          });
        }
      }
    } catch {
      // ignore parsing errors
    }
  });
  return listings.slice(0, cap);
}

function extractShopMetrics($: cheerio.CheerioAPI, pageText: string) {
  const text = pageText.replace(/[ \u00A0\u202F]+/g, ' ');
  let salesCount = 0;
  let reviewCount = 0;
  let rating = 0;
  let shopAge = '';

  const patternsSales = [
    /([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+sales?/i,
    /([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+ventes?/i,
    /([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+items?\s+sold/i,
  ];
  for (const re of patternsSales) {
    const m = text.match(re);
    if (m?.[1]) {
      salesCount = parseCompactNumber(m[1]);
      if (salesCount > 0) break;
    }
  }

  const patternsReviews = [/([\d.,\s\u00A0\u202F]+)\s+reviews?/i, /([\d.,\s\u00A0\u202F]+)\s+avis/i];
  for (const re of patternsReviews) {
    const m = text.match(re);
    if (m?.[1]) {
      reviewCount = parseCompactNumber(m[1]);
      if (reviewCount > 0) break;
    }
  }

  const ratingMatch =
    text.match(/(\d(?:[.,]\d)?)\s+(?:out of|sur)\s+5/i) || text.match(/(\d(?:[.,]\d)?)\s*\/\s*5/i);
  if (ratingMatch?.[1]) {
    rating = parseFloat(ratingMatch[1].replace(',', '.'));
  }

  const ageMatch = text.match(/(?:On Etsy since|Depuis)\s+(\d{4})/i);
  if (ageMatch?.[1]) shopAge = ageMatch[1];

  $('script[type="application/ld+json"]').each((_, el) => {
    if (salesCount > 0 && reviewCount > 0 && rating > 0) return;
    const content = $(el).html();
    if (!content) return;
    try {
      const data = JSON.parse(content);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const aggregate = node?.aggregateRating || node?.mainEntity?.aggregateRating;
        if (!rating && aggregate?.ratingValue) rating = Number(aggregate.ratingValue) || 0;
        if (!reviewCount && aggregate?.reviewCount) reviewCount = Number(aggregate.reviewCount) || 0;
        if (!salesCount && (node?.transaction_sold_count || node?.salesCount)) {
          salesCount = Number(node.transaction_sold_count || node.salesCount) || 0;
        }
      }
    } catch {
      // ignore
    }
  });

  return { salesCount, reviewCount, rating, shopAge };
}

/**
 * Compteurs boutique parfois exposés dans le HTML (JSON GraphQL / initial state).
 * Pas de ventes mensuelles ni de CA : Etsy ne les affiche pas publiquement pour les tiers.
 */
function extractShopExtraCounts(html: string, pageText: string): {
  activeListingCount: number | null;
  favoritesCount: number | null;
} {
  let activeListingCount: number | null = null;
  let favoritesCount: number | null = null;

  const listingRes = [
    /"active_listing_count"\s*:\s*(\d+)/i,
    /"listing_count"\s*:\s*(\d+)/i,
    /"activeListingCount"\s*:\s*(\d+)/i,
    /"shop_listing_count"\s*:\s*(\d+)/i,
    /"inventory_count"\s*:\s*(\d+)/i,
    /"active_listings"\s*:\s*(\d+)/i,
  ];
  for (const re of listingRes) {
    const m = html.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n < 1_000_000) {
        activeListingCount = n;
        break;
      }
    }
  }

  const favRes = [
    /"num_favorers"\s*:\s*(\d+)/i,
    /"favorites_count"\s*:\s*(\d+)/i,
    /"favoritesCount"\s*:\s*(\d+)/i,
    /"shop_favorers"\s*:\s*(\d+)/i,
    /"favorers"\s*:\s*(\d+)/i,
  ];
  for (const re of favRes) {
    const m = html.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (n >= 0 && n < 100_000_000) {
        favoritesCount = n;
        break;
      }
    }
  }

  const text = pageText.replace(/[ \u00A0\u202F]+/g, ' ');
  if (!favoritesCount) {
    const adm = text.match(/([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+admirers?/i);
    const av = text.match(/([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+admirateur/i);
    const m = adm || av;
    if (m?.[1]) favoritesCount = parseCompactNumber(m[1]);
  }

  return { activeListingCount, favoritesCount };
}

function computeDerivedShopStats(
  listings: ScrapedListing[],
  salesCount: number,
  reviewCount: number,
  activeListingCount: number | null,
  favoritesCount: number | null
): ShopDerivedStats {
  const prices = listings.map((l) => l.price).filter((p) => p > 0);
  const averagePrice = prices.length ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : null;

  const n = listings.length;
  const tagCounts = new Map<string, number>();
  for (const l of listings) {
    for (const t of l.tags || []) {
      const k = t.toLowerCase().trim();
      if (k.length < 2) continue;
      tagCounts.set(k, (tagCounts.get(k) || 0) + 1);
    }
  }
  const tagTop = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({
      tag,
      count,
      percentOfListings: n > 0 ? Math.round((count / n) * 1000) / 10 : 0,
    }));

  const active = activeListingCount && activeListingCount > 0 ? activeListingCount : null;
  const salesPerListing = active && salesCount >= 0 ? Math.round((salesCount / active) * 1000) / 1000 : null;

  const reviewRatePercent =
    salesCount > 0 && reviewCount >= 0
      ? Math.round((reviewCount / salesCount) * 10000) / 100
      : null;

  return {
    averagePrice,
    salesPerListing,
    reviewRatePercent,
    tagTop,
  };
}

/** Parcourt le JSON-LD (y compris @graph / imbrications) pour le premier Product avec aggregateRating. */
function deepFindProductAggregateRating(node: unknown): { rating: number; reviews: number } | null {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const f = deepFindProductAggregateRating(item);
      if (f) return f;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const o = node as Record<string, unknown>;
  const t = o['@type'];
  const types: string[] = Array.isArray(t)
    ? t.map((x) => String(x))
    : t != null
      ? [String(t)]
      : [];
  const isProduct = types.some((x) => {
    const s = x.trim().toLowerCase();
    return s === 'product' || s.endsWith('/product');
  });
  if (isProduct && o.aggregateRating && typeof o.aggregateRating === 'object') {
    const ar = o.aggregateRating as Record<string, unknown>;
    const rating = Number(ar.ratingValue);
    const reviews = Number(ar.reviewCount ?? ar.ratingCount);
    if (Number.isFinite(rating) && rating > 0 && rating <= 5) {
      return {
        rating,
        reviews: Number.isFinite(reviews) && reviews >= 0 ? Math.round(reviews) : 0,
      };
    }
  }
  for (const v of Object.values(o)) {
    const f = deepFindProductAggregateRating(v);
    if (f) return f;
  }
  return null;
}

/** Bloc Product dans le HTML brut (JSON souvent hors du premier script ou avec @graph). */
function extractRatingNearProductJson(html: string): { rating: number; reviews: number } {
  const idx = html.search(/"@type"\s*:\s*"Product"/i);
  if (idx < 0) return { rating: 0, reviews: 0 };
  const chunk = html.slice(idx, idx + 35_000);
  const m1 = chunk.match(
    /"aggregateRating"\s*:\s*\{[\s\S]*?"ratingValue"\s*:\s*(\d+(?:\.\d+)?)[\s\S]*?"reviewCount"\s*:\s*(\d+)/i
  );
  if (m1) {
    const r = parseFloat(m1[1]);
    const rev = parseInt(m1[2], 10);
    if (r > 0 && r <= 5) return { rating: r, reviews: Number.isFinite(rev) ? rev : 0 };
  }
  const m2 = chunk.match(
    /"aggregateRating"\s*:\s*\{[\s\S]*?"reviewCount"\s*:\s*(\d+)[\s\S]*?"ratingValue"\s*:\s*(\d+(?:\.\d+)?)/i
  );
  if (m2) {
    const r = parseFloat(m2[2]);
    const rev = parseInt(m2[1], 10);
    if (r > 0 && r <= 5) return { rating: r, reviews: Number.isFinite(rev) ? rev : 0 };
  }
  const rv = chunk.match(/"ratingValue"\s*:\s*(\d+(?:\.\d+)?)/);
  const rc = chunk.match(/"reviewCount"\s*:\s*(\d+)/);
  if (rv) {
    const r = parseFloat(rv[1]);
    const rev = rc ? parseInt(rc[1], 10) : 0;
    if (r > 0 && r <= 5) return { rating: r, reviews: rev };
  }
  return { rating: 0, reviews: 0 };
}

function extractRatingFromAriaLabels($: cheerio.CheerioAPI): { rating: number; reviews: number } {
  let rating = 0;
  let reviews = 0;
  $('[aria-label]').each((_, el) => {
    const label = ($(el).attr('aria-label') || '').trim();
    if (!label) return;
    const en = label.match(/(\d+(?:[.,]\d+)?)\s+out of\s+5/i);
    const fr = label.match(/(\d+(?:[.,]\d+)?)\s+sur\s+5/i);
    const slash = label.match(/(\d+(?:[.,]\d+)?)\s*\/\s*5\b/);
    const r = en || fr || slash;
    if (r && !rating) {
      const n = parseFloat(r[1].replace(',', '.'));
      if (n >= 0 && n <= 5) rating = n;
    }
    const revM = label.match(/(\d[\d\s\u00A0\u202F]*)\s*(?:reviews?|avis)\b/i);
    if (revM && !reviews) {
      const n = parseCompactNumber(revM[1].replace(/[\s\u00A0\u202F]/g, ''));
      if (n > 0) reviews = n;
    }
  });
  return { rating, reviews };
}

async function enrichListing(url: string): Promise<Partial<ScrapedListing>> {
  try {
    const html = await fetchListingHtmlForEnrich(url, 'fr-FR,fr;q=0.9,en;q=0.8');
    if (!html) return { isPartialData: true };
    const $ = cheerio.load(html);
    const bodyText = $('body').text();

    let tags: string[] = [];
    let materials: string[] = [];
    let description = '';
    let title = '';
    let hasVideo = false;
    let createdAt: string | undefined;
    let updatedAt: string | undefined;
    let reviews = 0;
    let rating = 0;
    let sales = 0;
    let price = 0;
    let images: string[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      const content = $(el).html();
      if (!content) return;
      try {
        const data = JSON.parse(content);
        const fromDeep = deepFindProductAggregateRating(data);
        if (fromDeep && fromDeep.rating > 0) {
          if (!rating) rating = fromDeep.rating;
          if (!reviews && fromDeep.reviews > 0) reviews = fromDeep.reviews;
        }
        const nodes = Array.isArray(data) ? data : [data];
        for (const node of nodes) {
          const product =
            node?.['@type'] === 'Product' ? node : node?.mainEntity?.['@type'] === 'Product' ? node.mainEntity : null;
          if (!product) continue;
          if (!title && product.name) title = String(product.name);
          if (!description && product.description) description = String(product.description);
          if (!price && product.offers?.price) price = Number(product.offers.price) || 0;
          if (!rating && product.aggregateRating?.ratingValue) rating = Number(product.aggregateRating.ratingValue) || 0;
          if (!reviews && product.aggregateRating?.reviewCount) reviews = Number(product.aggregateRating.reviewCount) || 0;
          if (!createdAt && product.datePublished) createdAt = String(product.datePublished);
          if (!updatedAt && product.dateModified) updatedAt = String(product.dateModified);
          if (!images.length && product.image) {
            images = Array.isArray(product.image)
              ? product.image.map(String).filter(Boolean)
              : [String(product.image)];
          }
          if (Array.isArray(product.keywords)) tags = product.keywords.map(String).filter(Boolean);
          if (!tags.length && typeof product.keywords === 'string') {
            tags = product.keywords
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean);
          }
          if (Array.isArray(product.material)) materials = product.material.map(String).filter(Boolean);
        }
      } catch {
        // ignore
      }
    });

    if (!rating || !reviews) {
      $('script').each((_, el) => {
        const typ = ($(el).attr('type') || '').toLowerCase();
        if (typ.includes('ld+json')) return;
        const raw = $(el).html();
        if (!raw || raw.length < 40 || raw.length > 1_500_000) return;
        if (!raw.includes('ratingValue') && !raw.includes('aggregateRating')) return;
        try {
          const parsed = JSON.parse(raw);
          const f = deepFindProductAggregateRating(parsed);
          if (f && f.rating > 0) {
            if (!rating) rating = f.rating;
            if (!reviews && f.reviews > 0) reviews = f.reviews;
          }
        } catch {
          /* pas du JSON pur */
        }
      });
    }

    if (!rating || !reviews) {
      const near = extractRatingNearProductJson(html);
      if (!rating && near.rating > 0) rating = near.rating;
      if (!reviews && near.reviews > 0) reviews = near.reviews;
    }
    if (!rating || !reviews) {
      const aria = extractRatingFromAriaLabels($);
      if (!rating && aria.rating > 0) rating = aria.rating;
      if (!reviews && aria.reviews > 0) reviews = aria.reviews;
    }
    if (!rating) {
      const avg = html.match(/"average_rating"\s*:\s*(\d+(?:\.\d+)?)/i);
      if (avg) {
        const n = parseFloat(avg[1]);
        if (n > 0 && n <= 5) rating = n;
      }
    }
    if (!rating) {
      const textHit =
        bodyText.match(/(\d+[.,]\d+)\s*\/\s*5/) ||
        bodyText.match(/(\d+[.,]\d+)\s+sur\s+5/i) ||
        bodyText.match(/(\d+[.,]\d+)\s+out of\s+5/i);
      if (textHit?.[1]) {
        const n = parseFloat(textHit[1].replace(',', '.'));
        if (n > 0 && n <= 5) rating = n;
      }
    }
    if (!reviews) {
      const revHit =
        bodyText.match(/([\d\s\u00A0\u202F]+)\s+avis\b/i) ||
        bodyText.match(/([\d\s\u00A0\u202F]+)\s+reviews?\b/i);
      if (revHit?.[1]) {
        const n = parseCompactNumber(revHit[1].replace(/[\s\u00A0\u202F]/g, ''));
        if (n > 0) reviews = n;
      }
    }

    if (!hasVideo) {
      hasVideo =
        $('video').length > 0 ||
        $('[data-video-id]').length > 0 ||
        $('[aria-label*="video" i]').length > 0 ||
        $('[class*="video"]').length > 0 ||
        $('button:contains("Video")').length > 0 ||
        bodyText.toLowerCase().includes('listing video');
    }

    if (!title) {
      title =
        $('h1').first().text().trim() ||
        $('meta[property="og:title"]').attr('content')?.trim() ||
        $('title').text().replace(/\s*\|\s*Etsy.*$/i, '').trim() ||
        '';
    }

    if (!images.length) {
      const gallery = $(
        '[data-carousel-panel] img, [data-listing-image] img, img[src*="etsyimg.com"], img[src*="etsystatic.com"]'
      )
        .toArray()
        .map((el) => $(el).attr('src') || $(el).attr('data-src') || '')
        .filter(Boolean)
        .map((src) => src.split('?')[0]);
      images = Array.from(new Set(gallery)).slice(0, 12);
    }

    if (!sales) {
      const salesMatch =
        bodyText.match(/([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+sales?/i) ||
        bodyText.match(/([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+ventes?/i);
      if (salesMatch?.[1]) sales = parseCompactNumber(salesMatch[1]);
    }

    if (!tags.length) {
      const chips = $('[data-tag], a[href*="search?q="], [class*="tag"]')
        .toArray()
        .map((el) => $(el).text().trim())
        .filter((t) => t.length >= 2 && t.length <= 40);
      tags = Array.from(new Set(chips)).slice(0, 13);
    }

    if (!materials.length) {
      const matMatch = bodyText.match(/materials?\s*[:\-]\s*([^\n\r]+)/i);
      if (matMatch?.[1]) {
        materials = matMatch[1]
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
          .slice(0, 13);
      }
    }

    const titleOut = title ? decodeListingTitleEntities(title.trim()) : '';

    return {
      title: titleOut || undefined,
      tags,
      materials,
      description: description?.trim(),
      hasVideo,
      createdAt,
      updatedAt,
      reviews,
      rating,
      sales,
      price,
      images: images.length ? images : undefined,
      isPartialData:
        !titleOut ||
        titleOut.endsWith('...') ||
        (!description && !tags.length && !materials.length && !hasVideo) ||
        (images.length <= 1 && !hasVideo),
    };
  } catch {
    return { isPartialData: true };
  }
}

function absolutizeEtsyImg(src: string): string | null {
  const s = src.trim();
  if (!s) return null;
  const u = s.replace(/\\\//g, '/');
  if (/^https?:\/\//i.test(u)) return u.split('?')[0];
  if (u.startsWith('//')) return `https:${u}`.split('?')[0];
  if (u.startsWith('/')) return `https://www.etsy.com${u}`.split('?')[0];
  return null;
}

/**
 * Dernier recours : images carrées i.etsystatic (il_…). Tailles type avatar (≈140px), pas miniatures listing.
 */

/** Limite le HTML pour le fallback : après le début des listings, les vignettes polluent le JSON. */
function shopHeaderHtmlSlice(html: string): string {
  const markers = [
    html.search(/"listing_id"\s*:\s*\d{5,}/),
    html.search(/"listing_ids"\s*:\s*\[/),
    html.search(/\/listing\/\d{6,}/),
  ].filter((i) => i >= 0);
  const minMarker = markers.length ? Math.min(...markers) : -1;
  const end =
    minMarker > 15_000 ? minMarker : Math.min(html.length, 95_000);
  return html.slice(0, end);
}

function pickShopLogoFromEtsyCdnSlice(htmlSlice: string, excludeBanner: string | null): string | null {
  const normEx = excludeBanner ? excludeBanner.split('?')[0] : null;
  const re = /https?:\/\/i\.etsystatic\.com\/[^"'\s<>\\]+/gi;
  const candidates: { u: string; area: number; side: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(htmlSlice)) !== null) {
    let u = m[0].replace(/\\\//g, '/').split('?')[0];
    if (!u.includes('/il_')) continue;
    if (normEx && u === normEx) continue;
    const dim = u.match(/il_(\d+)x(\d+)/);
    if (!dim) continue;
    const w = parseInt(dim[1], 10);
    const h = parseInt(dim[2], 10);
    if (w < 45 || h < 45 || w > 400 || h > 400) continue;
    if (Math.abs(w - h) > Math.max(24, Math.min(w, h) * 0.18)) continue;
    const side = Math.round((w + h) / 2);
    candidates.push({ u, area: w * h, side });
  }
  const ideal = candidates.filter((c) => c.side >= 70 && c.side <= 240);
  const pool = ideal.length ? ideal : candidates;
  pool.sort((a, b) => {
    const da = Math.abs(a.side - 140);
    const db = Math.abs(b.side - 140);
    if (da !== db) return da - db;
    return a.area - b.area;
  });
  return pool[0]?.u ?? null;
}

/** Icône boutique : uniquement dans le bloc JSON `shop` / `user` (pas les image_url_140x140 des listings). */
function extractShopIconFromEmbeddedShopJson(jsonStr: string): string | null {
  const shopIdx = jsonStr.search(/"shop"\s*:\s*\{/);
  if (shopIdx >= 0) {
    const chunk = jsonStr.slice(shopIdx, shopIdx + 55_000);
    const iconRes = [
      /"icon_url_fullxfull"\s*:\s*"([^"]+)"/i,
      /"shop_icon_url"\s*:\s*"([^"]+)"/i,
      /"shop_icon_url_fullxfull"\s*:\s*"([^"]+)"/i,
      /"shop_icon_image_url"\s*:\s*"([^"]+)"/i,
      /"shopIconUrl"\s*:\s*"([^"]+)"/i,
    ];
    for (const re of iconRes) {
      const m = chunk.match(re);
      if (m?.[1] && /etsystatic|etsyimg/i.test(m[1])) return m[1];
    }
  }
  const userIdx = jsonStr.search(/"user"\s*:\s*\{/);
  if (userIdx >= 0) {
    const chunk = jsonStr.slice(userIdx, userIdx + 16_000);
    const um = chunk.match(
      /"(avatar_url|user_avatar_url|profile_image_url)"\s*:\s*"([^"]+)"/i
    );
    if (um?.[2] && /etsystatic|etsyimg/i.test(um[2])) return um[2];
  }
  return null;
}

function tryLogoFromShopProfileLink($: cheerio.CheerioAPI, shopSlug: string | null | undefined): string | null {
  const slug = shopSlug?.trim();
  if (!slug) return null;
  const slugLower = slug.toLowerCase();
  let found: string | null = null;
  $('a[href*="/shop/"]').each((_, el) => {
    if (found) return;
    const href = ($(el).attr('href') || '').split('?')[0].toLowerCase();
    if (!href.includes(`/shop/${slugLower}`)) return;
    const $imgs = $(el).find('img');
    $imgs.each((_, img) => {
      if (found) return;
      const raw =
        $(img).attr('src') || $(img).attr('data-src') || $(img).attr('srcset')?.split(/\s+/)[0];
      if (!raw || !/etsystatic|etsyimg/i.test(raw)) return;
      if (/760x100|banner|570xN|680x680|1588xN/i.test(raw)) return;
      if (/il_(75x75|114x114|140x140|170x170|180x180|224x224|fullxfull)/i.test(raw)) {
        found = raw;
      }
    });
  });
  return found ? absolutizeEtsyImg(found) : null;
}

/**
 * Bannière + logo : lien profil boutique, JSON `shop` / `user`, puis bannière (OG, etc.).
 * On évite les motifs globaux `image_url_140x140` (souvent une vignette listing).
 */
export function extractShopBranding(
  $: cheerio.CheerioAPI,
  html: string,
  shopSlug?: string | null
): {
  bannerUrl: string | null;
  logoUrl: string | null;
} {
  let bannerUrl: string | null = null;
  let logoUrl: string | null = null;

  const setBanner = (raw: string | undefined) => {
    if (bannerUrl || !raw) return;
    const u = absolutizeEtsyImg(raw);
    if (u && /etsystatic|etsyimg/i.test(u)) bannerUrl = u;
  };
  const setLogo = (raw: string | undefined) => {
    if (logoUrl || !raw) return;
    const u = absolutizeEtsyImg(raw);
    if (u && /etsystatic|etsyimg/i.test(u)) logoUrl = u;
  };

  const jsonStr = html.replace(/\r/g, '');

  const fromLink = tryLogoFromShopProfileLink($, shopSlug);
  if (fromLink) setLogo(fromLink);

  const fromShopJson = extractShopIconFromEmbeddedShopJson(jsonStr);
  if (fromShopJson) setLogo(fromShopJson);

  const patternsLogoFallback: RegExp[] = [
    /"shop_icon_url"\s*:\s*"([^"]+)"/i,
    /"shop_icon_url_fullxfull"\s*:\s*"([^"]+)"/i,
    /"shop_icon_image_url"\s*:\s*"([^"]+)"/i,
    /"shopIconUrl"\s*:\s*"([^"]+)"/i,
    /"shop_avatar_url"\s*:\s*"([^"]+)"/i,
    /"avatar_url"\s*:\s*"([^"]*etsystatic[^"]*)"/i,
    /"avatarUrl"\s*:\s*"([^"]+)"/i,
    /"user_avatar_url"\s*:\s*"([^"]+)"/i,
    /"profile_image_url"\s*:\s*"([^"]+)"/i,
  ];
  for (const re of patternsLogoFallback) {
    const m = jsonStr.match(re);
    if (m?.[1]) setLogo(m[1]);
  }

  const patternsBanner: RegExp[] = [
    /"image_url_760x100"\s*:\s*"([^"]+)"/i,
    /"image_url_fullxfull"\s*:\s*"([^"]+)"/i,
    /"banner_image_url"\s*:\s*"([^"]+)"/i,
    /"header_image_url"\s*:\s*"([^"]+)"/i,
    /"primary_fullxfull_url"\s*:\s*"([^"]+)"/i,
    /"shop_banner_url"\s*:\s*"([^"]+)"/i,
  ];
  for (const re of patternsBanner) {
    const m = jsonStr.match(re);
    if (m?.[1]) setBanner(m[1]);
  }

  const og = $('meta[property="og:image"]').attr('content')?.trim();
  if (og) {
    const u = absolutizeEtsyImg(og);
    if (u && /etsystatic|etsyimg/i.test(u)) {
      if (/il_(75x75|114x114|140x140|180x180|224x224|170x170)/i.test(u)) setLogo(og);
      else setBanner(og);
    }
  }

  const tw = $('meta[name="twitter:image"], meta[property="twitter:image"]').attr('content')?.trim();
  if (tw && !bannerUrl) setBanner(tw);

  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (!content) return;
    try {
      const data = JSON.parse(content);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const t = node?.['@type'];
        if (t === 'Store' || t === 'LocalBusiness' || t === 'Organization' || t === 'ProfilePage') {
          const img = node.image;
          if (typeof img === 'string') setBanner(img);
          else if (Array.isArray(img) && img[0]) setBanner(String(img[0]));
          const logo = node.logo;
          if (typeof logo === 'string') setLogo(logo);
        }
      }
    } catch {
      /* ignore */
    }
  });

  $(
    '[class*="shop-header"] img[src*="etsystatic"], [class*="shop-header"] img[src*="etsyimg"], [data-test-id="shop-header"] img, [data-testid="shop-header"] img'
  ).each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset')?.split(/\s+/)[0];
    if (!src || !/etsystatic|etsyimg/i.test(src)) return;
    if (/il_(75x75|114x114|140x140|170x170|180x180|224x224|fullxfull)/i.test(src) && !/760x100/i.test(src)) {
      setLogo(src);
    } else if (/il_(fullxfull|570xN|680x680|760x100|794xN|1588xN|336x280)/i.test(src) || /760x100|banner/i.test(src)) {
      setBanner(src);
    }
  });

  $(
    'img[alt*="avatar" i], img[alt*="shop icon" i], img[alt*="Shop icon" i], [class*="shop-icon"] img[src*="etsystatic"], [class*="ShopIcon"] img, [class*="shop-icon-header"] img, [class*="wt-circle"] img[src*="etsystatic"]'
  ).each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (!src || !/etsystatic|etsyimg/i.test(src)) return;
    if (/il_(75x75|114x114|140x140|180x180|224x224|fullxfull)/i.test(src) || /avatar|shop.icon/i.test(src)) {
      setLogo(src);
    }
  });

  const bgInline = html.match(/background-image\s*:\s*url\(\s*["']?([^"')]+)/i);
  if (bgInline?.[1] && /etsystatic|etsyimg/i.test(bgInline[1])) {
    setBanner(bgInline[1].replace(/\\\//g, '/'));
  }

  if (!logoUrl) {
    $('picture source[srcset*="etsystatic"], img[srcset*="etsystatic"]').each((_, el) => {
      const raw = $(el).attr('srcset');
      if (!raw) return;
      const first = raw.split(',')[0]?.trim().split(/\s+/)[0];
      if (first && /il_(75x75|114x114|140x140|170x170|180x180|224x224)/i.test(first)) setLogo(first);
    });
  }

  if (!logoUrl) {
    const fromSlice = pickShopLogoFromEtsyCdnSlice(shopHeaderHtmlSlice(html), bannerUrl);
    if (fromSlice) setLogo(fromSlice);
  }

  return { bannerUrl, logoUrl };
}

function dedupeListings(listings: ScrapedListing[]): ScrapedListing[] {
  const seen = new Set<string>();
  const out: ScrapedListing[] = [];
  for (const l of listings) {
    const key = l.url.split('?')[0].toLowerCase();
    if (!key.includes('/listing/')) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

export type ScrapeShopOptions = {
  /** Nombre max de listings enrichis (1–80). Défaut 12. */
  maxListings?: number;
};

/**
 * Scrape la page boutique + enrichit chaque fiche (tags, prix, ventes unitaires si visibles, dates).
 * Les données viennent surtout de la première page boutique (Etsy pagine côté client).
 */
export async function scrapeEtsyShop(shopInput: string, options: ScrapeShopOptions = {}): Promise<ShopPayload> {
  const maxListings = Math.min(Math.max(options.maxListings ?? 12, 1), 80);
  const shopUrl = normalizeShopUrl(shopInput);
  if (!shopUrl) {
    throw new Error('INVALID_SHOP_URL');
  }

  const html = await fetchEtsyHtmlWithFallback(shopUrl, 'fr-FR,fr;q=0.9,en;q=0.8');
  if (!html) {
    throw new Error('SCRAPE_FAILED');
  }
  const $ = cheerio.load(html);
  const pageText = $('body').text();

  const h1 = $('h1').first().text().trim();
  const title = $('title').text().replace(/\s*\|\s*Etsy.*$/i, '').trim();
  const shopName = h1 || title || shopInput;

  const metrics = extractShopMetrics($, pageText);
  const extraCounts = extractShopExtraCounts(html, pageText);
  const shopSlugMatch = shopUrl.match(/\/shop\/([^/?#]+)/);
  const shopSlug = shopSlugMatch ? decodeURIComponent(shopSlugMatch[1]) : null;
  const branding = extractShopBranding($, html, shopSlug);

  const ldCap = Math.max(maxListings, 40);
  const listingsFromLd = extractListingsFromLdJson($, ldCap);
  const fromAnchors: ScrapedListing[] = $('a[href*="/listing/"]')
    .toArray()
    .slice(0, Math.min(200, maxListings * 4))
    .map((el) => {
      const anchor = $(el);
      const href = anchor.attr('href') || '';
      const u = href.startsWith('http') ? href.split('?')[0] : `https://www.etsy.com${href}`.split('?')[0];
      const card = anchor.closest('li, div');
      const titleText =
        anchor.attr('title') ||
        anchor.find('h3').first().text().trim() ||
        card.find('h3').first().text().trim() ||
        '';
      const priceText =
        card.find('[class*="price"]').first().text() || anchor.parent().find('[class*="price"]').first().text();
      const price = parsePriceValue(priceText);
      const image =
        card.find('img').first().attr('src') ||
        card.find('img').first().attr('data-src') ||
        '';
      return {
        title: titleText || 'Listing Etsy',
        url: u,
        price: Number.isFinite(price) ? price : 0,
        images: image ? [image] : [],
      };
    })
    .filter((l) => l.url.includes('/listing/'));

  const merged = dedupeListings([...listingsFromLd, ...fromAnchors]);
  const targetListings = merged.slice(0, maxListings);

  const detailedListings: ScrapedListing[] = [];
  const concurrency = 4;
  for (let i = 0; i < targetListings.length; i += concurrency) {
    const batch = targetListings.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (l) => {
        const details = await enrichListing(l.url);
        const detailsMissing =
          Object.keys(details).length === 0 ||
          (!details.images?.length &&
            !details.tags?.length &&
            !details.materials?.length &&
            !details.description &&
            !details.hasVideo);
        return {
          ...l,
          ...details,
          title: details.title && details.title.length > l.title.length ? details.title : l.title,
          price: details.price && details.price > 0 ? details.price : l.price,
          images: details.images && details.images.length ? details.images : l.images,
          tags: details.tags && details.tags.length ? details.tags : l.tags,
          isPartialData: Boolean(details.isPartialData || detailsMissing),
        } as ScrapedListing;
      })
    );
    detailedListings.push(...batchResults);
  }

  const derived = computeDerivedShopStats(
    detailedListings,
    metrics.salesCount,
    metrics.reviewCount,
    extraCounts.activeListingCount,
    extraCounts.favoritesCount
  );

  return {
    shopName,
    shopUrl,
    salesCount: metrics.salesCount,
    rating: metrics.rating,
    reviewCount: metrics.reviewCount,
    shopAge: metrics.shopAge,
    location: '',
    bannerUrl: branding.bannerUrl,
    logoUrl: branding.logoUrl,
    activeListingCount: extraCounts.activeListingCount,
    favoritesCount: extraCounts.favoritesCount,
    derived,
    listings: detailedListings,
  };
}
