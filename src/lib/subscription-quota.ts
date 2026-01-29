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
    console.log(`[incrementAnalysisCount] Starting for user: ${userId}`);
    
    // Get current user data - select ALL columns to debug
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    console.log(`[incrementAnalysisCount] User data:`, JSON.stringify(user, null, 2));
    console.log(`[incrementAnalysisCount] Fetch error:`, fetchError);
    
    if (fetchError || !user) {
      console.error(`[incrementAnalysisCount] User not found: ${fetchError?.message}`);
      return {
        success: false,
        used: 0,
        quota: 0,
        remaining: 0,
        error: `User not found: ${fetchError?.message || 'No user data'}`,
      };
    }
    
    // Handle both camelCase and snake_case column names
    const subscriptionStatus = user.subscriptionStatus || user.subscription_status;
    const subscriptionPlan = user.subscriptionPlan || user.subscription_plan;
    const analysisUsed = user.analysisUsedThisMonth ?? user.analysis_used_this_month ?? 0;
    const analysisQuota = user.analysisQuota ?? user.analysis_quota;
    const periodEnd = user.currentPeriodEnd || user.current_period_end;
    
    console.log(`[incrementAnalysisCount] Parsed values:`, {
      subscriptionStatus,
      subscriptionPlan,
      analysisUsed,
      analysisQuota,
      periodEnd,
    });
    
    // Check if subscription is active
    if (subscriptionStatus !== 'active') {
      console.log(`[incrementAnalysisCount] Subscription not active: ${subscriptionStatus}`);
      return {
        success: false,
        used: analysisUsed,
        quota: analysisQuota || 0,
        remaining: 0,
        error: `Subscription is not active (status: ${subscriptionStatus})`,
      };
    }
    
    // Check if period has expired (reset needed)
    const now = new Date();
    const periodEndDate = periodEnd ? new Date(periodEnd) : null;
    
    let currentUsed = analysisUsed;
    
    if (periodEndDate && periodEndDate < now) {
      console.log(`[incrementAnalysisCount] Period expired, resetting quota`);
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
        console.error('[incrementAnalysisCount] Error resetting quota:', resetError);
      }
      
      // After reset, used is 0
      currentUsed = 0;
    }
    
    // Check current quota
    const quota = analysisQuota || PLAN_QUOTAS[subscriptionPlan as PlanId] || 100;
    
    console.log(`[incrementAnalysisCount] Quota check: used=${currentUsed}, quota=${quota}`);
    
    if (currentUsed >= quota) {
      return {
        success: false,
        used: currentUsed,
        quota,
        remaining: 0,
        error: 'Quota exceeded',
      };
    }
    
    // Increment count
    const newUsed = currentUsed + 1;
    console.log(`[incrementAnalysisCount] Incrementing from ${currentUsed} to ${newUsed}`);
    
    const { error: updateError } = await supabase
      .from('users')
      .update({
        analysisUsedThisMonth: newUsed,
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error(`[incrementAnalysisCount] Update error:`, updateError);
      return {
        success: false,
        used: currentUsed,
        quota,
        remaining: quota - currentUsed,
        error: updateError.message,
      };
    }
    
    console.log(`[incrementAnalysisCount] ✅ Successfully incremented to ${newUsed}`);
    
    return {
      success: true,
      used: newUsed,
      quota,
      remaining: quota - newUsed,
    };
  } catch (error: any) {
    console.error('[incrementAnalysisCount] Exception:', error);
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
 * IMPORTANT: Returns Stripe data even if database update fails
 */
async function syncSubscriptionFromStripe(userId: string, userEmail: string): Promise<{
  plan: PlanId | null;
  status: string;
  stripeSubscriptionId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  quota: number;
}> {
  if (!stripe) {
    console.log('[syncSubscriptionFromStripe] Stripe not configured');
    return {
      plan: null,
      status: 'inactive',
      stripeSubscriptionId: null,
      periodStart: null,
      periodEnd: null,
      quota: 0,
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
        quota: 0,
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
        quota: 0,
      };
    }

    // Force type to Stripe.Subscription using double assertion
    const stripeSubscription = subscriptions.data[0] as unknown as Stripe.Subscription;
    const priceId = stripeSubscription.items.data[0]?.price.id;
    console.log(`[syncSubscriptionFromStripe] Found active subscription with price ID: ${priceId}`);

    // Find plan by price ID
    let plan: PlanId = 'SCALE'; // Default to SCALE
    for (const [planId, planPriceId] of Object.entries(STRIPE_PRICE_IDS)) {
      if (planPriceId === priceId) {
        plan = planId as PlanId;
        break;
      }
    }
    
    console.log(`[syncSubscriptionFromStripe] Matched plan: ${plan}`);
    
    const quota = PLAN_QUOTAS[plan] || 100;

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

    console.log(`[syncSubscriptionFromStripe] ✅ ACTIVE subscription found: ${plan}, quota: ${quota}`);

    // Try to update database (but don't fail if it doesn't work)
    try {
      const supabase = createSupabaseAdminClient();
      
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
        
      console.log(`[syncSubscriptionFromStripe] Database updated successfully`);
    } catch (dbError) {
      // Database update failed, but we still have Stripe data!
      console.error('[syncSubscriptionFromStripe] Database update failed (non-critical):', dbError);
    }

    // ALWAYS return Stripe data - this is the source of truth
    return {
      plan,
      status: 'active',
      stripeSubscriptionId: subscriptionId,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
      quota,
    };
  } catch (error: any) {
    console.error('Error syncing subscription from Stripe:', error);
    return {
      plan: null,
      status: 'inactive',
      stripeSubscriptionId: null,
      periodStart: null,
      periodEnd: null,
      quota: 0,
    };
  }
}

