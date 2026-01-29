/**
 * API Route: Direct check of Stripe subscription status
 * This checks Stripe directly WITHOUT updating the database
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { PLAN_QUOTAS, STRIPE_PRICE_IDS, type PlanId } from '@/types/subscription';

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

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      console.log(`[Check Stripe] No active subscription for customer: ${customer.id}`);
      return NextResponse.json({
        hasSubscription: false,
        customerId: customer.id,
        message: 'No active subscription',
      });
    }

    const subscription = subscriptions.data[0];
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

    const quota = PLAN_QUOTAS[plan] || 100;
    
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

    console.log(`[Check Stripe] ✅ Found active subscription: ${plan}, cancelAtPeriodEnd: ${cancelAtPeriodEnd}`);

    // Fetch current usage from database FIRST
    let currentUsed = 0;
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('analysisUsedThisMonth')
        .eq('id', user.id)
        .single();
      
      if (userData && typeof userData.analysisUsedThisMonth === 'number') {
        currentUsed = userData.analysisUsedThisMonth;
        console.log(`[Check Stripe] Current usage from DB: ${currentUsed}`);
      }
    } catch (fetchError) {
      console.warn('[Check Stripe] Could not fetch current usage:', fetchError);
    }

    // Update database with subscription info (but DON'T reset the usage count!)
    try {
      await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          subscriptionPlan: plan,
          subscriptionStatus: 'active',
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          analysisQuota: quota,
          // DON'T touch analysisUsedThisMonth - keep existing value!
          currentPeriodStart: periodStart.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
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
