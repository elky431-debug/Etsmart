import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

let sharp: any;
try { sharp = require('sharp'); } catch { sharp = null; }

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * GÉNÉRATION COMBINÉE LISTING + IMAGES
 * 
 * 1. Analyse produit + description fond (parallèle) ~5s
 * 2. Listing + soumission images (parallèle) ~5s  
 * 3. Polling images serveur 20s
 * 4. Si prêt → tout d'un coup. Sinon → listing + taskIds pour poll client.
 * 
 * Coût: 2 crédits
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 }); }

    const { sourceImage, backgroundImage, quantity = 1, aspectRatio = '1:1' } = body;
    if (!sourceImage) return NextResponse.json({ error: 'MISSING_IMAGE' }, { status: 400 });

    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED' }, { status: 403 });
    if (quotaInfo.remaining < 2) return NextResponse.json({ error: 'QUOTA_EXCEEDED' }, { status: 403 });

    const apiKey = process.env.OPENAI_API_KEY;
    const NANO_KEY = process.env.NANONBANANA_API_KEY || '758a24cfaef8c64eed9164858b941ecc';
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY_MISSING' }, { status: 500 });

    // Préparer images
    let imageForAnalysis = sourceImage;
    if (!imageForAnalysis.startsWith('data:image/')) imageForAnalysis = `data:image/jpeg;base64,${imageForAnalysis}`;

    let imageForAPI: string;
    try {
      let b64 = sourceImage;
      if (b64.startsWith('data:image/')) { const p = b64.split(','); if (p.length > 1) b64 = p[1]; }
      if (sharp) {
        const buf = Buffer.from(b64, 'base64');
        let compressed = await sharp(buf).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
        if (compressed.length > 500 * 1024) compressed = await sharp(buf).resize(400, 400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 60, mozjpeg: true }).toBuffer();
        imageForAPI = compressed.toString('base64');
      } else { imageForAPI = b64; }
    } catch {
      let b64 = sourceImage;
      if (b64.startsWith('data:image/')) { const p = b64.split(','); if (p.length > 1) b64 = p[1]; }
      imageForAPI = b64;
    }
    const imageDataUrl = `data:image/jpeg;base64,${imageForAPI}`;

    // ═══════════════════════════════════════════════════════════
    // STEP 1: Analyse produit + fond EN PARALLÈLE (~3-5s)
    // ═══════════════════════════════════════════════════════════
    const step1: Promise<any>[] = [
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: [
            { type: 'text', text: 'Analyze this product image. Describe the product type, materials, colors, design, key features in English. 100-200 words.' },
            { type: 'image_url', image_url: { url: imageForAnalysis, detail: 'low' } },
          ]}],
          max_tokens: 300,
        }),
      }).then(async r => { if (!r.ok) throw new Error(`${r.status}`); const d = await r.json(); return d.choices?.[0]?.message?.content?.trim() || ''; }),
    ];
    if (backgroundImage) {
      let bgUrl = backgroundImage;
      if (!bgUrl.startsWith('data:image/')) bgUrl = `data:image/jpeg;base64,${bgUrl}`;
      step1.push(
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: [
              { type: 'text', text: 'Describe this background/scene for an AI image generator. Colors, textures, lighting, atmosphere. 2-3 sentences. Scene only.' },
              { type: 'image_url', image_url: { url: bgUrl, detail: 'low' } },
            ]}],
            max_tokens: 150, temperature: 0.3,
          }),
        }).then(async r => { if (!r.ok) return null; const d = await r.json(); return d.choices?.[0]?.message?.content?.trim() || null; }).catch(() => null)
      );
    }
    const s1 = await Promise.all(step1);
    const productDesc = s1[0];
    const bgDesc: string | null = s1[1] || null;
    if (!productDesc) return NextResponse.json({ error: 'IMAGE_ANALYSIS_FAILED' }, { status: 500 });

    // Build prompt
    let nanoPrompt = bgDesc
      ? `Professional Etsy lifestyle product photography.\nMANDATORY BACKGROUND: "${bgDesc}"\nRules: Keep product IDENTICAL. Place naturally in described scene. Soft lighting, depth of field. NO text/logos/watermarks.`
      : `Professional Etsy lifestyle product photography.\nRules: Keep product IDENTICAL. Create NEW cozy lifestyle background. Soft lighting, depth of field, warm atmosphere. NO text/logos/watermarks.`;

    const VIEWS = ['frontal eye-level view', '45-degree angle', 'top-down view', 'close-up detail', 'wide shot', 'three-quarter view', 'low angle', 'side profile'];

    // ═══════════════════════════════════════════════════════════
    // STEP 2: Listing + Submit images EN PARALLÈLE (~5s)
    // ═══════════════════════════════════════════════════════════
    const descPromise = fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert Etsy copywriter.' },
          { role: 'user', content: `Generate an Etsy product description in ENGLISH:\n\n${productDesc}\n\nRules: 8-12 emojis, warm tone, 300-500 words. Structure: 1)Hook 2)Product 3)Features 4)Why buy 5)Ideal for 6)Quality 7)Care 8)CTA. ONLY the description.` },
        ],
        temperature: 0.7, max_tokens: 1500,
      }),
    }).then(async r => { if (!r.ok) return ''; const d = await r.json(); return d.choices?.[0]?.message?.content?.trim() || ''; }).catch(() => '');

    const titlePromise = fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Return valid JSON only.' },
          { role: 'user', content: `Product: ${productDesc}\n\nReturn JSON: {"title":"SEO title 100-140 chars","tags":"tag1,tag2,...,tag13","materials":"mat1,mat2"}\nTitle MUST be 100-140 chars. 13 tags max 20 chars each. English only.` },
        ],
        temperature: 0.7, max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
    }).then(async r => {
      if (!r.ok) return { title: '', tags: [] as string[], materials: '' };
      const d = await r.json();
      const p = JSON.parse(d.choices?.[0]?.message?.content?.trim());
      let title = p.title || '';
      const tags = (p.tags || '').split(',').map((t: string) => t.trim()).filter((t: string) => t && t.length <= 20).slice(0, 13);
      if (title.length < 100) {
        for (const s of [' - Perfect Gift Idea', ' - Unique Handcrafted Design', ' - Modern Stylish Decor']) {
          if (title.length + s.length <= 140) { title += s; break; }
        }
      }
      return { title, tags, materials: p.materials || '' };
    }).catch(() => ({ title: '', tags: [] as string[], materials: '' }));

    // Submit images to Nanonbanana
    const imageSubmits = Array.from({ length: quantity }, async (_, i) => {
      try {
        let prompt = `CAMERA ANGLE: ${VIEWS[i % VIEWS.length]}.\n\n${nanoPrompt}`;
        if (prompt.length > 1800) prompt = prompt.substring(0, 1800);
        const reqBody = {
          type: 'IMAGETOIAMGE', prompt,
          imageUrls: [imageDataUrl],
          image_size: aspectRatio === '16:9' ? '16:9' : aspectRatio === '9:16' ? '9:16' : '1:1',
          numImages: 1,
          callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
        };
        const endpoints = ['https://api.nanobananaapi.ai/api/v1/nanobanana/generate', 'https://api.nanobanana.com/api/v1/nanobanana/generate'];
        const auths = [
          { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NANO_KEY}` },
          { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NANO_KEY}`, 'X-API-Key': NANO_KEY },
        ];
        let resp: Response | null = null;
        for (const ep of endpoints) {
          for (const h of auths) {
            try { resp = await fetch(ep, { method: 'POST', headers: h as any, body: JSON.stringify(reqBody) }); if (resp.status !== 403 && resp.status !== 404) break; } catch { continue; }
          }
          if (resp && resp.status !== 403 && resp.status !== 404) break;
        }
        if (!resp || !resp.ok) throw new Error(`Submit failed: ${resp?.status}`);
        const data = await resp.json();
        const directUrl = data.data?.response?.resultImageUrl || data.data?.url || data.url;
        if (directUrl) return { taskId: null, url: directUrl, index: i };
        const taskId = data.data?.task_id || data.data?.taskId || data.data?.id;
        if (!taskId) throw new Error('No taskId');
        return { taskId, url: null, index: i };
      } catch (e: any) {
        return { taskId: null, url: null, index: i, error: e.message };
      }
    });

    // Attendre tout en parallèle
    const [description, titleData, ...imgResults] = await Promise.all([descPromise, titlePromise, ...imageSubmits]);

    const title = titleData.title || productDesc.substring(0, 140);
    const tags = titleData.tags.length > 0 ? titleData.tags : ['handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'];
    const materials = titleData.materials || 'Various materials';
    const desc = description || productDesc;

    // ═══════════════════════════════════════════════════════════
    // STEP 3: Poll images serveur (max 20s)
    // ═══════════════════════════════════════════════════════════
    const finalImages: any[] = [];
    const pendingTasks: any[] = [];

    for (const r of imgResults) {
      if (r.url) {
        finalImages.push({ id: `img-${Date.now()}-${r.index}`, url: r.url });
      } else if (r.taskId) {
        pendingTasks.push(r);
      }
    }

    // Poll serveur pour les tasks en cours (max 20s, 10 polls x 2s)
    if (pendingTasks.length > 0) {
      const pollResults = await Promise.all(pendingTasks.map(async (task: any) => {
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const paramName = i % 2 === 0 ? 'taskId' : 'task_id';
            const res = await fetch(
              `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?${paramName}=${task.taskId}`,
              { headers: { 'Authorization': `Bearer ${NANO_KEY}`, 'Content-Type': 'application/json' } }
            );
            if (!res.ok) continue;
            const data = await res.json();
            if (data.code === 200 || data.code === 0 || data.msg === 'success') {
              const url = data.data?.response?.resultImageUrl || data.data?.response?.originImageUrl
                || data.data?.url || data.data?.image_url || data.data?.imageUrl || data.url;
              if (url) return { index: task.index, url };
            }
          } catch { /* continue */ }
        }
        return { index: task.index, taskId: task.taskId, url: null };
      }));

      for (const r of pollResults) {
        if (r.url) {
          finalImages.push({ id: `img-${Date.now()}-${r.index}`, url: r.url });
        } else if (r.taskId) {
          pendingTasks.push({ taskId: r.taskId, index: r.index });
        }
      }
    }

    // Remaining tasks that didn't resolve
    const stillPending = pendingTasks.filter(t => !finalImages.some(img => img.id?.endsWith(`-${t.index}`)));

    // Deduct credits
    let quotaResult: any = null;
    try {
      quotaResult = await incrementAnalysisCount(user.id, 2.0);
    } catch { /* log */ }

    console.log('[GEN] Done:', { listing: true, images: finalImages.length, pending: stillPending.length });

    return NextResponse.json({
      success: true,
      listing: { title, description: desc, tags, materials },
      images: finalImages,
      imageTasks: stillPending.map(t => ({ taskId: t.taskId, index: t.index })),
      quotaUpdated: !!quotaResult?.success,
      ...(quotaResult?.success ? { quota: { used: quotaResult.used, remaining: quotaResult.remaining, quota: quotaResult.quota } } : {}),
    });
  } catch (error: any) {
    console.error('[GEN] Fatal:', error.message);
    return NextResponse.json({ error: 'GENERATION_ERROR', message: error.message }, { status: 500 });
  }
}
