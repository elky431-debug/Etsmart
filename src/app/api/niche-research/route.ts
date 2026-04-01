import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 26;
export const runtime = 'nodejs';

const ETSY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

export interface NicheResult {
  keyword: string;
  competitionCount: number | null;
  competitionScore: number;  // 0-100 (higher = more competition)
  demandScore: number;        // 0-100 (higher = more demand)
  opportunityScore: number;  // 0-100 (higher = better opportunity)
  bestsellerCount: number;
  error?: boolean;
}

async function analyzeNiche(keyword: string): Promise<NicheResult> {
  const base: NicheResult = {
    keyword,
    competitionCount: null,
    competitionScore: 50,
    demandScore: 50,
    opportunityScore: 50,
    bestsellerCount: 0,
    error: true,
  };

  try {
    const url = `https://www.etsy.com/search?q=${encodeURIComponent(keyword)}&ref=search_bar`;
    const res = await fetch(url, {
      headers: ETSY_HEADERS,
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return base;

    const html = await res.text();

    // Parse total result count
    const countPatterns = [
      /([\d,]+)\s+results?/i,
      /"total_results":\s*(\d+)/i,
      /results_count["']?\s*[:=]\s*(\d+)/i,
      /([\d,]+)\s+resultats?/i,
    ];
    let competitionCount: number | null = null;
    for (const pattern of countPatterns) {
      const m = html.match(pattern);
      if (m) {
        const n = parseInt(m[1].replace(/,/g, ''), 10);
        if (n > 0 && n < 50_000_000) { competitionCount = n; break; }
      }
    }

    // Count bestseller badges (proxy for demand — Etsy assigns based on real sales)
    const bestsellerCount = Math.min((html.match(/bestseller/gi) || []).length, 30);

    // Competition score: stepped scale calibrated on Etsy reality
    let competitionScore = 50;
    if (competitionCount !== null) {
      if (competitionCount < 3_000)       competitionScore = 10;
      else if (competitionCount < 10_000) competitionScore = 22;
      else if (competitionCount < 30_000) competitionScore = 35;
      else if (competitionCount < 80_000) competitionScore = 48;
      else if (competitionCount < 200_000) competitionScore = 60;
      else if (competitionCount < 500_000) competitionScore = 72;
      else if (competitionCount < 1_000_000) competitionScore = 83;
      else if (competitionCount < 2_000_000) competitionScore = 91;
      else competitionScore = 97;
    }

    // Demand score: based on bestseller density
    // Etsy shows ~48 results/page; more bestsellers = stronger real-sales demand
    let demandScore: number;
    if (bestsellerCount >= 22)      demandScore = 95;
    else if (bestsellerCount >= 17) demandScore = 85;
    else if (bestsellerCount >= 12) demandScore = 74;
    else if (bestsellerCount >= 8)  demandScore = 63;
    else if (bestsellerCount >= 5)  demandScore = 50;
    else if (bestsellerCount >= 3)  demandScore = 38;
    else if (bestsellerCount >= 1)  demandScore = 25;
    else                             demandScore = 12;

    // Opportunity: weighted combo — demand matters more than low competition
    const opportunityScore = Math.round(demandScore * 0.55 + (100 - competitionScore) * 0.45);

    return {
      keyword,
      competitionCount,
      competitionScore,
      demandScore,
      opportunityScore,
      bestsellerCount,
      error: false,
    };
  } catch {
    return base;
  }
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  let body: { keywords?: unknown } | null = null;
  try { body = await request.json(); } catch { body = null; }

  const keywords = (Array.isArray(body?.keywords) ? body.keywords : [])
    .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    .slice(0, 8)
    .map(k => k.trim());

  if (!keywords.length) return NextResponse.json({ error: 'No keywords' }, { status: 400 });

  const settled = await Promise.allSettled(keywords.map(analyzeNiche));
  const data: NicheResult[] = settled.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { ...{ keyword: keywords[i], competitionCount: null, competitionScore: 50, demandScore: 50, opportunityScore: 50, bestsellerCount: 0, error: true } }
  );

  return NextResponse.json({ success: true, data });
}
