import { NextRequest, NextResponse } from 'next/server';
import { normalizeShopUrl, scrapeEtsyShop } from '@/lib/etsy/shop-scrape-service';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const shopInput = String(body?.shopInput || body?.shopUrl || '').trim();
    const maxListingsRaw = body?.maxListings;
    const maxListings =
      typeof maxListingsRaw === 'number' && Number.isFinite(maxListingsRaw)
        ? Math.min(Math.max(Math.round(maxListingsRaw), 1), 80)
        : 12;

    const shopUrl = normalizeShopUrl(shopInput);
    if (!shopUrl) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Nom ou lien boutique invalide.' },
        { status: 400 }
      );
    }

    try {
      const shop = await scrapeEtsyShop(shopInput, { maxListings });
      return NextResponse.json({ success: true, shop });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'SCRAPE_FAILED' || msg.includes('SCRAPE')) {
        return NextResponse.json(
          {
            error: 'SCRAPE_FAILED',
            message: "Impossible de charger la boutique Etsy pour le moment. Réessaie dans quelques minutes.",
          },
          { status: 503 }
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur scraping boutique.';
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
