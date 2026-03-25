import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

function bearer(request: NextRequest): string | null {
  const h = request.headers.get('authorization')?.trim();
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const token = bearer(request);
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: rows, error } = await supabase
      .from('keyword_analyses')
      .select('id, keyword, status, result, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    const items = (rows || []).map((r) => {
      const res = r.result as Record<string, unknown> | null;
      const metrics = res?.metrics as Record<string, unknown> | undefined;
      const globalScore =
        typeof metrics?.globalScore === 'number' ? metrics.globalScore : null;
      return {
        id: r.id,
        keyword: r.keyword,
        status: r.status,
        created_at: r.created_at,
        globalScore,
        verdict: '',
      };
    });

    return NextResponse.json({ items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: 'SERVER_ERROR', message }, { status: 500 });
  }
}
