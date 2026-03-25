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

    const jobId = request.nextUrl.searchParams.get('jobId')?.trim();
    if (!jobId) {
      return NextResponse.json({ error: 'JOB_ID_REQUIRED' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: row, error } = await supabase
      .from('keyword_analyses')
      .select('id, user_id, keyword, status, result, created_at')
      .eq('id', jobId)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    if (row.user_id !== user.id) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const rowStatus = String(row.status || '').trim().toLowerCase();

    let parsedResult: Record<string, unknown> | null = null;
    const raw = row.result as unknown;
    if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
      parsedResult = raw as Record<string, unknown>;
    } else if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsedResult = parsed as Record<string, unknown>;
        }
      } catch {
        parsedResult = null;
      }
    }

    if (rowStatus === 'done' && parsedResult) {
      const p = parsedResult;
      return NextResponse.json({
        jobId: row.id,
        status: 'done',
        keyword: p.keyword ?? row.keyword,
        metrics: p.metrics,
        suggestions: Array.isArray(p.suggestions) ? p.suggestions : [],
        relatedTags: p.relatedTags,
        analysis: p.analysis,
        sampleTitles: p.sampleTitles,
        similarKeywords: p.similarKeywords,
        topListings: p.topListings,
        conversionRate: p.conversionRate,
        trendDirection: p.trendDirection,
        created_at: row.created_at,
      });
    }

    if (rowStatus === 'done' && !parsedResult) {
      return NextResponse.json({
        jobId: row.id,
        status: 'error',
        message: 'Analyse marquée terminée mais résultat manquant — relance une analyse.',
        created_at: row.created_at,
      });
    }

    if (rowStatus === 'error' && parsedResult) {
      const p = parsedResult as { message?: string };
      return NextResponse.json({
        jobId: row.id,
        status: 'error',
        message: p.message || 'Analyse échouée.',
        created_at: row.created_at,
      });
    }

    if (rowStatus === 'error' && !parsedResult) {
      return NextResponse.json({
        jobId: row.id,
        status: 'error',
        message: 'Analyse échouée.',
        created_at: row.created_at,
      });
    }

    // Cas “job jamais démarré / after() gelé / run perdu” :
    // on évite un spinner infini en basculant en erreur après un certain délai.
    if (rowStatus === 'pending') {
      const createdAtMs = (() => {
        const v = row.created_at as unknown;
        if (v instanceof Date) return v.getTime();
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
          const t = new Date(v).getTime();
          return Number.isFinite(t) ? t : NaN;
        }
        return NaN;
      })();

      const pendingAgeMs = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : null;
      const pendingAgeMin =
        pendingAgeMs != null && pendingAgeMs >= 0 ? Math.round(pendingAgeMs / 60_000) : null;

      // Remarque : côté serveur on applique aussi un timeout hard (~8 min).
      if (pendingAgeMin != null && pendingAgeMin >= 9) {
        return NextResponse.json({
          jobId: row.id,
          status: 'error',
          code: 'JOB_STUCK_PENDING',
          message:
            `JOB_STUCK_PENDING: le job est resté en pending pendant ~${pendingAgeMin} min. ` +
            `Relance l’analyse (ou vérifie les logs serveur).`,
          created_at: row.created_at,
        });
      }

      if (parsedResult && typeof parsedResult === 'object' && !Array.isArray(parsedResult)) {
        const maybeMsg = typeof (parsedResult as { message?: unknown }).message === 'string'
          ? (parsedResult as { message?: string }).message
          : null;
        if (maybeMsg) {
          return NextResponse.json({
            jobId: row.id,
            status: 'error',
            code: 'JOB_PENDING_WITH_RESULT_MESSAGE',
            message: maybeMsg,
            created_at: row.created_at,
          });
        }
      }
    }

    return NextResponse.json({
      jobId: row.id,
      status: 'pending',
      created_at: row.created_at,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: 'SERVER_ERROR', message }, { status: 500 });
  }
}
