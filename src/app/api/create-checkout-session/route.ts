import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripePriceId, type PlanId } from '@/types/subscription';

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

    const { planId, userId, userEmail } = await request.json();

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Validate plan ID (case-insensitive)
    const normalizedPlanId = planId.toUpperCase() as PlanId;
    if (!['SMART', 'PRO', 'SCALE'].includes(normalizedPlanId)) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    // Get Stripe Price ID for the plan
    const priceId = getStripePriceId(normalizedPlanId);
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
      customer_email: userEmail || undefined,
      metadata: {
        plan_id: normalizedPlanId,
        user_id: userId || '',
      },
      success_url: `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      payment_method_collection: 'always',
      subscription_data: {
        // Set billing cycle anchor to now (immediate payment)
        // Checkout Session already defaults to charge_automatically
        billing_cycle_anchor: Math.floor(Date.now() / 1000),
      },
      // Force invoice settings for immediate payment
      invoice_creation: {
        enabled: true,
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

