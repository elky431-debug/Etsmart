import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

let sharp: any;
try { sharp = require('sharp'); } catch { sharp = null; }

export const maxDuration = 25;
export const runtime = 'nodejs';

// Timeout wrapper — if a promise doesn't resolve in ms, return fallback
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    // Auth
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    // Body
    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 }); }
    const { sourceImage, backgroundImage, quantity = 1, aspectRatio = '1:1' } = body;
    if (!sourceImage) return NextResponse.json({ error: 'MISSING_IMAGE' }, { status: 400 });

    // Quota
    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED' }, { status: 403 });
    if (quotaInfo.remaining < 2) return NextResponse.json({ error: 'QUOTA_EXCEEDED' }, { status: 403 });

    const apiKey = process.env.OPENAI_API_KEY;
    const NANO_KEY = process.env.NANONBANANA_API_KEY || '758a24cfaef8c64eed9164858b941ecc';
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY_MISSING' }, { status: 500 });

    // Compress source image
    let imageForAnalysis = sourceImage;
    if (!imageForAnalysis.startsWith('data:image/')) imageForAnalysis = `data:image/jpeg;base64,${imageForAnalysis}`;

    let imageForAPI: string;
    try {
      let b64 = sourceImage;
      if (b64.startsWith('data:image/')) { const p = b64.split(','); if (p.length > 1) b64 = p[1]; }
      if (sharp) {
        const buf = Buffer.from(b64, 'base64');
        let c = await sharp(buf).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
        if (c.length > 500 * 1024) c = await sharp(buf).resize(400, 400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 60, mozjpeg: true }).toBuffer();
        imageForAPI = c.toString('base64');
      } else { imageForAPI = b64; }
    } catch {
      let b64 = sourceImage;
      if (b64.startsWith('data:image/')) { const p = b64.split(','); if (p.length > 1) b64 = p[1]; }
      imageForAPI = b64;
    }
    const imageDataUrl = `data:image/jpeg;base64,${imageForAPI}`;

    console.log(`[GEN] Compressed in ${Date.now() - startTime}ms`);

    // ══════════════════════════════════════════════════════════
    // STEP 1: Product analysis + bg description (parallel, 8s timeout)
    // ══════════════════════════════════════════════════════════
    const analysisP = fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Analyze this product. Type, materials, colors, design, features. English. 100-200 words.' },
          { type: 'image_url', image_url: { url: imageForAnalysis, detail: 'low' } },
        ]}], max_tokens: 300,
      }),
    }).then(async r => { if (!r.ok) throw new Error(`${r.status}`); const d = await r.json(); return d.choices?.[0]?.message?.content?.trim() || ''; });

    let bgDescP: Promise<string | null> = Promise.resolve(null);
    if (backgroundImage) {
      let bgUrl = backgroundImage;
      if (!bgUrl.startsWith('data:image/')) bgUrl = `data:image/jpeg;base64,${bgUrl}`;
      bgDescP = fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: [
            { type: 'text', text: 'Describe this background for an AI image generator. Colors, textures, lighting. 2 sentences.' },
            { type: 'image_url', image_url: { url: bgUrl, detail: 'low' } },
          ]}], max_tokens: 100, temperature: 0.3,
        }),
      }).then(async r => { if (!r.ok) return null; const d = await r.json(); return d.choices?.[0]?.message?.content?.trim() || null; }).catch(() => null);
    }

    const [productDesc, bgDesc] = await Promise.all([
      withTimeout(analysisP, 8000, ''),
      withTimeout(bgDescP, 8000, null),
    ]);
    if (!productDesc) return NextResponse.json({ error: 'IMAGE_ANALYSIS_FAILED' }, { status: 500 });

    console.log(`[GEN] Analysis done in ${Date.now() - startTime}ms`);

    // Build prompt
    const nanoPrompt = bgDesc
      ? `Professional Etsy lifestyle photo. BACKGROUND: "${bgDesc}" Keep product IDENTICAL. Soft lighting. NO text/watermarks.`
      : `Professional Etsy lifestyle photo. Keep product IDENTICAL. Cozy lifestyle background. Soft lighting. NO text/watermarks.`;

    const VIEWS = ['frontal view', '45-degree angle', 'top-down', 'close-up', 'wide shot', 'three-quarter', 'low angle', 'side view'];

    // ══════════════════════════════════════════════════════════
    // STEP 2: Listing + Image submissions ALL IN PARALLEL
    // Each has strict timeout to avoid 504
    // ══════════════════════════════════════════════════════════
    const descP = withTimeout(
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Expert Etsy copywriter.' },
            { role: 'user', content: `Etsy description ENGLISH:\n${productDesc}\n8-12 emojis, warm, 300-500 words. ONLY description.` },
          ], temperature: 0.7, max_tokens: 1500,
        }),
      }).then(async r => { if (!r.ok) return ''; const d = await r.json(); return d.choices?.[0]?.message?.content?.trim() || ''; }).catch(() => ''),
      10000, ''
    );

    const titleP = withTimeout(
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Return valid JSON only.' },
            { role: 'user', content: `Product: ${productDesc}\nJSON: {"title":"SEO 100-140 chars","tags":"t1,t2,...,t13","materials":"m1,m2"} English.` },
          ], temperature: 0.7, max_tokens: 400, response_format: { type: 'json_object' },
        }),
      }).then(async r => {
        if (!r.ok) return { title: '', tags: [] as string[], materials: '' };
        const d = await r.json(); const p = JSON.parse(d.choices?.[0]?.message?.content?.trim());
        let title = p.title || '';
        const tags = (p.tags || '').split(',').map((t: string) => t.trim()).filter((t: string) => t && t.length <= 20).slice(0, 13);
        if (title.length < 100) { for (const s of [' - Perfect Gift Idea', ' - Unique Handcrafted Design']) { if (title.length + s.length <= 140) { title += s; break; } } }
        return { title, tags, materials: p.materials || '' };
      }).catch(() => ({ title: '', tags: [] as string[], materials: '' })),
      10000, { title: '', tags: [] as string[], materials: '' }
    );

    // Submit images — STRICT 6s timeout per submission, no retry on alternate endpoint
    const submitImage = async (index: number): Promise<string | null> => {
      try {
        let prompt = `ANGLE: ${VIEWS[index % VIEWS.length]}. ${nanoPrompt}`;
        if (prompt.length > 1800) prompt = prompt.substring(0, 1800);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const resp = await fetch('https://api.nanobananaapi.ai/api/v1/nanobanana/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NANO_KEY}` },
          body: JSON.stringify({
            type: 'IMAGETOIAMGE', prompt,
            imageUrls: [imageDataUrl],
            image_size: aspectRatio === '16:9' ? '16:9' : aspectRatio === '9:16' ? '9:16' : '1:1',
            numImages: 1,
            callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!resp.ok) {
          console.error(`[GEN] Nano submit ${index} failed: ${resp.status}`);
          return null;
        }
        const data = await resp.json();
        return data.data?.task_id || data.data?.taskId || data.data?.id || null;
      } catch (e: any) {
        console.error(`[GEN] Nano submit ${index} error:`, e.message);
        return null;
      }
    };

    // Submit images SEQUENTIALLY to avoid Nanonbanana rate limits
    // But still in parallel with listing generation
    const imageSubmitP = (async () => {
      const ids: string[] = [];
      for (let i = 0; i < quantity; i++) {
        const id = await submitImage(i);
        if (id) ids.push(id);
        // Small delay between submissions to avoid rate limit
        if (i < quantity - 1) await new Promise(r => setTimeout(r, 300));
      }
      return ids;
    })();

    // Wait for everything
    const [description, titleData, taskIds] = await Promise.all([descP, titleP, imageSubmitP]);

    const title = titleData.title || productDesc.substring(0, 140);
    const tags = titleData.tags.length > 0 ? titleData.tags : ['handmade', 'gift', 'unique', 'custom', 'etsy', 'artisan', 'quality', 'premium', 'original', 'trendy', 'stylish', 'decor', 'special'];
    const materials = titleData.materials || '';

    // Deduct credits
    try { await incrementAnalysisCount(user.id, 2.0); } catch (e) { console.error('[GEN] Quota err:', e); }

    console.log(`[GEN] Done in ${Date.now() - startTime}ms — listing:✅ tasks:${taskIds.length}`);

    return NextResponse.json({
      success: true,
      listing: { title, description: description || productDesc, tags, materials },
      imageTaskIds: taskIds,
    });
  } catch (error: any) {
    console.error(`[GEN] Fatal (${Date.now() - startTime}ms):`, error.message);
    return NextResponse.json({ error: 'GENERATION_ERROR', message: error.message }, { status: 500 });
  }
}
