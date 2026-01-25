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

    // Validate plan ID
    if (!['smart', 'pro', 'scale'].includes(planId)) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    // Get Stripe Price ID for the plan
    const priceId = getStripePriceId(planId as PlanId);
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe Price ID not configured for plan: ${planId}` },
        { status: 400 }
      );
    }

    // Get base URL for redirect URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (request.headers.get('origin') || 'http://localhost:3000');

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
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
        plan_id: planId,
        user_id: userId || '',
      },
      success_url: `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

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

