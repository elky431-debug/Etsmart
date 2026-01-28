/**
 * ⚠️ STRIPE WEBHOOKS HANDLER
 * 
 * Handles Stripe webhook events for subscription management
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { PLAN_QUOTAS, STRIPE_PRICE_IDS, type PlanId } from '@/types/subscription';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Helper to find plan by price ID
function findPlanByPriceId(priceId: string): PlanId {
  for (const [planId, planPriceId] of Object.entries(STRIPE_PRICE_IDS)) {
    if (planPriceId === priceId) {
      return planId as PlanId;
    }
  }
  return 'SCALE'; // Default fallback
}

// Helper to find user by email
async function findUserByEmail(supabase: any, email: string) {
  // First try to find in users table
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();
  
  if (user) return user;
  
  // Try to find in auth.users
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const authUser = users?.find((u: any) => u.email === email);
  
  return authUser ? { id: authUser.id } : null;
}

export async function POST(request: NextRequest) {
  console.log('[Webhook] Received webhook request');
  
  if (!stripe) {
    console.error('[Webhook] STRIPE_SECRET_KEY not configured');
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }
  
  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log(`[Webhook] ✅ Verified event: ${event.type}`);
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[Webhook] checkout.session.completed:', session.id);
        
        // Get customer email
        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        
        // Try to get plan from metadata first
        let planId = session.metadata?.plan_id as PlanId | undefined;
        let userId = session.metadata?.user_id;
        
        // If no planId in metadata, get from subscription
        if (!planId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = sub.items.data[0]?.price?.id;
          if (priceId) {
            planId = findPlanByPriceId(priceId);
          }
        }
        
        planId = planId || 'SCALE';
        
        // If no userId, find by email
        if (!userId && customerEmail) {
          const user = await findUserByEmail(supabase, customerEmail);
          userId = user?.id;
        }
        
        if (!userId) {
          console.error('[Webhook] Could not find user for checkout session');
          break;
        }

        const quota = PLAN_QUOTAS[planId] || 100;
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 30);

        // Use upsert to create or update the user
        const { error: updateError } = await supabase
          .from('users')
          .upsert({
            id: userId,
            email: customerEmail,
            subscriptionPlan: planId,
            subscriptionStatus: 'active',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            analysisQuota: quota,
            analysisUsedThisMonth: 0,
            currentPeriodStart: now.toISOString(),
            currentPeriodEnd: periodEnd.toISOString(),
          }, {
            onConflict: 'id',
          });

        if (updateError) {
          console.error('[Webhook] Error updating user:', updateError);
        } else {
          console.log(`[Webhook] ✅ Subscription activated for user ${userId}: ${planId}`);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] ${event.type}:`, subscription.id);
        
        const customerId = typeof subscription.customer === 'string' 
          ? subscription.customer 
          : subscription.customer?.id;

        if (!customerId) {
          console.error('[Webhook] Missing customer ID');
          break;
        }

        // Get customer email from Stripe
        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail = (customer as Stripe.Customer).email;
        
        if (!customerEmail) {
          console.error('[Webhook] Customer has no email');
          break;
        }

        // Find user by email
        const user = await findUserByEmail(supabase, customerEmail);
        if (!user) {
          console.error('[Webhook] User not found for email:', customerEmail);
          break;
        }

        // Get plan from price ID
        const priceId = subscription.items.data[0]?.price?.id;
        const planId = priceId ? findPlanByPriceId(priceId) : 'SCALE';
        const quota = PLAN_QUOTAS[planId] || 100;

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

        // Determine status
        let status: 'active' | 'inactive' | 'canceled' | 'past_due' = 'inactive';
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          status = 'active';
        } else if (subscription.status === 'past_due') {
          status = 'past_due';
        } else if (subscription.status === 'canceled') {
          status = 'canceled';
        }

        const { error: updateError } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            email: customerEmail,
            subscriptionPlan: planId,
            subscriptionStatus: status,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            analysisQuota: quota,
            currentPeriodStart: periodStart.toISOString(),
            currentPeriodEnd: periodEnd.toISOString(),
          }, {
            onConflict: 'id',
          });

        if (updateError) {
          console.error('[Webhook] Error updating user:', updateError);
        } else {
          console.log(`[Webhook] ✅ Subscription ${event.type} for ${customerEmail}: ${planId} (${status})`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('[Webhook] customer.subscription.deleted:', subscription.id);
        
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;

        if (!customerId) break;

        // Find user by stripeCustomerId
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('stripeCustomerId', customerId)
          .single();

        if (!user) {
          console.error('[Webhook] User not found for customer:', customerId);
          break;
        }

        await supabase
          .from('users')
          .update({
            subscriptionStatus: 'canceled',
            subscriptionPlan: 'FREE',
            analysisQuota: 0,
          })
          .eq('id', user.id);

        console.log(`[Webhook] ✅ Subscription canceled for user ${user.id}`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('[Webhook] invoice.paid:', invoice.id);
        
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : (invoice.customer as any)?.id;

        if (!customerId) break;

        const { data: user } = await supabase
          .from('users')
          .select('id, subscriptionPlan')
          .eq('stripeCustomerId', customerId)
          .single();

        if (user) {
          const quota = PLAN_QUOTAS[user.subscriptionPlan as PlanId] || 100;
          await supabase
            .from('users')
            .update({
              analysisUsedThisMonth: 0,
              subscriptionStatus: 'active',
              analysisQuota: quota,
            })
            .eq('id', user.id);
          
          console.log(`[Webhook] ✅ Quota reset for user ${user.id}`);
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
