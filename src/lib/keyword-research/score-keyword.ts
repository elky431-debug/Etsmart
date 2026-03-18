import {
  AluraOverviewMetrics,
  BuyerIntentLevel,
  EtsyKeywordListing,
  KeywordShape,
  KeywordMetrics,
  KeywordResearchResult,
  KeywordScores,
  KeywordStrategicInsights,
} from './types';

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function tokenizeKeyword(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeTopShopsConcentration(listings: EtsyKeywordListing[]): number {
  if (!listings.length) return 0;

  const shopMap = new Map<string, number>();
  for (const listing of listings) {
    const key = (listing.shopName || '').trim().toLowerCase();
    if (!key) continue;
    shopMap.set(key, (shopMap.get(key) || 0) + 1);
  }
  if (!shopMap.size) {
    const strongListings = listings.filter((l) => (l.reviewCount ?? 0) >= 100);
    return round2((strongListings.length / listings.length) * 100);
  }

  const top3Presence = [...shopMap.values()]
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, count) => sum + count, 0);
  return round2((top3Presence / listings.length) * 100);
}

function toBuyerIntentLevel(intentScore: number): BuyerIntentLevel {
  if (intentScore >= 70) return 'High';
  if (intentScore >= 40) return 'Medium';
  return 'Low';
}

function toKeywordShape(keyword: string): KeywordShape {
  const words = tokenizeKeyword(keyword);
  if (words.length >= 4) return 'Long-tail';
  if (words.length >= 2) return 'Niche';
  return 'Broad';
}

function computeIntentScore(keyword: string): number {
  const lowered = keyword.toLowerCase();
  const words = tokenizeKeyword(keyword);

  const strongCommercialTerms = [
    'gift',
    'printable',
    'digital',
    'custom',
    'personalized',
    'template',
    'invitation',
    'svg',
    'png',
    'shirt',
    'mug',
    'sticker',
  ];
  const mediumCommercialTerms = ['for her', 'for him', 'bundle', 'set', 'instant download'];

  // Base neutral score, then boost/punish based on transactional terms and keyword shape.
  let score = 35;
  for (const term of strongCommercialTerms) {
    if (lowered.includes(term)) score += 7;
  }
  for (const term of mediumCommercialTerms) {
    if (lowered.includes(term)) score += 5;
  }

  if (words.length <= 1) score -= 20;
  if (words.length === 2) score -= 8;
  if (words.length >= 4) score += 8;
  if (words.length >= 6) score += 4;

  return Math.round(clamp(score, 5, 95));
}

function computeDemandScore(
  keyword: string,
  listings: EtsyKeywordListing[],
  metrics: KeywordMetrics,
  intentScore: number,
  marketSizeEstimate: number | null
): number {
  const reviewValues = listings
    .map((l) => l.reviewCount)
    .filter((value): value is number => typeof value === 'number' && value >= 0);
  const ratingValues = listings
    .map((l) => l.rating)
    .filter((value): value is number => typeof value === 'number' && value > 0);

  const activeListingRatio =
    listings.length > 0
      ? listings.filter((l) => (l.reviewCount ?? 0) >= 20).length / listings.length
      : 0;
  const strongListingRatio =
    listings.length > 0
      ? listings.filter((l) => (l.reviewCount ?? 0) >= 80 || (l.rating ?? 0) >= 4.8).length /
        listings.length
      : 0;
  const reviewMedian = median(reviewValues);
  const averageReviews = metrics.averageReviewCount;
  const marketSignal = marketSizeEstimate ? clamp(Math.log10(marketSizeEstimate + 1) / 6.2, 0, 1) : 0.45;
  const reviewSignal = clamp(Math.log10(averageReviews + 1) / 3.1, 0, 1);
  const medianSignal = clamp(Math.log10(reviewMedian + 1) / 3, 0, 1);
  const ratingSignal = ratingValues.length ? clamp(avg(ratingValues) / 5, 0, 1) : 0.6;
  const bestsellerRatio =
    listings.length > 0 ? listings.filter((l) => l.isBestSeller).length / listings.length : 0;
  const broadPenalty = toKeywordShape(keyword) === 'Broad' ? 6 : 0;
  const intentCompensation = clamp(intentScore / 100, 0, 1) * 8;

  // Demand is not tied only to result count: we blend market size + social proof + listing quality.
  const score =
    marketSignal * 38 +
    reviewSignal * 24 +
    medianSignal * 16 +
    strongListingRatio * 10 +
    activeListingRatio * 6 +
    ratingSignal * 4 +
    bestsellerRatio * 2 +
    intentCompensation -
    broadPenalty;
  return Math.round(clamp(score, 8, 98));
}

