// Etsmart Subscription Types

export type PlanId = 'smart' | 'pro' | 'scale';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

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

// Plan limits per plan type
export const PLAN_LIMITS: Record<PlanId, number> = {
  smart: 15,
  pro: 30,
  scale: 100,
};

// Stripe Price IDs for each plan
export const STRIPE_PRICE_IDS: Record<PlanId, string | null> = {
  smart: 'price_1SqHYZCn17QPHnzEGz8Ehdzz', // Etsmart Smart - $29.99/month
  pro: 'price_1SqHfuCn17QPHnzErxhIM918', // Etsmart Pro - $49.99/month
  scale: 'price_1SqOqYCn17QPHnzEplHYB7CK', // Etsmart Scale - $79.99/month
};

// Plan features configuration
export const PLAN_FEATURES: Record<PlanId, PlanFeature[]> = {
  smart: [
    { id: 'competition_analysis', name: 'Competition & saturation analysis', available: true },
    { id: 'basic_simulation', name: 'Simplified launch simulation', available: true },
    { id: 'basic_product_sheet', name: 'Basic product sheet', available: true },
    { id: 'history', name: 'Analysis history', available: true },
    { id: 'advanced_simulation', name: 'Advanced simulation (risk/effort)', available: false },
    { id: 'full_product_sheet', name: 'Complete product sheet', available: false },
    { id: 'advanced_marketing', name: 'Advanced marketing', available: false },
    { id: 'tiktok_ideas', name: 'TikTok ideas & ad channel', available: false },
    { id: 'ad_prompt', name: 'AI ad image prompt', available: false },
    { id: 'extended_market', name: 'Extended market analysis', available: false },
  ],
  pro: [
    { id: 'competition_analysis', name: 'Competition & saturation analysis', available: true },
    { id: 'basic_simulation', name: 'Simplified launch simulation', available: true },
    { id: 'full_simulation', name: 'Complete launch simulation', available: true },
    { id: 'full_product_sheet', name: 'Complete product sheet', available: true },
    { id: 'advanced_marketing', name: 'Advanced marketing', available: true },
    { id: 'tiktok_ideas', name: 'TikTok ideas & ad channel', available: true },
    { id: 'ad_prompt', name: 'AI ad image prompt', available: true },
    { id: 'history', name: 'Complete analysis history', available: true },
    { id: 'advanced_simulation', name: 'Advanced simulation (risk/effort)', available: false },
    { id: 'extended_market', name: 'Extended market analysis', available: false },
  ],
  scale: [
    { id: 'competition_analysis', name: 'Competition & saturation analysis', available: true },
    { id: 'basic_simulation', name: 'Simplified launch simulation', available: true },
    { id: 'full_simulation', name: 'Complete launch simulation', available: true },
    { id: 'advanced_simulation', name: 'Advanced simulation (risk/effort)', available: true },
    { id: 'full_product_sheet', name: 'Complete product sheet', available: true },
    { id: 'advanced_marketing', name: 'Advanced marketing', available: true },
    { id: 'tiktok_ideas', name: 'TikTok ideas & ad channel', available: true },
    { id: 'ad_prompt', name: 'AI ad image prompt', available: true },
    { id: 'extended_market', name: 'Extended market analysis', available: true },
    { id: 'advanced_history', name: 'Advanced history organization', available: true },
    { id: 'beta_features', name: 'Early access to new features (beta)', available: true },
  ],
};

// Plan definitions
export const PLANS: Plan[] = [
  {
    id: 'smart',
    name: 'Etsmart Smart',
    description: 'For Etsy sellers starting out or intermediate, who want to test products seriously without multiplying errors.',
    price: 29.99,
    currency: 'USD',
    analysesPerMonth: 15,
    features: PLAN_FEATURES.smart,
    stripePriceId: STRIPE_PRICE_IDS.smart || undefined,
    limitations: [
      'No advanced simulation',
      'Simplified marketing',
      'No in-depth buyer behavior analysis',
    ],
  },
  {
    id: 'pro',
    name: 'Etsmart Pro',
    description: 'For active sellers who want to structure their decisions and improve their marketing performance on Etsy.',
    price: 49.99,
    currency: 'USD',
    analysesPerMonth: 30,
    features: PLAN_FEATURES.pro,
    stripePriceId: STRIPE_PRICE_IDS.pro || undefined,
    popular: true,
    limitations: [
      'No global risk simulation',
      'No estimated marketing effort',
    ],
  },
  {
    id: 'scale',
    name: 'Etsmart Scale',
    description: 'For advanced sellers, high-volume shops, or users who want to test many products strategically.',
    price: 79.99,
    currency: 'USD',
    analysesPerMonth: 100,
    features: PLAN_FEATURES.scale,
    stripePriceId: STRIPE_PRICE_IDS.scale || undefined,
  },
];

// Helper functions
export function getPlanById(planId: PlanId): Plan | undefined {
  return PLANS.find(plan => plan.id === planId);
}

export function getPlanLimit(planId: PlanId): number {
  return PLAN_LIMITS[planId] || 0;
}

export function hasFeature(planId: PlanId, featureId: string): boolean {
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

