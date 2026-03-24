import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { fetchAliExpressProductQuick } from '@/lib/aliexpress-product-quick';

export const maxDuration = 15;

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

    const body = await request.json();
    const url = typeof body.url === 'string' ? body.url.trim() : '';

    if (!url) {
      return NextResponse.json({ error: 'URL manquante' }, { status: 400 });
    }

    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const lower = normalizedUrl.toLowerCase();
    if (!lower.includes('aliexpress')) {
      return NextResponse.json(
        {
          error:
            'Récupération rapide réservée à AliExpress. Utilise la récupération complète pour Alibaba / autres.',
        },
        { status: 400 }
      );
    }

    const product = await fetchAliExpressProductQuick(normalizedUrl);

    if (!product) {
      return NextResponse.json(
        {
          error:
            'Impossible de récupérer ce produit rapidement. Vérifie le lien ou utilise la récupération complète.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (e) {
    console.error('[parse-product-quick]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
