import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { runGenerateImagesPipeline } from '@/lib/server/generate-images-pipeline';

export const maxDuration = 120;
export const runtime = 'nodejs';

function isNetlifyRuntime(): boolean {
  return Boolean(process.env.SITE_ID && process.env.URL);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentification invalide' }, { status: 401 });

    console.log(`[IMAGE GEN] User ${user.id} - request received`);

    const { getUserQuotaInfo } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json(
        { error: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required.' },
        { status: 403 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Format de requête invalide' }, { status: 400 });
    }

    const sourceImage = body.sourceImage;
    const quantity = typeof body.quantity === 'number' ? body.quantity : 1;
    if (!sourceImage || (typeof sourceImage !== 'string' && typeof sourceImage !== 'object')) {
      return NextResponse.json({ error: 'Image source requise' }, { status: 400 });
    }
    if (quantity < 1 || quantity > 10) {
      return NextResponse.json({ error: 'Quantité entre 1 et 10' }, { status: 400 });
    }

    const skipCreditDeduction = body.skipCreditDeduction === true;
    if (!skipCreditDeduction && quotaInfo.remaining < 1) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: 'Crédits insuffisants. Il te faut au moins 1 crédit pour générer des images.',
        },
        { status: 403 }
      );
    }

    if (!process.env.GEMINI_API_KEY?.trim()) {
      console.error('[IMAGE GEN] GEMINI_API_KEY manquante');
      return NextResponse.json(
        {
          error: 'SERVER_CONFIG_ERROR',
          message:
            'GEMINI_API_KEY est requise pour la génération d\'images (API Google Gemini — Nano Banana / Nano Banana 2).',
        },
        { status: 500 }
      );
    }

    const useNetlifyBg =
      isNetlifyRuntime() &&
      process.env.NETLIFY_IMAGE_BG !== '0' &&
      Boolean(process.env.NETLIFY_IMAGE_BG_SECRET);

    if (useNetlifyBg) {
      const { data: row, error: insErr } = await supabase
        .from('image_gen_jobs' as any)
        .insert({
          user_id: user.id,
          status: 'pending',
          request_body: body,
        })
        .select('id')
        .single();

      if (insErr || !row?.id) {
        console.error('[IMAGE GEN] job insert', insErr);
        return NextResponse.json(
          {
            error: 'JOB_CREATE_FAILED',
            message: insErr?.message || 'Impossible de créer le job image (table image_gen_jobs manquante ?).',
          },
          { status: 500 }
        );
      }

      const jobId = String((row as { id: string }).id);
      const base = (process.env.URL || '').replace(/\/$/, '') || request.nextUrl.origin;

      const bgUrl = `${base}/.netlify/functions/generate-images-background`;
      fetch(bgUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-netlify-image-bg-secret': process.env.NETLIFY_IMAGE_BG_SECRET!,
        },
        body: JSON.stringify({ jobId }),
        signal: AbortSignal.timeout(10_000),
      }).catch((e) => console.error('[IMAGE GEN] background invoke failed', e));

      console.log(`[IMAGE GEN] queued job ${jobId} → background`);
      return NextResponse.json(
        {
          accepted: true,
          jobId,
          pollUrl: '/api/generate-images/status',
        },
        { status: 202 }
      );
    }

    const result = await runGenerateImagesPipeline({
      body,
      user,
      supabase,
      startTime,
      netlifyBackgroundWorker: false,
    });
    return NextResponse.json(result.json, { status: result.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[IMAGE GEN] Fatal error (${Date.now() - startTime}ms):`, message);
    return NextResponse.json(
      { error: message || 'Erreur lors de la génération des images' },
      { status: 500 }
    );
  }
}
