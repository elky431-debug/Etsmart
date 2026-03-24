import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isEtsyShopUrl, normalizeShopUrl, scrapeEtsyShop } from '@/lib/etsy/shop-scrape-service';
import type { CompetitorShopAnalysis } from '@/types/competitor-shop-analysis';

export const maxDuration = 300;

function buildListingPayloadForGpt(
  listings: {
    title: string;
    url: string;
    price: number;
    sales?: number;
    tags?: string[];
    createdAt?: string;
    rating?: number;
    reviews?: number;
  }[]
) {
  return listings.map((l, i) => ({
    i: i + 1,
    title: l.title.slice(0, 200),
    price: l.price,
    sales: l.sales ?? null,
    tags: (l.tags || []).slice(0, 13),
    createdAt: l.createdAt || null,
    rating: l.rating ?? null,
    reviews: l.reviews ?? null,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
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
        ? Math.min(Math.max(Math.round(body.maxListings), 8), 60)
        : 40;

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

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'CONFIG', message: 'OPENAI_API_KEY manquant' }, { status: 500 });
    }

    let shop;
    try {
      shop = await scrapeEtsyShop(shopUrlRaw, { maxListings });
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

    const compactListings = buildListingPayloadForGpt(shop.listings);
    const shopContext = {
      shopName: shop.shopName,
      shopUrl: shop.shopUrl,
      shopSalesTotal: shop.salesCount,
      rating: shop.rating,
      reviewCount: shop.reviewCount,
      shopAge: shop.shopAge,
      listingsSampleSize: compactListings.length,
      listings: compactListings,
    };

    const system = `Tu es un analyste e-commerce Etsy senior. Tu reçois des données RÉELLES scrapées (échantillon de la page boutique, souvent la 1re page + fiches enrichies). 
Ne invente pas de chiffres absents : indique quand tu déduis ou estimes.
Réponds UNIQUEMENT en JSON valide UTF-8, sans markdown.`;

    const userPrompt = `Analyse cette boutique concurrente Etsy et produis un tableau de bord stratégique.

Données :
${JSON.stringify(shopContext, null, 2)}

Tâches :
1) Identifie les "meilleures ventes" probables : utilise les ventes au niveau listing (sales) si présentes, sinon mélange titre, ancienneté (createdAt), avis, prix.
2) Stratégie de prix : fourchette, positionnement (premium / milieu / entrée de gamme), bundles éventuels (déduits des titres).
3) Tags : mots-clés récurrents, thématiques SEO.
4) Fréquence de publication : si createdAt est disponible sur plusieurs listings, estime un rythme (listings/mois) ; sinon explique l'incertitude.

Schéma JSON exact :
{
  "summary": "2-4 phrases en français",
  "bestSellers": [{"title": "titre court", "reason": "pourquoi c'est un pilier du CA estimé"}],
  "pricingStrategy": "paragraphe concis",
  "priceRangeComment": "commentaire sur min/max/médiane observés",
  "tagInsights": {"topTags": ["..."], "themes": ["thèmes regroupés"]},
  "publicationFrequency": {"estimatedPerMonth": number ou null, "comment": "..."},
  "strengths": ["..."],
  "weaknesses": ["..."],
  "recommendations": ["actions concrètes pour un concurrent qui veut se différencier"]
}`;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.35,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[competitor-shop-analysis] OpenAI', aiRes.status, errText.slice(0, 400));
      return NextResponse.json(
        { error: 'OPENAI_ERROR', message: 'Analyse IA indisponible. Réessaie.' },
        { status: 502 }
      );
    }

    const aiJson = (await aiRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = aiJson.choices?.[0]?.message?.content?.trim() || '';
    let analysis: CompetitorShopAnalysis;
    try {
      analysis = JSON.parse(raw) as CompetitorShopAnalysis;
    } catch {
      return NextResponse.json(
        { error: 'PARSE_ERROR', message: 'Réponse IA invalide', shop },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      shop,
      analysis,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[competitor-shop-analysis]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
