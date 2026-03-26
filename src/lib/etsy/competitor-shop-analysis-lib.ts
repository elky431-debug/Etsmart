import type { ShopPayload, ScrapeShopOptions } from '@/lib/etsy/shop-scrape-service';
import type { CompetitorShopAnalysis } from '@/types/competitor-shop-analysis';

/** Netlify définit SITE_ID + URL ; le gateway coupe souvent avant maxDuration (évite 504 HTML). */
export function isNetlifyCompetitorHost(): boolean {
  return Boolean(process.env.SITE_ID && process.env.URL);
}

/**
 * Options scrape pour l’analyse concurrente sur Netlify :
 * - Le gateway coupe souvent avant 60 s (plan gratuit ~10 s) : Apify long = 504 HTML.
 * - Par défaut : pas d’Apify ; HTML boutique d’abord via ZenRows si `ZENROWS_BROWSER_WS_URL`.
 * - Apify : `COMPETITOR_SHOP_USE_APIFY=true` (+ idéalement plan Netlify Pro pour timeouts >10 s).
 */
export function getCompetitorScrapeOptions(requestedMaxListings?: number): ScrapeShopOptions {
  const raw =
    typeof requestedMaxListings === 'number' && Number.isFinite(requestedMaxListings)
      ? Math.round(requestedMaxListings)
      : 18;
  const maxListings = Math.min(Math.max(raw, 8), 32);

  if (isNetlifyCompetitorHost()) {
    const useApify = process.env.COMPETITOR_SHOP_USE_APIFY === 'true';
    const apifyMs = Math.min(
      55_000,
      Math.max(15_000, parseInt(process.env.COMPETITOR_SHOP_APIFY_MAX_MS || '22000', 10))
    );
    return {
      maxListings: Math.min(maxListings, 16),
      maxEnrichListings: Math.min(12, maxListings),
      preferZenRowsForShopHtml: true,
      skipBrandingApifyFallback: true,
      disableApifyFallback: !useApify,
      ...(useApify ? { apifyMaxTotalWaitMs: apifyMs } : {}),
    };
  }

  return {
    maxListings,
    maxEnrichListings: Math.min(maxListings, 24),
  };
}

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

export async function synthesizeCompetitorShopWithGpt(
  shop: ShopPayload,
  apiKey: string,
  gptTimeoutMs = 55_000
): Promise<CompetitorShopAnalysis> {
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
    signal: AbortSignal.timeout(gptTimeoutMs),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error('[competitor-shop-synthesize] OpenAI', aiRes.status, errText.slice(0, 400));
    throw new Error('OPENAI_ERROR');
  }

  const aiJson = (await aiRes.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = aiJson.choices?.[0]?.message?.content?.trim() || '';
  let analysis: CompetitorShopAnalysis;
  try {
    analysis = JSON.parse(raw) as CompetitorShopAnalysis;
  } catch {
    throw new Error('PARSE_ERROR');
  }

  if (shop.publicationFrequency) {
    analysis.publicationFrequency = {
      estimatedPerMonth: shop.publicationFrequency.estimatedPerMonth,
      comment: shop.publicationFrequency.comment,
    };
  }

  return analysis;
}
