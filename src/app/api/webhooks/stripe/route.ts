/**
 * ⚠️ STRIPE WEBHOOKS HANDLER
 * 
 * Handles Stripe webhook events for subscription management:
 * - checkout.session.completed: New subscription
 * - invoice.paid: Renewal
 * - customer.subscription.deleted: Cancellation
 * - customer.subscription.updated: Plan changes
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { PLAN_QUOTAS, PLAN_PRICES, type PlanId } from '@/types/subscription';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia',
    })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!stripe || !webhookSecret) {
    console.error('Stripe webhook secret not configured');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const planId = session.metadata?.plan_id as PlanId;
        const userId = session.metadata?.user_id;

        if (!planId || !userId) {
          console.error('Missing plan_id or user_id in checkout session metadata');
          break;
        }

        // Get customer ID
        const customerId = typeof session.customer === 'string' 
          ? session.customer 
          : session.customer?.id;

        if (!customerId) {
          console.error('Missing customer ID in checkout session');
          break;
        }

        // Get subscription ID
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

        if (!subscriptionId) {
          console.error('Missing subscription ID in checkout session');
          break;
        }

        // Update user subscription
        const quota = PLAN_QUOTAS[planId] || 0;
        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + 30);

        const { error: updateError } = await supabase
          .from('users')
          .update({
            subscriptionPlan: planId,
            subscriptionStatus: 'active',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            analysisQuota: quota,
            analysisUsedThisMonth: 0, // Reset on new subscription
            currentPeriodStart: periodStart.toISOString(),
            currentPeriodEnd: periodEnd.toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Error updating user subscription:', updateError);
        } else {
          console.log(`✅ Subscription activated for user ${userId}: ${planId}`);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;

        if (!subscriptionId) {
          console.error('Missing subscription ID in invoice');
          break;
        }

        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;

        if (!customerId) {
          console.error('Missing customer ID in subscription');
          break;
        }

        // Find user by Stripe customer ID
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, subscriptionPlan')
          .eq('stripeCustomerId', customerId)
          .single();

        if (userError || !user) {
          console.error('User not found for customer:', customerId);
          break;
        }

        // Reset monthly quota on renewal
        const periodStart = new Date(subscription.current_period_start * 1000);
        const periodEnd = new Date(subscription.current_period_end * 1000);
        const quota = PLAN_QUOTAS[user.subscriptionPlan as PlanId] || 0;

        const { error: updateError } = await supabase
          .from('users')
          .update({
            analysisUsedThisMonth: 0, // Reset on renewal
            currentPeriodStart: periodStart.toISOString(),
            currentPeriodEnd: periodEnd.toISOString(),
            subscriptionStatus: 'active',
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error resetting quota on renewal:', updateError);
        } else {
          console.log(`✅ Quota reset for user ${user.id} on renewal`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;

        if (!customerId) {
          console.error('Missing customer ID in deleted subscription');
          break;
        }

        // Find user by Stripe customer ID
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('stripeCustomerId', customerId)
          .single();

        if (userError || !user) {
          console.error('User not found for customer:', customerId);
          break;
        }

        // Cancel subscription
        const { error: updateError } = await supabase
          .from('users')
          .update({
            subscriptionStatus: 'inactive',
            subscriptionPlan: 'FREE',
            analysisQuota: 0,
            stripeSubscriptionId: null,
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error canceling subscription:', updateError);
        } else {
          console.log(`✅ Subscription canceled for user ${user.id}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;

        if (!customerId) {
          console.error('Missing customer ID in updated subscription');
          break;
        }

        // Find user by Stripe customer ID
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('stripeCustomerId', customerId)
          .single();

        if (userError || !user) {
          console.error('User not found for customer:', customerId);
          break;
        }

        // Update subscription status based on Stripe status
        let subscriptionStatus: 'active' | 'inactive' | 'canceled' | 'past_due' = 'inactive';
        if (subscription.status === 'active') {
          subscriptionStatus = 'active';
        } else if (subscription.status === 'past_due') {
          subscriptionStatus = 'past_due';
        } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          subscriptionStatus = 'canceled';
        }

        const { error: updateError } = await supabase
          .from('users')
          .update({
            subscriptionStatus,
            currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating subscription:', updateError);
        } else {
          console.log(`✅ Subscription updated for user ${user.id}: ${subscriptionStatus}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', message: error.message },
      { status: 500 }
    );
  }
}

