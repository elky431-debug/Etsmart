export type CompetitorShopAnalysis = {
  summary: string;
  bestSellers: { title: string; reason: string }[];
  pricingStrategy: string;
  priceRangeComment: string;
  tagInsights: { topTags: string[]; themes: string[] };
  publicationFrequency: { estimatedPerMonth: number | null; comment: string };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};
