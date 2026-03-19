import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import OpenAI from 'openai';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import sharp from 'sharp';

export const maxDuration = 25;
export const runtime = 'nodejs';

const LOGO_CREDITS = 1;
const LOGO_MAINTENANCE = true;

export async function POST(request: NextRequest) {
  try {
    if (LOGO_MAINTENANCE) {
      return NextResponse.json(
        { error: 'MAINTENANCE', message: 'Le générateur de logo est en maintenance. Reviens demain.' },
        { status: 503 }
      );
    }

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
                'Analyze both images and propose: (1) a 2-3 color palette (hex or CSS color names), (2) a background color for an opaque logo, (3) 3 distinct icon/motif concepts inspired by the product (symbol-only; no text), and (4) 3 style keywords.\n\nReturn JSON with keys: palette {main, accent, background}, motifs (string[3]), style_keywords (string[3]).',
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
      motifs?: string[];
      style_keywords?: string[];
    };
    let parsed: LogoAnalysis = {};
    try { parsed = JSON.parse(analysisContent); } catch { parsed = {}; }
    const palette = parsed?.palette ?? {};
    const motifs = Array.isArray(parsed?.motifs) ? parsed.motifs.filter(Boolean).slice(0, 3) : [];
    const styleKeywords = Array.isArray(parsed?.style_keywords)
      ? parsed.style_keywords.filter(Boolean).slice(0, 3)
      : [];
    const mainColor = String(palette?.main ?? '#00d4ff');
    const accentColor = String(palette?.accent ?? '#00c9b7');
    const backgroundColor = String(palette?.background ?? '#0b0b0b');

    // Step 2: generate multiple SVG candidates (fast + Netlify-friendly), pick best, then rasterize to PNG.
    // This avoids slow image generation calls that may time out in production while improving quality.
    const motifLine =
      motifs.length > 0
        ? `Motif concepts (pick ONE and execute it well):\n- ${motifs.map((m) => String(m)).join('\n- ')}`
        : 'Motif: a refined symbol inspired by the product (avoid generic icons).';
    const styleLine =
      styleKeywords.length > 0
        ? `Style keywords (use as guidance): ${styleKeywords.map((s) => String(s)).join(', ')}`
        : 'Style: modern, premium, minimal-but-not-flat.';

    const candidatesResp = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.55,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a world-class logo designer. Output ONLY valid JSON with key "svgs" (array of 3 SVG strings). Each SVG must be 1024x1024, square, with an opaque background. No text allowed.',
        },
        {
          role: 'user',
          content: `Create 3 distinct square logo ICONS (not illustrations) for an Etsy shop.\n\nABSOLUTE RULES:\n- NO text, NO letters, NO words, NO numbers, NO punctuation (no question marks), NO watermarks\n- Icon/symbol only\n- Must read as a professional logo asset: balanced, intentional negative space, scalable, clean edges\n- Not generic (avoid: star/heart/leaf/lightbulb/question mark/crown unless clearly derived from motif)\n- Add subtle depth: gentle gradient, inner shadow, or highlight (but keep it logo-like)\n- Opaque background required (solid or soft gradient)\n\nPalette:\n- main: ${mainColor}\n- accent: ${accentColor}\n- background: ${backgroundColor}\n\n${motifLine}\n${styleLine}\n\nSVG requirements:\n- width/height/viewBox 1024\n- include a background rect covering full canvas\n- only vector shapes (path/circle/rect), no embedded images\n- keep complexity moderate (<= ~30 shapes per logo)\n\nReturn JSON: {"svgs":["<svg...>...</svg>","<svg...>...</svg>","<svg...>...</svg>"]}`,
        },
      ],
    });

    const candidatesJson = candidatesResp.choices[0]?.message?.content ?? '{}';
    let svgs: string[] = [];
    try {
      const parsedCandidates = JSON.parse(candidatesJson) as { svgs?: string[] };
      svgs = Array.isArray(parsedCandidates.svgs) ? parsedCandidates.svgs.map((s) => String(s).trim()) : [];
    } catch {
      svgs = [];
    }
    svgs = svgs.filter((s) => s.startsWith('<svg')).slice(0, 3);
    if (svgs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'SVG_GENERATION_FAILED', message: 'Impossible de générer le logo (SVG).' },
        { status: 500 }
      );
    }

    // Pick the best candidate with a quick judge pass
    const judgeResp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a strict logo art director. Choose the best SVG candidate for a premium Etsy shop icon. Output ONLY JSON with keys: index (0-2), reason (1 sentence). Reject anything with text, punctuation, or generic symbols.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            criteria: [
              'no text/letters/numbers/punctuation',
              'balanced, professional logo feel (not clipart)',
              'motif relevance (derived from product idea, not generic)',
              'scalable silhouette + clean negative space',
              'subtle depth but not overly complex',
            ],
            svgs,
          }),
        },
      ],
    });
    const judgeJson = judgeResp.choices[0]?.message?.content ?? '{}';
    let bestIndex = 0;
    try {
      const parsedJudge = JSON.parse(judgeJson) as { index?: number };
      const idx = Number(parsedJudge.index);
      if (Number.isFinite(idx) && idx >= 0 && idx < svgs.length) bestIndex = idx;
    } catch {
      bestIndex = 0;
    }
    const svg = svgs[bestIndex] ?? svgs[0];

    // Rasterize SVG -> PNG 1024x1024
    let finalB64 = '';
    try {
      const png = await sharp(Buffer.from(svg))
        .resize(1024, 1024, { fit: 'cover' })
        .png({ quality: 92 })
        .toBuffer();
      finalB64 = png.toString('base64');
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'RASTERIZE_FAILED', message: 'Impossible de convertir le logo en image.' },
        { status: 500 }
      );
    }

    // Deduct credits after success
    const deductResult = await incrementAnalysisCount(user.id, LOGO_CREDITS);
    if (!deductResult.success) {
      console.warn('[generate-logo] Credit deduction failed after success:', deductResult.error);
    }

    return NextResponse.json({
      success: true,
      imageDataUrl: `data:image/png;base64,${finalB64}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: 'GENERATION_ERROR', message }, { status: 500 });
  }
}

