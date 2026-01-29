/**
 * DEBUG ENDPOINT - Check database state
 * Call this to see exactly what's in the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function GET(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAdminClient();

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated', authError }, { status: 401 });
    }

    // Get ALL data from users table for this user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // Get ALL data from subscriptions table
    const { data: subData, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id);

    // Check Stripe directly
    let stripeData: any = null;
    if (stripe && user.email) {
      try {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          const customer = customers.data[0];
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1,
          });
          stripeData = {
            customerId: customer.id,
            subscription: subscriptions.data[0] || null,
          };
        }
      } catch (stripeErr: any) {
        stripeData = { error: stripeErr.message };
      }
    }

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      usersTable: {
        data: userData,
        error: userError?.message || null,
      },
      subscriptionsTable: {
        data: subData,
        error: subError?.message || null,
      },
      stripe: stripeData,
      columnCheck: userData ? {
        hasAnalysisUsedThisMonth: 'analysisUsedThisMonth' in userData,
        hasAnalysis_used_this_month: 'analysis_used_this_month' in userData,
        allKeys: Object.keys(userData),
      } : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

