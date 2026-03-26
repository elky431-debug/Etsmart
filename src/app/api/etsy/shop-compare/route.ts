import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isApifyConfigured } from '@/lib/apify-scraper';
import { computeShopListingQualityAggregate } from '@/lib/etsy/competitor-listing-score';
import {
  computeShopOverallQuality,
  diffTagSets,
  listingPriceStats,
  tagSetFromListings,
  titleKeywordSetFromListings,
} from '@/lib/etsy/shop-compare-helpers';
import { isEtsyShopUrl, normalizeShopUrl, scrapeEtsyShop, type ShopPayload } from '@/lib/etsy/shop-scrape-service';
import type {
  ShopCompareIndicators,
  ShopCompareSynthesis,
  ShopCompareTagDiff,
} from '@/types/shop-compare';

export const maxDuration = 300;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (t) clearTimeout(t);
  });
}

function listingsToQualityInput(shop: ShopPayload) {
  return shop.listings.map((l) => ({
    title: l.title || '',
    price: l.price,
    images: l.images,
    tags: l.tags,
    description: l.description,
    materials: l.materials,
    sales: l.sales,
    listingStars: l.rating != null && l.rating > 0 ? l.rating : undefined,
    listingReviews: l.reviews != null && l.reviews > 0 ? Math.round(l.reviews) : undefined,
  }));
}

function buildIndicators(shop: ShopPayload): ShopCompareIndicators {
  const stats = listingPriceStats(shop.listings);
  const avgFromDerived =
    shop.derived?.averagePrice != null && Number.isFinite(shop.derived.averagePrice)
      ? shop.derived.averagePrice
      : null;
  return {
    sales: shop.salesCount,
    avgPrice: avgFromDerived ?? stats.avg,
    minPrice: stats.min,
    maxPrice: stats.max,
    listingsSampleCount: shop.listings.length,
    listingsActive: shop.activeListingCount ?? null,
    rating: shop.rating,
    reviewCount: shop.reviewCount,
    shopAgeLabel: shop.shopAge?.trim() || '—',
  };
}

