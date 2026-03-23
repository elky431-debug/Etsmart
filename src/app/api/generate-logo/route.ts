import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import OpenAI from 'openai';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import sharp from 'sharp';
import {
  LOGO_BRIEF_SYSTEM,
  LOGO_BRIEF_USER,
  buildImageGenerationPromptFromBrief,
  briefBackgroundRgb,
  type LogoDesignBrief,
} from '@/lib/etsy-logo-brief-prompt';
import { geminiGenerateImageBuffer, GEMINI_IMAGE_MODEL } from '@/lib/gemini-image-generate';

/** Vercel Pro : jusqu’à 300 s — évite les « Inactivity Timeout » du proxy pendant vision + image. */
export const maxDuration = 300;
export const runtime = 'nodejs';

const LOGO_CREDITS = 1;

function parseBriefJson(raw: string): LogoDesignBrief | null {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t) as LogoDesignBrief;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentification invalide' }, { status: 401 });

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY_MISSING', message: 'OPENAI_API_KEY manquante côté serveur.' },
        { status: 500 }
      );
    }
    const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim();
    if (!GEMINI_KEY) {
      return NextResponse.json(
        { error: 'SERVER_CONFIG_ERROR', message: 'GEMINI_API_KEY manquante côté serveur (génération logo).' },
        { status: 500 }
      );
    }
    const openai = new OpenAI({ apiKey: OPENAI_KEY, timeout: 240_000 });

    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json(
        {
          error: 'SUBSCRIPTION_REQUIRED',
          message: 'An active subscription is required to generate a logo.',
          subscriptionStatus: quotaInfo.status,
        },
        { status: 403 }
      );
    }
    if (quotaInfo.remaining < LOGO_CREDITS) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: `Génération de logo : ${LOGO_CREDITS} crédit requis. Il te reste ${quotaInfo.remaining} crédit(s).`,
          used: quotaInfo.used,
          quota: quotaInfo.quota,
          remaining: quotaInfo.remaining,
        },
        { status: 403 }
      );
    }

    let body: { shopImage?: string; productImage?: string } | null = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return NextResponse.json({ error: 'Format de requête invalide' }, { status: 400 });
    const shopImage = body.shopImage;
    const productImage = body.productImage;
    if (!shopImage || !productImage) {
      return NextResponse.json({ error: 'Deux images sont requises: boutique + produit.' }, { status: 400 });
    }

    const toImageDataUrl = async (input: string): Promise<string | null> => {
      try {
        const raw = String(input).trim();
        const dataUrl = raw.startsWith('data:image/') ? raw : `data:image/jpeg;base64,${raw}`;
        const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!m) return null;
        let b64 = m[2];
        const buf = Buffer.from(b64, 'base64');
        const c = await sharp(buf)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer();
        b64 = c.toString('base64');
        return `data:image/jpeg;base64,${b64}`;
      } catch {
        return null;
      }
    };

    const shopImageDataUrl = await toImageDataUrl(shopImage);
    const productImageDataUrl = await toImageDataUrl(productImage);
    if (!shopImageDataUrl || !productImageDataUrl) {
      return NextResponse.json({ error: 'Images invalides. Utilise JPG/PNG/WebP.' }, { status: 400 });
    }

    // Étape 1 — Brief JSON (vision) : gpt-4o + detail auto = brief aligné sur la vraie DA (qualité logo).
    const briefCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: LOGO_BRIEF_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: LOGO_BRIEF_USER },
            { type: 'image_url', image_url: { url: shopImageDataUrl, detail: 'auto' } },
            { type: 'image_url', image_url: { url: productImageDataUrl, detail: 'auto' } },
          ],
        },
      ],
    });

    const briefRaw = briefCompletion.choices[0]?.message?.content ?? '{}';
    const brief = parseBriefJson(briefRaw);
    if (!brief || !String(brief.final_image_prompt || '').trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'BRIEF_FAILED',
          message: 'Impossible d’extraire un brief logo (JSON invalide). Réessaie avec d’autres captures.',
        },
        { status: 422 }
      );
    }

    const imagePrompt = buildImageGenerationPromptFromBrief(brief);

    // Étape 2 — Image : Gemini (même modèle que les visuels listing / bannière).
    let imageBuf: Buffer | null = null;
    for (let attempt = 0; attempt < 3 && !imageBuf; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
      imageBuf = await geminiGenerateImageBuffer({
        apiKey: GEMINI_KEY,
        prompt: imagePrompt,
        model: GEMINI_IMAGE_MODEL,
        timeoutMs: 120_000,
      });
    }

    if (!imageBuf) {
      return NextResponse.json(
        {
          success: false,
          error: 'IMAGE_GENERATION_FAILED',
          message:
            'La génération du logo (Gemini) a échoué. Vérifie GEMINI_API_KEY et les quotas, puis réessaie.',
        },
        { status: 502 }
      );
    }
    const imageModelUsed = GEMINI_IMAGE_MODEL;

    const canvasBg = briefBackgroundRgb(brief);

    let finalPng: Buffer;
    try {
      finalPng = await sharp(imageBuf)
        .resize(1024, 1024, {
          fit: 'contain',
          position: 'center',
          background: canvasBg,
        })
        .flatten({ background: canvasBg })
        .png({ quality: 92 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { success: false, error: 'POST_PROCESS_FAILED', message: 'Impossible de finaliser le fichier image.' },
        { status: 500 }
      );
    }

    const deductResult = await incrementAnalysisCount(user.id, LOGO_CREDITS);
    if (!deductResult.success) {
      console.warn('[generate-logo] Credit deduction failed after success:', deductResult.error);
    }

    return NextResponse.json({
      success: true,
      imageDataUrl: `data:image/png;base64,${finalPng.toString('base64')}`,
      meta: { imageModel: imageModelUsed },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[generate-logo]', error);
    return NextResponse.json({ error: 'GENERATION_ERROR', message }, { status: 500 });
  }
}
