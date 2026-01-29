// Subscription management utilities

import { supabase } from './supabase';
import type { Subscription, PlanId, SubscriptionStatus } from '@/types/subscription';
import { PLAN_QUOTAS, PLAN_PRICES, PLANS } from '@/types/subscription';

/**
 * Get user's current subscription
 * This function checks both subscriptions and users tables
 */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  console.log('[getUserSubscription] Checking subscription for user:', userId);
  
  // First, check users table (snake_case columns!)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('subscription_plan, subscription_status, analysis_used_this_month, analysis_quota, current_period_start, current_period_end, stripe_subscription_id, stripe_customer_id')
    .eq('id', userId)
    .single();
  
  console.log('[getUserSubscription] User data:', userData, 'Error:', userError);
  
  if (!userError && userData && userData.subscription_status === 'active') {
    // Normalize plan ID to uppercase
    const planId = (userData.subscription_plan || 'FREE').toUpperCase() as PlanId;
    const plan = PLANS.find(p => p.id === planId);
    
    console.log('[getUserSubscription] Found active subscription:', planId);
    
    return {
      id: userData.stripe_subscription_id || `sub_${userId}`,
      user_id: userId,
      plan_id: planId,
      plan_name: plan?.name || planId,
      price: PLAN_PRICES[planId] || 0,
      currency: 'USD',
      status: userData.subscription_status as SubscriptionStatus,
      analyses_used_current_month: userData.analysis_used_this_month || 0,
      current_period_start: userData.current_period_start || new Date().toISOString(),
      current_period_end: userData.current_period_end || new Date().toISOString(),
      month_reset_date: userData.current_period_end || new Date().toISOString(),
      cancel_at_period_end: false,
      stripe_subscription_id: userData.stripe_subscription_id,
      stripe_customer_id: userData.stripe_customer_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Subscription;
  }
  
  // Fallback: check subscriptions table
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  
  if (!error && data) {
    // Normalize plan ID to uppercase
    const planId = (data.plan_id || 'FREE').toUpperCase() as PlanId;
    const plan = PLANS.find(p => p.id === planId);
    
    console.log('[getUserSubscription] Found in subscriptions table:', planId);
    
    return {
      ...data,
      plan_id: planId,
      plan_name: plan?.name || planId,
      price: PLAN_PRICES[planId] || 0,
    } as Subscription;
  }
  
  console.log('[getUserSubscription] No active subscription found');
  return null;
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
    // Also check users table directly (snake_case columns!)
    const { data: userData } = await supabase
      .from('users')
      .select('subscription_plan, subscription_status, analysis_used_this_month, analysis_quota, current_period_end')
      .eq('id', userId)
      .single();
    
    if (userData && userData.subscription_status === 'active') {
      const limit = userData.analysis_quota || PLAN_QUOTAS[userData.subscription_plan as PlanId] || 0;
      const used = userData.analysis_used_this_month || 0;
      const remaining = Math.max(0, limit - used);
      const percentage = limit > 0 ? (used / limit) * 100 : 0;
      const resetDate = userData.current_period_end ? new Date(userData.current_period_end) : null;
      
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

