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
import {
  demandScoreFromSearchVolume,
  competitionScoreFromGoogleAds,
  estimateEtsyListingsFromCompetitionIndex,
} from '@/lib/etsy-keyword-analytics';
import type { EtsyKeywordListing, KeywordMetrics, KeywordScores } from '@/lib/keyword-research/types';

export const maxDuration = 55;
export const runtime = 'nodejs';

const KEYWORD_RESEARCH_CREDIT_COST = Number.parseFloat(
  process.env.KEYWORD_RESEARCH_CREDIT_COST || '1'
);

// ─── DataForSEO fetch ─────────────────────────────────────────────────────────

async function fetchDataForSeo(keyword: string): Promise<{ searchVolume: number; competitionIndex: number } | null> {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) return null;

  const credentials = Buffer.from(`${login}:${password}`).toString('base64');
  try {
    const res = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ keywords: [keyword], location_code: 2840, language_code: 'en' }]),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { tasks?: Array<{ result?: Array<{ search_volume: number; competition_index: number }> }> };
    const result = json.tasks?.[0]?.result?.[0];
    if (!result) return null;
    return { searchVolume: result.search_volume ?? 0, competitionIndex: result.competition_index ?? 0 };
  } catch {
    return null;
  }
}

// ─── Build scores from DataForSEO data ───────────────────────────────────────

function buildScoresFromDfs(
  keyword: string,
  dfs: { searchVolume: number; competitionIndex: number },
  listings: EtsyKeywordListing[],
  marketSize: number
): { metrics: KeywordMetrics; scores: KeywordScores } {
  const demandScore = demandScoreFromSearchVolume(dfs.searchVolume);
  const competitionScore = competitionScoreFromGoogleAds(dfs.competitionIndex);
  const opportunityScore = Math.round(demandScore * 0.55 + (100 - competitionScore) * 0.45);
  const globalScore = Math.round((opportunityScore + demandScore) / 2);

  const baseMetrics = computeKeywordMetrics(listings, marketSize);
  const baseScores = computeKeywordScores(keyword, listings, baseMetrics);

  const metrics: KeywordMetrics = { ...baseMetrics, listingsCount: marketSize, marketSizeEstimate: marketSize };
  const scores: KeywordScores = {
    ...baseScores,
    demandScore,
    competitionScore,
    opportunityScore,
    globalScore,
  };

  return { metrics, scores };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Token invalide ou expiré.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
    if (!keyword || keyword.length < 2) {
      return NextResponse.json({ error: 'INVALID_KEYWORD', message: 'Le mot-clé doit contenir au moins 2 caractères.' }, { status: 400 });
    }

    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'Un abonnement actif est requis pour Keyword Research.',
      }, { status: 403 });
    }
    if (quotaInfo.remaining < KEYWORD_RESEARCH_CREDIT_COST) {
      return NextResponse.json({
        error: 'QUOTA_EXCEEDED',
        message: `Crédits insuffisants. Il faut ${KEYWORD_RESEARCH_CREDIT_COST} crédit(s) pour cette analyse.`,
        remaining: quotaInfo.remaining,
      }, { status: 403 });
    }

    const sourceUrl = `https://www.etsy.com/search?q=${encodeURIComponent(keyword)}`;
    const suggestions = generateKeywordSuggestions(keyword).slice(0, 12);

    // Run DataForSEO + Etsy scraping in parallel (scraping is best-effort)
    const [dfs, etsyResult] = await Promise.all([
      fetchDataForSeo(keyword),
      scrapeEtsyKeywordListings(keyword, 24).catch(() => null),
    ]);

    const listings: EtsyKeywordListing[] = etsyResult?.listings ?? [];
    const marketSize = dfs
      ? estimateEtsyListingsFromCompetitionIndex(dfs.competitionIndex)
      : (etsyResult?.marketSizeEstimate ?? listings.length);

    let metrics: KeywordMetrics;
    let scores: KeywordScores;

    if (dfs) {
      // DataForSEO scores (reliable) + listing enrichment when available
      ({ metrics, scores } = buildScoresFromDfs(keyword, dfs, listings, marketSize));
    } else {
      // Fallback: pure listing-based scores
      metrics = computeKeywordMetrics(listings, etsyResult?.marketSizeEstimate ?? null);
      scores = computeKeywordScores(keyword, listings, metrics);
    }

    const strategicInsights = await generateKeywordInsights({
      keyword,
      listings,
      metrics,
      scores,
      aluraOverview: undefined,
    }).catch(() => null);

    const finalInsights = strategicInsights?.summary
      ? strategicInsights
      : fallbackStrategicInsights(keyword, metrics, scores);

    const result = buildKeywordResult({
      keyword,
      sourceUrl,
      dataSource: 'etsy',
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
      return NextResponse.json({
        error: 'CREDIT_DEDUCTION_FAILED',
        message: "L'analyse est prête mais la déduction de crédits a échoué. Réessaie dans quelques secondes.",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      result,
      historyItem,
      credits: { used: deduction.used, quota: deduction.quota, remaining: deduction.remaining },
    });

  } catch (error: unknown) {
    console.error('[KEYWORD_RESEARCH] analyze error:', error);
    if (error instanceof EtsyScrapeUnavailableError) {
      return NextResponse.json({
        error: 'SERVICE_UNAVAILABLE',
        message: "Le service est temporairement indisponible. Réessaie dans quelques instants.",
      }, { status: 503 });
    }
    const detail = error instanceof Error ? error.message.slice(0, 400) : 'Erreur inconnue';
    return NextResponse.json({
      error: 'INTERNAL_ERROR',
      message: detail || 'Erreur serveur keyword research.',
    }, { status: 500 });
  }
}
