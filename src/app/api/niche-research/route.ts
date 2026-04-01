import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 26;
export const runtime = 'nodejs';

const DFS_BASE = 'https://api.dataforseo.com/v3';

export interface NicheResult {
  keyword: string;
  competitionCount: number | null;   // Etsy listing count (via Google site:)
  competitionScore: number;           // 0-100 (higher = more crowded)
  searchVolume: number | null;        // Monthly Google searches
  demandScore: number;                // 0-100 (higher = more demand)
  opportunityScore: number;           // 0-100 (higher = better opportunity)
  error?: boolean;
}

function getDFSAuth(): string | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const pass = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !pass) return null;
  return Buffer.from(`${login}:${pass}`).toString('base64');
}

/** DataForSEO Keywords Data API — returns monthly search volume for each keyword (bulk call) */
async function fetchSearchVolumes(keywords: string[], auth: string): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${DFS_BASE}/keywords_data/google_ads/search_volume/live`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keywords, location_code: 2840, language_code: 'en' }]),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const out: Record<string, number> = {};
    for (const item of (data?.tasks?.[0]?.result ?? [])) {
      if (item?.keyword && typeof item?.search_volume === 'number') {
        out[item.keyword.toLowerCase()] = item.search_volume;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** DataForSEO SERP API — site:etsy.com search → total_count = Etsy listing count indexed by Google */
async function fetchEtsyCompetitionCounts(keywords: string[], auth: string): Promise<Record<string, number | null>> {
  try {
    const tasks = keywords.map(kw => ({
      keyword: `site:etsy.com ${kw}`,
      location_code: 2840,
      language_code: 'en',
      depth: 10, // minimum depth to save credits
    }));
    const res = await fetch(`${DFS_BASE}/serp/google/organic/live/regular`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
      signal: AbortSignal.timeout(22_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const out: Record<string, number | null> = {};
    for (let i = 0; i < (data?.tasks ?? []).length; i++) {
      const kw = keywords[i]?.toLowerCase();
      if (!kw) continue;
      const result = data.tasks[i]?.result?.[0];
      out[kw] = result?.total_count ?? null;
    }
    return out;
  } catch {
    return {};
  }
}

function toCompetitionScore(count: number | null): number {
  if (count === null) return 50;
  if (count < 5_000)          return 10;
  if (count < 20_000)         return 22;
  if (count < 60_000)         return 35;
  if (count < 200_000)        return 48;
  if (count < 600_000)        return 60;
  if (count < 1_500_000)      return 72;
  if (count < 4_000_000)      return 83;
  return 93;
}

function toDemandScore(volume: number | null): number {
  if (volume === null) return 20;
  if (volume >= 500_000)      return 96;
  if (volume >= 150_000)      return 86;
  if (volume >= 50_000)       return 74;
  if (volume >= 15_000)       return 63;
  if (volume >= 5_000)        return 50;
  if (volume >= 1_000)        return 38;
  if (volume >= 300)          return 25;
  return 12;
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const auth = getDFSAuth();
  if (!auth) {
    return NextResponse.json(
      { error: 'DATAFORSEO_NOT_CONFIGURED', message: 'Ajoute DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD dans les variables d\'environnement Netlify.' },
      { status: 503 }
    );
  }

  let body: { keywords?: unknown } | null = null;
  try { body = await request.json(); } catch { body = null; }

  const keywords = (Array.isArray(body?.keywords) ? body.keywords : [])
    .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    .slice(0, 10)
    .map(k => k.trim().toLowerCase());

  if (!keywords.length) return NextResponse.json({ error: 'No keywords' }, { status: 400 });

  // Both API calls in parallel — Keywords Data (demand) + SERP site:etsy.com (competition)
  const [volumes, counts] = await Promise.all([
    fetchSearchVolumes(keywords, auth),
    fetchEtsyCompetitionCounts(keywords, auth),
  ]);

  const data: NicheResult[] = keywords.map(kw => {
    const searchVolume = volumes[kw] ?? null;
    const competitionCount = counts[kw] ?? null;
    const demandScore = toDemandScore(searchVolume);
    const competitionScore = toCompetitionScore(competitionCount);
    const opportunityScore = Math.round(demandScore * 0.55 + (100 - competitionScore) * 0.45);

    return {
      keyword: kw,
      competitionCount,
      competitionScore,
      searchVolume,
      demandScore,
      opportunityScore,
      error: searchVolume === null && competitionCount === null,
    };
  });

  return NextResponse.json({ success: true, data });
}
