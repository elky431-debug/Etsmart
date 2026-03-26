import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

/**
 * Polling du job async (Netlify Background Function).
 * GET ?jobId=uuid — Authorization: Bearer (même utilisateur que le job).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

    const jobId = request.nextUrl.searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'jobId requis' }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentification invalide' }, { status: 401 });

    const { data: job, error } = await supabase
      .from('image_gen_jobs' as any)
      .select('id, status, result_json, http_status, error_message, updated_at')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !job) {
      return NextResponse.json({ error: 'Job introuvable' }, { status: 404 });
    }

    const row = job as {
      status: string;
      result_json: Record<string, unknown> | null;
      http_status: number | null;
      error_message: string | null;
    };

    if (row.status === 'done' && row.result_json) {
      return NextResponse.json({
        status: 'done',
        httpStatus: row.http_status ?? 200,
        result: row.result_json,
      });
    }

    if (row.status === 'error') {
      return NextResponse.json({
        status: 'error',
        message: row.error_message || 'Erreur génération image',
      });
    }

    return NextResponse.json({
      status: row.status,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
