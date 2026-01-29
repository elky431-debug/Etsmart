// Etsmart Types

export type Niche = 
  | 'personalized-gifts'
  | 'wedding'
  | 'home-decor'
  | 'pets'
  | 'baby'
  | 'wellness'
  | 'jewelry'
  | 'art'
  | 'vintage'
  | 'crafts'
  | 'sport'
  | 'fashion'
  | 'kitchen'
  | 'garden'
  | 'custom';

export interface NicheInfo {
  id: Niche;
  name: string;
  description: string;
  icon: string;
  avgCompetition: 'low' | 'medium' | 'high';
  avgDemand: 'low' | 'medium' | 'high';
}

export interface SupplierProduct {
  id: string;
  url: string;
  source: 'aliexpress' | 'alibaba';
  title: string;
  description: string;
  images: string[];
  price: number;
  currency: string;
  variants: ProductVariant[];
  category: string;
  shippingTime: string;
  minOrderQuantity: number;
  supplierRating: number;
  createdAt: Date;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  image?: string;
  stock?: number;
}

export interface EtsyCompetitor {
  id: string;
  shopName: string;
  shopUrl: string;
  listingUrl: string;
  listingTitle: string;
  listingImage: string;
  price: number;
  currency: string;
  totalSales: number;
  listingAge: number; // in days
  reviews: number;
  rating: number;
  estimatedMonthlySales: number;
  estimatedMonthlyRevenue: number;
}

export interface LaunchPotentialScore {
  score: number; // Score sur 10 (0-10)
  tier: 'saturated' | 'competitive' | 'favorable'; // Tranche : 0-3 / 4-7 / 8-10
  verdict: string; // Verdict texte court
  explanation: string; // Explication détaillée
  scoreJustification: string; // Justification détaillée du score en 3-4 lignes
  badge: '🔴' | '🟡' | '🟢'; // Badge visuel
  factors: {
    competitionDensity: 'low' | 'medium' | 'high';
    nicheSaturation: 'low' | 'medium' | 'high';
    productSpecificity: 'low' | 'medium' | 'high';
  };
}

export interface CompetitorAnalysis {
  // ⚠️ DEPRECATED: Ne plus afficher totalCompetitors dans l'UI
  // Conservé pour compatibilité interne uniquement
  totalCompetitors: number;
  competitorEstimationReliable: boolean; // false si peu fiable
  competitorEstimationReasoning: string; // Explication de la méthodologie
  competitors: EtsyCompetitor[];
  marketStructure: 'dominated' | 'fragmented' | 'open';
  dominantSellers: number;
  avgPrice: number;
  priceRange: { min: number; max: number };
  avgReviews: number;
  avgRating: number;
  // Prix moyen du marché (nouvelle estimation)
  averageMarketPrice: number;
  marketPriceRange: { min: number; max: number };
  marketPriceReasoning: string;
  // ═══════════════════════════════════════════════════════════════════════════
  // NOUVEAU: Launch Potential Score (remplace l'affichage du nombre de concurrents)
  // ═══════════════════════════════════════════════════════════════════════════
  launchPotentialScore?: LaunchPotentialScore;
}

export interface RevenueEstimation {
  competitor: EtsyCompetitor;
  estimatedMonthlySales: number;
  estimatedMonthlyRevenue: number;
  confidenceLevel: 'low' | 'medium' | 'high';
}

export interface SaturationAnalysis {
  phase: 'launch' | 'growth' | 'saturation' | 'decline';
  phasePercentage: number;
  newSellersRate: number; // per month
  listingGrowthRate: number; // percentage
  saturationProbability: number;
  estimatedSaturationDate?: Date;
  declineRisk: 'low' | 'medium' | 'high';
  seasonality: SeasonalityData;
}

export interface SeasonalityData {
  isSeasonalProduct: boolean;
  peakMonths: number[];
  lowMonths: number[];
  currentSeasonImpact: 'positive' | 'neutral' | 'negative';
}

export interface LaunchSimulation {
  timeToFirstSale: {
    withoutAds: { min: number; max: number; expected: number }; // in days
    withAds: { min: number; max: number; expected: number };
  };
  threeMonthProjection: {
    conservative: SalesProjection;
    realistic: SalesProjection;
    optimistic: SalesProjection;
  };
  successProbability: number;
  keyFactors: string[];
}

export interface SalesProjection {
  estimatedSales: number;
  estimatedRevenue: number;
  estimatedProfit: number;
  marginPercentage: number;
}

export interface PricingRecommendation {
  recommendedPrice: number;
  aggressivePrice: number;
  premiumPrice: number;
  currency: string;
  justification: string;
  competitorPriceAnalysis: {
    below25: number;
    median: number;
    above75: number;
  };
  priceStrategy: {
    launch: number;
    stable: number;
    premium: number;
  };
  marginAnalysis: {
    atRecommendedPrice: number;
    atAggressivePrice: number;
    atPremiumPrice: number;
  };
}

