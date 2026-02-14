/**
 * Subscription Quota Management
 * Server-side functions for managing analysis quotas
 */

import { createSupabaseAdminClient } from './supabase-admin';
import { PLAN_QUOTAS, getUpgradeSuggestion, STRIPE_PRICE_IDS, isUnlimitedPlan, type PlanId } from '@/types/subscription';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/**
 * Increment analysis count for user (server-side only)
 * Returns true if successful, false if quota exceeded
 * @param userId - User ID
 * @param amount - Amount to increment (default: 0.5 for analysis, can be customized)
 */
export async function incrementAnalysisCount(userId: string, amount: number = 0.5): Promise<{
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
    
    // Use snake_case column names (database standard)
    const subscriptionStatus = user.subscription_status;
    const subscriptionPlan = user.subscription_plan;
    // Ensure we parse as float to support decimal values (0.5, 0.25, etc.)
    // Handle both string and number types from database
    const rawUsed = user.analysis_used_this_month;
    const analysisUsed = typeof rawUsed === 'string' ? parseFloat(rawUsed) : (typeof rawUsed === 'number' ? rawUsed : 0);
    const analysisQuota = user.analysis_quota;
    const periodEnd = user.current_period_end;
    
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
    
    // Ensure we work with numbers (not strings) to support decimals
    let currentUsed = typeof analysisUsed === 'number' ? analysisUsed : (typeof analysisUsed === 'string' ? parseFloat(analysisUsed) : 0);
    if (isNaN(currentUsed)) currentUsed = 0;
    
    if (periodEndDate && periodEndDate < now) {
      console.log(`[incrementAnalysisCount] Period expired, resetting quota`);
      // Reset monthly quota (snake_case columns!)
      const newPeriodStart = new Date();
      const newPeriodEnd = new Date();
      newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);
      
      const { error: resetError } = await supabase
        .from('users')
        .update({
          analysis_used_this_month: 0,
          current_period_start: newPeriodStart.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
        })
        .eq('id', userId);
      
      if (resetError) {
        console.error('[incrementAnalysisCount] Error resetting quota:', resetError);
      }
      
      // After reset, used is 0
      currentUsed = 0;
    }
    
    // Check current quota
    // Use the HIGHER value between PLAN_QUOTAS and DB value
    // This respects manual admin overrides (e.g. boosted from 200 to 600)
    const planQuota = PLAN_QUOTAS[subscriptionPlan as PlanId] || 0;
    const dbQuota = analysisQuota || 0;
    const quota = Math.max(planQuota, dbQuota) || 100;
    const isUnlimited = isUnlimitedPlan(subscriptionPlan as PlanId) || quota === -1;
    
    console.log(`[incrementAnalysisCount] 📊 Quota source: plan=${subscriptionPlan}, planQuota=${planQuota}, dbQuota=${dbQuota}, finalQuota=${quota}`);
    
    // Ensure amount is a number
    const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
    
    console.log(`[incrementAnalysisCount] Quota check: used=${currentUsed}, quota=${quota}, amount=${amountNum}, unlimited=${isUnlimited}`);
    
    // Check if adding the amount would exceed quota (skip check if unlimited)
    if (!isUnlimited && currentUsed + amountNum > quota) {
      return {
        success: false,
        used: currentUsed,
        quota,
        remaining: Math.max(0, quota - currentUsed),
        error: 'Quota exceeded',
      };
    }
    
    // Increment count by specified amount (snake_case column!)
    const newUsed = currentUsed + amountNum;
    console.log(`[incrementAnalysisCount] Incrementing from ${currentUsed} to ${newUsed} (${amountNum} credit)`);
    
    // Force decimal value to be stored as number (not string)
    // Ensure newUsed is always a number, even if it's a whole number like 8.0
    const newUsedValue = typeof newUsed === 'number' ? newUsed : parseFloat(String(newUsed));
    
    console.log(`[incrementAnalysisCount] ⚠️ Updating database: analysis_used_this_month = ${newUsedValue} (type: ${typeof newUsedValue})`);
    console.log(`[incrementAnalysisCount] ⚠️ User ID: ${userId}`);
    console.log(`[incrementAnalysisCount] ⚠️ Current used: ${currentUsed}, New used: ${newUsedValue}, Amount: ${amountNum}`);
    
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({
        analysis_used_this_month: newUsedValue, // Explicitly pass as number
      })
      .eq('id', userId)
      .select('analysis_used_this_month');
    
    if (updateError) {
      console.error(`[incrementAnalysisCount] ❌ Update error:`, updateError);
      console.error(`[incrementAnalysisCount] ❌ Update error details:`, JSON.stringify(updateError, null, 2));
      return {
        success: false,
        used: currentUsed,
        quota,
        remaining: quota - currentUsed,
        error: updateError.message || 'Database update failed',
      };
    }
    
    console.log(`[incrementAnalysisCount] ✅ Update successful. Updated data:`, JSON.stringify(updateData, null, 2));
    
    // Verify the value was stored correctly by reading it back
    const { data: verifyData, error: verifyError } = await supabase
      .from('users')
      .select('analysis_used_this_month')
      .eq('id', userId)
      .single();
    
    if (!verifyError && verifyData) {
      const storedValue = verifyData.analysis_used_this_month;
      const storedValueNum = typeof storedValue === 'number' ? storedValue : parseFloat(String(storedValue)) || 0;
      console.log(`[incrementAnalysisCount] ✅ Database updated. Stored value: ${storedValueNum} (type: ${typeof storedValue})`);
      
      // Check if the stored value matches what we sent (allow small floating point differences)
      if (Math.abs(storedValueNum - newUsedValue) > 0.01) {
        console.error(`[incrementAnalysisCount] ❌ ERROR: Stored value (${storedValueNum}) differs from sent value (${newUsedValue})`);
        // Use the stored value instead
        return {
          success: true,
          used: storedValueNum,
          quota,
          remaining: quota - storedValueNum,
        };
      }
    }
    
    console.log(`[incrementAnalysisCount] ✅ Successfully incremented to ${newUsed}`);
    
    // Calculate remaining (Infinity for unlimited plans)
    const remaining = isUnlimited ? Number.MAX_SAFE_INTEGER : Math.max(0, quota - newUsed);
    
    return {
      success: true,
      used: newUsed,
      quota: isUnlimited ? -1 : quota,
      remaining,
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

    // Try to update database (snake_case columns!)
    try {
      const supabase = createSupabaseAdminClient();
      
      // Check current DB quota to avoid overwriting manual admin overrides
      const { data: currentUser } = await supabase
        .from('users')
        .select('analysis_quota')
        .eq('id', userId)
        .single();
      
      const currentDbQuota = currentUser?.analysis_quota || 0;
      // Only update quota if current DB value is LOWER (never downgrade manual boosts)
      const newQuota = Math.max(quota, currentDbQuota);
      
      console.log(`[syncSubscriptionFromStripe] Quota update: planQuota=${quota}, dbQuota=${currentDbQuota}, final=${newQuota}`);
      
      await supabase
        .from('users')
        .update({
          subscription_plan: plan,
          subscription_status: 'active',
          analysis_quota: newQuota,
          current_period_start: periodStartDate.toISOString(),
          current_period_end: periodEndDate.toISOString(),
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscriptionId,
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
    // STEP 1: Check database first (FAST - snake_case columns!)
    const { data: user } = await supabase
      .from('users')
      .select('subscription_plan, subscription_status, analysis_used_this_month, analysis_quota, current_period_start, current_period_end, email')
      .eq('id', userId)
      .single();
    
    // If database says user has ACTIVE subscription, use it immediately (FAST PATH)
    if (user && user.subscription_status === 'active') {
      console.log(`[getUserQuotaInfo] ✅ DB says ACTIVE: ${user.subscription_plan}`);
      
      // Use the HIGHER value between PLAN_QUOTAS and DB value
      // This respects manual overrides (e.g. admin boosted quota from 200 to 600)
      const planQuota = PLAN_QUOTAS[user.subscription_plan as PlanId] || 0;
      const dbQuota = user.analysis_quota || 0;
      
      // If DB quota is HIGHER than plan quota, it means an admin manually boosted it → respect it
      // If DB quota is LOWER than plan quota, it means DB is stale → use plan quota
      const quota = Math.max(planQuota, dbQuota) || 100;
      
      console.log(`[getUserQuotaInfo] 📊 Quota check: plan=${user.subscription_plan}, planQuota=${planQuota}, dbQuota=${dbQuota}, finalQuota=${quota}`);
      
      // ⚠️ CRITICAL: Only auto-fix if DB quota is LOWER than plan quota AND DB quota is 0 or null (stale data)
      // Never downgrade a manually boosted quota (even if it's lower than plan quota, it might be intentional)
      // Only update if DB quota is 0/null (truly stale) - never touch if it's a positive number (could be manual override)
      if (planQuota > 0 && (dbQuota === 0 || dbQuota === null || dbQuota === undefined)) {
        console.log(`[getUserQuotaInfo] ⚠️ Fixing stale analysis_quota in DB: ${dbQuota} → ${planQuota}`);
        supabase
          .from('users')
          .update({ analysis_quota: planQuota })
          .eq('id', userId)
          .then(() => console.log(`[getUserQuotaInfo] ✅ analysis_quota updated to ${planQuota}`))
          .catch((err: any) => console.error(`[getUserQuotaInfo] ❌ Failed to update analysis_quota:`, err));
      } else if (dbQuota > 0 && dbQuota !== planQuota) {
        console.log(`[getUserQuotaInfo] ℹ️ DB quota (${dbQuota}) differs from plan quota (${planQuota}) - respecting DB value (manual override)`);
      }
      
      const isUnlimited = isUnlimitedPlan(user.subscription_plan as PlanId) || quota === -1;
      // Ensure we parse as float to support decimal values (0.5, 0.25, etc.)
      // Handle both string and number types from database
      const rawUsed = user.analysis_used_this_month;
      const used = typeof rawUsed === 'number' ? rawUsed : (rawUsed != null ? parseFloat(String(rawUsed)) : 0);
      const usedNum = isNaN(used) ? 0 : used;
      const remaining = isUnlimited ? Number.MAX_SAFE_INTEGER : Math.max(0, quota - usedNum);
      
      console.log(`[getUserQuotaInfo] 📊 Usage: used=${usedNum}, quota=${quota}, remaining=${remaining}`);
      
      let requiresUpgrade: PlanId | undefined;
      if (!isUnlimited && used >= quota) {
        requiresUpgrade = getUpgradeSuggestion(user.subscription_plan as PlanId) || undefined;
      }
      
      return {
        plan: user.subscription_plan as PlanId,
        status: 'active',
        used: usedNum,
        quota: isUnlimited ? -1 : quota,
        remaining,
        periodStart: user.current_period_start ? new Date(user.current_period_start) : null,
        periodEnd: user.current_period_end ? new Date(user.current_period_end) : null,
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
        // Ensure we parse as float to support decimal values (0.5, 0.25, etc.)
        // Handle both string and number types from database
        const rawUsed = user?.analysis_used_this_month;
        const used = typeof rawUsed === 'number' ? rawUsed : (rawUsed != null ? parseFloat(String(rawUsed)) : 0);
        const usedNum = isNaN(used) ? 0 : used;
        const quota = stripeData.quota;
        
        return {
          plan: stripeData.plan,
          status: 'active',
          used: usedNum,
          quota,
          remaining: Math.max(0, quota - usedNum),
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


