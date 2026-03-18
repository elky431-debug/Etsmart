import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import { fetchRankHeroKeywordResearch, RankHeroKeywordError } from '@/lib/keyword-research/scrape-rankhero-keyword';
import { fetchAluraKeywordResearch, AluraKeywordResearchError } from '@/lib/keyword-research/scrape-alura-keyword';
import {
  buildKeywordResult,
  computeKeywordMetrics,
  computeKeywordScores,
  fallbackStrategicInsights,
  computeScoresFromAluraOverview,
  generateKeywordSuggestions,
} from '@/lib/keyword-research/score-keyword';
import { generateKeywordInsights } from '@/lib/keyword-research/generate-insights';
import { insertKeywordResearchHistory } from '@/lib/keyword-research/history';
import { scrapeEtsyKeywordListings, EtsyScrapeUnavailableError } from '@/lib/keyword-research/scrape-etsy-search';
import type { EtsyKeywordListing, KeywordMetrics } from '@/lib/keyword-research/types';

const KEYWORD_RESEARCH_CREDIT_COST = Number.parseFloat(
  process.env.KEYWORD_RESEARCH_CREDIT_COST || '1'
);

function buildMetricsFromRankHero(
  listings: EtsyKeywordListing[],
  overview: Awaited<ReturnType<typeof fetchRankHeroKeywordResearch>>['overview']
): KeywordMetrics {
  if (listings.length) {
    const m = computeKeywordMetrics(listings, overview.competingListings);
    return {
      ...m,
      averagePrice: overview.avgPriceUsd ?? m.averagePrice,
      averageReviewCount: overview.avgReviewCount ?? m.averageReviewCount,
      marketSizeEstimate: overview.competingListings ?? m.marketSizeEstimate,
      listingsCount: overview.competingListings ?? m.listingsCount,
    };
  }
  return {
    averagePrice: overview.avgPriceUsd ?? 0,
    averageReviewCount: overview.avgReviewCount ?? 0,
    topShopsConcentration: 0,
    listingsCount: overview.competingListings ?? overview.listingsAnalyzed ?? 0,
    marketSizeEstimate: overview.competingListings,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Token invalide ou expiré.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
    if (!keyword || keyword.length < 2) {
      return NextResponse.json(
        { error: 'INVALID_KEYWORD', message: 'Le mot-clé doit contenir au moins 2 caractères.' },
        { status: 400 }
      );
    }

    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json(
        {
          error: 'SUBSCRIPTION_REQUIRED',
          message: 'Un abonnement actif est requis pour Keyword Research.',
        },
        { status: 403 }
      );
    }
    if (quotaInfo.remaining < KEYWORD_RESEARCH_CREDIT_COST) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: `Crédits insuffisants. Il faut ${KEYWORD_RESEARCH_CREDIT_COST} crédit(s) pour cette analyse.`,
          remaining: quotaInfo.remaining,
        },
        { status: 403 }
      );
    }

    // 1) Provider primary (RankHero). 2) Provider secondary (Alura scraping) if configured.
    // 3) Fallback scraping Etsy. Goal: never hard-fail on provider errors.
    let sourceUrl = '';
    let listings: EtsyKeywordListing[] = [];
    let suggestions: string[] = [];
    let metrics: KeywordMetrics;
    let scores: ReturnType<typeof computeKeywordScores>;
    let dataSource: 'rankhero' | 'alura' | 'etsy' = 'etsy';
    let aluraOverview: Awaited<ReturnType<typeof fetchRankHeroKeywordResearch>>['overview'] | null = null;

    // Attempt RankHero
    try {
      const provider = await fetchRankHeroKeywordResearch(keyword);
      sourceUrl = provider.sourceUrl;
      listings = provider.listings;
      suggestions = provider.suggestions.slice(0, 12);
      aluraOverview = provider.overview;
      metrics = buildMetricsFromRankHero(listings, provider.overview);
      scores = computeScoresFromAluraOverview(keyword, provider.overview, listings);
      dataSource = 'rankhero';
    } catch (e) {
      // RankHero is flaky (403 / WAF). Ignore and fallback.
      const err = e as unknown;
      if (!(err instanceof RankHeroKeywordError)) {
        console.warn('[KEYWORD_RESEARCH] RankHero failed, falling back:', err);
      }

      // Attempt Alura scraping when configured
      try {
        const alura = await fetchAluraKeywordResearch(keyword, 24);
        sourceUrl = alura.sourceUrl;
        listings = alura.listings;
        suggestions =
          alura.similarKeywords.length >= 3
            ? alura.similarKeywords.slice(0, 12)
            : [...alura.similarKeywords, ...generateKeywordSuggestions(keyword)].slice(0, 12);
        aluraOverview = alura.overview;
        metrics = buildMetricsFromRankHero(listings, alura.overview);
        scores = computeScoresFromAluraOverview(keyword, alura.overview, listings);
        dataSource = 'alura';
      } catch (aluraErr) {
        if (aluraErr instanceof AluraKeywordResearchError) {
          console.warn('[KEYWORD_RESEARCH] Alura failed, falling back:', {
            code: aluraErr.code,
            message: aluraErr.message,
          });
        } else {
          console.warn('[KEYWORD_RESEARCH] Alura failed, falling back:', aluraErr);
        }

        // Final fallback: scrape Etsy search directly.
        const etsy = await scrapeEtsyKeywordListings(keyword, 24);
        sourceUrl = etsy.sourceUrl;
        listings = etsy.listings;
        suggestions = generateKeywordSuggestions(keyword).slice(0, 12);
        metrics = computeKeywordMetrics(listings, etsy.marketSizeEstimate);
        scores = computeKeywordScores(keyword, listings, metrics);
        dataSource = 'etsy';
        aluraOverview = null;
      }
    }

    const strategicInsights = await generateKeywordInsights({
      keyword,
      listings,
      metrics,
      scores,
      aluraOverview: aluraOverview ?? undefined,
    }).catch(() => null);

    const finalInsights =
      strategicInsights?.summary ? strategicInsights : fallbackStrategicInsights(keyword, metrics, scores);

    const result = buildKeywordResult({
      keyword,
      sourceUrl,
      dataSource,
      listings,
      metrics,
      scores,
      strategicInsights: finalInsights,
      suggestions,
      aluraOverview,
    });

    const historyItem = await insertKeywordResearchHistory(supabase, user.id, result);

    const deduction = await incrementAnalysisCount(user.id, KEYWORD_RESEARCH_CREDIT_COST);
    if (!deduction.success) {
      return NextResponse.json(
        {
          error: 'CREDIT_DEDUCTION_FAILED',
          message:
            "L'analyse est prête mais la déduction de crédits a échoué. Réessaie dans quelques secondes.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      historyItem,
      credits: {
        used: deduction.used,
        quota: deduction.quota,
        remaining: deduction.remaining,
      },
    });
  } catch (error: unknown) {
    console.error('[KEYWORD_RESEARCH] analyze error:', error);
    const e = error as { name?: string; message?: string; code?: string };
    if (error instanceof EtsyScrapeUnavailableError) {
      return NextResponse.json(
        {
          error: 'SERVICE_UNAVAILABLE',
          message: "Le service est temporairement indisponible. Réessaie dans quelques instants.",
        },
        { status: 503 }
      );
    }
    const detail =
      error instanceof Error ? error.message.slice(0, 400) : 'Erreur inconnue';
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: detail || 'Erreur serveur keyword research.',
      },
      { status: 500 }
    );
  }
}
