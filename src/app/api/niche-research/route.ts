import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 26;
export const runtime = 'nodejs';

export interface NicheResult {
  keyword: string;
  competitionCount: number | null;   // Etsy listing count via Google site:etsy.com
  competitionScore: number;           // 0-100 (higher = more crowded)
  trendsScore: number | null;         // Google Trends interest 0-100
  demandScore: number;                // 0-100 (higher = more demand)
  opportunityScore: number;           // 0-100
  error?: boolean;
}

// ─── Google Custom Search — competition (site:etsy.com keyword → listing count) ──
async function getCompetitionCount(keyword: string): Promise<number | null> {
  const key = process.env.GOOGLE_CSE_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_ID?.trim();
  if (!key || !cx) return null;

  try {
    const q = encodeURIComponent(`site:etsy.com ${keyword}`);
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${q}&num=1`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const total = data?.queries?.request?.[0]?.totalResults;
    const n = parseInt(String(total ?? '0'), 10);
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

// ─── Google Trends (unofficial, free) — demand: interest 0-100 over last 12 months ──
async function getTrendsScore(keyword: string): Promise<number | null> {
  const TRENDS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://trends.google.com/trends/explore',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    // Step 1: get explore widget token
    const req1 = encodeURIComponent(JSON.stringify({
      comparisonItem: [{ keyword, geo: 'US', time: 'today 12-m' }],
      category: 0,
      property: '',
    }));
    const exploreRes = await fetch(
      `https://trends.google.com/trends/api/explore?hl=en-US&tz=360&req=${req1}`,
      { headers: TRENDS_HEADERS, signal: AbortSignal.timeout(8_000) }
    );
    if (!exploreRes.ok) return null;

    const exploreText = await exploreRes.text();
    const exploreJson = JSON.parse(exploreText.replace(/^\)\]\}'/, '').trim());
    const widgets: Record<string, unknown>[] = exploreJson?.widgets ?? [];
    const timeWidget = widgets.find((w) => w.id === 'TIMESERIES');
    if (!timeWidget) return null;

    // Step 2: fetch timeseries data
    const dataReq = encodeURIComponent(JSON.stringify(timeWidget.request));
    const token = encodeURIComponent(timeWidget.token as string);
    const dataRes = await fetch(
      `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=360&req=${dataReq}&token=${token}`,
      { headers: TRENDS_HEADERS, signal: AbortSignal.timeout(8_000) }
    );
    if (!dataRes.ok) return null;

    const dataText = await dataRes.text();
    const dataJson = JSON.parse(dataText.replace(/^\)\]\}'/, '').trim());
    const timeline: Record<string, unknown>[] = dataJson?.default?.timelineData ?? [];
    if (!timeline.length) return null;

    const values = timeline
      .map((d) => (Array.isArray(d.value) ? (d.value[0] as number) : 0))
      .filter((v) => typeof v === 'number' && v > 0);
    if (!values.length) return null;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(avg); // 0-100
  } catch {
    return null;
  }
}

// ─── Scoring functions ────────────────────────────────────────────────────────

function toCompetitionScore(count: number | null): number {
  if (count === null) return 50;
  if (count < 5_000)        return 10;
  if (count < 20_000)       return 22;
  if (count < 60_000)       return 35;
  if (count < 200_000)      return 48;
  if (count < 600_000)      return 60;
  if (count < 1_500_000)    return 72;
  if (count < 4_000_000)    return 83;
  return 93;
}

function toDemandScore(trends: number | null): number {
  // Google Trends 0-100 → demand score
  if (trends === null) return 40; // neutral when unavailable
  if (trends >= 75) return 92;
  if (trends >= 55) return 78;
  if (trends >= 35) return 63;
  if (trends >= 20) return 48;
  if (trends >= 10) return 33;
  return 18;
}

// ─── Main analysis ────────────────────────────────────────────────────────────

async function analyzeNiche(keyword: string): Promise<NicheResult> {
  const [competitionCount, trendsScore] = await Promise.all([
    getCompetitionCount(keyword),
    getTrendsScore(keyword),
  ]);

  const competitionScore = toCompetitionScore(competitionCount);
  const demandScore = toDemandScore(trendsScore);
  const opportunityScore = Math.round(demandScore * 0.55 + (100 - competitionScore) * 0.45);

  return {
    keyword,
    competitionCount,
    competitionScore,
    trendsScore,
    demandScore,
    opportunityScore,
    error: competitionCount === null && trendsScore === null,
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

  if (!process.env.GOOGLE_CSE_KEY || !process.env.GOOGLE_CSE_ID) {
    return NextResponse.json(
      { error: 'GOOGLE_CSE_NOT_CONFIGURED', message: 'Ajoute GOOGLE_CSE_KEY et GOOGLE_CSE_ID dans les variables Netlify.' },
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

  // Max 4 concurrent (Google CSE rate limiting)
  const tasks = keywords.map(kw => () => analyzeNiche(kw));
  const data = await runWithConcurrency(tasks, 4);

  return NextResponse.json({ success: true, data });
}
