import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ShopPayload } from '@/lib/etsy/shop-scrape-service';
import { synthesizeCompetitorShopWithGpt } from '@/lib/etsy/competitor-shop-analysis-lib';
import type { CompetitorShopAnalysis } from '@/types/competitor-shop-analysis';

/** Synthèse GPT uniquement (appelée après /competitor-shop-scrape pour éviter le timeout Netlify). */
export const maxDuration = 60;
export const runtime = 'nodejs';

function isShopPayload(x: unknown): x is ShopPayload {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.shopName === 'string' &&
    typeof o.shopUrl === 'string' &&
    Array.isArray(o.listings) &&
    o.listings.length > 0
  );
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')?.trim();
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? '';
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentification requise' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Session invalide' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const shop = body?.shop;
    if (!isShopPayload(shop)) {
      return NextResponse.json(
        { error: 'INVALID_SHOP', message: 'Payload « shop » manquant ou invalide.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'CONFIG', message: 'OPENAI_API_KEY manquant' }, { status: 500 });
    }

    let analysis: CompetitorShopAnalysis;
    try {
      analysis = await synthesizeCompetitorShopWithGpt(shop, apiKey, 55_000);
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : String(e);
      if (code === 'OPENAI_ERROR') {
        return NextResponse.json(
          { error: 'OPENAI_ERROR', message: 'Analyse IA indisponible. Réessaie.' },
          { status: 502 }
        );
      }
      if (code === 'PARSE_ERROR') {
        return NextResponse.json(
          { error: 'PARSE_ERROR', message: 'Réponse IA invalide', shop },
          { status: 502 }
        );
      }
      throw e;
    }

    return NextResponse.json({
      success: true,
      shop,
      analysis,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[competitor-shop-synthesize]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
