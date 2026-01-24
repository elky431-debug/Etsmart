/**
 * Subscription Quota Management
 * Server-side functions for managing analysis quotas
 */

import { createSupabaseAdminClient } from './supabase-admin';
import { PLAN_QUOTAS, getUpgradeSuggestion, type PlanId } from '@/types/subscription';

/**
 * Increment analysis count for user (server-side only)
 * Returns true if successful, false if quota exceeded
 */
export async function incrementAnalysisCount(userId: string): Promise<{
  success: boolean;
  used: number;
  quota: number;
  remaining: number;
  error?: string;
}> {
  const supabase = createSupabaseAdminClient();
  
  try {
    // Get current user data
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('subscriptionPlan, subscriptionStatus, analysisUsedThisMonth, analysisQuota, currentPeriodStart, currentPeriodEnd')
      .eq('id', userId)
      .single();
    
    if (fetchError || !user) {
      return {
        success: false,
        used: 0,
        quota: 0,
        remaining: 0,
        error: 'User not found',
      };
    }
    
    // Check if subscription is active
    if (user.subscriptionStatus !== 'active') {
      return {
        success: false,
        used: user.analysisUsedThisMonth || 0,
        quota: user.analysisQuota || 0,
        remaining: 0,
        error: 'Subscription is not active',
      };
    }
    
    // Check if period has expired (reset needed)
    const now = new Date();
    const periodEnd = user.currentPeriodEnd ? new Date(user.currentPeriodEnd) : null;
    
    if (periodEnd && periodEnd < now) {
      // Reset monthly quota
      const newPeriodStart = new Date();
      const newPeriodEnd = new Date();
      newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);
      
      const { error: resetError } = await supabase
        .from('users')
        .update({
          analysisUsedThisMonth: 0,
          currentPeriodStart: newPeriodStart.toISOString(),
          currentPeriodEnd: newPeriodEnd.toISOString(),
        })
        .eq('id', userId);
      
      if (resetError) {
        console.error('Error resetting quota:', resetError);
      }
      
      // After reset, used is 0
      user.analysisUsedThisMonth = 0;
    }
    
    // Check current quota
    const quota = user.analysisQuota || PLAN_QUOTAS[user.subscriptionPlan as PlanId] || 0;
    const used = user.analysisUsedThisMonth || 0;
    
    if (used >= quota) {
      return {
        success: false,
        used,
        quota,
        remaining: 0,
        error: 'Quota exceeded',
      };
    }
    
    // Increment count
    const { error: updateError } = await supabase
      .from('users')
      .update({
        analysisUsedThisMonth: used + 1,
      })
      .eq('id', userId);
    
    if (updateError) {
      return {
        success: false,
        used,
        quota,
        remaining: quota - used,
        error: updateError.message,
      };
    }
    
    return {
      success: true,
      used: used + 1,
      quota,
      remaining: quota - (used + 1),
    };
  } catch (error: any) {
    console.error('Error incrementing analysis count:', error);
    return {
      success: false,
      used: 0,
      quota: 0,
      remaining: 0,
      error: error.message,
    };
  }
}

/**
 * Get user quota information
 */
export async function getUserQuotaInfo(userId: string): Promise<{
  plan: PlanId;
  status: string;
  used: number;
  quota: number;
  remaining: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  requiresUpgrade?: PlanId;
}> {
  const supabase = createSupabaseAdminClient();
  
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('subscriptionPlan, subscriptionStatus, analysisUsedThisMonth, analysisQuota, currentPeriodStart, currentPeriodEnd')
      .eq('id', userId)
      .single();
    
    if (error || !user) {
      return {
        plan: 'FREE',
        status: 'inactive',
        used: 0,
        quota: 0,
        remaining: 0,
        periodStart: null,
        periodEnd: null,
      };
    }
    
    const quota = user.analysisQuota || PLAN_QUOTAS[user.subscriptionPlan as PlanId] || 0;
    const used = user.analysisUsedThisMonth || 0;
    const remaining = Math.max(0, quota - used);
    
    // Determine if upgrade is needed
    let requiresUpgrade: PlanId | undefined;
    if (used >= quota && user.subscriptionStatus === 'active') {
      requiresUpgrade = getUpgradeSuggestion(user.subscriptionPlan as PlanId) || undefined;
    }
    
    return {
      plan: user.subscriptionPlan as PlanId,
      status: user.subscriptionStatus,
      used,
      quota,
      remaining,
      periodStart: user.currentPeriodStart ? new Date(user.currentPeriodStart) : null,
      periodEnd: user.currentPeriodEnd ? new Date(user.currentPeriodEnd) : null,
      requiresUpgrade,
    };
  } catch (error: any) {
    console.error('Error getting user quota info:', error);
    return {
      plan: 'FREE',
      status: 'inactive',
      used: 0,
      quota: 0,
      remaining: 0,
      periodStart: null,
      periodEnd: null,
    };
  }
}

/**
 * Reset monthly quota (called by cron job)
 */
export async function resetMonthlyQuotas(): Promise<{
  reset: number;
  errors: number;
}> {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  
  try {
    // Get all users with expired periods
    const { data: users, error } = await supabase
      .from('users')
      .select('id, currentPeriodEnd')
      .not('subscriptionStatus', 'eq', 'inactive')
      .not('subscriptionStatus', 'eq', 'canceled');
    
    if (error) {
      console.error('Error fetching users for quota reset:', error);
      return { reset: 0, errors: 0 };
    }
    
    let resetCount = 0;
    let errorCount = 0;
    
    for (const user of users || []) {
      if (!user.currentPeriodEnd) continue;
      
      const periodEnd = new Date(user.currentPeriodEnd);
      if (periodEnd < now) {
        const newPeriodStart = new Date();
        const newPeriodEnd = new Date();
        newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);
        
        const { error: updateError } = await supabase
          .from('users')
          .update({
            analysisUsedThisMonth: 0,
            currentPeriodStart: newPeriodStart.toISOString(),
            currentPeriodEnd: newPeriodEnd.toISOString(),
          })
          .eq('id', user.id);
        
        if (updateError) {
          console.error(`Error resetting quota for user ${user.id}:`, updateError);
          errorCount++;
        } else {
          resetCount++;
        }
      }
    }
    
    return { reset: resetCount, errors: errorCount };
  } catch (error: any) {
    console.error('Error in resetMonthlyQuotas:', error);
    return { reset: 0, errors: 0 };
  }
}

