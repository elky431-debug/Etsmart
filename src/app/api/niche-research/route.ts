import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 26;
export const runtime = 'nodejs';

const ETSY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
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

/** Extract ZenRows API key from env (either direct key or from WebSocket URL) */
function getZenRowsApiKey(): string | null {
  if (process.env.ZENROWS_API_KEY) return process.env.ZENROWS_API_KEY;
  const ws = process.env.ZENROWS_BROWSER_WS_URL;
  if (!ws) return null;
  try { return new URL(ws).searchParams.get('apikey'); } catch { return null; }
}

/** Detect if Etsy returned a CAPTCHA/block page instead of real results */
function isBlockedHtml(html: string): boolean {
  if (html.length < 8_000) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes('access denied') ||
    lower.includes('cf-error-type') ||
    lower.includes('recaptcha') ||
    lower.includes('are you a human') ||
    lower.includes('challenge-form') ||
    (!lower.includes('/listing/') && !lower.includes('data-listing'))
  );
}

/** Parse Etsy's server-side rendered HTML for result count + bestseller data */
function parseEtsySearchHtml(html: string): { competitionCount: number | null; bestsellerCount: number } {
  let competitionCount: number | null = null;
  let bestsellerCount = 0;

  // ── 1. __NEXT_DATA__ JSON (most reliable — SSR data embedded in page) ──────
  try {
    const ndMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (ndMatch) {
      const data = JSON.parse(ndMatch[1]);
      const pp = data?.props?.pageProps;

      // Try multiple paths Etsy uses across versions
      const countCandidates: unknown[] = [
        pp?.searchResultsPage?.metadata?.total_count,
        pp?.searchResults?.meta?.total,
        pp?.initialSearchResults?.metadata?.total_count,
        pp?.searchData?.listing_objects_count,
        pp?.listingSearchResults?.metadata?.total_count,
        data?.query?.count,
      ];
      for (const v of countCandidates) {
        if (typeof v === 'number' && v > 0) { competitionCount = v; break; }
      }

      // Count bestsellers from embedded listing data
      const listings: unknown[] =
        pp?.searchResultsPage?.results ||
        pp?.searchResults?.results ||
        pp?.initialSearchResults?.results || [];
      if (Array.isArray(listings)) {
        for (const item of listings) {
          if (
            (item as Record<string, unknown>)?.isBestSeller ||
            (item as Record<string, unknown>)?.is_best_seller ||
            JSON.stringify(item).toLowerCase().includes('"bestseller":true')
          ) {
            bestsellerCount++;
          }
        }
      }
    }
  } catch { /* fall through to regex */ }

  // ── 2. Regex fallback for result count ────────────────────────────────────
  if (competitionCount === null) {
    const patterns = [
      /([\d,]+)\s+results?/i,
      /"total_results":\s*(\d+)/,
      /"total_count":\s*(\d+)/,
      /results_count["']?\s*[:=]\s*(\d+)/,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m) {
        const n = parseInt(m[1].replace(/,/g, ''), 10);
        if (n > 0 && n < 50_000_000) { competitionCount = n; break; }
      }
    }
  }

  // ── 3. Bestseller density from raw HTML if JSON gave 0 ───────────────────
  if (bestsellerCount === 0) {
    bestsellerCount = Math.min((html.match(/bestseller/gi) || []).length, 30);
  }

  return { competitionCount, bestsellerCount };
}

/** Fetch Etsy search HTML: direct first (free), then ZenRows proxy fallback */
async function fetchEtsySearchHtml(keyword: string, zenrowsKey: string | null): Promise<string | null> {
  const searchUrl = `https://www.etsy.com/search?q=${encodeURIComponent(keyword)}&ref=search_bar`;

  // 1. Direct fetch (free — works ~30% of time from datacenter IPs)
  try {
    const res = await fetch(searchUrl, {
      headers: ETSY_HEADERS,
      signal: AbortSignal.timeout(6_000),
    });
    if (res.ok) {
      const html = await res.text();
      if (!isBlockedHtml(html)) return html;
    }
  } catch { /* blocked or timeout — fall through */ }

  // 2. ZenRows API proxy (reliable bypass, no JS rendering needed for SSR pages)
  if (!zenrowsKey) return null;

  const zenUrl = `https://api.zenrows.com/v1/?apikey=${zenrowsKey}&url=${encodeURIComponent(searchUrl)}&premium_proxy=true`;
  try {
    const res = await fetch(zenUrl, { signal: AbortSignal.timeout(18_000) });
    if (!res.ok) return null;
    const html = await res.text();
    return !isBlockedHtml(html) ? html : null;
  } catch {
    return null;
  }
}

async function analyzeNiche(keyword: string, zenrowsKey: string | null): Promise<NicheResult> {
  const base: NicheResult = {
    keyword, competitionCount: null, competitionScore: 50,
    demandScore: 50, opportunityScore: 50, bestsellerCount: 0, error: true,
  };

  try {
    const html = await fetchEtsySearchHtml(keyword, zenrowsKey);
    if (!html) return base;

    const { competitionCount, bestsellerCount } = parseEtsySearchHtml(html);

    // Competition score: stepped scale calibrated on real Etsy volumes
    let competitionScore = 50;
    if (competitionCount !== null) {
      if (competitionCount < 3_000)         competitionScore = 10;
      else if (competitionCount < 10_000)   competitionScore = 22;
      else if (competitionCount < 30_000)   competitionScore = 35;
      else if (competitionCount < 80_000)   competitionScore = 48;
      else if (competitionCount < 200_000)  competitionScore = 60;
      else if (competitionCount < 500_000)  competitionScore = 72;
      else if (competitionCount < 1_000_000) competitionScore = 83;
      else if (competitionCount < 2_000_000) competitionScore = 91;
      else                                   competitionScore = 97;
    }

    // Demand score: based on bestseller density (~48 results/page)
    let demandScore: number;
    if (bestsellerCount >= 22)      demandScore = 95;
    else if (bestsellerCount >= 17) demandScore = 85;
    else if (bestsellerCount >= 12) demandScore = 74;
    else if (bestsellerCount >= 8)  demandScore = 63;
    else if (bestsellerCount >= 5)  demandScore = 50;
    else if (bestsellerCount >= 3)  demandScore = 38;
    else if (bestsellerCount >= 1)  demandScore = 25;
    else                             demandScore = 12;

    const opportunityScore = Math.round(demandScore * 0.55 + (100 - competitionScore) * 0.45);

    return {
      keyword, competitionCount, competitionScore,
      demandScore, opportunityScore, bestsellerCount, error: false,
    };
  } catch {
    return base;
  }
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
    .slice(0, 6)
    .map(k => k.trim());

  if (!keywords.length) return NextResponse.json({ error: 'No keywords' }, { status: 400 });

  const zenrowsKey = getZenRowsApiKey();
  // Limit to 3 concurrent ZenRows calls to respect rate limits
  const tasks = keywords.map(kw => () => analyzeNiche(kw, zenrowsKey));
  const data = await runWithConcurrency(tasks, 3);

  return NextResponse.json({ success: true, data, hasZenRows: Boolean(zenrowsKey) });
}
