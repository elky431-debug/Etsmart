import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

let sharp: any;
try { sharp = require('sharp'); } catch { sharp = null; }

export const maxDuration = 25;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentification invalide' }, { status: 401 });

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      return NextResponse.json({ error: 'SERVER_CONFIG_ERROR', message: 'GEMINI_API_KEY manquante côté serveur.' }, { status: 500 });
    }

    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Format de requête invalide' }, { status: 400 }); }
    const { shopImage, productImage } = body;
    if (!shopImage || !productImage) {
      return NextResponse.json({ error: 'Deux images sont requises: boutique + produit.' }, { status: 400 });
    }

    const toInlineImagePart = async (input: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> => {
      try {
        const raw = String(input).trim();
        const dataUrl = raw.startsWith('data:image/') ? raw : `data:image/jpeg;base64,${raw}`;
        const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!m) return null;
        let mime = m[1];
        let b64 = m[2];
        if (sharp) {
          const buf = Buffer.from(b64, 'base64');
          const c = await sharp(buf).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
          mime = 'image/jpeg';
          b64 = c.toString('base64');
        }
        return { inlineData: { mimeType: mime, data: b64 } };
      } catch {
        return null;
      }
    };

    const shopPart = await toInlineImagePart(shopImage);
    const productPart = await toInlineImagePart(productImage);
    if (!shopPart || !productPart) {
      return NextResponse.json({ error: 'Images invalides. Utilise JPG/PNG/WebP.' }, { status: 400 });
    }

    const prompt = [
      'Create ONE square logo (1:1) for an Etsy shop. It should feel refined and professional, not overly minimal.',
      'Use the shop/banner image for color palette and brand mood (allow 2–3 harmonious colors: main, accent, background).',
      'Use product image as thematic inspiration for the symbol or motif.',
      'ABSOLUTE RULES:',
      '- icon/symbol only, no text, no letters, no words, no watermark',
      '- refined and polished: add subtle depth (light shading or soft gradients on the icon), a clear focal point, and enough detail so it does not look like a single flat silhouette. Avoid being too simplistic or generic.',
      '- memorable, premium, strong silhouette, scalable, modern',
      '- MANDATORY: solid opaque background. NO transparency. Use a visible background (solid color or soft gradient from the shop palette). The logo must sit on this filled background.',
      '- no mockup, no business card, no 3D scene, no extra decorative clutter',
      '- output should look like a real, professional logo asset that could be used on a shop or packaging.',
    ].join(' ');

    const modelCandidates = [
      'gemini-3-pro-image-preview',
      'nano-banana-pro-preview',
      'gemini-3.1-flash-image-preview',
      'gemini-2.5-flash-image',
    ];

    for (const model of modelCandidates) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: prompt }, shopPart, productPart],
            }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          let b64 = part?.inlineData?.data;
          let mime = part?.inlineData?.mimeType || 'image/png';
          if (typeof b64 !== 'string' || b64.length < 100) continue;
          // Force opaque background: if PNG (may have alpha), composite on white and output JPEG
          if (sharp && (mime === 'image/png' || mime === 'image/webp')) {
            try {
              const buf = Buffer.from(b64, 'base64');
              const withBackground = await sharp(buf)
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .jpeg({ quality: 90 })
                .toBuffer();
              b64 = withBackground.toString('base64');
              mime = 'image/jpeg';
            } catch {
              // keep original if flatten fails
            }
          }
          return NextResponse.json({
            success: true,
            imageDataUrl: `data:${mime};base64,${b64}`,
          });
        }
      } catch {
        // try next model
      }
    }

    return NextResponse.json({
      success: false,
      error: 'IMAGE_SUBMIT_FAILED',
      message: 'Impossible de générer le logo pour le moment. Réessaie dans quelques secondes.',
    }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ error: 'GENERATION_ERROR', message: error?.message || 'Erreur serveur' }, { status: 500 });
  }
}

