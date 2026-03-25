import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import { executeKeywordAnalysisJob } from '@/lib/keywords-analysis-job';
import { shouldRunKeywordJobInProcess } from '@/lib/keywords-env';
import { isApifyConfigured } from '@/lib/apify-scraper';

export const runtime = 'nodejs';

function bearer(request: NextRequest): string | null {
  const h = request.headers.get('authorization')?.trim();
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

function triggerBackgroundJob(origin: string, jobId: string, userId: string) {
  if (shouldRunKeywordJobInProcess()) {
    /**
     * En `next dev`, `after()` peut ne pas exécuter le job de façon fiable (réponse déjà envoyée,
     * réordonnancements), d’où un statut `pending` infini côté UI alors que l’historique ne bouge pas.
     * En local, une promesse détachée sur le process Node en cours suffit.
     * En preview/prod avec ce mode, on garde `after()` pour rester compatible avec le cycle serverless.
     */
    if (process.env.NODE_ENV === 'development') {
      void executeKeywordAnalysisJob(jobId, userId).catch((err) => {
        console.error('[keywords/analyze] in-process job failed', err);
      });
      return;
    }
    after(async () => {
      await executeKeywordAnalysisJob(jobId, userId);
    });
    return;
  }

  const secret =
    process.env.KEYWORDS_INTERNAL_SECRET?.trim() || process.env.CRON_SECRET?.trim() || '';
  const url = `${origin.replace(/\/$/, '')}/api/keywords/process`;
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-keywords-secret': secret,
    },
    body: JSON.stringify({ jobId, userId }),
  }).catch((err) => console.error('[keywords/analyze] process fetch failed', err));
}

export async function POST(request: NextRequest) {
  try {
    const token = bearer(request);
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Session invalide.' }, { status: 401 });
    }

    let body: { keyword?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }

    const raw = String(body?.keyword || '').trim();
    if (raw.length < 2 || raw.length > 120) {
      return NextResponse.json(
        { error: 'KEYWORD_INVALID', message: 'Mot-clé entre 2 et 120 caractères.' },
        { status: 400 }
      );
    }

    const keywordNormalized = raw.toLowerCase().replace(/\s+/g, ' ');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from('keyword_analyses')
      .select('id, status, result')
      .eq('keyword', keywordNormalized)
      .eq('status', 'done')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.result && typeof cached.result === 'object' && cached.result !== null) {
      const p = cached.result as Record<string, unknown>;

      const metricsObj = p.metrics as Record<string, unknown> | null;
      const similarArr = Array.isArray(p.similarKeywords) ? (p.similarKeywords as unknown[]) : [];
      const metricsOk =
        !!metricsObj &&
        typeof metricsObj.globalScore === 'number' &&
        typeof metricsObj.totalListings === 'number';
      const similarOk = similarArr.some(
        (x) => x && typeof x === 'object' && typeof (x as Record<string, unknown>).globalScore === 'number'
      );

      // Evite le “stale cache” après des changements de logique (ex: similarKeywords/metrics).
      if (!metricsOk || !similarOk) {
        // Continue : on relance un job frais plutôt que de renvoyer un résultat partiellement cassé.
      } else {
      return NextResponse.json({
        jobId: cached.id,
        status: 'done',
        cached: true,
        keyword: p.keyword,
        metrics: p.metrics,
        suggestions: Array.isArray(p.suggestions) ? p.suggestions : [],
        relatedTags: p.relatedTags,
        analysis: p.analysis,
        sampleTitles: p.sampleTitles,
        similarKeywords: p.similarKeywords,
        topListings: p.topListings,
        conversionRate: p.conversionRate,
        trendDirection: p.trendDirection,
      });
      }
    }

    const quota = await getUserQuotaInfo(user.id);
    if (quota.status !== 'active') {
      return NextResponse.json(
        { error: 'SUBSCRIPTION_REQUIRED', message: 'Un abonnement actif est requis.' },
        { status: 403 }
      );
    }
    if (quota.remaining < 1) {
      return NextResponse.json(
        { error: 'QUOTA_EXCEEDED', message: 'Crédits insuffisants pour lancer une analyse.' },
        { status: 403 }
      );
    }

    const apifyReady = isApifyConfigured('listing');
    if (!apifyReady) {
      const msg = [
        !apifyReady
          ? 'Apify requis pour les listings : APIFY_API_TOKEN + acteur epctex~etsy-scraper (scraping, pas d’Open API Etsy dans cette route).'
          : null,
      ]
        .filter(Boolean)
        .join(' ');
      return NextResponse.json({ error: 'CONFIG', message: msg }, { status: 503 });
    }

    const deduct = await incrementAnalysisCount(user.id, 1.0);
    if (!deduct.success) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: deduct.error || 'Crédits insuffisants pour lancer une analyse.',
        },
        { status: 403 }
      );
    }

    const { data: inserted, error: insErr } = await supabase
      .from('keyword_analyses')
      .insert({
        user_id: user.id,
        keyword: keywordNormalized,
        status: 'pending',
        result: null,
      })
      .select('id')
      .single();

    if (insErr || !inserted?.id) {
      return NextResponse.json(
        { error: 'INSERT_FAILED', message: insErr?.message || 'Impossible de créer le job.' },
        { status: 500 }
      );
    }

    const jobId = inserted.id as string;
    const origin = new URL(request.url).origin;
    triggerBackgroundJob(origin, jobId, user.id);

    return NextResponse.json({ jobId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: 'SERVER_ERROR', message }, { status: 500 });
  }
}
