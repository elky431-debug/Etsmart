/**
 * API Route: Direct check of Stripe subscription status
 * This checks Stripe directly WITHOUT updating the database
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { PLAN_QUOTAS, STRIPE_PRICE_IDS, type PlanId } from '@/types/subscription';

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function GET(request: NextRequest) {
  try {
    if (!stripe) {
      console.error('[Check Stripe] STRIPE_SECRET_KEY not configured');
      return NextResponse.json({ 
        hasSubscription: false, 
        error: 'Stripe not configured' 
      });
    }

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        hasSubscription: false, 
        error: 'Unauthorized' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || !user.email) {
      console.error('[Check Stripe] Auth error:', authError);
      return NextResponse.json({ 
        hasSubscription: false, 
        error: 'Not authenticated' 
      });
    }

    console.log(`[Check Stripe] Checking subscription for: ${user.email}`);

    // Find customer in Stripe by email
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      console.log(`[Check Stripe] No customer found for: ${user.email}`);
      return NextResponse.json({
        hasSubscription: false,
        message: 'No Stripe customer found',
      });
    }

    const customer = customers.data[0];
    console.log(`[Check Stripe] Found customer: ${customer.id}`);

    // ⚠️ CRITICAL: Get active subscriptions (including those that will cancel at period end)
    // On cherche les abonnements avec status 'active' OU 'trialing' OU 'past_due' (mais période valide)
    // car même si cancel_at_period_end est true, l'abonnement reste 'active' jusqu'à la fin de la période
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all', // Chercher tous les statuts pour ne rien manquer
      limit: 10, // Augmenter la limite pour trouver tous les abonnements
    });

    // Filtrer pour trouver les abonnements actifs ou avec période valide
    const nowUnix = Math.floor(Date.now() / 1000); // Timestamp Unix en secondes
    const activeSubscriptions = subscriptions.data.filter(sub => {
      const periodEnd = sub.current_period_end;
      const isPeriodValid = periodEnd && periodEnd > nowUnix;
      // Un abonnement est considéré comme actif si :
      // 1. Status est 'active' ou 'trialing'
      // 2. OU si la période est encore valide (même si status est 'canceled' ou autre)
      return (sub.status === 'active' || sub.status === 'trialing') || 
             (isPeriodValid && periodEnd > nowUnix);
    });

    if (activeSubscriptions.length === 0) {
      console.log(`[Check Stripe] No active subscription for customer: ${customer.id}`);
      return NextResponse.json({
        hasSubscription: false,
        customerId: customer.id,
        message: 'No active subscription',
      });
    }

    // Prendre le premier abonnement actif trouvé
    const subscription = activeSubscriptions[0];
    const priceId = subscription.items.data[0]?.price?.id;
    const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
    
    // Find plan by price ID, default to SCALE
    let plan: PlanId = 'SCALE';
    for (const [planId, planPriceId] of Object.entries(STRIPE_PRICE_IDS)) {
      if (planPriceId === priceId) {
        plan = planId as PlanId;
        break;
      }
    }

    const planQuota = PLAN_QUOTAS[plan] || 100;
    
    // Safely handle period dates
    const rawPeriodStart = (subscription as any).current_period_start;
    const rawPeriodEnd = (subscription as any).current_period_end;
    
    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setDate(defaultEnd.getDate() + 30);
    
    const periodStart = (typeof rawPeriodStart === 'number' && rawPeriodStart > 0) 
      ? new Date(rawPeriodStart * 1000) 
      : now;
    const periodEnd = (typeof rawPeriodEnd === 'number' && rawPeriodEnd > 0) 
      ? new Date(rawPeriodEnd * 1000) 
      : defaultEnd;
    
    // Vérifier si la période est toujours valide
    const isPeriodValid = periodEnd > now;
    
    // Si cancel_at_period_end est true mais que la période est terminée, l'abonnement n'est plus actif
    if (cancelAtPeriodEnd && !isPeriodValid) {
      console.log(`[Check Stripe] Subscription canceled and period expired`);
      return NextResponse.json({
        hasSubscription: false,
        customerId: customer.id,
        message: 'Subscription canceled and period expired',
      });
    }

    console.log(`[Check Stripe] ✅ Found active subscription: ${plan}, cancelAtPeriodEnd: ${cancelAtPeriodEnd}`);

    // Fetch current usage and quota from database FIRST
    let currentUsed = 0;
    let dbQuota = 0;
    try {
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      console.log(`[Check Stripe] DB user data:`, JSON.stringify(userData, null, 2));
      console.log(`[Check Stripe] DB fetch error:`, fetchError);
      
      if (userData) {
        // Handle both camelCase and snake_case column names
        // Ensure we parse as float to support decimal values (0.5, 0.25, etc.)
        const rawValue = userData.analysisUsedThisMonth ?? userData.analysis_used_this_month ?? 0;
        currentUsed = parseFloat(rawValue) || 0;
        dbQuota = userData.analysis_quota || 0;
        console.log(`[Check Stripe] Current usage from DB: ${currentUsed}, DB quota: ${dbQuota}`);
      }
    } catch (fetchError) {
      console.warn('[Check Stripe] Could not fetch current usage:', fetchError);
    }

    // Use the HIGHER value between plan quota and DB quota
    // This respects manual admin overrides (e.g. boosted from 200 to 600)
    const quota = Math.max(planQuota, dbQuota) || 100;
    console.log(`[Check Stripe] Final quota: planQuota=${planQuota}, dbQuota=${dbQuota}, final=${quota}`);

    // Update database with subscription info (using snake_case column names!)
    try {
      await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          subscription_plan: plan,
          subscription_status: 'active',
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscription.id,
          // Only update quota if plan quota is HIGHER than DB quota (never downgrade manual boosts)
          analysis_quota: quota,
          // DON'T touch analysis_used_this_month - keep existing value!
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
        }, {
          onConflict: 'id',
          ignoreDuplicates: false,
        });
      console.log(`[Check Stripe] Database updated for user ${user.id}`);
    } catch (dbError) {
      console.error('[Check Stripe] Database update failed (non-critical):', dbError);
    }

    const remaining = Math.max(0, quota - currentUsed);
    
    return NextResponse.json({
      hasSubscription: true,
      plan,
      status: cancelAtPeriodEnd ? 'canceling' : 'active',
      cancelAtPeriodEnd,
      quota,
      used: currentUsed,
      remaining: remaining,
      customerId: customer.id,
      subscriptionId: subscription.id,
      priceId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });

  } catch (error: any) {
    console.error('[Check Stripe] Error:', error);
    return NextResponse.json({
      hasSubscription: false,
      error: error.message || 'Failed to check subscription',
    });
  }
}
