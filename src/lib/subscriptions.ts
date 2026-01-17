// Subscription management utilities

import { supabase } from './supabase';
import type { Subscription, PlanId, SubscriptionStatus } from '@/types/subscription';

/**
 * Get user's current subscription
 */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as Subscription;
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
  
  const planLimits: Record<PlanId, number> = {
    smart: 15,
    pro: 30,
    scale: 100,
  };
  
  const limit = planLimits[subscription.plan_id] || 0;
  const remaining = Math.max(0, limit - subscription.analyses_used_current_month);
  const allowed = subscription.analyses_used_current_month < limit;
  
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
    return {
      used: 0,
      limit: 0,
      remaining: 0,
      percentage: 0,
      resetDate: null,
    };
  }
  
  const planLimits: Record<PlanId, number> = {
    smart: 15,
    pro: 30,
    scale: 100,
  };
  
  const limit = planLimits[subscription.plan_id] || 0;
  const used = subscription.analyses_used_current_month;
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

