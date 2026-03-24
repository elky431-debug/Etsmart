import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { fetchAliExpressProductQuick } from '@/lib/aliexpress-product-quick';
import { isApifyConfigured, mapApifyItemToListing, runApifyActorByTarget } from '@/lib/apify-scraper';

export const maxDuration = 15;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Session invalide ou expirée' }, { status: 401 });
    }

    const body = await request.json();
    const url = typeof body.url === 'string' ? body.url.trim() : '';

    if (!url) {
      return NextResponse.json({ error: 'URL manquante' }, { status: 400 });
    }

    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const lower = normalizedUrl.toLowerCase();
    if (!lower.includes('aliexpress')) {
      return NextResponse.json(
        {
          error:
            'Récupération rapide réservée à AliExpress. Utilise la récupération complète pour Alibaba / autres.',
        },
        { status: 400 }
      );
    }

    let product = await fetchAliExpressProductQuick(normalizedUrl);

    // Fallback optionnel via Apify (si configuré), utile quand l'API AliExpress renvoie du HTML anti-bot.
    if (!product && isApifyConfigured('listing')) {
      try {
        const items = await runApifyActorByTarget(
          'listing',
          {
            url: normalizedUrl,
            urls: [normalizedUrl],
            startUrls: [{ url: normalizedUrl }],
            maxItems: 1,
          },
          { timeoutSecs: 40, maxItems: 1 }
        );
        const mapped = mapApifyItemToListing(items[0]);
        if (mapped?.title) {
          product = {
            id: `apify-aliexpress-${Date.now()}`,
            url: normalizedUrl,
            source: 'aliexpress' as const,
            title: mapped.title,
            description: mapped.description || mapped.title,
            images: mapped.images.length > 0 ? mapped.images : ['https://via.placeholder.com/600x600?text=AliExpress'],
            price: mapped.price || 0,
            currency: 'USD',
            variants: [{ id: 'v1', name: 'Standard', price: mapped.price || 0 }],
            category: 'General',
            shippingTime: '15-30 days',
            minOrderQuantity: 1,
            supplierRating: 4.5,
            createdAt: new Date().toISOString(),
          };
        }
      } catch (apifyError) {
        console.warn('[parse-product-quick] fallback Apify failed:', apifyError);
      }
    }

    if (!product) {
      return NextResponse.json(
        {
          error:
            'Impossible de récupérer ce produit rapidement. Vérifie le lien ou configure Apify en fallback.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (e) {
    console.error('[parse-product-quick]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
