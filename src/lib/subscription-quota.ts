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
    console.log('[syncSubscriptionFromStripe] Stripe not configured');
    return {
      plan: null,
      status: 'inactive',
      stripeSubscriptionId: null,
      periodStart: null,
      periodEnd: null,
    };
  }

  try {
    console.log(`[syncSubscriptionFromStripe] Looking for customer with email: ${userEmail}`);
    
    // Find customer by email
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      console.log(`[syncSubscriptionFromStripe] No customer found for email: ${userEmail}`);
      return {
        plan: null,
        status: 'inactive',
        stripeSubscriptionId: null,
        periodStart: null,
        periodEnd: null,
      };
    }

    const customer = customers.data[0];
    console.log(`[syncSubscriptionFromStripe] Found customer: ${customer.id}`);

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      console.log(`[syncSubscriptionFromStripe] No active subscriptions for customer: ${customer.id}`);
      return {
        plan: null,
        status: 'inactive',
        stripeSubscriptionId: null,
        periodStart: null,
        periodEnd: null,
      };
    }

    // Force type to Stripe.Subscription using double assertion
    const stripeSubscription = subscriptions.data[0] as unknown as Stripe.Subscription;
    const priceId = stripeSubscription.items.data[0]?.price.id;
    console.log(`[syncSubscriptionFromStripe] Found active subscription with price ID: ${priceId}`);

    // Find plan by price ID
    let plan: PlanId | null = null;
    for (const [planId, planPriceId] of Object.entries(STRIPE_PRICE_IDS)) {
      if (planPriceId === priceId) {
        plan = planId as PlanId;
        break;
      }
    }

    // If no plan found by price ID, default to SCALE (the current active plan)
    // This ensures we recognize ANY active subscription
    if (!plan) {
      console.log(`[syncSubscriptionFromStripe] Price ID ${priceId} not in STRIPE_PRICE_IDS, defaulting to SCALE`);
      plan = 'SCALE';
    }
    
    console.log(`[syncSubscriptionFromStripe] Matched plan: ${plan}`);

    // Update database
    const supabase = createSupabaseAdminClient();
    const quota = PLAN_QUOTAS[plan] || 0;

    // Extract period dates - safely handle undefined values
    const rawPeriodStart = (stripeSubscription as any).current_period_start;
    const rawPeriodEnd = (stripeSubscription as any).current_period_end;
    const subscriptionId: string = stripeSubscription.id;
    
    // Create safe date values - fallback to current date + 30 days if invalid
    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setDate(defaultEnd.getDate() + 30);
    
    const periodStartDate = (typeof rawPeriodStart === 'number' && rawPeriodStart > 0) 
      ? new Date(rawPeriodStart * 1000) 
      : now;
    const periodEndDate = (typeof rawPeriodEnd === 'number' && rawPeriodEnd > 0) 
      ? new Date(rawPeriodEnd * 1000) 
      : defaultEnd;

    console.log(`[syncSubscriptionFromStripe] Period: ${periodStartDate.toISOString()} to ${periodEndDate.toISOString()}`);

    await supabase
      .from('users')
      .update({
        subscriptionPlan: plan,
        subscriptionStatus: 'active',
        analysisQuota: quota,
        currentPeriodStart: periodStartDate.toISOString(),
        currentPeriodEnd: periodEndDate.toISOString(),
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
        current_period_start: periodStartDate.toISOString(),
        current_period_end: periodEndDate.toISOString(),
        analyses_used_current_month: 0,
        month_reset_date: periodEndDate.toISOString(),
      }, {
        onConflict: 'user_id',
      });

    return {
      plan,
      status: 'active',
      stripeSubscriptionId: subscriptionId,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
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
 * Always checks Stripe first to ensure data is up to date
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
    // Get user data from users table (includes email)
    const { data: user, error } = await supabase
      .from('users')
      .select('subscriptionPlan, subscriptionStatus, analysisUsedThisMonth, analysisQuota, currentPeriodStart, currentPeriodEnd, email')
      .eq('id', userId)
      .single();
    
    // Also try to get email from auth if not in users table
    let userEmail = user?.email;
    if (!userEmail) {
      try {
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
        userEmail = authUser?.email;
      } catch (authErr) {
        console.error('Error getting email from auth:', authErr);
      }
    }
    
    if (error || !user) {
      // If no user in DB, try to sync from Stripe anyway
      if (stripe && userEmail) {
        console.log(`[Subscription Sync] No user in DB, checking Stripe for ${userEmail}...`);
        const stripeData = await syncSubscriptionFromStripe(userId, userEmail);
        if (stripeData.status === 'active' && stripeData.plan) {
          // Re-fetch after sync
          const { data: newUser } = await supabase
            .from('users')
            .select('subscriptionPlan, subscriptionStatus, analysisUsedThisMonth, analysisQuota, currentPeriodStart, currentPeriodEnd')
            .eq('id', userId)
            .single();
          
          if (newUser) {
            const quota = newUser.analysisQuota || PLAN_QUOTAS[newUser.subscriptionPlan as PlanId] || 0;
            const used = newUser.analysisUsedThisMonth || 0;
            return {
              plan: newUser.subscriptionPlan as PlanId,
              status: newUser.subscriptionStatus,
              used,
              quota,
              remaining: Math.max(0, quota - used),
              periodStart: newUser.currentPeriodStart ? new Date(newUser.currentPeriodStart) : null,
              periodEnd: newUser.currentPeriodEnd ? new Date(newUser.currentPeriodEnd) : null,
            };
          }
        }
      }
      
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

    // ALWAYS check Stripe to ensure we have the latest subscription status
    const emailToUse = userEmail || user.email;
    if (stripe && emailToUse) {
      console.log(`[Subscription Sync] Checking Stripe for user ${userId} (${emailToUse})...`);
      const stripeData = await syncSubscriptionFromStripe(userId, emailToUse);
      
      if (stripeData.status === 'active' && stripeData.plan) {
        console.log(`[Subscription Sync] Found active subscription in Stripe: ${stripeData.plan}`);
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
      } else {
        console.log(`[Subscription Sync] No active subscription found in Stripe for ${emailToUse}`);
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


