import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function GET(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    // Récupérer tous les prix actifs
    const prices = await stripe.prices.list({
      limit: 100,
      active: true,
    });

    // Récupérer les produits associés
    const pricesWithProducts = await Promise.all(
      prices.data.map(async (price) => {
        const productId = typeof price.product === 'string' ? price.product : price.product?.id;
        const product = productId ? await stripe.products.retrieve(productId) : null;
        
        return {
          id: price.id,
          amount: price.unit_amount ? price.unit_amount / 100 : 0,
          currency: price.currency,
          interval: price.recurring?.interval,
          intervalCount: price.recurring?.interval_count || 1,
          productName: product?.name || 'Unknown',
          productId: productId,
        };
      })
    );

    // Filtrer les prix mensuels
    const monthlyPrices = pricesWithProducts.filter(
      p => p.interval === 'month' && p.intervalCount === 1
    );

    // Trouver les prix correspondant aux plans Etsmart
    const smartPrice = monthlyPrices.find(p => Math.abs(p.amount - 24.99) < 0.01);
    const proPrice = monthlyPrices.find(p => Math.abs(p.amount - 44.99) < 0.01);
    const scalePrice = monthlyPrices.find(p => Math.abs(p.amount - 69.99) < 0.01);
    const infinityPrice = monthlyPrices.find(p => p.id === 'price_1TFQofCn17QPHnzEJqaSmDdP');

    return NextResponse.json({
      success: true,
      allPrices: monthlyPrices,
      recommended: {
        SMART: smartPrice?.id || null,
        PRO: proPrice?.id || null,
        SCALE: scalePrice?.id || null,
        INFINITY: infinityPrice?.id || null,
      },
      current: {
        SMART: 'price_1TEWJ0Cn17QPHnzEwYpxSgGX',
        PRO: 'price_1TEWTHCn17QPHnzEgEpXoK76',
        SCALE: 'price_1TEWUlCn17QPHnzEa6m5sgJY',
        INFINITY: 'price_1TFQofCn17QPHnzEJqaSmDdP',
      },
      prices: {
        SMART: smartPrice?.amount || 24.99,
        PRO: proPrice?.amount || 44.99,
        SCALE: scalePrice?.amount || 69.99,
        INFINITY: infinityPrice?.amount || 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Stripe prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices', message: error.message },
      { status: 500 }
    );
  }
}

