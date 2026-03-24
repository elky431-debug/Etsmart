import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  runApifyActorByTarget,
  mapApifyItemToListing,
  getApifyConfigState,
  type ScrapeTarget,
} from '@/lib/apify-scraper';

export const maxDuration = 60;

function normalizedUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return '';
  return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
}

function buildActorInput(url: string, target: ScrapeTarget, actorId: string): Record<string, unknown> {
  const lowerActor = actorId.toLowerCase();
  const isEtsyActor = lowerActor.includes('etsy');
  const isEtsyUrl = url.toLowerCase().includes('etsy.com');

  // Input par défaut compatible large.
  const genericInput: Record<string, unknown> = {
    url,
    urls: [url],
    startUrls: [url],
    maxItems: 5,
  };

  // Cet actor Etsy demande explicitement `proxy`.
  if (target === 'listing' && (isEtsyActor || isEtsyUrl)) {
    return {
      maxItems: 10,
      includeDescription: false,
      includeUsedVariationPrices: false,
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
      startUrls: [url],
    };
  }

  return genericInput;
}

function isApifyTimeoutLikeError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('timed-out') || m.includes('run-failed') || m.includes('timeout');
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Session invalide ou expirée' }, { status: 401 });
    }

    const body = (await request.json()) as {
      url?: string;
      target?: ScrapeTarget;
      maxItems?: number;
      timeoutSecs?: number;
      actorId?: string;
    };

    const url = normalizedUrl(body?.url || '');
    const target: ScrapeTarget = body?.target === 'shop' ? 'shop' : 'listing';

    if (!url) {
      return NextResponse.json({ error: 'URL manquante' }, { status: 400 });
    }

    const config = getApifyConfigState(target, typeof body?.actorId === 'string' ? body.actorId : undefined);
    console.log('[api/apify/scrape] config', {
      target,
      hasToken: config.hasToken,
      hasActorInEnv: config.hasActorInEnv,
      hasActorOverride: config.hasActorOverride,
      resolvedActorId: config.resolvedActorId,
    });
    if (!config.hasToken || !config.resolvedActorId) {
      return NextResponse.json(
        {
          error:
            'Configuration Apify incomplete: ajoute APIFY_API_TOKEN + APIFY_ACTOR_LISTING_ID (ou actorId dans le formulaire), puis redemarre npm run dev.',
          debug: config,
        },
        { status: 400 }
      );
    }

    const actorInput = buildActorInput(url, target, config.resolvedActorId);
    if (typeof body?.maxItems === 'number' && Number.isFinite(body.maxItems)) {
      actorInput.maxItems = body.maxItems;
    }

    let items: unknown[] = [];
    try {
      items = await runApifyActorByTarget(target, actorInput, {
        maxItems: typeof body?.maxItems === 'number' ? body.maxItems : 5,
        timeoutSecs: typeof body?.timeoutSecs === 'number' ? body.timeoutSecs : undefined,
        actorIdOverride: typeof body?.actorId === 'string' ? body.actorId : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Retry "anti-timeout" pour les listings Etsy qui peuvent échouer aléatoirement.
      if (target === 'listing' && isApifyTimeoutLikeError(message)) {
        const retryInput: Record<string, unknown> = {
          startUrls: [url],
          maxItems: 1,
          proxy: { useApifyProxy: true },
        };
        items = await runApifyActorByTarget(target, retryInput, {
          maxItems: 1,
          timeoutSecs: Math.max(70, typeof body?.timeoutSecs === 'number' ? body.timeoutSecs : 70),
          actorIdOverride: typeof body?.actorId === 'string' ? body.actorId : undefined,
        });
      } else {
        throw err;
      }
    }

    if (!items.length) {
      return NextResponse.json(
        { error: 'Aucune donnée retournée par le scraper Apify.' },
        { status: 422 }
      );
    }

    const mapped = target === 'listing' ? mapApifyItemToListing(items[0]) : null;

    return NextResponse.json({
      success: true,
      target,
      count: items.length,
      firstItem: items[0],
      mapped,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[api/apify/scrape]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
