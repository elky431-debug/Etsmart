// Etsmart Subscription Types - Updated per requirements

export type PlanId = 'FREE' | 'SMART' | 'PRO' | 'SCALE';

export type SubscriptionStatus = 'active' | 'inactive' | 'canceled' | 'past_due';

export interface UserSubscription {
  id: string;
  user_id: string;
  subscriptionPlan: PlanId;
  subscriptionStatus: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  analysisUsedThisMonth: number;
  analysisQuota: number;
  currentPeriodStart: Date | string;
  currentPeriodEnd: Date | string;
  created_at?: string;
  updated_at?: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: PlanId;
  plan_name: string;
  price: number;
  currency: string;
  status: SubscriptionStatus;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  stripe_price_id?: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  analyses_used_current_month: number;
  month_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  price: number;
  currency: string;
  analysesPerMonth: number;
  features: PlanFeature[];
  limitations?: string[];
  popular?: boolean;
  stripePriceId?: string; // Stripe Price ID for payment integration
}

export interface PlanFeature {
  id: string;
  name: string;
  description?: string;
  available: boolean;
}

// Plan quotas per plan type (as per requirements)
export const PLAN_QUOTAS: Record<PlanId, number> = {
  FREE: 0,
  SMART: 30,
  PRO: 60,
  SCALE: 100,
};

// Plan prices per plan type (as per requirements)
export const PLAN_PRICES: Record<PlanId, number> = {
  FREE: 0,
  SMART: 19.99,
  PRO: 29.99,
  SCALE: 49.99,
};

// Stripe Price IDs for each plan (PRODUCTION - All in EUR)
export const STRIPE_PRICE_IDS: Record<PlanId, string | null> = {
  FREE: null,
  SMART: 'price_1SuZeOCn17QPHnzEKg8ix1VD', // Etsmart Smart - €19.99/month
  PRO: 'price_1SuZj2Cn17QPHnzEzSlaXWuh', // Etsmart Pro - €29.99/month
  SCALE: 'price_1SuZZdCn17QPHnzEHKehuq0O', // Etsmart Scale - €49.99/month
};

// All plans have access to all features - only difference is number of analyses per month
const ALL_FEATURES: PlanFeature[] = [
  { id: 'competition_analysis', name: 'Analyse concurrence & saturation', available: true },
  { id: 'basic_simulation', name: 'Simulation de lancement simplifiée', available: true },
  { id: 'full_simulation', name: 'Simulation de lancement complète', available: true },
  { id: 'advanced_simulation', name: 'Simulation avancée (risque/effort)', available: true },
  { id: 'full_product_sheet', name: 'Fiche produit complète', available: true },
  { id: 'advanced_marketing', name: 'Marketing avancé', available: true },
  { id: 'tiktok_ideas', name: 'Idées TikTok & canal publicitaire', available: true },
  { id: 'ad_prompt', name: 'Prompt IA pour image publicitaire', available: true },
  { id: 'extended_market', name: 'Analyse de marché étendue', available: true },
  { id: 'advanced_history', name: 'Organisation avancée de l\'historique', available: true },
  { id: 'beta_features', name: 'Accès anticipé aux nouvelles fonctionnalités (bêta)', available: true },
];

// Plan features configuration - all plans have the same features
export const PLAN_FEATURES: Record<PlanId, PlanFeature[]> = {
  FREE: [],
  SMART: ALL_FEATURES,
  PRO: ALL_FEATURES,
  SCALE: ALL_FEATURES,
};

// Plan definitions
export const PLANS: Plan[] = [
  {
    id: 'SMART',
    name: 'Etsmart Smart',
    description: 'Parfait pour les vendeurs qui veulent tester des produits sérieusement. Toutes les fonctionnalités incluses.',
    price: 19.99,
    currency: 'EUR',
    analysesPerMonth: 30,
    features: PLAN_FEATURES.SMART,
    stripePriceId: STRIPE_PRICE_IDS.SMART || undefined,
  },
  {
    id: 'PRO',
    name: 'Etsmart Pro',
    description: 'Idéal pour les vendeurs actifs qui analysent plusieurs produits par mois. Toutes les fonctionnalités incluses.',
    price: 29.99,
    currency: 'EUR',
    analysesPerMonth: 60,
    features: PLAN_FEATURES.PRO,
    stripePriceId: STRIPE_PRICE_IDS.PRO || undefined,
    popular: true,
  },
  {
    id: 'SCALE',
    name: 'Etsmart Scale',
    description: 'Pour les boutiques à fort volume testant de nombreux produits stratégiquement. Toutes les fonctionnalités incluses.',
    price: 49.99,
    currency: 'EUR',
    analysesPerMonth: 100,
    features: PLAN_FEATURES.SCALE,
    stripePriceId: STRIPE_PRICE_IDS.SCALE || undefined,
  },
];

// Helper functions
export function getPlanById(planId: PlanId): Plan | undefined {
  return PLANS.find(plan => plan.id === planId);
}

export function getPlanQuota(planId: PlanId): number {
  return PLAN_QUOTAS[planId] || 0;
}

export function hasFeature(planId: PlanId, featureId: string): boolean {
  if (planId === 'FREE') return false;
  const plan = getPlanById(planId);
  if (!plan) return false;
  
  const feature = plan.features.find(f => f.id === featureId);
  return feature?.available || false;
}

/**
 * Get Stripe Price ID for a plan
 */
export function getStripePriceId(planId: PlanId): string | null {
  return STRIPE_PRICE_IDS[planId] || null;
}

/**
 * Get upgrade suggestion based on current plan
 */
export function getUpgradeSuggestion(currentPlan: PlanId): PlanId | null {
  if (currentPlan === 'FREE') return 'SMART';
  if (currentPlan === 'SMART') return 'PRO';
  if (currentPlan === 'PRO') return 'SCALE';
  return null;
}
