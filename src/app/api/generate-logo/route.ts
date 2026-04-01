import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import OpenAI from 'openai';
import { getUserQuotaInfo } from '@/lib/subscription-quota';
import sharp from 'sharp';
import {
  LOGO_BRIEF_SYSTEM,
  LOGO_BRIEF_USER,
  buildImageGenerationPromptFromBrief,
  briefBackgroundRgb,
  type LogoDesignBrief,
} from '@/lib/etsy-logo-brief-prompt';

// Step 1 of 2: brief only (~6-8s, well under Netlify 26s)
export const maxDuration = 30;
export const runtime = 'nodejs';

function parseBriefJson(raw: string): LogoDesignBrief | null {
  let t = raw.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/m.exec(t);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t) as LogoDesignBrief; }
  catch { return null; }
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
    const openai = new OpenAI({ apiKey: OPENAI_KEY, timeout: 18_000 });

    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED', message: 'Abonnement actif requis.' }, { status: 403 });
    }
    if (quotaInfo.quota !== -1 && quotaInfo.remaining < 1) {
      return NextResponse.json({ error: 'QUOTA_EXCEEDED', message: `1 crédit requis. Il te reste ${quotaInfo.remaining}.` }, { status: 403 });
    }

    let body: { shopImage?: string; productImage?: string } | null = null;
    try { body = await request.json(); } catch { body = null; }
    if (!body?.shopImage || !body?.productImage) {
      return NextResponse.json({ error: 'Deux images requises : bannière + produit.' }, { status: 400 });
    }

    const toJpeg = async (input: string): Promise<string | null> => {
      try {
        const raw = String(input).trim();
        const dataUrl = raw.startsWith('data:image/') ? raw : `data:image/jpeg;base64,${raw}`;
        const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!m) return null;
        const buf = Buffer.from(m[2], 'base64');
        const c = await sharp(buf).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75, mozjpeg: true }).toBuffer();
        return `data:image/jpeg;base64,${c.toString('base64')}`;
      } catch { return null; }
    };

    const [shopDataUrl, productDataUrl] = await Promise.all([
      toJpeg(body.shopImage),
      toJpeg(body.productImage),
    ]);
    if (!shopDataUrl || !productDataUrl) {
      return NextResponse.json({ error: 'Images invalides. Utilise JPG/PNG/WebP.' }, { status: 400 });
    }

    // GPT-4o-mini vision brief (~5-7s)
    let briefRaw = '{}';
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.35,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: LOGO_BRIEF_SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: LOGO_BRIEF_USER },
              { type: 'image_url', image_url: { url: shopDataUrl, detail: 'low' } },
              { type: 'image_url', image_url: { url: productDataUrl, detail: 'low' } },
            ],
          },
        ],
      });
      briefRaw = completion.choices[0]?.message?.content ?? '{}';
    } catch (e) {
      console.error('[generate-logo brief]', e);
      return NextResponse.json({ success: false, error: 'BRIEF_FAILED', message: "Analyse des images échouée. Réessaie." }, { status: 422 });
    }

    const brief = parseBriefJson(briefRaw);
    if (!brief || !String(brief.final_image_prompt || '').trim()) {
      return NextResponse.json({ success: false, error: 'BRIEF_FAILED', message: "Brief invalide. Réessaie avec d'autres images." }, { status: 422 });
    }

    const imagePrompt = buildImageGenerationPromptFromBrief(brief);
    const bg = briefBackgroundRgb(brief);

    return NextResponse.json({
      success: true,
      imagePrompt,
      bgR: bg.r,
      bgG: bg.g,
      bgB: bg.b,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[generate-logo]', error);
    return NextResponse.json({ error: 'GENERATION_ERROR', message }, { status: 500 });
  }
}