/**
 * Get user quota information
 * OPTIMIZED: Check database first (fast), only check Stripe if no active subscription in DB
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
    // STEP 1: Check database first (FAST - no external API call)
    const { data: user } = await supabase
      .from('users')
      .select('subscriptionPlan, subscriptionStatus, analysisUsedThisMonth, analysisQuota, currentPeriodStart, currentPeriodEnd, email')
      .eq('id', userId)
      .single();
    
    // If database says user has ACTIVE subscription, use it immediately (FAST PATH)
    if (user && user.subscriptionStatus === 'active') {
      console.log(`[getUserQuotaInfo] ✅ DB says ACTIVE: ${user.subscriptionPlan}`);
      const quota = user.analysisQuota || PLAN_QUOTAS[user.subscriptionPlan as PlanId] || 100;
      const used = user.analysisUsedThisMonth || 0;
      const remaining = Math.max(0, quota - used);
      
      let requiresUpgrade: PlanId | undefined;
      if (used >= quota) {
        requiresUpgrade = getUpgradeSuggestion(user.subscriptionPlan as PlanId) || undefined;
      }
      
      return {
        plan: user.subscriptionPlan as PlanId,
        status: 'active',
        used,
        quota,
        remaining,
        periodStart: user.currentPeriodStart ? new Date(user.currentPeriodStart) : null,
        periodEnd: user.currentPeriodEnd ? new Date(user.currentPeriodEnd) : null,
        requiresUpgrade,
      };
    }
    
    // STEP 2: Database says no active subscription - check Stripe with timeout (SLOW PATH)
    let userEmail = user?.email || null;
    if (!userEmail) {
      try {
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
        userEmail = authUser?.email || null;
      } catch (authErr) {
        console.error('Error getting email from auth:', authErr);
      }
    }
    
    if (stripe && userEmail) {
      console.log(`[getUserQuotaInfo] DB inactive, checking Stripe for ${userEmail}...`);
      
      // Add timeout of 5 seconds for Stripe check
      const stripePromise = syncSubscriptionFromStripe(userId, userEmail);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      
      const stripeData = await Promise.race([stripePromise, timeoutPromise]);
      
      if (stripeData && stripeData.status === 'active' && stripeData.plan) {
        console.log(`[getUserQuotaInfo] ✅ Stripe says ACTIVE: ${stripeData.plan}, quota: ${stripeData.quota}`);
        const used = user?.analysisUsedThisMonth || 0;
        const quota = stripeData.quota;
        
        return {
          plan: stripeData.plan,
          status: 'active',
          used,
          quota,
          remaining: Math.max(0, quota - used),
          periodStart: stripeData.periodStart,
          periodEnd: stripeData.periodEnd,
        };
      } else if (stripeData === null) {
        console.warn(`[getUserQuotaInfo] ⚠️ Stripe check timed out`);
      }
    }
    
    // No active subscription found
    return {
      plan: 'FREE',
      status: 'inactive',
      used: 0,
      quota: 0,
      remaining: 0,
      periodStart: null,
      periodEnd: null,
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


