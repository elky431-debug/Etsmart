import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { tryUpdateOrderFromAliExpress } from '@/lib/orders-tracking-sync';

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')?.trim();
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Token invalide ou expiré.' },
        { status: 401 }
      );
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('aliexpress_access_token')
      .eq('id', user.id)
      .maybeSingle();

    const accessToken = userRow?.aliexpress_access_token || undefined;

    const { data: pending, error: fetchError } = await supabase
      .from('orders')
      .select('id, aliexpress_order_id')
      .eq('user_id', user.id)
      .eq('status', 'pending_tracking')
      .order('created_at', { ascending: true })
      .limit(30);

    if (fetchError) {
      return NextResponse.json(
        { error: 'FETCH_FAILED', message: fetchError.message },
        { status: 500 }
      );
    }

    const list = pending || [];
    let updated = 0;
    const errors: string[] = [];

    for (const order of list) {
      const result = await tryUpdateOrderFromAliExpress(supabase, order, accessToken);
      if (result.updated) updated += 1;
      if (result.error) errors.push(result.error);
      await new Promise((r) => setTimeout(r, 250));
    }

    return NextResponse.json({
      success: true,
      checked: list.length,
      updated,
      errors: errors.slice(0, 8),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: 'SERVER_ERROR', message }, { status: 500 });
  }
}
