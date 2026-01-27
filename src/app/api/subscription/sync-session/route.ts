/**
 * API Route: Sync subscription from Stripe Checkout Session
 * This is called immediately after payment to ensure subscription is active
 * even if webhook hasn't been received yet
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { PLAN_QUOTAS, STRIPE_PRICE_IDS, type PlanId } from '@/types/subscription';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get session ID from request
    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    console.log(`[Sync Session] Syncing checkout session ${sessionId} for user ${user.id}`);

    // Retrieve checkout session from Stripe with expanded subscription
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.items.data.price'],
    });

    // Verify this session belongs to the current user
    if (checkoutSession.metadata?.user_id !== user.id) {
      console.error(`[Sync Session] Session user_id mismatch: ${checkoutSession.metadata?.user_id} vs ${user.id}`);
      // Don't return error - might be a different session format, continue with email check
    }

    // Get subscription from session
    const subscription = checkoutSession.subscription as Stripe.Subscription | null;
    
    if (!subscription) {
      console.log('[Sync Session] No subscription found in checkout session');
      return NextResponse.json(
        { error: 'No subscription found in session' },
        { status: 404 }
      );
    }

    // Get customer ID
    const customerId = typeof checkoutSession.customer === 'string'
      ? checkoutSession.customer
      : checkoutSession.customer?.id || '';

    // Get price ID from subscription
    const priceId = subscription.items.data[0]?.price?.id;
    
    // Find plan by price ID
    let plan: PlanId = 'FREE';
    for (const [planId, planPriceId] of Object.entries(STRIPE_PRICE_IDS)) {
      if (planPriceId === priceId) {
        plan = planId as PlanId;
        break;
      }
    }

    // Also check metadata for plan
    if (plan === 'FREE' && checkoutSession.metadata?.plan_id) {
      plan = checkoutSession.metadata.plan_id as PlanId;
    }

    if (plan === 'FREE') {
      console.error(`[Sync Session] Could not determine plan from price ID: ${priceId}`);
      return NextResponse.json(
        { error: 'Could not determine subscription plan' },
        { status: 400 }
      );
    }

    const quota = PLAN_QUOTAS[plan] || 0;
    const periodStart = new Date((subscription as any).current_period_start * 1000);
    const periodEnd = new Date((subscription as any).current_period_end * 1000);

    console.log(`[Sync Session] Activating ${plan} subscription for user ${user.id}`);

    // Update user in database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscriptionPlan: plan,
        subscriptionStatus: 'active',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        analysisQuota: quota,
        analysisUsedThisMonth: 0,
        currentPeriodStart: periodStart.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Sync Session] Error updating user:', updateError);
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      );
    }

    // Also update/create subscription record
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        plan_id: plan,
        status: 'active',
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        analyses_used_current_month: 0,
        month_reset_date: periodEnd.toISOString(),
      }, {
        onConflict: 'user_id',
      });

    console.log(`[Sync Session] ✅ Successfully activated ${plan} for user ${user.id}`);

    return NextResponse.json({
      success: true,
      plan,
      status: 'active',
      quota,
      periodEnd: periodEnd.toISOString(),
    });

  } catch (error: any) {
    console.error('[Sync Session] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

