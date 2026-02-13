import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

let sharp: any;
try { sharp = require('sharp'); } catch { sharp = null; }

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * API ROUTE - GÉNÉRATION COMBINÉE LISTING + SOUMISSION IMAGES
 * 
 * Flow:
 * 1. Analyse produit (GPT-4o-mini) ~3-5s
 * 2. En parallèle: Description + Titre/Tags + Soumission images à Nanonbanana ~5-8s
 * 3. Retourne: listing complet + task IDs pour les images
 * 4. Le frontend poll /api/check-image-status pour récupérer les images
 * 
 * Coût: 2.0 crédits (1 listing + 1 images) — déduits immédiatement
 * Temps total: ~10-15s — bien sous le timeout Netlify
 */
export async function POST(request: NextRequest) {
  try {
    // Auth
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

    // Quota check
    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED' }, { status: 403 });
    const creditNeeded = 2.0;
    if (quotaInfo.remaining < creditNeeded) return NextResponse.json({ error: 'QUOTA_EXCEEDED' }, { status: 403 });

    const apiKey = process.env.OPENAI_API_KEY;
    const NANONBANANA_API_KEY = process.env.NANONBANANA_API_KEY || '758a24cfaef8c64eed9164858b941ecc';
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY_MISSING' }, { status: 500 });

    // Préparer l'image
    let imageForAnalysis = sourceImage;
    if (!imageForAnalysis.startsWith('data:image/')) imageForAnalysis = `data:image/jpeg;base64,${imageForAnalysis}`;

    // Compresser l'image pour Nanonbanana
    let imageForAPI: string;
    try {
      let base64Data = sourceImage;
      if (base64Data.startsWith('data:image/')) {
        const parts = base64Data.split(',');
        if (parts.length > 1) base64Data = parts[1];
      }
      if (sharp) {
        const imageBuffer = Buffer.from(base64Data, 'base64');
        let compressedBuffer = await sharp(imageBuffer)
          .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70, mozjpeg: true })
          .toBuffer();
        if (compressedBuffer.length > 500 * 1024) {
          compressedBuffer = await sharp(imageBuffer)
            .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 60, mozjpeg: true })
            .toBuffer();
        }
        imageForAPI = compressedBuffer.toString('base64');
        console.log('[GEN] Image compressed:', (compressedBuffer.length / 1024).toFixed(0), 'KB');
      } else {
        imageForAPI = base64Data;
      }
    } catch {
      let base64Data = sourceImage;
      if (base64Data.startsWith('data:image/')) {
        const parts = base64Data.split(',');
        if (parts.length > 1) base64Data = parts[1];
      }
      imageForAPI = base64Data;
    }

    const imageDataUrl = `data:image/jpeg;base64,${imageForAPI}`;
    console.log('[GEN] Starting | user:', user.id, '| qty:', quantity);

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 1: Analyse produit + Description fond EN PARALLÈLE
    // ═══════════════════════════════════════════════════════════════
    const step1Promises: Promise<any>[] = [
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: [
            { type: 'text', text: 'Analyze this product image. Describe the product type, materials, colors, design, and key features in English. Be concise (100-200 words).' },
            { type: 'image_url', image_url: { url: imageForAnalysis, detail: 'low' } },
          ]}],
          max_tokens: 300,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Analysis failed: ${r.status}`);
        const d = await r.json();
        return d.choices?.[0]?.message?.content?.trim() || '';
      }),
    ];

    if (backgroundImage) {
      let bgDataUrl = backgroundImage;
      if (!bgDataUrl.startsWith('data:image/')) bgDataUrl = `data:image/jpeg;base64,${bgDataUrl}`;
      step1Promises.push(
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: [
              { type: 'text', text: 'Describe this background/scene for an AI image generator. Colors, textures, lighting, atmosphere. 2-3 sentences. Scene only, no products.' },
              { type: 'image_url', image_url: { url: bgDataUrl, detail: 'low' } },
            ]}],
            max_tokens: 150, temperature: 0.3,
          }),
        }).then(async (r) => {
          if (!r.ok) return null;
          const d = await r.json();
          return d.choices?.[0]?.message?.content?.trim() || null;
        }).catch(() => null)
      );
    }

    const step1Results = await Promise.all(step1Promises);
    const productVisualDescription = step1Results[0];
    const backgroundDescription: string | null = step1Results[1] || null;

    if (!productVisualDescription) {
      return NextResponse.json({ error: 'IMAGE_ANALYSIS_FAILED' }, { status: 500 });
    }
    console.log('[GEN] ✅ Step 1 done');

    // Build Nanonbanana prompt
    let nanonbananaPrompt: string;
    if (backgroundDescription) {
      nanonbananaPrompt = `Professional Etsy lifestyle product photography.
