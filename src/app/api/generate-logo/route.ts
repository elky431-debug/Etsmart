import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import OpenAI from 'openai';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import sharp from 'sharp';

export const maxDuration = 25;
export const runtime = 'nodejs';

const LOGO_CREDITS = 1;

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentification invalide' }, { status: 401 });

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY_MISSING', message: 'OPENAI_API_KEY manquante côté serveur.' },
        { status: 500 }
      );
    }
    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json(
        { error: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required to generate a logo.', subscriptionStatus: quotaInfo.status },
        { status: 403 }
      );
    }
    if (quotaInfo.remaining < LOGO_CREDITS) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: `Generation de logo : ${LOGO_CREDITS} crédit requis. Il te reste ${quotaInfo.remaining} crédit(s).`,
          used: quotaInfo.used,
          quota: quotaInfo.quota,
          remaining: quotaInfo.remaining,
        },
        { status: 403 }
      );
    }

    let body: { shopImage?: string; productImage?: string } | null = null;
    try { body = await request.json(); } catch { /* handled below */ }
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
        let mime = m[1];
        let b64 = m[2];
        const buf = Buffer.from(b64, 'base64');
        const c = await sharp(buf)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 78, mozjpeg: true })
          .toBuffer();
        mime = 'image/jpeg';
        b64 = c.toString('base64');
        return `data:${mime};base64,${b64}`;
      } catch {
        return null;
      }
    };

    const shopImageDataUrl = await toImageDataUrl(shopImage);
    const productImageDataUrl = await toImageDataUrl(productImage);
    if (!shopImageDataUrl || !productImageDataUrl) {
      return NextResponse.json({ error: 'Images invalides. Utilise JPG/PNG/WebP.' }, { status: 400 });
    }

    // Step 1: analyze colors/mood from images (vision) with OpenAI
    const analysis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert Etsy brand designer and logo artist. Analyze the provided shop/banner image and product image. Output ONLY valid JSON.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Analyze both images and propose: (1) a 2-3 color palette (hex or CSS color names), (2) a background color for an opaque logo, and (3) a clear icon/motif idea inspired by the product. The icon must be symbol-only (no text). Return JSON with keys: palette {main, accent, background}, motif (1 sentence).',
            },
            { type: 'image_url', image_url: { url: shopImageDataUrl } },
            { type: 'image_url', image_url: { url: productImageDataUrl } },
          ],
        },
      ],
    });

    const analysisContent = analysis.choices[0]?.message?.content ?? '{}';
    type LogoAnalysis = {
      palette?: { main?: string; accent?: string; background?: string };
      motif?: string;
    };
    let parsed: LogoAnalysis = {};
    try { parsed = JSON.parse(analysisContent); } catch { parsed = {}; }
    const palette = parsed?.palette ?? {};
    const motif = String(parsed?.motif ?? 'a refined symbol inspired by the product');
    const mainColor = String(palette?.main ?? '#00d4ff');
    const accentColor = String(palette?.accent ?? '#00c9b7');
    const backgroundColor = String(palette?.background ?? '#0b0b0b');

    // Step 2: generate logo image (text-to-image) with OpenAI
    const logoPrompt = [
      'Create ONE square logo (1:1) for an Etsy shop.',
      'ABSOLUTE RULES:',
      '- icon/symbol only, NO text, NO letters, NO words, NO watermark',
      '- refined and polished: subtle depth (soft gradient/shading), clear focal point, enough detail (not a flat silhouette)',
      `- palette: main ${mainColor}, accent ${accentColor}, background ${backgroundColor}`,
      `- motif idea: ${motif}`,
      '- MANDATORY: solid opaque background. NO transparency.',
      '- no mockup, no business card, no 3D scene, no decorative clutter',
      '- output must look like a real professional logo asset (usable on a shop page, packaging, favicon)',
    ].join('\n');

    const imageResponse = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: logoPrompt,
      size: '1024x1024',
    });

    const b64 = imageResponse.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ success: false, error: 'IMAGE_GENERATION_FAILED', message: 'Impossible de générer le logo.' }, { status: 500 });
    }

    // Ensure opaque background (flatten to white if needed)
    let finalMime = 'image/jpeg';
    let finalB64 = b64;
    try {
      const raw = Buffer.from(b64, 'base64');
      const flattened = await sharp(raw)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 90 })
        .toBuffer();
      finalB64 = flattened.toString('base64');
    } catch {
      // keep original
      finalMime = 'image/png';
    }

    // Deduct credits after success
    const deductResult = await incrementAnalysisCount(user.id, LOGO_CREDITS);
    if (!deductResult.success) {
      console.warn('[generate-logo] Credit deduction failed after success:', deductResult.error);
    }

    return NextResponse.json({
      success: true,
      imageDataUrl: `data:${finalMime};base64,${finalB64}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: 'GENERATION_ERROR', message }, { status: 500 });
  }
}

