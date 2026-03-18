import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import { fetchRankHeroKeywordResearch, RankHeroKeywordError } from '@/lib/keyword-research/scrape-rankhero-keyword';
import {
  buildKeywordResult,
  computeKeywordMetrics,
  computeScoresFromAluraOverview,
  generateKeywordSuggestions,
} from '@/lib/keyword-research/score-keyword';
import { generateKeywordInsights } from '@/lib/keyword-research/generate-insights';
import { insertKeywordResearchHistory } from '@/lib/keyword-research/history';
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

    const { sourceUrl, overview, listings, suggestions: providerSuggestions } =
      await fetchRankHeroKeywordResearch(keyword);

    const metrics = buildMetricsFromRankHero(listings, overview);
    const scores = computeScoresFromAluraOverview(keyword, overview, listings);
    const suggestions =
      providerSuggestions.length >= 3
        ? providerSuggestions.slice(0, 12)
        : [...providerSuggestions, ...generateKeywordSuggestions(keyword)].slice(0, 12);

    const strategicInsights = await generateKeywordInsights({
      keyword,
      listings,
      metrics,
      scores,
      aluraOverview: overview,
    });

    if (!strategicInsights?.summary) {
      return NextResponse.json(
        {
          error: 'AI_ANALYSIS_FAILED',
          message: "L'analyse stratégique n'a pas pu être générée.",
        },
        { status: 502 }
      );
    }

    const result = buildKeywordResult({
      keyword,
      sourceUrl,
      dataSource: 'rankhero',
      listings,
      metrics,
      scores,
      strategicInsights,
      suggestions,
      aluraOverview: overview,
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
    let providerCode: string | null = null;
    if (error instanceof RankHeroKeywordError) {
      providerCode = error.code;
    } else if (
      e.name === 'RankHeroKeywordError' &&
      typeof e.code === 'string' &&
      ['CONFIG', 'AUTH', 'HTTP', 'PARSE', 'EMPTY'].includes(e.code)
    ) {
      providerCode = e.code;
    }
    if (providerCode && typeof e.message === 'string') {
      const status =
        providerCode === 'CONFIG'
          ? 503
          : providerCode === 'AUTH'
            ? 401
            : providerCode === 'EMPTY'
              ? 422
              : 502;
      return NextResponse.json(
        { error: `RANKHERO_${providerCode}`, message: e.message },
        { status }
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