function computeCompetitionScore(
  listings: EtsyKeywordListing[],
  metrics: KeywordMetrics,
  marketSizeEstimate: number | null
): number {
  const averageReviews = metrics.averageReviewCount;
  const listingDensity = listings.length ? clamp(listings.length / 24, 0, 1) : 0;
  const marketPressure = marketSizeEstimate
    ? clamp(Math.log10(marketSizeEstimate + 1) / 6.2, 0, 1)
    : listingDensity;
  const reviewPressure = clamp(Math.log10(averageReviews + 1) / 3.2, 0, 1);
  const concentration = clamp(metrics.topShopsConcentration / 100, 0, 1);
  const highRatedRatio =
    listings.length > 0
      ? listings.filter((l) => (l.rating ?? 0) >= 4.7).length / listings.length
      : 0;
  const highReviewRatio =
    listings.length > 0
      ? listings.filter((l) => (l.reviewCount ?? 0) >= 500).length / listings.length
      : 0;

  // Competition captures how hard it is to enter top results for this term.
  const score =
    marketPressure * 34 +
    reviewPressure * 24 +
    concentration * 22 +
    highReviewRatio * 12 +
    highRatedRatio * 8;
  return Math.round(clamp(score, 5, 98));
}

function computeOpportunityScore(
  demandScore: number,
  competitionScore: number,
  intentScore: number
): number {
  const value = demandScore * 0.44 + (100 - competitionScore) * 0.34 + intentScore * 0.22;
  return Math.round(clamp(value, 0, 100));
}

function computeGlobalScore(
  opportunityScore: number,
  demandScore: number,
  intentScore: number
): number {
  const value = opportunityScore * 0.55 + demandScore * 0.25 + intentScore * 0.2;
  return Math.round(clamp(value, 0, 100));
}

function toSaturationLevel(competitionScore: number): KeywordScores['saturationLevel'] {
  if (competitionScore >= 70) return 'High';
  if (competitionScore >= 45) return 'Medium';
  return 'Low';
}

function toDifficultyLevel(
  competitionScore: number,
  topShopsConcentration: number
): KeywordScores['difficulty'] {
  const combined = competitionScore * 0.7 + topShopsConcentration * 0.3;
  if (combined >= 70) return 'Hard';
  if (combined >= 45) return 'Medium';
  return 'Easy';
}

function toVerdict(
  globalScore: number,
  demandScore: number,
  intentScore: number,
  competitionScore: number
): KeywordScores['verdict'] {
  if (globalScore >= 68 && demandScore >= 50 && intentScore >= 45 && competitionScore <= 75) {
    return 'Launch';
  }
  if (globalScore >= 42 && demandScore >= 35) return 'Test';
  return 'Avoid';
}

export function computeKeywordMetrics(
  listings: EtsyKeywordListing[],
  marketSizeEstimate: number | null = null
): KeywordMetrics {
  const prices = listings.map((l) => l.price).filter((v): v is number => typeof v === 'number');
  const reviews = listings
    .map((l) => l.reviewCount)
    .filter((v): v is number => typeof v === 'number');

  const averagePrice = prices.length ? round2(avg(prices)) : 0;
  const averageReviewCount = reviews.length ? round2(avg(reviews)) : 0;
  const topShopsConcentration = computeTopShopsConcentration(listings);

  return {
    averagePrice,
    averageReviewCount,
    topShopsConcentration,
    listingsCount: listings.length,
    marketSizeEstimate,
  };
}

