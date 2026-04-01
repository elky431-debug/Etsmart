import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { incrementAnalysisCount } from '@/lib/subscription-quota';
import sharp from 'sharp';
import { geminiGenerateImageBuffer, GEMINI_IMAGE_MODEL } from '@/lib/gemini-image-generate';

export const maxDuration = 60;
export const runtime = 'nodejs';

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] ?? c));
}

async function compositeShopName(logoBuf: Buffer, shopName: string): Promise<Buffer> {
  const name = escapeXml(shopName.slice(0, 40));
  const nameLen = name.length;
  const fontSize = nameLen <= 8 ? 72 : nameLen <= 13 ? 58 : nameLen <= 18 ? 46 : nameLen <= 24 ? 38 : 30;
  const barH = Math.round(fontSize * 2.4);
  const textY = 1024 - Math.round(barH * 0.28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect x="0" y="${1024 - barH}" width="1024" height="${barH}" fill="#000000" fill-opacity="0.60"/>
  <text x="513" y="${textY + 2}" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" font-weight="700" fill="#000000" fill-opacity="0.6" letter-spacing="2">${name}</text>
  <text x="512" y="${textY}" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" font-weight="700" fill="#ffffff" letter-spacing="2">${name}</text>
</svg>`;
  return sharp(logoBuf).composite([{ input: Buffer.from(svg), blend: 'over' }]).png({ quality: 92 }).toBuffer();
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentification invalide' }, { status: 401 });

    const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim();
    if (!GEMINI_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY manquante.' }, { status: 500 });

    let body: { imagePrompt?: string; bgR?: number; bgG?: number; bgB?: number; shopName?: string; withName?: boolean } | null = null;
    try { body = await request.json(); } catch { body = null; }
    if (!body?.imagePrompt) return NextResponse.json({ error: 'imagePrompt manquant.' }, { status: 400 });

    const { imagePrompt, bgR = 201, bgG = 184, bgB = 164, shopName = '', withName = false } = body;

    // Gemini image generation (~18-20s, well under 26s since no brief step here)
    const imageBuf = await geminiGenerateImageBuffer({
      apiKey: GEMINI_KEY,
      prompt: imagePrompt,
      model: GEMINI_IMAGE_MODEL,
      timeoutMs: 22_000,
    });

    if (!imageBuf) {
      return NextResponse.json(
        { success: false, error: 'IMAGE_GENERATION_FAILED', message: 'La génération du logo a échoué. Réessaie dans un instant.' },
        { status: 502 }
      );
    }

    const canvasBg = { r: bgR, g: bgG, b: bgB };
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

    if (withName && shopName.trim().length >= 1) {
      try { finalPng = await compositeShopName(finalPng, shopName.trim()); }
      catch (e) { console.warn('[generate-logo-image] name composite failed:', e); }
    }

    const deductResult = await incrementAnalysisCount(user.id, 1);
    if (!deductResult.success) console.warn('[generate-logo-image] Credit deduction failed:', deductResult.error);

    return NextResponse.json({
      success: true,
      imageDataUrl: `data:image/png;base64,${finalPng.toString('base64')}`,
      creditsRemaining: deductResult.remaining,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[generate-logo-image]', error);
    return NextResponse.json({ error: 'GENERATION_ERROR', message }, { status: 500 });
  }
}