export interface MarketingAngle {
  id: string;
  title: string;
  description: string;
  whyItWorks: string;
  competitionLevel: 'low' | 'medium' | 'high';
  emotionalTriggers: string[];
  suggestedKeywords: string[];
  targetAudience: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOUVELLE STRUCTURE MARKETING STRATÉGIQUE
// ═══════════════════════════════════════════════════════════════════════════════

export interface StrategicPositioning {
  mainPositioning: string; // Ex: "Cadeau émotionnel", "Objet déco unique"
  justification: string; // Basé sur analyse concurrents
  competitiveAdvantage: string; // Ce que ça permet de faire mieux
}

export interface UnderexploitedAngle {
  angle: string;
  whyUnderexploited: string;
  whyItCanWork: string;
  competitionLevel: 'low' | 'medium' | 'high';
}

export interface CompetitorMistake {
  mistake: string;
  frequency: 'common' | 'frequent' | 'very_frequent';
}

export interface VisualRecommendation {
  recommendation: string;
  impact: string; // Orienté résultat
}

export interface PsychologicalTrigger {
  trigger: string;
  explanation: string;
}

export interface AngleToAvoid {
  angle: string;
  risk: string;
}

export interface StrategicMarketing {
  positioning: StrategicPositioning;
  underexploitedAngles: UnderexploitedAngle[]; // 2-3 max
  competitorMistakes: CompetitorMistake[]; // 3-5 max
  visualRecommendations: VisualRecommendation[]; // 3 max
  psychologicalTriggers: PsychologicalTrigger[]; // 2-4 max
  anglesToAvoid: AngleToAvoid[]; // 2-3 max
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING ACQUISITION IA
// ═══════════════════════════════════════════════════════════════════════════════

export interface TargetAudience {
  ageRange: string; // Ex: "25-40 ans"
  situation: string; // Ex: "jeunes, parents, couples"
  buyingBehavior: 'impulsive' | 'reflective';
  description: string; // Description complète du profil dominant
}

export interface AcquisitionChannel {
  primary: 'tiktok' | 'facebook' | 'instagram' | 'pinterest';
  secondary?: 'tiktok' | 'facebook' | 'instagram' | 'pinterest';
  justification: string; // Pourquoi ce canal est recommandé
  notSuitableForTikTok?: boolean; // Si le produit n'est pas adapté à TikTok
}

export interface TikTokIdea {
  title: string; // Titre court du concept
  concept: string; // Principe de la vidéo en 1 phrase
  whatToShow: string; // Ce qu'on montre à l'écran
  whyViral: string; // Pourquoi ça peut devenir viral
}

export interface FacebookIdea {
  title: string; // Titre du concept
  concept: string; // Principe du contenu
  whatToShow: string; // Ce qu'on montre
  whyEffective: string; // Pourquoi c'est efficace sur Facebook
}

export interface AcquisitionMarketing {
  targetAudience: TargetAudience;
  acquisitionChannel: AcquisitionChannel;
  tiktokIdeas: TikTokIdea[]; // 2-3 max
  facebookIdeas?: FacebookIdea[]; // Si Facebook est recommandé
}

export interface MarketingAnalysis {
  angles: MarketingAngle[];
  topKeywords: string[];
  emotionalHooks: string[];
  occasions: string[];
  // Nouvelle analyse stratégique
  strategic?: StrategicMarketing;
  // Marketing Acquisition IA
  acquisition?: AcquisitionMarketing;
}

export type Verdict = 'launch' | 'test' | 'avoid';

export interface ProductVerdict {
  verdict: Verdict;
  confidenceScore: number;
  improvements: string[];
  summary: string;
  
  // AI-powered fields
  aiComment?: string;
  difficultyAnalysis?: string;
  competitionComment?: string;
  competitorEstimationReasoning?: string;
  viralTitleEN?: string;
  seoTags?: string[];
  launchTips?: string[];
  
  // Description visuelle par l'IA
  productVisualDescription?: string;
  
  // Recherche Etsy optimisée par IA
  etsySearchQuery?: string;
  
  // Prix fournisseur estimé par l'IA
  estimatedSupplierPrice?: number;
  estimatedShippingCost?: number;
  supplierPriceReasoning?: string;
  
  // Avertissement si données de fallback utilisées
  warningIfAny?: string | null;
}

export interface ProductAnalysis {
  id: string;
  product: SupplierProduct;
  niche: Niche;
  competitors: CompetitorAnalysis;
  saturation: SaturationAnalysis;
  launchSimulation: LaunchSimulation;
  pricing: PricingRecommendation;
  marketing: MarketingAnalysis;
  verdict: ProductVerdict;
  analyzedAt: Date;
  analysisVersion: string;
  dataSource: 'real' | 'estimated'; // Indicates if data comes from real Etsy scraping or estimates
}

export interface BoutiqueAnalysis {
  id: string;
  niche: Niche;
  products: ProductAnalysis[];
  globalScore: number;
  coherenceScore: number;
  nicheViability: 'high' | 'medium' | 'low';
  globalRisk: 'high' | 'medium' | 'low';
  priorityProducts: string[]; // product ids in order
  recommendedLaunchStrategy: string;
  analyzedAt: Date;
}

// Store State Types
export interface AppState {
  currentStep: 1 | 2 | 3 | 4;
  selectedNiche: Niche | null;
  customNiche: string;
  products: SupplierProduct[];
  analyses: ProductAnalysis[];
  boutiqueAnalysis: BoutiqueAnalysis | null;
  isAnalyzing: boolean;
  error: string | null;
}

