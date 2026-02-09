import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripePriceId, type PlanId } from '@/types/subscription';
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
        { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' },
        { status: 500 }
      );
    }

    // 🔒 SECURITY: Verify user authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    let authenticatedUser = null;
    if (token) {
      try {
        const supabase = createSupabaseAdminClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          authenticatedUser = user;
        }
      } catch (e) {
        console.warn('[Checkout] Auth verification failed:', e);
      }
    }

    const { planId, userId, userEmail } = await request.json();
    
    // 🔒 SECURITY: If user is authenticated, enforce that they can only create sessions for themselves
    if (authenticatedUser) {
      if (userId && userId !== authenticatedUser.id) {
        return NextResponse.json(
          { error: 'Unauthorized: Cannot create checkout session for another user' },
          { status: 403 }
        );
      }
      if (userEmail && userEmail !== authenticatedUser.email) {
        return NextResponse.json(
          { error: 'Unauthorized: Email mismatch' },
          { status: 403 }
        );
      }
    }
    
    // Use authenticated user data if available
    const finalUserId = authenticatedUser?.id || userId;
    const finalUserEmail = authenticatedUser?.email || userEmail;

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Validate plan ID (case-insensitive)
    const normalizedPlanId = planId.toUpperCase() as PlanId;
    if (!['SMART', 'PRO', 'SCALE', 'INFINITY'].includes(normalizedPlanId)) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    // Get Stripe Price ID for the plan
    let priceId = getStripePriceId(normalizedPlanId);
    
    // If price ID is not configured, try to find it from Stripe API
    if (!priceId && stripe) {
      try {
        const expectedPrice = normalizedPlanId === 'SMART' ? 19.99 :
                             normalizedPlanId === 'PRO' ? 29.99 :
                             normalizedPlanId === 'SCALE' ? 59.99 :
                             normalizedPlanId === 'INFINITY' ? 219.99 : null;
        
        if (expectedPrice) {
          const prices = await stripe.prices.list({
            limit: 100,
            active: true,
          });
          
          const matchingPrice = prices.data.find(p => {
            const amount = p.unit_amount ? p.unit_amount / 100 : 0;
            return Math.abs(amount - expectedPrice) < 0.01 && 
                   p.recurring?.interval === 'month' &&
                   p.recurring?.interval_count === 1;
          });
          
          if (matchingPrice) {
            priceId = matchingPrice.id;
            console.log(`[Checkout] Auto-detected Price ID for ${normalizedPlanId}: ${priceId}`);
          }
        }
      } catch (e) {
        console.warn(`[Checkout] Failed to auto-detect Price ID for ${normalizedPlanId}:`, e);
      }
    }
    
    if (!priceId) {
      return NextResponse.json(
        { 
          error: `Stripe Price ID not configured for plan: ${normalizedPlanId}`,
          message: `Please configure the Price ID for ${normalizedPlanId} plan in Stripe Dashboard.`
        },
        { status: 400 }
      );
    }

    // Get base URL for redirect URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (request.headers.get('origin') || 'http://localhost:3000');

    // Create Stripe Checkout Session with immediate payment
    // IMPORTANT: The issue might be in Stripe Dashboard configuration
    // Check: Products > Price > Billing settings > "Charge immediately" should be enabled
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: finalUserEmail || undefined,
      metadata: {
        plan_id: normalizedPlanId,
        user_id: finalUserId || '',
      },
      success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard?section=analyse-simulation&canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      payment_method_collection: 'always',
      subscription_data: {
        // Set billing cycle anchor to now (immediate payment)
        // Checkout Session already defaults to charge_automatically
        // Invoices are created automatically for subscription mode
        billing_cycle_anchor: Math.floor(Date.now() / 1000),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url 
    });

  } catch (error: any) {
    console.error('Error creating Stripe checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

