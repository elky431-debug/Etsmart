import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getKeywordResearchHistory } from '@/lib/keyword-research/history';

export async function GET(request: NextRequest) {
  try {
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

    const limit = Number.parseInt(request.nextUrl.searchParams.get('limit') || '30', 10);
    const history = await getKeywordResearchHistory(supabase, user.id, Number.isFinite(limit) ? limit : 30);
    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'HISTORY_FAILED', message: error?.message || "Impossible de charger l'historique." },
      { status: 500 }
    );
  }
}
