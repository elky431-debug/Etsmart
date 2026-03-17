import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import {
  EtsyScrapeUnavailableError,
  scrapeEtsyKeywordListings,
} from '@/lib/keyword-research/scrape-etsy-search';
import {
  buildKeywordResult,
  computeKeywordMetrics,
  computeKeywordScores,
  generateKeywordSuggestions,
} from '@/lib/keyword-research/score-keyword';
import { generateKeywordInsights } from '@/lib/keyword-research/generate-insights';
import { insertKeywordResearchHistory } from '@/lib/keyword-research/history';

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

    const { sourceUrl, listings, marketSizeEstimate } = await scrapeEtsyKeywordListings(keyword, 24);
    if (!listings.length) {
      return NextResponse.json(
        {
          error: 'NO_DATA',
          message: 'Aucune donnée exploitable trouvée pour ce mot-clé.',
        },
        { status: 422 }
      );
    }

    const metrics = computeKeywordMetrics(listings, marketSizeEstimate);
    const scores = computeKeywordScores(keyword, listings, metrics);
    const suggestions = generateKeywordSuggestions(keyword);

    const strategicInsights = await generateKeywordInsights({
      keyword,
      listings,
      metrics,
      scores,
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
      listings,
      metrics,
      scores,
      strategicInsights,
      suggestions,
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
  } catch (error: any) {
    console.error('[KEYWORD_RESEARCH] analyze error:', error);
    if (error instanceof EtsyScrapeUnavailableError) {
      return NextResponse.json(
        {
          error: 'SCRAPE_UNAVAILABLE',
          message: error.message,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error: 'ANALYZE_FAILED',
        message: "Impossible d'analyser ce mot-clé pour le moment. Réessaie dans quelques instants.",
      },
      { status: 500 }
    );
  }
}
