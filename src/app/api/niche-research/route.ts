import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  demandScoreFromSearchVolume,
  competitionScoreFromGoogleAds,
  estimateEtsyListingsFromCompetitionIndex,
} from '@/lib/etsy-keyword-analytics';

export const maxDuration = 26;
export const runtime = 'nodejs';

export interface NicheResult {
  keyword: string;
  competitionCount: number | null;
  competitionScore: number;           // 0-100
  trendsScore: number | null;         // search volume (DataForSEO) or null
  demandScore: number;                // 0-100
  opportunityScore: number;           // 0-100
  searchVolume?: number;
  competitionIndex?: number;
  cachedAt?: number;
  error?: boolean;
}

// ─── DataForSEO — volume Google Ads + competition index (source principale) ──

async function fetchDataForSeo(keyword: string): Promise<{
  searchVolume: number;
  competitionIndex: number;
} | null> {
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
      body: JSON.stringify([{
        keywords: [keyword],
        location_code: 2840, // US
        language_code: 'en',
      }]),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const json = await res.json() as {
      tasks?: Array<{
        result?: Array<{
          search_volume: number;
          competition_index: number;
        }>
      }>
    };
    const result = json.tasks?.[0]?.result?.[0];
    if (!result) return null;
    return {
      searchVolume: result.search_volume ?? 0,
      competitionIndex: result.competition_index ?? 0,
    };
  } catch {
    return null;
  }
}

// ─── Main analysis ────────────────────────────────────────────────────────────

async function analyzeNiche(keyword: string): Promise<NicheResult> {
  const dfs = await fetchDataForSeo(keyword);

  if (dfs) {
    const competitionScore = competitionScoreFromGoogleAds(dfs.competitionIndex);
    const demandScore = demandScoreFromSearchVolume(dfs.searchVolume);
    const competitionCount = estimateEtsyListingsFromCompetitionIndex(dfs.competitionIndex);
    const opportunityScore = Math.round(demandScore * 0.55 + (100 - competitionScore) * 0.45);
    return {
      keyword,
      competitionCount,
      competitionScore,
      trendsScore: dfs.searchVolume,
      demandScore,
      opportunityScore,
      searchVolume: dfs.searchVolume,
      competitionIndex: dfs.competitionIndex,
      error: false,
    };
  }

  // Fallback heuristique si DataForSEO indisponible
  return {
    keyword,
    competitionCount: null,
    competitionScore: 50,
    trendsScore: null,
    demandScore: 40,
    opportunityScore: 45,
    error: true,
  };
}

/** Run tasks with a max concurrency limit */
async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    return NextResponse.json(
      { error: 'DATAFORSEO_NOT_CONFIGURED', message: 'Ajoute DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD dans les variables Netlify.' },
      { status: 503 }
    );
  }

  let body: { keywords?: unknown } | null = null;
  try { body = await request.json(); } catch { body = null; }

  const keywords = (Array.isArray(body?.keywords) ? body.keywords : [])
    .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    .slice(0, 8)
    .map(k => k.trim().toLowerCase());

  if (!keywords.length) return NextResponse.json({ error: 'No keywords' }, { status: 400 });

  // Max 3 concurrent (DataForSEO rate limiting)
  const tasks = keywords.map(kw => () => analyzeNiche(kw));
  const data = await runWithConcurrency(tasks, 3);

  return NextResponse.json({ success: true, data });
}
