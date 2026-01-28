/**
 * API Route: Force sync subscription from Stripe to database
 * Call this ONCE after payment to sync the subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { PLAN_QUOTAS, STRIPE_PRICE_IDS, type PlanId } from '@/types/subscription';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    if (!stripe) {
      return NextResponse.json({ 
        success: false, 
        error: 'Stripe not configured' 
      }, { status: 500 });
    }

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || !user.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    console.log(`[Force Sync] Starting for ${user.email}`);

    // Find customer in Stripe
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Stripe customer found',
        email: user.email,
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
      return NextResponse.json({
        success: false,
        error: 'No active subscription',
        customerId: customer.id,
      });
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price?.id;
    
    // Find plan
    let plan: PlanId = 'SCALE';
    for (const [planId, planPriceId] of Object.entries(STRIPE_PRICE_IDS)) {
      if (planPriceId === priceId) {
        plan = planId as PlanId;
        break;
      }
    }

    const quota = PLAN_QUOTAS[plan] || 100;
    
    // Get period dates safely
    const rawStart = (subscription as any).current_period_start;
    const rawEnd = (subscription as any).current_period_end;
    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setDate(defaultEnd.getDate() + 30);
    
    const periodStart = (typeof rawStart === 'number' && rawStart > 0) 
      ? new Date(rawStart * 1000) 
      : now;
    const periodEnd = (typeof rawEnd === 'number' && rawEnd > 0) 
      ? new Date(rawEnd * 1000) 
      : defaultEnd;

    console.log(`[Force Sync] Found: ${plan}, quota: ${quota}`);

    // UPSERT into database with minimal fields
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        subscriptionPlan: plan,
        subscriptionStatus: 'active',
        analysisQuota: quota,
        analysisUsedThisMonth: 0,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        currentPeriodStart: periodStart.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (upsertError) {
      console.error('[Force Sync] Database error:', upsertError);
      
      // Even if DB fails, return success with Stripe data
      // The user can still use the app via Stripe checks
      return NextResponse.json({
        success: true,
        warning: 'Database update failed but Stripe subscription is active',
        dbError: upsertError.message,
        subscription: {
          plan,
          status: 'active',
          quota,
          customerId: customer.id,
          subscriptionId: subscription.id,
        },
        duration: Date.now() - startTime,
      });
    }

    console.log(`[Force Sync] ✅ Success in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      success: true,
      subscription: {
        plan,
        status: 'active',
        quota,
        used: 0,
        remaining: quota,
        customerId: customer.id,
        subscriptionId: subscription.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
      duration: Date.now() - startTime,
    });

  } catch (error: any) {
    console.error('[Force Sync] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Sync failed',
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}

