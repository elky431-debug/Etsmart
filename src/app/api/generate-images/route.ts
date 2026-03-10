import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

let sharp: any;
try { sharp = require('sharp'); } catch { sharp = null; }

// ⚠️ CRITICAL: Keep maxDuration under Netlify's 26s limit
export const maxDuration = 25;
export const runtime = 'nodejs';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * API ROUTE - IMAGE GENERATION (SUBMIT + RETURN TASK IDS)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Architecture:
 * 1. Compress & validate the source image
 * 2. Submit image generation tasks to Nanonbanana (NO server-side polling)
 * 3. Return taskIds immediately → frontend polls via /api/check-image-status
 * 
 * This avoids Netlify's 26s timeout by not waiting for images to be ready.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    // ── Auth ──────────────────────────────────────────────────
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentification invalide' }, { status: 401 });

    console.log(`[IMAGE GEN] User ${user.id} - request received`);

    // ── Quota check ──────────────────────────────────────────
    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required.' }, { status: 403 });
    }
    if (quotaInfo.remaining < 1) {
      return NextResponse.json({ error: 'QUOTA_EXCEEDED', message: 'Insufficient quota. You need 1 credit.' }, { status: 403 });
    }

    // ── Parse body ───────────────────────────────────────────
    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Format de requête invalide' }, { status: 400 }); }

    const { sourceImage, backgroundImage, quantity = 1, aspectRatio = '1:1', customInstructions, productTitle } = body;
    if (!sourceImage) return NextResponse.json({ error: 'Image source requise' }, { status: 400 });
    if (quantity < 1 || quantity > 10) return NextResponse.json({ error: 'Quantité entre 1 et 10' }, { status: 400 });

    const NANO_KEY = process.env.NANONBANANA_API_KEY || '758a24cfaef8c64eed9164858b941ecc';

    // ── Compress source image ────────────────────────────────
    let imageForAPI: string;
    try {
      let b64 = sourceImage;
      if (b64.startsWith('data:image/')) { const p = b64.split(','); if (p.length > 1) b64 = p[1]; }
      if (sharp) {
        const buf = Buffer.from(b64, 'base64');
        let c = await sharp(buf).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
        if (c.length > 500 * 1024) c = await sharp(buf).resize(400, 400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 60, mozjpeg: true }).toBuffer();
        if (c.length > 500 * 1024) c = await sharp(buf).resize(300, 300, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 50, mozjpeg: true }).toBuffer();
        imageForAPI = c.toString('base64');
        console.log(`[IMAGE GEN] Compressed: ${(c.length / 1024).toFixed(0)}KB`);
      } else {
        imageForAPI = b64;
      }
    } catch {
      let b64 = sourceImage;
      if (b64.startsWith('data:image/')) { const p = b64.split(','); if (p.length > 1) b64 = p[1]; }
      imageForAPI = b64;
    }
    const imageDataUrl = `data:image/jpeg;base64,${imageForAPI}`;

    // ── Describe background if provided (with strict 6s timeout) ──
    let bgDesc: string | null = null;
    if (backgroundImage) {
      try {
        let bgUrl = backgroundImage;
        if (!bgUrl.startsWith('data:image/')) bgUrl = `data:image/jpeg;base64,${bgUrl}`;
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: [
                { type: 'text', text: 'Describe this background for an AI image generator. Colors, textures, lighting. 2 sentences.' },
                { type: 'image_url', image_url: { url: bgUrl, detail: 'low' } },
              ]}], max_tokens: 100, temperature: 0.3,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (resp.ok) {
            const d = await resp.json();
            bgDesc = d.choices?.[0]?.message?.content?.trim() || null;
            console.log(`[IMAGE GEN] Background described: ${bgDesc?.substring(0, 80)}...`);
          }
        }
      } catch (e: any) {
        console.warn(`[IMAGE GEN] Background description failed: ${e.message}`);
      }
    }

    // ── Build prompt (décor cohérent avec le produit, produit clair et reconnaissable) ──
    let basePrompt: string;
    const productContext = productTitle && String(productTitle).trim()
      ? `PRODUCT: ${String(productTitle).trim().substring(0, 120)}. Background and setting MUST match this product (e.g. garden/lawn for outdoor tools, kitchen for kitchenware, desk for office, bathroom for toiletries). One clear focal product, instantly recognizable.`
      : '';
    if (bgDesc) {
      basePrompt = `Professional Etsy product photo. Hyper realistic, photorealistic, real photograph — must NOT look AI-generated or synthetic. BACKGROUND: "" Keep product IDENTICAL and clearly visible. Each generated image must use a different composition, camera framing, and background layout so that no two images look like the same scene. Soft lighting. NO text/watermarks.`;
    } else if (productContext) {
      basePrompt = `Professional Etsy product photo. Hyper realistic, photorealistic, real photograph — must NOT look AI-generated or synthetic. Keep the product IDENTICAL and clearly visible.  Each generated image must use a different composition, camera framing, and background layout so that no two images look like the same scene. Clean, simple, aesthetic setting. Soft natural lighting. No text, no logos, no watermarks.`;
    } else {
      basePrompt = `Professional Etsy product photo. Hyper realistic, photorealistic, real photograph — must NOT look AI-generated or synthetic. Keep product IDENTICAL. Background must match the product type. Each generated image must use a different composition, camera framing, and background layout so that no two images look like the same scene. One clear focal product, instantly recognizable. Clean, simple. NO text/watermarks.`;
    }
    if (customInstructions && customInstructions.trim()) {
      basePrompt += ` ${customInstructions.trim()}`;
    }

    const VIEWS = [
      'wide room view showing the full environment around the product',
      'medium three-quarter angle focusing on the entire product',
      'tight close-up crop focusing only on a portion of the product and its textures',
      'side profile angle showing depth and perspective of the product',
      'low angle looking slightly up at the product to give it presence',
      'top-down flat lay looking directly down on the product',
      'angled view from above looking toward the product at 45 degrees',
      'frontal eye-level view centered on the product',
    ];
    const LIGHTING = ['soft natural daylight', 'warm golden hour glow', 'bright airy studio light', 'dramatic side lighting with soft shadows', 'cool overcast diffused light', 'warm candlelit ambiance', 'clean backlit silhouette edge', 'neutral even lighting'];
    const VARIATIONS = [
      'Make this image a wide shot where the product occupies less of the frame and more of the background environment is visible.',
      'Make this image a medium shot, with the product centered and filling most of the frame, background slightly blurred.',
      'Make this image a close-up or detail shot, cropping tightly on part of the product and blurring most of the background.',
      'Make this image a side-angle composition, moving the camera to the side so the product is seen in strong perspective with background elements arranged differently.',
      'Make this image use a low viewpoint so the product looks taller and more prominent, with the background rearranged.',
      'Make this image a flat-lay style shot looking straight down at the product with props arranged differently around it.',
      'Make this image an angled overhead view where the camera is above and to the side, changing the perceived depth and layout.',
      'Make this image keep the camera at eye level but change the background composition and prop placement significantly compared to other images.',
    ];

    console.log(`[IMAGE GEN] Setup done in ${Date.now() - startTime}ms, submitting ${quantity} image(s)...`);

    // ── Submit image generation tasks to NanoBanana (with retry) ──
    const payloadSize = imageDataUrl.length;
    console.log(`[IMAGE GEN] Image payload size: ${(payloadSize / 1024).toFixed(0)}KB, sharp: ${!!sharp}`);

    const sizeMap: Record<string, string> = { '16:9': '16:9', '9:16': '9:16', '4:3': '4:3', '3:4': '3:4' };
    const imgSize = sizeMap[aspectRatio] || '1:1';

    const submitOnce = async (prompt: string): Promise<{ taskId: string | null; error?: string }> => {
      const resp = await fetch('https://api.nanobananaapi.ai/api/v1/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NANO_KEY}` },
        body: JSON.stringify({
          type: 'IMAGETOIAMGE',
          prompt,
          imageUrls: [imageDataUrl],
          image_size: imgSize,
          numImages: 1,
          callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
        }),
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        return { taskId: null, error: `HTTP ${resp.status}: ${t.substring(0, 150)}` };
      }
      const raw = await resp.text();
      let data: any;
      try { data = JSON.parse(raw); } catch { return { taskId: null, error: `Bad JSON: ${raw.substring(0, 100)}` }; }
      if (data.code && data.code !== 200 && data.code !== 0) {
        return { taskId: null, error: `API ${data.code}: ${data.msg || 'error'}` };
      }
      const taskId = data.data?.task_id || data.data?.taskId || data.data?.id || data.task_id || data.taskId || null;
      if (!taskId) return { taskId: null, error: `No taskId in: ${raw.substring(0, 150)}` };
      return { taskId };
    };

    const submitWithRetry = async (index: number): Promise<{ taskId: string | null; error?: string }> => {
      const view = VIEWS[index % VIEWS.length];
      const light = LIGHTING[(index + 3) % LIGHTING.length];
      const variation = VARIATIONS[index % VARIATIONS.length];
      let prompt = `IMAGE ${index + 1} — MUST be visually UNIQUE and DIFFERENT from all other images. CAMERA: ${view}. LIGHTING: ${light}. ${variation} ${basePrompt}`;
      if (prompt.length > 1800) prompt = prompt.substring(0, 1800);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await submitOnce(prompt);
          if (result.taskId) {
            console.log(`[IMAGE GEN] Image ${index + 1} submitted (attempt ${attempt + 1}): ${result.taskId}`);
            return result;
          }
          console.warn(`[IMAGE GEN] Image ${index + 1} attempt ${attempt + 1} failed: ${result.error}`);
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
        } catch (e: any) {
          console.error(`[IMAGE GEN] Image ${index + 1} attempt ${attempt + 1} crash: ${e?.message}`);
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
        }
      }
      return { taskId: null, error: 'All 3 attempts failed' };
    };

    const taskIds: string[] = [];
    const errors: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const result = await submitWithRetry(i);
      if (result.taskId) taskIds.push(result.taskId);
      else errors.push(result.error || 'failed');
      if (i < quantity - 1) await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[IMAGE GEN] Submitted ${taskIds.length}/${quantity} in ${Date.now() - startTime}ms`);

    if (taskIds.length === 0) {
      return NextResponse.json({ 
        error: 'IMAGE_SUBMIT_FAILED', 
        message: errors[0] || 'Submission failed',
        debug: { errors, payloadSizeKB: Math.round(payloadSize / 1024), sharpAvailable: !!sharp },
      }, { status: 500 });
    }

    // ── Deduct credits ───────────────────────────────────────
    try {
      const result = await incrementAnalysisCount(user.id, 1.0);
      if (result.success) {
        console.log(`[IMAGE GEN] ✅ 1 credit deducted. Used: ${result.used}/${result.quota}`);
      } else {
        console.error(`[IMAGE GEN] ❌ Credit deduction failed: ${result.error}`);
      }
    } catch (e: any) {
      console.error(`[IMAGE GEN] ❌ Credit deduction error: ${e.message}`);
    }

    // ── Return task IDs for client-side polling ──────────────
    return NextResponse.json({
      success: true,
      imageTaskIds: taskIds,
    });

  } catch (error: any) {
    console.error(`[IMAGE GEN] Fatal error (${Date.now() - startTime}ms):`, error.message);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la génération des images' },
      { status: 500 }
    );
  }
}
