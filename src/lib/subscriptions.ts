// Subscription management utilities

import { supabase } from './supabase';
import type { Subscription, PlanId, SubscriptionStatus } from '@/types/subscription';
import { PLAN_QUOTAS, PLAN_PRICES, PLANS } from '@/types/subscription';

/**
 * Get user's current subscription
 * This function first syncs with Stripe, then reads from the local database
 */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  // First, try to get from subscriptions table
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  
  if (!error && data) {
    return data as Subscription;
  }
  
  // If not found in subscriptions table, check users table
  // (subscription might be synced there from Stripe)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('subscriptionPlan, subscriptionStatus, analysisUsedThisMonth, analysisQuota, currentPeriodStart, currentPeriodEnd, stripeSubscriptionId, stripeCustomerId')
    .eq('id', userId)
    .single();
  
  if (userError || !userData || userData.subscriptionStatus !== 'active') {
    return null;
  }
  
  // Convert users table data to Subscription format
  const planId = userData.subscriptionPlan as PlanId;
  const plan = PLANS.find(p => p.id === planId);
  
  return {
    id: userData.stripeSubscriptionId || '',
    user_id: userId,
    plan_id: planId,
    plan_name: plan?.name || planId,
    price: PLAN_PRICES[planId] || 0,
    currency: 'USD',
    status: userData.subscriptionStatus as SubscriptionStatus,
    analyses_used_current_month: userData.analysisUsedThisMonth || 0,
    current_period_start: userData.currentPeriodStart || new Date().toISOString(),
    current_period_end: userData.currentPeriodEnd || new Date().toISOString(),
    month_reset_date: userData.currentPeriodEnd || new Date().toISOString(),
    cancel_at_period_end: false,
    stripe_subscription_id: userData.stripeSubscriptionId,
    stripe_customer_id: userData.stripeCustomerId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Subscription;
}

/**
 * Check if user can perform an analysis
 */
export async function canPerformAnalysis(userId: string): Promise<{
  allowed: boolean;
  subscription: Subscription | null;
  remaining: number;
  limit: number;
}> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return {
      allowed: false,
      subscription: null,
      remaining: 0,
      limit: 0,
    };
  }
  
  const limit = PLAN_QUOTAS[subscription.plan_id] || 0;
  const used = subscription.analyses_used_current_month || 0;
  const remaining = Math.max(0, limit - used);
  const allowed = used < limit;
  
  return {
    allowed,
    subscription,
    remaining,
    limit,
  };
}

/**
 * Increment analysis count for user
 */
export async function incrementAnalysisCount(userId: string): Promise<boolean> {
  // Use the database function to increment and check limits
  const { data, error } = await supabase.rpc('increment_analysis_count', {
    p_user_id: userId,
  });
  
  if (error) {
    console.error('Error incrementing analysis count:', error);
    return false;
  }
  
  return data === true;
}

/**
 * Get usage statistics for current month
 */
export async function getUsageStats(userId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  resetDate: Date | null;
}> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    // Also check users table directly
    const { data: userData } = await supabase
      .from('users')
      .select('subscriptionPlan, subscriptionStatus, analysisUsedThisMonth, analysisQuota, currentPeriodEnd')
      .eq('id', userId)
      .single();
    
    if (userData && userData.subscriptionStatus === 'active') {
      const limit = userData.analysisQuota || PLAN_QUOTAS[userData.subscriptionPlan as PlanId] || 0;
      const used = userData.analysisUsedThisMonth || 0;
      const remaining = Math.max(0, limit - used);
      const percentage = limit > 0 ? (used / limit) * 100 : 0;
      const resetDate = userData.currentPeriodEnd ? new Date(userData.currentPeriodEnd) : null;
      
      return { used, limit, remaining, percentage, resetDate };
    }
    
    return {
      used: 0,
      limit: 0,
      remaining: 0,
      percentage: 0,
      resetDate: null,
    };
  }
  
  const limit = PLAN_QUOTAS[subscription.plan_id] || 0;
  const used = subscription.analyses_used_current_month || 0;
  const remaining = Math.max(0, limit - used);
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const resetDate = subscription.month_reset_date ? new Date(subscription.month_reset_date) : null;
  
  return {
    used,
    limit,
    remaining,
    percentage,
    resetDate,
  };
}

