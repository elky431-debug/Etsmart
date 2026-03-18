import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import {
  buildKeywordResult,
  computeKeywordMetrics,
  computeKeywordScores,
  fallbackStrategicInsights,
  generateKeywordSuggestions,
} from '@/lib/keyword-research/score-keyword';
import { generateKeywordInsights } from '@/lib/keyword-research/generate-insights';
import { insertKeywordResearchHistory } from '@/lib/keyword-research/history';
import { scrapeEtsyKeywordListings, EtsyScrapeUnavailableError } from '@/lib/keyword-research/scrape-etsy-search';
import type { EtsyKeywordListing, KeywordMetrics } from '@/lib/keyword-research/types';

const KEYWORD_RESEARCH_CREDIT_COST = Number.parseFloat(
  process.env.KEYWORD_RESEARCH_CREDIT_COST || '1'
);

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

    // Keyword Research est masqué en production (bug côté route).
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'FEATURE_DISABLED',
          message: 'Keyword Research est temporairement indisponible sur le site.',
        },
        { status: 503 }
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

    // Source unique : recherche Etsy (scraping HTML du search Etsy.com)
    // → pas de RankHero / Alura, uniquement données officielles Etsy.
    const etsy = await scrapeEtsyKeywordListings(keyword, 24);
    const sourceUrl = etsy.sourceUrl;
    const listings = etsy.listings;
    const suggestions = generateKeywordSuggestions(keyword).slice(0, 12);
    const metrics = computeKeywordMetrics(listings, etsy.marketSizeEstimate);
    const scores = computeKeywordScores(keyword, listings, metrics);
    const dataSource: 'etsy' = 'etsy';

    const strategicInsights = await generateKeywordInsights({
      keyword,
      listings,
      metrics,
      scores,
      aluraOverview: undefined,
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
      aluraOverview: null,
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
