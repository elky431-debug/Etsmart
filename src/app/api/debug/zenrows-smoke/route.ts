import { NextRequest, NextResponse } from 'next/server';
import { scrapeEtsyWithZenRowsBrowser } from '@/services/scraping/zenrowsBrowser';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get('keyword')?.trim() || 'witch sticker';

  try {
    const startedAt = Date.now();
    const result = await scrapeEtsyWithZenRowsBrowser(keyword, 10);
    const elapsedMs = Date.now() - startedAt;

    return NextResponse.json({
      success: true,
      keyword,
      sourceUrl: result.sourceUrl,
      listingsCount: result.listings.length,
      firstListingTitle: result.listings[0]?.title || null,
      marketSizeEstimate: result.marketSizeEstimate,
      elapsedMs,
    });
  } catch (error: any) {
    console.error('[ZENROWS_SMOKE] failed', error);
    return NextResponse.json(
      {
        success: false,
        message: 'ZenRows smoke test failed.',
      },
      { status: 503 }
    );
  }
}
