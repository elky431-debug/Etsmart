export type SaturationLevel = 'Low' | 'Medium' | 'High';
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
export type KeywordVerdict = 'Launch' | 'Test' | 'Avoid';
export type BuyerIntentLevel = 'Low' | 'Medium' | 'High';
export type KeywordShape = 'Broad' | 'Niche' | 'Long-tail';

export interface EtsyKeywordListing {
  id: string;
  rank: number;
  title: string;
  listingUrl: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  reviewCount: number | null;
  rating: number | null;
  shopName: string | null;
  isBestSeller: boolean;
  hasFreeShipping: boolean;
  /** Données Alura (listing tab) */
  aluraMonthlySales?: number | null;
  aluraViews?: number | null;
  aluraFavorites?: number | null;
}

/** Point mensuel (courbe volume Etsy / Google) */
export interface AluraVolumeMonth {
  year: string;
  month: string;
  monthlySearches: string;
}

/**
 * Overview API Alura v3 (`results` dans la réponse JSON).
 * Champs remplis par le parseur ; anciennes analyses peuvent avoir partiellement null.
 */
export interface AluraOverviewMetrics {
  /** Score Alura 0–100 (identique à l’app) */
  keywordScore: number | null;
  /** Volume recherche Etsy / mois (ex. 29 258) */
  etsyVolumeMonthly: number | null;
  /** Volume Google / mois */
  googleVolumeMonthly: number | null;
  competingListings: number | null;
  /** Taux conversion moyen top listings (ex. 0.0221 → 2.21 %) */
  avgConversionRate: number | null;
  competitionLevel: string | null;
  competitionGoogle: string | null;
  searchCompetitionRatio: string | null;
  viewsTopListings: number | null;
  avgViewsPerListing: number | null;
  avgFavorers: number | null;
  salesTotal: number | null;
  avgSalesPerListing: number | null;
  revenueTotal: number | null;
  avgRevenuePerListing: number | null;
  avgPriceUsd: number | null;
  avgListingAgeDays: number | null;
  avgReviewCount: number | null;
  avgReviewScore: number | null;
  etsyChangeQr: string | null;
  etsyChangeYr: string | null;
  googleChangeQr: string | null;
  googleChangeYr: string | null;
  longTailKeyword: boolean | null;
  etsyVolumes: AluraVolumeMonth[];
  googleVolumes: AluraVolumeMonth[];
  listingsAnalyzed: number | null;
}

export interface KeywordMetrics {
  averagePrice: number;
  averageReviewCount: number;
  topShopsConcentration: number;
  listingsCount: number;
  marketSizeEstimate: number | null;
}

export interface KeywordScores {
  globalScore: number;
  intentScore: number;
  demandScore: number;
  competitionScore: number;
  opportunityScore: number;
  saturationLevel: SaturationLevel;
  difficulty: DifficultyLevel;
  buyerIntentLevel: BuyerIntentLevel;
  keywordShape: KeywordShape;
  verdict: KeywordVerdict;
}

export interface KeywordStrategicInsights {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  strategicAngle: string;
  verdictExplanation: string;
}

export type KeywordDataSource = 'etsy' | 'alura' | 'rankhero';

export interface KeywordResearchResult {
  keyword: string;
  sourceUrl: string;
  generatedAt: string;
  dataSource: KeywordDataSource;
  metrics: KeywordMetrics;
  scores: KeywordScores;
  listings: EtsyKeywordListing[];
  strategicInsights: KeywordStrategicInsights;
  suggestions: string[];
  /** Présent si dataSource === 'alura' */
  aluraOverview?: AluraOverviewMetrics | null;
}

export interface KeywordResearchHistoryItem {
  id: string;
  keyword: string;
  sourceUrl: string;
  dataSource?: KeywordDataSource;
  demandScore: number;
  competitionScore: number;
  opportunityScore: number;
  saturationLevel: SaturationLevel;
  difficulty: DifficultyLevel;
  verdict: KeywordVerdict;
  averagePrice: number;
  averageReviews: number;
  listingsCount: number;
  topShopsConcentration: number;
  marketSizeEstimate?: number | null;
  createdAt: string;
  strategicInsights?: KeywordStrategicInsights | null;
  suggestions?: string[] | null;
  rawListings?: EtsyKeywordListing[] | null;
  aluraOverview?: AluraOverviewMetrics | null;
}