export function computeKeywordScores(
  keyword: string,
  listings: EtsyKeywordListing[],
  metrics: KeywordMetrics
): KeywordScores {
  const intentScore = computeIntentScore(keyword);
  const demandScore = computeDemandScore(
    keyword,
    listings,
    metrics,
    intentScore,
    metrics.marketSizeEstimate
  );
  const competitionScore = computeCompetitionScore(listings, metrics, metrics.marketSizeEstimate);
  const opportunityScore = computeOpportunityScore(demandScore, competitionScore, intentScore);
  const globalScore = computeGlobalScore(opportunityScore, demandScore, intentScore);
  const buyerIntentLevel = toBuyerIntentLevel(intentScore);
  const keywordShape = toKeywordShape(keyword);

  return {
    globalScore,
    intentScore,
    demandScore,
    competitionScore,
    opportunityScore,
    saturationLevel: toSaturationLevel(competitionScore),
    difficulty: toDifficultyLevel(competitionScore, metrics.topShopsConcentration),
    buyerIntentLevel,
    keywordShape,
    verdict: toVerdict(globalScore, demandScore, intentScore, competitionScore),
  };
}

export function fallbackStrategicInsights(
  keyword: string,
  metrics: KeywordMetrics,
  scores: KeywordScores
): KeywordStrategicInsights {
  const saturationMsg =
    scores.saturationLevel === 'High'
      ? 'Le marché est déjà très occupé par des listings établis.'
      : scores.saturationLevel === 'Medium'
      ? 'Le marché est compétitif mais encore jouable.'
      : 'Le marché semble encore peu saturé.';

  const angle =
    scores.difficulty === 'Hard'
      ? 'Se différencier par une proposition ultra-spécifique (niche, style, personnalisation).'
      : 'Tester une offre claire orientée bénéfice client avec visuels premium et SEO long-tail.';

  return {
    summary: `Le mot-clé "${keyword}" montre un potentiel ${
      scores.opportunityScore >= 60 ? 'intéressant' : 'limité'
    } avec une demande ${scores.demandScore >= 60 ? 'solide' : 'modérée/faible'}, une concurrence ${
      scores.competitionScore >= 60 ? 'élevée' : 'gérable'
    } et une intention acheteur ${scores.buyerIntentLevel.toLowerCase()}.`,
    strengths: [
      `Demande estimée à ${scores.demandScore}/100.`,
      `Taille de marche observee: ${
        metrics.marketSizeEstimate ? metrics.marketSizeEstimate.toLocaleString('en-US') : 'N/A'
      } resultats Etsy.`,
      `Prix moyen observé: ${metrics.averagePrice > 0 ? `${metrics.averagePrice}` : 'N/A'}.`,
      `Concentration top shops: ${metrics.topShopsConcentration}%.`,
      `Intent score: ${scores.intentScore}/100.`,
    ],
    weaknesses: [
      saturationMsg,
      `Difficulté estimée: ${scores.difficulty}.`,
      metrics.averageReviewCount > 120
        ? 'Les listings top ont déjà beaucoup de preuve sociale.'
        : 'Preuve sociale parfois faible sur certains résultats.',
    ],
    recommendations: [
      'Travailler un angle long-tail (usage, occasion, audience) au lieu du mot-clé trop générique.',
      'Optimiser miniatures + vidéo + USP claire dès les premiers visuels.',
      'Tester 2-3 variations de pricing pour trouver le meilleur CTR/conversion.',
    ],
    strategicAngle: angle,
    verdictExplanation:
      scores.verdict === 'Launch'
        ? 'Le ratio demande/concurrence est assez favorable pour lancer rapidement.'
        : scores.verdict === 'Test'
        ? 'Le marché mérite un test contrôlé avant un investissement important.'
        : 'Le marché semble trop difficile actuellement pour un lancement direct.',
  };
}

