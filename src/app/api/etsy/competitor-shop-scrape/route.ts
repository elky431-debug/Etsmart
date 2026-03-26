import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isEtsyShopUrl, normalizeShopUrl, scrapeEtsyShop } from '@/lib/etsy/shop-scrape-service';
import { getCompetitorScrapeOptions } from '@/lib/etsy/competitor-shop-analysis-lib';

/** Une seule étape : scraping (Netlify : Apify plafonné pour éviter 504 gateway). */
export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')?.trim();
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? '';
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentification requise' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Session invalide' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const shopUrlRaw = String(body?.shopUrl || body?.url || '').trim();
    const maxListings =
      typeof body?.maxListings === 'number' && Number.isFinite(body.maxListings)
        ? Math.min(Math.max(Math.round(body.maxListings), 8), 32)
        : undefined;

    const shopUrl = normalizeShopUrl(shopUrlRaw);
    if (!shopUrl || !isEtsyShopUrl(shopUrl)) {
      return NextResponse.json(
        {
          error: 'INVALID_URL',
          message:
            'Colle une URL de boutique Etsy (ex. https://www.etsy.com/shop/… ou https://www.etsy.com/fr/shop/…)',
        },
        { status: 400 }
      );
    }

    const scrapeOpts = getCompetitorScrapeOptions(maxListings);

    let shop;
    try {
      shop = await scrapeEtsyShop(shopUrlRaw, scrapeOpts);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'SCRAPE_FAILED' || msg.includes('SCRAPE')) {
        return NextResponse.json(
          {
            error: 'SCRAPE_FAILED',
            message: 'Impossible de charger la boutique. Réessaie plus tard.',
          },
          { status: 503 }
        );
      }
      throw e;
    }

    if (!shop.listings.length) {
      return NextResponse.json(
        {
          error: 'NO_LISTINGS',
          message: 'Aucun listing trouvé sur la page boutique (Etsy peut bloquer ou la page est vide).',
          shop,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, shop });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[competitor-shop-scrape]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
