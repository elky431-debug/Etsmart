/**
 * FULL DEBUG ENDPOINT - Check everything
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get ALL columns from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // Get product analyses
    const { data: analyses, error: analysesError } = await supabase
      .from('product_analyses')
      .select('id, created_at, verdict, product_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, title, url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Check Stripe
    let stripeInfo: any = null;
    if (stripe && user.email) {
      try {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          const customer = customers.data[0];
          const subs = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1,
          });
          stripeInfo = {
            customerId: customer.id,
            hasActiveSubscription: subs.data.length > 0,
            subscription: subs.data[0] ? {
              id: subs.data[0].id,
              status: subs.data[0].status,
              priceId: subs.data[0].items.data[0]?.price?.id,
            } : null,
          };
        }
      } catch (e: any) {
        stripeInfo = { error: e.message };
      }
    }

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      users_table: {
        data: userData,
        error: userError?.message,
        columns: userData ? Object.keys(userData) : [],
      },
      analyses: {
        count: analyses?.length || 0,
        data: analyses,
        error: analysesError?.message,
      },
      products: {
        count: products?.length || 0,
        data: products,
        error: productsError?.message,
      },
      stripe: stripeInfo,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST to manually increment analysis count
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get current value
    const { data: before } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log('[Debug] Before:', JSON.stringify(before, null, 2));

    // Determine which column name exists
    const columns = before ? Object.keys(before) : [];
    const hasSnakeCase = columns.includes('analysis_used_this_month');
    const hasCamelCase = columns.includes('analysisUsedThisMonth');

    console.log('[Debug] Columns:', columns);
    console.log('[Debug] hasSnakeCase:', hasSnakeCase, 'hasCamelCase:', hasCamelCase);

    let currentUsed = 0;
    let columnName = '';

    if (hasSnakeCase) {
      currentUsed = before?.analysis_used_this_month || 0;
      columnName = 'analysis_used_this_month';
    } else if (hasCamelCase) {
      currentUsed = before?.analysisUsedThisMonth || 0;
      columnName = 'analysisUsedThisMonth';
    } else {
      // Neither exists - need to create the column
      return NextResponse.json({
        error: 'Column not found',
        columns,
        message: 'Neither analysis_used_this_month nor analysisUsedThisMonth exists in users table',
      });
    }

    // Increment
    const newUsed = currentUsed + 1;
    const updateData: any = {};
    updateData[columnName] = newUsed;

    console.log('[Debug] Updating with:', updateData);

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    // Get after value
    const { data: after } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    const afterUsed = hasSnakeCase ? after?.analysis_used_this_month : after?.analysisUsedThisMonth;

    return NextResponse.json({
      success: !updateError,
      columnName,
      before: currentUsed,
      after: afterUsed,
      updateError: updateError?.message,
      allColumnsBefore: columns,
      allColumnsAfter: after ? Object.keys(after) : [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

