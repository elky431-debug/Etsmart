import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * Route de test pour la génération d'images — PAS de vérification subscription/quota.
 * Sécurisée par LAB_TEST_SECRET (paramètre ?key= ou header Authorization).
 */
export async function POST(request: NextRequest) {
  // Auth via secret
  const secret = process.env.LAB_TEST_SECRET?.trim();
  const keyFromHeader = request.headers.get('authorization')?.replace('Bearer ', '').trim();
  const { searchParams } = new URL(request.url);
  const keyFromQuery = searchParams.get('key')?.trim();
  const provided = keyFromHeader || keyFromQuery;

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const { sourceImage, prompt, engine = 'flash', aspectRatio = '1:1' } = body as {
    sourceImage?: string;
    prompt?: string;
    engine?: 'flash' | 'pro';
    aspectRatio?: string;
  };

  if (!sourceImage) {
    return NextResponse.json({ error: 'sourceImage requis' }, { status: 400 });
  }

  const NANO_KEY =
    process.env.NANONBANANA_API_KEY ||
    process.env.NANOBANANA_API_KEY ||
    process.env.NANO_BANANA_API_KEY ||
    process.env.NANONBANANA_KEY ||
    process.env.NANOBANANA_KEY;

  if (!NANO_KEY) {
    return NextResponse.json({ error: 'NANONBANANA_API_KEY manquante' }, { status: 500 });
  }

  const finalPrompt = prompt?.trim() ||
    'Professional product photo, clean white background, studio lighting, sharp focus, high quality e-commerce shot';

  const sizeMap: Record<string, string> = { '16:9': '16:9', '9:16': '9:16', '4:3': '4:3', '3:4': '3:4' };
  const imgSize = sizeMap[aspectRatio as string] || '1:1';

  const url =
    engine === 'pro'
      ? 'https://api.nanobananaapi.ai/api/v1/nanobanana/generate-pro'
      : 'https://api.nanobananaapi.ai/api/v1/nanobanana/generate';

  const payload =
    engine === 'pro'
      ? {
          prompt: finalPrompt,
          imageUrls: [sourceImage],
          resolution: '1K',
          aspectRatio: imgSize,
          callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
        }
      : {
          type: 'IMAGETOIAMGE',
          prompt: finalPrompt,
          imageUrls: [sourceImage],
          image_size: imgSize,
          numImages: 1,
          callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
        };

  console.log(`[LAB-TEST-IMG] Submitting to ${engine} model — prompt: ${finalPrompt.slice(0, 80)}...`);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${NANO_KEY}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    const raw = await resp.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: `Bad JSON from NanoBanana: ${raw.slice(0, 200)}` }, { status: 502 });
    }

    if (!resp.ok) {
      return NextResponse.json({ error: `NanoBanana HTTP ${resp.status}`, raw: raw.slice(0, 300) }, { status: 502 });
    }

    const dataObj = data.data as Record<string, unknown> | undefined;
    const taskId =
      dataObj?.task_id ||
      dataObj?.taskId ||
      dataObj?.id ||
      (data as Record<string, unknown>).task_id ||
      (data as Record<string, unknown>).taskId ||
      null;

    if (!taskId) {
      return NextResponse.json({ error: 'Pas de taskId reçu', raw: raw.slice(0, 300) }, { status: 502 });
    }

    console.log(`[LAB-TEST-IMG] Task submitted OK — taskId: ${taskId}`);
    return NextResponse.json({ taskId, engine, model: engine === 'pro' ? 'Nano Banana Pro' : 'Nano Banana 2' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[LAB-TEST-IMG] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
