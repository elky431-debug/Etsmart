import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { pingEtsyOpenApi } from '@/lib/etsy-keyword-analytics';
import { resolveEtsyKeywordOpenApiKey } from '@/lib/keywords-env';

export const runtime = 'nodejs';

function bearer(request: NextRequest): string | null {
  const h = request.headers.get('authorization')?.trim();
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

/**
 * GET — vérifie keystring:secret via l’endpoint officiel openapi-ping (sans OAuth, sans crédit).
 */
export async function GET(request: NextRequest) {
  try {
    const token = bearer(request);
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const key = resolveEtsyKeywordOpenApiKey();
    if (!key || !key.includes(':')) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'Configuration incomplète : il faut keystring + Shared secret (ex. ETSY_KEYWORD_API_KEY + ETSY_KEYWORD_API_SECRET).',
        },
        { status: 503 }
      );
    }

    const result = await pingEtsyOpenApi(key);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          message: result.errorMessage,
          hint:
            result.status === 403
              ? 'Souvent : clé en attente d’approbation Etsy (developers → Manage your apps), ou secret / keystring incorrects.'
              : undefined,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      application_id: result.application_id,
      message: 'Ta clé Etsy est reconnue par l’Open API (ping OK).',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
