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
    const smartPrice = monthlyPrices.find(p => Math.abs(p.amount - 19.99) < 0.01);
    const proPrice = monthlyPrices.find(p => Math.abs(p.amount - 29.99) < 0.01);
    const scalePrice = monthlyPrices.find(p => Math.abs(p.amount - 49.99) < 0.01); // Updated to €49.99

    return NextResponse.json({
      success: true,
      allPrices: monthlyPrices,
      recommended: {
        SMART: smartPrice?.id || null,
        PRO: proPrice?.id || null,
        SCALE: scalePrice?.id || null,
      },
      current: {
        SMART: 'price_1SuZeOCn17QPHnzEKg8ix1VD', // Etsmart Smart - €19.99/month
        PRO: 'price_1SuZj2Cn17QPHnzEzSlaXWuh', // Etsmart Pro - €29.99/month
        SCALE: 'price_1SuZZdCn17QPHnzEHKehuq0O', // Etsmart Scale - €49.99/month
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

