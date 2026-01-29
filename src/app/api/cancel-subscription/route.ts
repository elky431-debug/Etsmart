import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY environment variable is not set');
}

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

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
    
    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`[Cancel] Attempting to cancel subscription for ${user.email}`);

    let stripeSubscriptionId: string | null = null;

    // Method 1: Try to get subscription from database
    const { data: dbSub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (dbSub?.stripe_subscription_id) {
      stripeSubscriptionId = dbSub.stripe_subscription_id;
      console.log(`[Cancel] Found subscription in DB: ${stripeSubscriptionId}`);
    }

    // Method 2: Try to get from users table (snake_case columns!)
    if (!stripeSubscriptionId) {
      const { data: userData } = await supabase
        .from('users')
        .select('stripe_subscription_id')
        .eq('id', user.id)
        .single();

      if (userData?.stripe_subscription_id) {
        stripeSubscriptionId = userData.stripe_subscription_id;
        console.log(`[Cancel] Found subscription in users table: ${stripeSubscriptionId}`);
      }
    }

    // Method 3: Search directly in Stripe by email
    if (!stripeSubscriptionId) {
      console.log(`[Cancel] Searching Stripe for customer: ${user.email}`);
      
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        const customer = customers.data[0];
        
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'active',
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          stripeSubscriptionId = subscriptions.data[0].id;
          console.log(`[Cancel] Found subscription in Stripe: ${stripeSubscriptionId}`);
        }
      }
    }

    if (!stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Cancel the subscription in Stripe (at period end to be fair)
    const canceledSubscription = await stripe.subscriptions.update(
      stripeSubscriptionId,
      { cancel_at_period_end: true }
    );

    console.log(`[Cancel] ✅ Subscription marked for cancellation: ${stripeSubscriptionId}`);

    // Update subscriptions table
    await supabase
      .from('subscriptions')
      .update({
        status: 'canceling',
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    // Update users table (snake_case column!)
    await supabase
      .from('users')
      .update({
        subscription_status: 'canceling',
      })
      .eq('id', user.id);

    return NextResponse.json({ 
      success: true,
      message: 'Subscription will be canceled at the end of your billing period',
      cancelAt: canceledSubscription.cancel_at 
        ? new Date(canceledSubscription.cancel_at * 1000).toISOString() 
        : null,
    });

  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
