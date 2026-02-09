// Etsmart Subscription Types - Updated per requirements

export type PlanId = 'FREE' | 'SMART' | 'PRO' | 'SCALE' | 'INFINITY';

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
// -1 means unlimited
export const PLAN_QUOTAS: Record<PlanId, number> = {
  FREE: 0,
  SMART: 60,
  PRO: 120,
  SCALE: 200,
  INFINITY: -1, // -1 means unlimited
};

// Plan prices per plan type (as per requirements)
export const PLAN_PRICES: Record<PlanId, number> = {
  FREE: 0,
  SMART: 19.99,
  PRO: 29.99,
  SCALE: 59.99,
  INFINITY: 219.99,
};

// Stripe Price IDs for each plan (PRODUCTION - All in EUR)
export const STRIPE_PRICE_IDS: Record<PlanId, string | null> = {
  FREE: null,
  SMART: 'price_1SuZeOCn17QPHnzEKg8ix1VD', // Etsmart Smart - €19.99/month
  PRO: 'price_1SuZj2Cn17QPHnzEzSlaXWuh', // Etsmart Pro - €29.99/month
  SCALE: null, // Etsmart Scale - €59.99/month (Price ID to be updated)
  INFINITY: 'price_1SyzZ0Cn17QPHnzEuRynPNzi', // Etsmart Infinity - Unlimited credits
};

// All plans have access to all features - only difference is number of analyses per month
const ALL_FEATURES: PlanFeature[] = [
  { id: 'analyse_simulation', name: 'Analyse IA & simulation de lancement', available: true },
  { id: 'competitors', name: 'Espionnage des boutiques concurrentes', available: true },
  { id: 'history', name: 'Historique complet de vos analyses', available: true },
  { id: 'quick_generate', name: 'Génération rapide listing + images', available: true },
  { id: 'listing', name: 'Création de listings optimisés SEO', available: true },
  { id: 'images', name: 'Génération d\'images produit par IA', available: true },
  { id: 'prompt_universel', name: 'Prompt universel pour vos visuels', available: true },
  { id: 'top_sellers', name: 'Découverte des top sellers Etsy', available: true },
  { id: 'trends', name: 'Tendances Etsy en temps réel', available: true },
  { id: 'niche_finder', name: 'Recherche de niches rentables', available: true },
];

// Plan features configuration - all plans have the same features
export const PLAN_FEATURES: Record<PlanId, PlanFeature[]> = {
  FREE: [],
  SMART: ALL_FEATURES,
  PRO: ALL_FEATURES,
  SCALE: ALL_FEATURES,
  INFINITY: ALL_FEATURES,
};

// Plan definitions
export const PLANS: Plan[] = [
  {
    id: 'SMART',
    name: 'Etsmart Smart',
    description: 'Parfait pour les vendeurs qui veulent tester des produits sérieusement. Toutes les fonctionnalités incluses.',
    price: 19.99,
    currency: 'EUR',
    analysesPerMonth: 60,
    features: PLAN_FEATURES.SMART,
    stripePriceId: STRIPE_PRICE_IDS.SMART || undefined,
  },
  {
    id: 'PRO',
    name: 'Etsmart Pro',
    description: 'Idéal pour les vendeurs actifs qui analysent plusieurs produits par mois. Toutes les fonctionnalités incluses.',
    price: 29.99,
    currency: 'EUR',
    analysesPerMonth: 120,
    features: PLAN_FEATURES.PRO,
    stripePriceId: STRIPE_PRICE_IDS.PRO || undefined,
    popular: true,
  },
  {
    id: 'SCALE',
    name: 'Etsmart Scale',
    description: 'Pour les boutiques à fort volume testant de nombreux produits stratégiquement. Toutes les fonctionnalités incluses.',
    price: 59.99,
    currency: 'EUR',
    analysesPerMonth: 200,
    features: PLAN_FEATURES.SCALE,
    stripePriceId: STRIPE_PRICE_IDS.SCALE || undefined,
  },
  {
    id: 'INFINITY',
    name: 'Etsmart Infinity',
    description: 'Pour les professionnels qui ont besoin de crédits illimités. Toutes les fonctionnalités incluses.',
    price: 219.99,
    currency: 'EUR',
    analysesPerMonth: -1, // -1 means unlimited
    features: PLAN_FEATURES.INFINITY,
    stripePriceId: STRIPE_PRICE_IDS.INFINITY || undefined,
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
  if (currentPlan === 'SCALE') return 'INFINITY';
  return null; // INFINITY is the highest plan
}

/**
 * Check if a plan has unlimited credits
 */
export function isUnlimitedPlan(planId: PlanId): boolean {
  return planId === 'INFINITY' || PLAN_QUOTAS[planId] === -1;
}
