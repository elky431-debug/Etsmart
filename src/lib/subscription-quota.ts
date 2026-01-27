/**
 * Subscription Quota Management
 * Server-side functions for managing analysis quotas
 */

import { createSupabaseAdminClient } from './supabase-admin';
import { PLAN_QUOTAS, getUpgradeSuggestion, STRIPE_PRICE_IDS, type PlanId } from '@/types/subscription';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

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
 * Sync subscription from Stripe to database
 */
async function syncSubscriptionFromStripe(userId: string, userEmail: string): Promise<{
  plan: PlanId | null;
  status: string;
  stripeSubscriptionId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
}> {
  if (!stripe) {
    return {
      plan: null,
      status: 'inactive',
      stripeSubscriptionId: null,
      periodStart: null,
      periodEnd: null,
    };
  }

  try {
    // Find customer by email
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return {
        plan: null,
        status: 'inactive',
        stripeSubscriptionId: null,
        periodStart: null,
        periodEnd: null,
      };
    }

    const customer = customers.data[0];

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return {
        plan: null,
        status: 'inactive',
        stripeSubscriptionId: null,
        periodStart: null,
        periodEnd: null,
      };
    }

    // Explicitly type as Stripe.Subscription to access current_period_* fields
    const subscription = subscriptions.data[0] as Stripe.Subscription;
    const priceId = subscription.items.data[0]?.price.id;

    // Find plan by price ID
    let plan: PlanId | null = null;
    for (const [planId, planPriceId] of Object.entries(STRIPE_PRICE_IDS)) {
      if (planPriceId === priceId) {
        plan = planId as PlanId;
        break;
      }
    }

    if (!plan) {
      return {
        plan: null,
        status: 'inactive',
        stripeSubscriptionId: null,
        periodStart: null,
        periodEnd: null,
      };
    }

    // Update database
    const supabase = createSupabaseAdminClient();
    const quota = PLAN_QUOTAS[plan] || 0;

    // Extract period dates with proper typing
    const currentPeriodStart = subscription.current_period_start;
    const currentPeriodEnd = subscription.current_period_end;
    const subscriptionId = subscription.id;

    await supabase
      .from('users')
      .update({
        subscriptionPlan: plan,
        subscriptionStatus: 'active',
        analysisQuota: quota,
        currentPeriodStart: new Date(currentPeriodStart * 1000).toISOString(),
        currentPeriodEnd: new Date(currentPeriodEnd * 1000).toISOString(),
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscriptionId,
      })
      .eq('id', userId);

    // Also update subscriptions table
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        plan_id: plan,
        status: 'active',
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customer.id,
        current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
        current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
        analyses_used_current_month: 0,
        month_reset_date: new Date(currentPeriodEnd * 1000).toISOString(),
      }, {
        onConflict: 'user_id',
      });

    return {
      plan,
      status: 'active',
      stripeSubscriptionId: subscriptionId,
      periodStart: new Date(currentPeriodStart * 1000),
      periodEnd: new Date(currentPeriodEnd * 1000),
    };
  } catch (error: any) {
    console.error('Error syncing subscription from Stripe:', error);
    return {
      plan: null,
      status: 'inactive',
      stripeSubscriptionId: null,
      periodStart: null,
      periodEnd: null,
    };
  }
}

/**
 * Get user quota information
 * Checks database first, then syncs from Stripe if needed
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
    // First, get user data including email
    const { data: user, error } = await supabase
      .from('users')
      .select('subscriptionPlan, subscriptionStatus, analysisUsedThisMonth, analysisQuota, currentPeriodStart, currentPeriodEnd, email')
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

    // If subscription is not active in database, check Stripe directly
    if (user.subscriptionStatus !== 'active' && stripe && user.email) {
      console.log(`[Subscription Sync] User ${userId} has inactive subscription in DB, checking Stripe...`);
      const stripeData = await syncSubscriptionFromStripe(userId, user.email);
      
      if (stripeData.status === 'active' && stripeData.plan) {
        // Re-fetch user data after sync
        const { data: updatedUser } = await supabase
          .from('users')
          .select('subscriptionPlan, subscriptionStatus, analysisUsedThisMonth, analysisQuota, currentPeriodStart, currentPeriodEnd')
          .eq('id', userId)
          .single();
        
        if (updatedUser) {
          const quota = updatedUser.analysisQuota || PLAN_QUOTAS[updatedUser.subscriptionPlan as PlanId] || 0;
          const used = updatedUser.analysisUsedThisMonth || 0;
          const remaining = Math.max(0, quota - used);
          
          return {
            plan: updatedUser.subscriptionPlan as PlanId,
            status: updatedUser.subscriptionStatus,
            used,
            quota,
            remaining,
            periodStart: updatedUser.currentPeriodStart ? new Date(updatedUser.currentPeriodStart) : null,
            periodEnd: updatedUser.currentPeriodEnd ? new Date(updatedUser.currentPeriodEnd) : null,
          };
        }
      }
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


