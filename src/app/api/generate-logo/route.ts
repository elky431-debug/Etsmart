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

// Netlify gateway = 26s — brief (gpt-4o-mini ~6s) + Gemini (~16s) = ~22s total, stays under.
export const maxDuration = 60;
export const runtime = 'nodejs';

const LOGO_CREDITS = 1;

function parseBriefJson(raw: string): LogoDesignBrief | null {
  let t = raw.trim();
  const fence = /^`\`\`(?:json)?\s*([\s\S]*?)`\`\`$/m.exec(t);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t) as LogoDesignBrief;
  } catch {
    return null;
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] ?? c));
}

async function compositeShopName(logoBuf: Buffer, shopName: string): Promise<Buffer> {
  const name = escapeXml(shopName.slice(0, 40));
  const nameLen = name.length;
  const fontSize = nameLen <= 8 ? 72 : nameLen <= 13 ? 58 : nameLen <= 18 ? 46 : nameLen <= 24 ? 38 : 30;
  const barH = Math.round(fontSize * 2.4);
  const textY = 1024 - Math.round(barH * 0.28);

  // No feDropShadow — not supported by Sharp's librsvg. Text shadow via stacked text elements instead.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect x="0" y="${1024 - barH}" width="1024" height="${barH}" fill="#000000" fill-opacity="0.60"/>
  <text x="513" y="${textY + 2}" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" font-weight="700" fill="#000000" fill-opacity="0.6" letter-spacing="2">${name}</text>
  <text x="512" y="${textY}" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" font-weight="700" fill="#ffffff" letter-spacing="2">${name}</text>
</svg>`;

  return sharp(logoBuf)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png({ quality: 92 })
    .toBuffer();
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentification invalide' }, { status: 401 });

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY_MISSING' }, { status: 500 });
    const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim();
    if (!GEMINI_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY manquante.' }, { status: 500 });
    const openai = new OpenAI({ apiKey: OPENAI_KEY, timeout: 10_000 });

    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED', message: 'Abonnement actif requis.' }, { status: 403 });
    }
    if (quotaInfo.quota !== -1 && quotaInfo.remaining < LOGO_CREDITS) {
      return NextResponse.json({ error: 'QUOTA_EXCEEDED', message: `${LOGO_CREDITS} crédit requis. Il te reste ${quotaInfo.remaining}.` }, { status: 403 });
    }

    let body: { shopImage?: string; productImage?: string; shopName?: string; withName?: boolean } | null = null;
    try { body = await request.json(); } catch { body = null; }
    if (!body) return NextResponse.json({ error: 'Format de requête invalide' }, { status: 400 });

    const { shopImage, productImage, shopName = '', withName = false } = body;
    if (!shopImage || !productImage) {
      return NextResponse.json({ error: 'Deux images requises : boutique + produit.' }, { status: 400 });
    }

    const toImageDataUrl = async (input: string): Promise<string | null> => {
      try {
        const raw = String(input).trim();
        const dataUrl = raw.startsWith('data:image/') ? raw : `data:image/jpeg;base64,${raw}`;
        const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!m) return null;
        const buf = Buffer.from(m[2], 'base64');
        const c = await sharp(buf).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
        return `data:image/jpeg;base64,${c.toString('base64')}`;
      } catch { return null; }
    };

    const [shopImageDataUrl, productImageDataUrl] = await Promise.all([
      toImageDataUrl(shopImage),
      toImageDataUrl(productImage),
    ]);
    if (!shopImageDataUrl || !productImageDataUrl) {
      return NextResponse.json({ error: 'Images invalides. Utilise JPG/PNG/WebP.' }, { status: 400 });
    }

    // Step 1 — Brief via gpt-4o-mini (~5-8s)
    let briefRaw = '{}';
    try {
      const briefCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.35,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: LOGO_BRIEF_SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: LOGO_BRIEF_USER },
              { type: 'image_url', image_url: { url: shopImageDataUrl, detail: 'low' } },
              { type: 'image_url', image_url: { url: productImageDataUrl, detail: 'low' } },
            ],
          },
        ],
      });
      briefRaw = briefCompletion.choices[0]?.message?.content ?? '{}';
    } catch (e) {
      console.error('[generate-logo] brief step failed:', e);
      return NextResponse.json({ success: false, error: 'BRIEF_FAILED', message: "Analyse des images échouée. Réessaie." }, { status: 422 });
    }
    const brief = parseBriefJson(briefRaw);
    if (!brief || !String(brief.final_image_prompt || '').trim()) {
      return NextResponse.json(
        { success: false, error: 'BRIEF_FAILED', message: "Impossible d'extraire un brief logo. Réessaie avec d'autres images." },
        { status: 422 }
      );
    }

    const imagePrompt = buildImageGenerationPromptFromBrief(brief);

    // Step 2 — Gemini image (12s cap: brief took ~8s, 12s left before Netlify 26s gateway)
    const imageBuf = await geminiGenerateImageBuffer({
      apiKey: GEMINI_KEY,
      prompt: imagePrompt,
      model: GEMINI_IMAGE_MODEL,
      timeoutMs: 12_000,
    });

    if (!imageBuf) {
      return NextResponse.json(
        { success: false, error: 'IMAGE_GENERATION_FAILED', message: 'La génération du logo a échoué. Réessaie dans un instant.' },
        { status: 502 }
      );
    }

    const canvasBg = briefBackgroundRgb(brief);
    let finalPng: Buffer;
    try {
      finalPng = await sharp(imageBuf)
        .resize(1024, 1024, { fit: 'contain', position: 'center', background: canvasBg })
        .flatten({ background: canvasBg })
        .png({ quality: 92 })
        .toBuffer();
    } catch {
      return NextResponse.json({ success: false, error: 'POST_PROCESS_FAILED' }, { status: 500 });
    }

    // Step 3 — Optionally composite shop name via Sharp SVG overlay
    if (withName && shopName.trim().length >= 1) {
      try { finalPng = await compositeShopName(finalPng, shopName.trim()); }
      catch (e) { console.warn('[generate-logo] name composite failed:', e); }
    }

    const deductResult = await incrementAnalysisCount(user.id, LOGO_CREDITS);
    if (!deductResult.success) console.warn('[generate-logo] Credit deduction failed:', deductResult.error);

    return NextResponse.json({
      success: true,
      imageDataUrl: `data:image/png;base64,${finalPng.toString('base64')}`,
      meta: { imageModel: GEMINI_IMAGE_MODEL, withName: withName && shopName.trim().length >= 1 },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[generate-logo]', error);
    return NextResponse.json({ error: 'GENERATION_ERROR', message }, { status: 500 });
  }
}
