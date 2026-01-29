/**
 * API Route: Upgrade subscription to a higher plan
 * Handles Stripe proration automatically
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { STRIPE_PRICE_IDS, PLAN_QUOTAS, type PlanId } from '@/types/subscription';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the new plan from request body
    const { newPlan } = await request.json();
    
    if (!newPlan || !['SMART', 'PRO', 'SCALE'].includes(newPlan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const newPriceId = STRIPE_PRICE_IDS[newPlan as PlanId];
    if (!newPriceId) {
      return NextResponse.json({ error: 'Price ID not found for plan' }, { status: 400 });
    }

    console.log(`[Upgrade] User ${user.email} upgrading to ${newPlan}`);

    // Find the customer in Stripe
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      // No existing customer - create checkout session for new subscription
      console.log(`[Upgrade] No customer found, creating checkout session`);
      
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: user.email,
        line_items: [{
          price: newPriceId,
          quantity: 1,
        }],
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://etsmart.app'}/dashboard?upgrade=success&plan=${newPlan}`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://etsmart.app'}/dashboard?upgrade=cancelled`,
        metadata: {
          user_id: user.id,
          plan_id: newPlan,
          type: 'upgrade',
        },
      });

      return NextResponse.json({
        type: 'checkout',
        url: checkoutSession.url,
      });
    }

    const customer = customers.data[0];

    // Get active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // No active subscription - create checkout for new subscription
      console.log(`[Upgrade] No active subscription, creating checkout session`);
      
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer: customer.id,
        line_items: [{
          price: newPriceId,
          quantity: 1,
        }],
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://etsmart.app'}/dashboard?upgrade=success&plan=${newPlan}`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://etsmart.app'}/dashboard?upgrade=cancelled`,
        metadata: {
          user_id: user.id,
          plan_id: newPlan,
          type: 'upgrade',
        },
      });

      return NextResponse.json({
        type: 'checkout',
        url: checkoutSession.url,
      });
    }

    // Has active subscription - upgrade it with proration
    const subscription = subscriptions.data[0];
    const subscriptionItemId = subscription.items.data[0].id;
    const currentPriceId = subscription.items.data[0].price.id;

    // Check if already on this plan
    if (currentPriceId === newPriceId) {
      return NextResponse.json({ 
        error: 'Already on this plan',
        message: 'Tu es déjà abonné à ce plan.'
      }, { status: 400 });
    }

    console.log(`[Upgrade] Upgrading subscription ${subscription.id} from ${currentPriceId} to ${newPriceId}`);

    // Update the subscription with proration
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      items: [{
        id: subscriptionItemId,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations', // Automatically calculate credit for unused time
      payment_behavior: 'pending_if_incomplete', // Handle payment issues gracefully
    });

    console.log(`[Upgrade] ✅ Subscription upgraded successfully`);

    // Update the database immediately
    const newQuota = PLAN_QUOTAS[newPlan as PlanId] || 100;
    
    await supabase
      .from('users')
      .update({
        subscription_plan: newPlan,
        analysis_quota: newQuota,
        // Keep the current usage - don't reset on upgrade
      })
      .eq('id', user.id);

    return NextResponse.json({
      type: 'upgraded',
      success: true,
      plan: newPlan,
      quota: newQuota,
      message: `Félicitations ! Tu es maintenant sur le plan ${newPlan} avec ${newQuota} analyses/mois.`,
      prorationApplied: true,
    });

  } catch (error: any) {
    console.error('[Upgrade] Error:', error);
    return NextResponse.json({
      error: error.message || 'Upgrade failed',
    }, { status: 500 });
  }
}

