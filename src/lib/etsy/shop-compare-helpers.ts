import type { ScrapedListing } from '@/lib/etsy/shop-scrape-service';
import type { ShopCompareIndicators, ShopCompareQuality } from '@/types/shop-compare';
import { clampScore, letterGradeVerbal, scoreToLetterGrade } from '@/lib/etsy/listing-letter-grade';

const TITLE_STOP = new Set(
  [
    'the',
    'and',
    'for',
    'with',
    'your',
    'from',
    'this',
    'that',
    'vous',
    'pour',
    'avec',
    'dans',
    'une',
    'des',
    'les',
    'aux',
    'sur',
    'sans',
    'plus',
    'très',
    'petit',
    'grand',
  ].map((w) => w.toLowerCase())
);

export function tagSetFromListings(listings: { tags?: string[] }[]): Set<string> {
  const s = new Set<string>();
  for (const l of listings) {
    for (const t of l.tags || []) {
      const k = t.trim().toLowerCase();
      if (k.length >= 2) s.add(k);
    }
  }
  return s;
}

export function titleKeywordSetFromListings(listings: { title: string }[]): Set<string> {
  const s = new Set<string>();
  for (const l of listings) {
    const words = (l.title || '').toLowerCase().match(/[a-zàâäéèêëïîôùûüç]{4,}/g) || [];
    for (const w of words) {
      if (!TITLE_STOP.has(w)) s.add(w);
    }
  }
  return s;
}

export function diffTagSets(a: Set<string>, b: Set<string>): {
  common: string[];
  onlyA: string[];
  onlyB: string[];
} {
  const common = [...a].filter((x) => b.has(x)).sort((x, y) => x.localeCompare(y));
  const onlyA = [...a].filter((x) => !b.has(x)).sort((x, y) => x.localeCompare(y));
  const onlyB = [...b].filter((x) => !a.has(x)).sort((x, y) => x.localeCompare(y));
  return { common, onlyA, onlyB };
}

export function listingPriceStats(listings: ScrapedListing[]): {
  min: number | null;
  max: number | null;
  avg: number | null;
} {
  const prices = listings.map((l) => l.price).filter((p) => p > 0);
  if (!prices.length) return { min: null, max: null, avg: null };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((x, y) => x + y, 0) / prices.length;
  return { min, max, avg: Math.round(avg * 100) / 100 };
}

function parseShopOpenedYear(shopAgeLabel: string | null | undefined): number | null {
  const s = (shopAgeLabel || '').trim();
  if (!s) return null;
  const m = s.match(/(19|20)\d{2}/);
  if (!m) return null;
  const y = parseInt(m[0], 10);
  return Number.isFinite(y) ? y : null;
}

function scoreSales(sales: number): number {
  if (!Number.isFinite(sales) || sales <= 0) return 18;
  if (sales >= 20_000) return 100;
  if (sales >= 5_000) return 95;
  if (sales >= 1_000) return 88;
  if (sales >= 200) return 78;
  if (sales >= 50) return 68;
  if (sales >= 10) return 54;
  if (sales >= 3) return 42;
  return 34;
}

function scoreReviews(reviews: number): number {
  if (!Number.isFinite(reviews) || reviews <= 0) return 16;
  if (reviews >= 10_000) return 100;
  if (reviews >= 2_000) return 92;
  if (reviews >= 500) return 84;
  if (reviews >= 150) return 74;
  if (reviews >= 40) return 62;
  if (reviews >= 10) return 50;
  if (reviews >= 3) return 40;
  return 32;
}

function scoreLongevity(openedYear: number | null, nowYear: number): number {
  if (!openedYear) return 55;
  const years = Math.max(0, nowYear - openedYear);
  if (years >= 10) return 100;
  if (years >= 6) return 90;
  if (years >= 4) return 82;
  if (years >= 2) return 70;
  if (years >= 1) return 58;
  return 45;
}

/**
 * Score boutique (0–100) : combine
 * - qualité moyenne des fiches (design/SEO) -> 55%
 * - crédibilité commerciale (ventes + avis + rating) -> 30%
 * - ancienneté -> 15%
 * + pénalités si échantillon très faible.
 */
export function computeShopOverallQuality(params: {
  listingQualityScore100: number;
  indicators: ShopCompareIndicators;
}): ShopCompareQuality {
  const nowYear = new Date().getFullYear();
  const openedYear = parseShopOpenedYear(params.indicators.shopAgeLabel);

  const salesScore = scoreSales(params.indicators.sales);
  const reviewsScore = scoreReviews(params.indicators.reviewCount);
  const rating = params.indicators.rating;
  const ratingFactor =
    Number.isFinite(rating) && rating > 0 && rating <= 5 ? 0.72 + (rating / 5) * 0.28 : 0.78;
  const social = Math.round(((salesScore + reviewsScore) / 2) * ratingFactor);
  const longevity = scoreLongevity(openedYear, nowYear);

  let score =
    params.listingQualityScore100 * 0.55 +
    social * 0.3 +
    longevity * 0.15;

  const n = params.indicators.listingsSampleCount;
  if (n < 8) score -= (8 - n) * 2.2; // jusqu'à ~15 pts de malus
  if (params.indicators.sales <= 5 && params.indicators.reviewCount <= 5) score -= 10; // shop très peu mature

  const score100 = clampScore(score);
  const grade = scoreToLetterGrade(score100);
  return { score100, grade, verbal: letterGradeVerbal(grade) };
}
