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

export interface KeywordResearchResult {
  keyword: string;
  sourceUrl: string;
  generatedAt: string;
  metrics: KeywordMetrics;
  scores: KeywordScores;
  listings: EtsyKeywordListing[];
  strategicInsights: KeywordStrategicInsights;
  suggestions: string[];
}

export interface KeywordResearchHistoryItem {
  id: string;
  keyword: string;
  sourceUrl: string;
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
  createdAt: string;
  strategicInsights?: KeywordStrategicInsights | null;
  suggestions?: string[] | null;
  rawListings?: EtsyKeywordListing[] | null;
}