function compactShopForPrompt(shop: ShopPayload, label: string) {
  const ind = buildIndicators(shop);
  return {
    label,
    shopName: shop.shopName,
    shopUrl: shop.shopUrl,
    location: shop.location || null,
    shopAge: shop.shopAge || null,
    ...ind,
    listings: shop.listings.map((l, i) => ({
      i: i + 1,
      title: (l.title || '').slice(0, 160),
      price: l.price,
      sales: l.sales ?? null,
      rating: l.rating ?? null,
      reviews: l.reviews ?? null,
      tags: (l.tags || []).slice(0, 12),
    })),
  };
}

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

    if (!isApifyConfigured('listing')) {
      return NextResponse.json(
        {
          error: 'APIFY_NOT_CONFIGURED',
          message: 'Apify (acteur listing + token) est requis pour comparer les boutiques.',
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawA = String(body?.shopUrlA || body?.urlA || '').trim();
    const rawB = String(body?.shopUrlB || body?.urlB || '').trim();
    const maxListings =
      typeof body?.maxListings === 'number' && Number.isFinite(body.maxListings)
        ? Math.min(Math.max(Math.round(body.maxListings), 8), 32)
        : 18;

    const shopUrlA = normalizeShopUrl(rawA);
    const shopUrlB = normalizeShopUrl(rawB);
    if (!shopUrlA || !isEtsyShopUrl(shopUrlA) || !shopUrlB || !isEtsyShopUrl(shopUrlB)) {
      return NextResponse.json(
        {
          error: 'INVALID_URL',
          message: 'Fournis deux URLs de boutique Etsy valides (shopUrlA et shopUrlB).',
        },
        { status: 400 }
      );
    }
    if (shopUrlA.split('?')[0].toLowerCase() === shopUrlB.split('?')[0].toLowerCase()) {
      return NextResponse.json(
        { error: 'SAME_SHOP', message: 'Les deux URLs pointent vers la même boutique.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'CONFIG', message: 'OPENAI_API_KEY manquant' }, { status: 500 });
    }

    const scrapeOpts = {
      maxListings,
      maxEnrichListings: 0,
      requireApifyListings: true as const,
      /** Donne du temps à Apify pour terminer correctement. */
      apifyMaxTotalWaitMs: 240_000,
    };

    let shopA: ShopPayload;
    let shopB: ShopPayload;
    try {
      /** Un seul run Apify à la fois : deux runs parallèles sursaturent souvent le proxy résidentiel / les quotas. */
      shopA = await withTimeout(scrapeEtsyShop(rawA, scrapeOpts), 260_000, 'SCRAPE_A');
      shopB = await withTimeout(scrapeEtsyShop(rawB, scrapeOpts), 260_000, 'SCRAPE_B');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith('TIMEOUT:')) {
        const which = msg.split(':')[1] || 'SCRAPE';
        return NextResponse.json(
          {
            error: 'TIMEOUT',
            message:
              which.includes('A')
                ? 'Timeout scraping Boutique A (Apify trop lent). Réessaie.'
                : which.includes('B')
                  ? 'Timeout scraping Boutique B (Apify trop lent). Réessaie.'
                  : 'Timeout scraping (Apify trop lent). Réessaie.',
          },
          { status: 504 }
        );
      }
      if (msg === 'APIFY_NOT_CONFIGURED') {
        return NextResponse.json(
          { error: 'APIFY_NOT_CONFIGURED', message: 'Apify non configuré côté serveur.' },
          { status: 503 }
        );
      }
      if (msg === 'APIFY_NO_LISTINGS') {
        return NextResponse.json(
          {
            error: 'APIFY_NO_LISTINGS',
            message:
              'Apify n’a renvoyé aucune fiche pour au moins une boutique. Vérifie l’URL, le proxy résidentiel et réessaie.',
          },
          { status: 422 }
        );
      }
      if (msg.startsWith('APIFY_FAILED|')) {
        const hint = msg.slice('APIFY_FAILED|'.length).trim();
        return NextResponse.json(
          {
            error: 'APIFY_FAILED',
            message: hint
              ? `Échec Apify : ${hint}${hint.length >= 400 ? '…' : ''} Réessaie.`
              : 'Échec du run Apify. Réessaie.',
          },
          { status: 503 }
        );
      }
      if (msg === 'SCRAPE_FAILED' || msg.includes('SCRAPE')) {
        return NextResponse.json(
          { error: 'SCRAPE_FAILED', message: 'Impossible de charger une des boutiques.' },
          { status: 503 }
        );
      }
      throw e;
    }

    if (!shopA.listings.length || !shopB.listings.length) {
      return NextResponse.json(
        { error: 'NO_LISTINGS', message: 'Échantillon de listings vide pour au moins une boutique.' },
        { status: 422 }
      );
    }

    const indicatorsA = buildIndicators(shopA);
    const indicatorsB = buildIndicators(shopB);
    const listingQualityA = computeShopListingQualityAggregate(listingsToQualityInput(shopA));
    const listingQualityB = computeShopListingQualityAggregate(listingsToQualityInput(shopB));
    const qualityA = computeShopOverallQuality({
      listingQualityScore100: listingQualityA.score100,
      indicators: indicatorsA,
    });
    const qualityB = computeShopOverallQuality({
      listingQualityScore100: listingQualityB.score100,
      indicators: indicatorsB,
    });

    const tags: ShopCompareTagDiff = diffTagSets(tagSetFromListings(shopA.listings), tagSetFromListings(shopB.listings));
    const titleKeywords: ShopCompareTagDiff = diffTagSets(
      titleKeywordSetFromListings(shopA.listings),
      titleKeywordSetFromListings(shopB.listings)
    );

    const system = `Tu es un stratège e-commerce Etsy. Tu compares deux boutiques à partir de données scrapées réelles (échantillon Apify).
Ne invente pas de chiffres absents du JSON. Réponds UNIQUEMENT en JSON UTF-8 valide, sans markdown.`;

    const userPrompt = `Compare ces deux boutiques Etsy et réponds au schéma JSON exact ci-dessous.

Boutique A :
${JSON.stringify(compactShopForPrompt(shopA, 'A'), null, 2)}

Boutique B :
${JSON.stringify(compactShopForPrompt(shopB, 'B'), null, 2)}

Scores qualité internes (moyenne des fiches, 0–100) : A=${qualityA.score100}, B=${qualityB.score100}.

Tags en commun (normalisés) : ${tags.common.slice(0, 50).join(', ') || 'aucun'}
Mots-clés titres en commun : ${titleKeywords.common.slice(0, 50).join(', ') || 'aucun'}

Schéma JSON exact :
{
  "strongerShop": "A" | "B" | "tie",
  "why": "3-6 phrases en français : pourquoi cette boutique est globalement plus solide (ou tie), en t’appuyant sur ventes, avis, prix, diversité des listings, tags.",
  "opportunityForUser": "3-5 phrases en français : niche ou angle que l’utilisateur (un troisième vendeur) peut exploiter face à ces deux concurrents (différenciation, sous-niche, SEO, offre)."
}`;

    let synthesis: ShopCompareSynthesis = {
      strongerShop: 'tie',
      why: '',
      opportunityForUser: '',
    };
    try {
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
        signal: AbortSignal.timeout(45_000),
      });

      if (aiRes.ok) {
        const aiJson = (await aiRes.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const raw = aiJson.choices?.[0]?.message?.content?.trim() || '';
        synthesis = JSON.parse(raw) as ShopCompareSynthesis;
      } else {
        const errText = await aiRes.text();
        console.error('[shop-compare] OpenAI', aiRes.status, errText.slice(0, 220));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[shop-compare] OpenAI synthesis skipped:', msg);
    }

    if (!synthesis || (synthesis.strongerShop !== 'A' && synthesis.strongerShop !== 'B' && synthesis.strongerShop !== 'tie')) {
      synthesis = {
        strongerShop: 'tie',
        why: synthesis?.why || 'Synthèse partielle.',
        opportunityForUser: synthesis?.opportunityForUser || '',
      };
    }

    return NextResponse.json({
      success: true,
      shopA,
      shopB,
      indicatorsA,
      indicatorsB,
      qualityA,
      qualityB,
      tags,
      titleKeywords,
      synthesis,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[shop-compare]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
