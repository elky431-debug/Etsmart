import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getKeywordResearchById } from '@/lib/keyword-research/history';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = context.params;

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Token invalide ou expiré.' },
        { status: 401 }
      );
    }

    const item = await getKeywordResearchById(supabase, user.id, id);
    if (!item) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Recherche introuvable.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'DETAIL_FAILED', message: error?.message || 'Impossible de charger ce détail.' },
      { status: 500 }
    );
  }
}
