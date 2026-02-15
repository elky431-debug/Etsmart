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

    const { sourceImage, backgroundImage, quantity = 1, aspectRatio = '1:1', customInstructions } = body;
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

    // ── Build prompt ─────────────────────────────────────────
    let basePrompt: string;
    if (bgDesc) {
      basePrompt = `Professional Etsy lifestyle photo. BACKGROUND: "${bgDesc}" Keep product IDENTICAL. Soft lighting. NO text/watermarks.`;
    } else {
      basePrompt = `Professional Etsy lifestyle photo. Keep product IDENTICAL. Cozy lifestyle background. Soft lighting. NO text/watermarks.`;
    }
    if (customInstructions && customInstructions.trim()) {
      basePrompt += ` ${customInstructions.trim()}`;
    }

    const VIEWS = ['frontal view', '45-degree angle', 'top-down', 'close-up', 'wide shot', 'three-quarter', 'low angle', 'side view'];

    console.log(`[IMAGE GEN] Setup done in ${Date.now() - startTime}ms, submitting ${quantity} image(s)...`);

    // ── Submit image generation tasks to Nanonbanana ──────────
    // STRICT 6s timeout per submission, NO server-side polling
    const submitImage = async (index: number): Promise<string | null> => {
      try {
        let prompt = `ANGLE: ${VIEWS[index % VIEWS.length]}. ${basePrompt}`;
        if (prompt.length > 1800) prompt = prompt.substring(0, 1800);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const resp = await fetch('https://api.nanobananaapi.ai/api/v1/nanobanana/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NANO_KEY}` },
          body: JSON.stringify({
            type: 'IMAGETOIAMGE',
            prompt,
            imageUrls: [imageDataUrl],
            image_size: aspectRatio === '16:9' ? '16:9' : aspectRatio === '9:16' ? '9:16' : aspectRatio === '4:3' ? '4:3' : aspectRatio === '3:4' ? '3:4' : '1:1',
            numImages: 1,
            callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          console.error(`[IMAGE GEN] Nano submit ${index} failed: ${resp.status} ${errText.substring(0, 200)}`);
          return null;
        }
        const data = await resp.json();
        const taskId = data.data?.task_id || data.data?.taskId || data.data?.id || null;
        console.log(`[IMAGE GEN] Submitted image ${index + 1}: taskId=${taskId}`);
        return taskId;
      } catch (e: any) {
        console.error(`[IMAGE GEN] Nano submit ${index} error: ${e.message}`);
        return null;
      }
    };

    // Submit SEQUENTIALLY with small delay to avoid rate limits
    const taskIds: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const taskId = await submitImage(i);
      if (taskId) taskIds.push(taskId);
      if (i < quantity - 1) await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[IMAGE GEN] Submitted ${taskIds.length}/${quantity} tasks in ${Date.now() - startTime}ms`);

    if (taskIds.length === 0) {
      return NextResponse.json({ error: 'Échec de soumission des images. Réessayez.' }, { status: 500 });
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