MANDATORY BACKGROUND: "${backgroundDescription}"
Rules: Keep product IDENTICAL. Place naturally in described scene. Soft lighting, depth of field. NO text/logos/watermarks.`;
    } else {
      nanonbananaPrompt = `Professional Etsy lifestyle product photography.
Rules: Keep product IDENTICAL. Create NEW cozy lifestyle background. Soft lighting, depth of field, warm atmosphere. NO text/logos/watermarks.`;
    }

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 2: Description + Titre/Tags + SOUMISSION images EN PARALLÈLE
    // (Pas de polling ici — le frontend poll via /api/check-image-status)
    // ═══════════════════════════════════════════════════════════════
    const VIEWPOINTS = ['frontal eye-level view', '45-degree angle', 'top-down view', 'close-up detail', 'wide shot', 'three-quarter view', 'low angle', 'side profile'];

    const [descResult, titleResult, ...imageSubmitResults] = await Promise.all([
      // Description
      (async () => {
        try {
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are an expert Etsy copywriter.' },
                { role: 'user', content: `Generate an Etsy product description in ENGLISH based on this product:\n\n${productVisualDescription}\n\nRules: Include 8-12 emojis, warm tone, 300-500 words. Structure: 1) Emotional hook 2) Product presentation 3) Features 4) Why buy 5) Ideal for 6) Quality 7) Care 8) CTA. Return ONLY the description.` },
              ],
              temperature: 0.7, max_tokens: 1500,
            }),
          });
          if (!r.ok) throw new Error(`${r.status}`);
          const d = await r.json();
          return d.choices?.[0]?.message?.content?.trim() || '';
        } catch { return ''; }
      })(),

      // Title + Tags + Materials
      (async () => {
        try {
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'Return valid JSON only.' },
                { role: 'user', content: `Product: ${productVisualDescription}\n\nReturn JSON: {"title":"SEO title 100-140 chars","tags":"tag1,tag2,...,tag13","materials":"mat1,mat2"}\nTitle MUST be 100-140 chars. Exactly 13 tags max 20 chars each. English only.` },
              ],
              temperature: 0.7, max_tokens: 400,
              response_format: { type: 'json_object' },
            }),
          });
          if (!r.ok) throw new Error(`${r.status}`);
          const d = await r.json();
          const parsed = JSON.parse(d.choices?.[0]?.message?.content?.trim());
          let title = parsed.title || '';
          const tags = (parsed.tags || '').split(',').map((t: string) => t.trim()).filter((t: string) => t && t.length <= 20).slice(0, 13);
          if (title.length < 100) {
            const suffixes = [' - Perfect Gift Idea', ' - Unique Handcrafted Design', ' - Modern Stylish Decor'];
            for (const s of suffixes) { if (title.length + s.length <= 140) { title += s; break; } }
          }
          return { title, tags, materials: parsed.materials || '' };
        } catch { return { title: '', tags: [] as string[], materials: '' }; }
      })(),

      // Submit images to Nanonbanana (NO polling — just get task IDs)
      ...Array.from({ length: quantity }, (_, index) => (async () => {
        try {
          const viewpoint = VIEWPOINTS[index % VIEWPOINTS.length];
          let prompt = `CAMERA ANGLE: ${viewpoint}.\n\n${nanonbananaPrompt}`;
          if (prompt.length > 1800) prompt = prompt.substring(0, 1800);

          const requestBody = {
            type: 'IMAGETOIAMGE',
            prompt,
            imageUrls: [imageDataUrl],
            image_size: aspectRatio === '16:9' ? '16:9' : aspectRatio === '9:16' ? '9:16' : '1:1',
            numImages: 1,
            callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
          };

          // Try endpoints
          const endpoints = [
            'https://api.nanobananaapi.ai/api/v1/nanobanana/generate',
            'https://api.nanobanana.com/api/v1/nanobanana/generate',
          ];
          const authFormats = [
            { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NANONBANANA_API_KEY}` },
            { 'Content-Type': 'application/json', 'X-API-Key': NANONBANANA_API_KEY, 'Authorization': `Bearer ${NANONBANANA_API_KEY}` },
          ];

          let response: Response | null = null;
          for (const endpoint of endpoints) {
            for (const headers of authFormats) {
              try {
                response = await fetch(endpoint, {
                  method: 'POST',
                  headers: headers as any,
                  body: JSON.stringify(requestBody),
                });
                if (response.status !== 403 && response.status !== 404) break;
              } catch { continue; }
            }
            if (response && response.status !== 403 && response.status !== 404) break;
          }

          if (!response || !response.ok) {
            throw new Error(`Nanonbanana submit failed: ${response?.status || 'no response'}`);
          }

          const data = await response.json();

          // Check for direct URL (rare but possible)
          const directUrl = data.data?.response?.resultImageUrl || data.data?.url || data.url;
          if (directUrl) {
            return { taskId: null, url: directUrl, index };
          }

          // Get task ID for polling
          const taskId = data.data?.task_id || data.data?.taskId || data.data?.id;
          if (!taskId) throw new Error('No taskId returned');

          console.log(`[GEN] ✅ Image ${index + 1} submitted, taskId: ${taskId}`);
          return { taskId, url: null, index };
        } catch (e: any) {
          console.error(`[GEN] ❌ Image ${index + 1} submit failed:`, e.message);
          return { taskId: null, url: null, index, error: e.message };
        }
      })()),
    ]);

    // Build results
    const description = descResult || productVisualDescription;
    const title = titleResult.title || productVisualDescription.substring(0, 140);
    const tags = titleResult.tags.length > 0 ? titleResult.tags : ['handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'];
    const materials = titleResult.materials || 'Various materials';

    // Process image results
    const imageTasks: any[] = [];
    const immediateImages: any[] = [];
    for (const result of imageSubmitResults) {
      if (result.url) {
        immediateImages.push({ id: `img-${Date.now()}-${result.index}`, url: result.url });
      } else if (result.taskId) {
        imageTasks.push({ taskId: result.taskId, index: result.index });
      }
      // Errors are just skipped
    }

    // Deduct 2 credits
    let quotaResult: any = null;
    try {
      quotaResult = await incrementAnalysisCount(user.id, creditNeeded);
      if (quotaResult?.success) console.log('[GEN] ✅ Quota deducted:', quotaResult.remaining, 'remaining');
    } catch (e: any) {
      console.error('[GEN] Quota error:', e.message);
    }

    console.log('[GEN] ✅ Done | listing OK | images:', immediateImages.length, 'ready,', imageTasks.length, 'pending');

    return NextResponse.json({
      success: true,
      listing: { title, description, tags, materials },
      images: immediateImages, // Images already available (rare)
      imageTasks, // Task IDs for frontend to poll
      // nanonbananaApiKey is handled server-side in check-image-status
      quotaUpdated: quotaResult !== null,
      ...(quotaResult?.success ? { quota: { used: quotaResult.used, remaining: quotaResult.remaining, quota: quotaResult.quota } } : {}),
    });
  } catch (error: any) {
    console.error('[GEN] ❌ Fatal:', error.message);
    return NextResponse.json({ error: 'GENERATION_ERROR', message: error.message }, { status: 500 });
  }
}
