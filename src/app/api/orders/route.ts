import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')?.trim();
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function GET(request: NextRequest) {
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

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'ORDERS_FETCH_FAILED', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, orders: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { error: 'SERVER_ERROR', message },
      { status: 500 }
    );
  }
}
