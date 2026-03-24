import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')?.trim();
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
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

    const params = await Promise.resolve(context.params);
    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { error: 'INVALID_ID', message: 'ID commande manquant.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'ORDER_DELETE_FAILED', message: error.message },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Commande introuvable.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { error: 'SERVER_ERROR', message },
      { status: 500 }
    );
  }
}