export function generateKeywordSuggestions(keyword: string): string[] {
  const base = keyword.trim().toLowerCase();
  if (!base) return [];
  const patterns = [
    `${base} personalized`,
    `${base} gift`,
    `${base} handmade`,
    `${base} for women`,
    `${base} for men`,
    `${base} printable`,
    `${base} custom`,
    `${base} minimalist`,
    `${base} boho`,
    `${base} small business`,
  ];
  return Array.from(new Set(patterns)).slice(0, 10);
}

/**
 * Scores : le **score global** = `keyword_score` Alura (0–100).
 * Demand / Competition / Opportunity = lecture complémentaire à partir des mêmes données.
 */
export function computeScoresFromAluraOverview(
  keyword: string,
  overview: AluraOverviewMetrics,
  listings: EtsyKeywordListing[]
): KeywordScores {
  const topConc = listings.length ? computeTopShopsConcentration(listings) : 35;
  const ev = overview.etsyVolumeMonthly ?? 0;
  const demandScore = Math.round(clamp(18 + Math.log10(Math.max(ev, 1) + 1) * 15, 12, 98));

  const level = (overview.competitionLevel || '').toLowerCase();
  let competitionScore = 55;
  if (level === 'low') competitionScore = 30;
  else if (level === 'medium') competitionScore = 56;
  else if (level === 'high') competitionScore = 80;
  else if (level.includes('very')) competitionScore = 90;
  else {
    const cl = overview.competingListings ?? 0;
    competitionScore = Math.round(clamp(Math.log10(cl + 10) * 19, 18, 92));
  }

  const intentScore = computeIntentScore(keyword);
  const conv = overview.avgConversionRate ?? 0;
  const convBoost = conv >= 0.03 ? 10 : conv >= 0.02 ? 6 : conv >= 0.015 ? 3 : 0;

  const fromAlura =
    overview.keywordScore != null && Number.isFinite(overview.keywordScore)
      ? Math.round(clamp(overview.keywordScore, 0, 100))
      : null;

  const opportunityFirst = computeOpportunityScore(demandScore, competitionScore, intentScore);
  const globalScore =
    fromAlura ?? Math.round(computeGlobalScore(opportunityFirst, demandScore, intentScore));

  const opportunityScore = Math.round(
    clamp(globalScore * 0.5 + demandScore * 0.22 + (100 - competitionScore) * 0.18 + convBoost, 10, 98)
  );

  const saturationLevel: KeywordScores['saturationLevel'] =
    level === 'low' ? 'Low' : level === 'medium' ? 'Medium' : level === 'high' || level.includes('very') ? 'High' : toSaturationLevel(competitionScore);

  const difficulty: KeywordScores['difficulty'] =
    level === 'low' ? 'Easy' : level === 'medium' ? 'Medium' : level === 'high' || level.includes('very') ? 'Hard' : toDifficultyLevel(competitionScore, topConc);

  const verdict: KeywordScores['verdict'] =
    globalScore >= 75 && level !== 'high' && !level.includes('very')
      ? 'Launch'
      : globalScore >= 40
        ? 'Test'
        : 'Avoid';

  return {
    globalScore,
    intentScore,
    demandScore,
    competitionScore,
    opportunityScore,
    saturationLevel,
    difficulty,
    buyerIntentLevel: toBuyerIntentLevel(intentScore),
    keywordShape: overview.longTailKeyword ? 'Long-tail' : toKeywordShape(keyword),
    verdict,
  };
}

export function buildKeywordResult(params: {
  keyword: string;
  sourceUrl: string;
  dataSource: KeywordResearchResult['dataSource'];
  listings: EtsyKeywordListing[];
  metrics: KeywordMetrics;
  scores: KeywordScores;
  strategicInsights: KeywordStrategicInsights;
  suggestions: string[];
  aluraOverview?: AluraOverviewMetrics | null;
}): KeywordResearchResult {
  return {
    keyword: params.keyword,
    sourceUrl: params.sourceUrl,
    dataSource: params.dataSource,
    listings: params.listings,
    metrics: params.metrics,
    scores: params.scores,
    strategicInsights: params.strategicInsights,
    suggestions: params.suggestions,
    generatedAt: new Date().toISOString(),
    aluraOverview: params.aluraOverview,
  };
}
