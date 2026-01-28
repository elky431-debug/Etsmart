/**
 * API Route: Direct check of Stripe subscription status
 * This bypasses the database and checks Stripe directly
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
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized or no email' }, { status: 401 });
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
    
    // Find plan
    let plan: PlanId = 'SCALE'; // Default
    for (const [planId, planPriceId] of Object.entries(STRIPE_PRICE_IDS)) {
      if (planPriceId === priceId) {
        plan = planId as PlanId;
        break;
      }
    }

    const quota = PLAN_QUOTAS[plan] || 100;
    const periodStart = new Date((subscription as any).current_period_start * 1000);
    const periodEnd = new Date((subscription as any).current_period_end * 1000);

    console.log(`[Check Stripe] Found active subscription: ${plan}, price: ${priceId}`);

    // Update the database with this subscription
    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscriptionPlan: plan,
        subscriptionStatus: 'active',
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        analysisQuota: quota,
        currentPeriodStart: periodStart.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Check Stripe] Error updating user:', updateError);
    } else {
      console.log(`[Check Stripe] Updated user ${user.id} with ${plan} subscription`);
    }

    return NextResponse.json({
      hasSubscription: true,
      plan,
      status: 'active',
      quota,
      used: 0,
      remaining: quota,
      customerId: customer.id,
      subscriptionId: subscription.id,
      priceId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });

  } catch (error: any) {
    console.error('[Check Stripe] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check subscription' },
      { status: 500 }
    );
  }
}

