import { NextRequest, NextResponse } from 'next/server';
import { detectBlockedPage } from '@/services/scraping/blockDetection';

export const maxDuration = 120;

function getZenRowsApiKey(): string | null {
  if (process.env.ZENROWS_API_KEY) return process.env.ZENROWS_API_KEY;
  const ws = process.env.ZENROWS_BROWSER_WS_URL;
  if (!ws) return null;
  try {
    const parsed = new URL(ws);
    return parsed.searchParams.get('apikey');
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get('keyword')?.trim() || 'booknook';
  const apiKey = getZenRowsApiKey();
  if (!apiKey) {
    return NextResponse.json({ success: false, message: 'Missing ZenRows API key.' }, { status: 500 });
  }

  const sourceUrl = `https://www.etsy.com/search?q=${encodeURIComponent(keyword)}`;
  const candidates = [
    `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodeURIComponent(sourceUrl)}&js_render=true&premium_proxy=true&antibot=true`,
    `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodeURIComponent(sourceUrl)}&js_render=true&premium_proxy=true`,
    `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodeURIComponent(sourceUrl)}&js_render=true`,
  ];

  const results: Array<Record<string, unknown>> = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const startedAt = Date.now();
    try {
      const response = await fetch(candidates[i], { signal: AbortSignal.timeout(90000) });
      const html = await response.text().catch(() => '');
      const blocked = detectBlockedPage({ html, listingsCount: 0 });
      const listingSignals =
        (html.match(/\/listing\//g)?.length || 0) +
        (html.match(/data-listing-id/gi)?.length || 0);
      results.push({
        candidate: i + 1,
        status: response.status,
        ok: response.ok,
        blocked,
        htmlLength: html.length,
        listingSignals,
        elapsedMs: Date.now() - startedAt,
      });
      if (response.ok && !blocked && listingSignals > 0) {
        return NextResponse.json({
          success: true,
          keyword,
          sourceUrl,
          provider: 'zenrows-api',
          results,
        });
      }
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0f151a95-065e-4dcd-b345-8bd842db5239',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'139b8b'},body:JSON.stringify({sessionId:'139b8b',runId:`zenrows-api-smoke-${Date.now()}`,hypothesisId:'H8_API_CONNECTIVITY',location:'zenrows-api-smoke/route.ts:catch',message:'ZenRows API candidate request failed',data:{candidate:i+1,errorName:error?.name||null,errorMessage:error?.message||String(error),causeCode:error?.cause?.code||null,causeMessage:error?.cause?.message||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      results.push({
        candidate: i + 1,
        ok: false,
        error: error?.message || String(error),
        errorName: error?.name || null,
        causeCode: error?.cause?.code || null,
        elapsedMs: Date.now() - startedAt,
      });
    }
  }

  return NextResponse.json(
    {
      success: false,
      keyword,
      sourceUrl,
      provider: 'zenrows-api',
      results,
    },
    { status: 503 }
  );
}
