import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// Import sharp pour compression serveur (comme generate-images)
let sharp: any;
try {
  sharp = require('sharp');
} catch (error) {
  console.warn('[QUICK GENERATE] Sharp not available');
  sharp = null;
}

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * API ROUTE - GÉNÉRATION COMBINÉE LISTING + IMAGES
 * Coût: 2.0 crédits (1 listing + 1 images)
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

    let quotaResult: any = null;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY_MISSING' }, { status: 500 });
    const NANONBANANA_API_KEY = process.env.NANONBANANA_API_KEY || '758a24cfaef8c64eed9164858b941ecc';

    // Préparer l'image pour l'analyse GPT-4o
    let imageForAnalysis = sourceImage;
    if (!imageForAnalysis.startsWith('data:image/')) imageForAnalysis = `data:image/jpeg;base64,${imageForAnalysis}`;

    // ⚠️ Compresser l'image pour Nanonbanana (MÊME logique que generate-images)
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
        console.log('[QUICK GENERATE] Compressed image:', (compressedBuffer.length / 1024).toFixed(0), 'KB');
      } else {
        imageForAPI = base64Data;
        console.log('[QUICK GENERATE] Sharp unavailable, using raw image');
      }
    } catch (e: any) {
      console.error('[QUICK GENERATE] Compression error:', e.message);
      let base64Data = sourceImage;
      if (base64Data.startsWith('data:image/')) {
        const parts = base64Data.split(',');
        if (parts.length > 1) base64Data = parts[1];
      }
      imageForAPI = base64Data;
    }

    const imageDataUrl = `data:image/jpeg;base64,${imageForAPI}`;
    console.log('[QUICK GENERATE] Starting | user:', user.id, '| qty:', quantity, '| bg:', !!backgroundImage);

    // ═══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 1: Analyse produit + Description fond EN PARALLÈLE
    // ═══════════════════════════════════════════════════════════════════════════
    const step1Promises: Promise<any>[] = [
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this product image. Describe the product type, materials, colors, design, and key features in English. Be concise (100-200 words).' },
              { type: 'image_url', image_url: { url: imageForAnalysis, detail: 'low' } },
            ],
          }],
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
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Describe this background/scene for an AI image generator. Colors, textures, lighting, atmosphere. 2-3 sentences. Scene only, no products.' },
                { type: 'image_url', image_url: { url: bgDataUrl, detail: 'low' } },
              ],
            }],
            max_tokens: 150,
            temperature: 0.3,
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
    console.log('[QUICK GENERATE] ✅ Step1 done | product:', productVisualDescription.substring(0, 60), '| bg:', backgroundDescription ? 'yes' : 'no');

    // Prompt Nanonbanana
    let nanonbananaPrompt: string;
    if (backgroundDescription) {
      nanonbananaPrompt = `Professional Etsy lifestyle product photography.
MANDATORY BACKGROUND: "${backgroundDescription}"
Rules: Keep product IDENTICAL. Place naturally in described scene. Soft lighting, depth of field. NO text/logos/watermarks.`;
    } else {
      nanonbananaPrompt = `Professional Etsy lifestyle product photography.
Rules: Keep product IDENTICAL. Create NEW cozy lifestyle background. Soft lighting, depth of field, warm atmosphere. NO text/logos/watermarks.`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 2: Description + Titre/Tags + Images EN PARALLÈLE
    // ═══════════════════════════════════════════════════════════════════════════
    const [descriptionResult, titleTagsResult, imagesResult] = await Promise.all([
      // 2a. Description Etsy
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
          return { success: true, description: d.choices?.[0]?.message?.content?.trim() || '' };
        } catch (e: any) {
          return { success: false, description: '', error: e.message };
        }
      })(),

      // 2b. Titre + Tags + Matériaux
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
          return { success: true, title, tags, materials: parsed.materials || '' };
        } catch (e: any) {
          return { success: false, title: '', tags: [], materials: '', error: e.message };
        }
      })(),

      // 2c. Images Nanonbanana (MÊME logique de polling que generate-images)
      (async () => {
        try {
          const VIEWPOINTS = ['frontal eye-level view', '45-degree angle', 'top-down view', 'close-up detail', 'wide shot', 'three-quarter view', 'low angle', 'side profile'];

          const genPromises = Array.from({ length: quantity }, async (_, index) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s par image

            try {
              const viewpoint = VIEWPOINTS[index % VIEWPOINTS.length];
              let prompt = `CAMERA ANGLE: ${viewpoint}.\n\n${nanonbananaPrompt}`;
              if (prompt.length > 1800) prompt = prompt.substring(0, 1800);

              console.log(`[QUICK GENERATE] Image ${index + 1}/${quantity} submitting...`);

              // ⚠️ Essayer PLUSIEURS endpoints et auth formats (MÊME que generate-images)
              const endpoints = [
                'https://api.nanobananaapi.ai/api/v1/nanobanana/generate',
                'https://api.nanobanana.com/api/v1/nanobanana/generate',
              ];
              const authFormats = [
                { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NANONBANANA_API_KEY}` },
                { 'Content-Type': 'application/json', 'X-API-Key': NANONBANANA_API_KEY },
                { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NANONBANANA_API_KEY}`, 'X-API-Key': NANONBANANA_API_KEY },
              ];

              const requestBody = {
                type: 'IMAGETOIAMGE',
                prompt,
                imageUrls: [imageDataUrl],
                image_size: aspectRatio === '16:9' ? '16:9' : aspectRatio === '9:16' ? '9:16' : '1:1',
                numImages: 1,
                callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
              };

              let nanonbananaResponse: Response | null = null;

              for (const endpoint of endpoints) {
                for (const headers of authFormats) {
                  try {
                    nanonbananaResponse = await fetch(endpoint, {
                      method: 'POST',
                      headers: headers as any,
                      body: JSON.stringify(requestBody),
                      signal: controller.signal,
                    });
                    if (nanonbananaResponse.status !== 403 && nanonbananaResponse.status !== 404) break;
                  } catch { continue; }
                }
                if (nanonbananaResponse && nanonbananaResponse.status !== 403 && nanonbananaResponse.status !== 404) break;
              }

              if (!nanonbananaResponse || !nanonbananaResponse.ok) {
                const errText = nanonbananaResponse ? await nanonbananaResponse.text().catch(() => '') : 'No response';
                throw new Error(`Nanonbanana ${nanonbananaResponse?.status || 'ERR'}: ${errText.substring(0, 200)}`);
              }

              const data = await nanonbananaResponse.json();
              console.log('[QUICK GENERATE] Nanonbanana response code:', data.code);

              // Check for direct URL
              let imageUrl = data.data?.response?.resultImageUrl || data.data?.url || data.url;
              if (imageUrl) {
                console.log(`[QUICK GENERATE] ✅ Image ${index + 1} direct URL`);
                return { id: `img-${Date.now()}-${index}`, url: imageUrl };
              }

              // Poll for task result (MÊME timing que generate-images: 30 × 2s = 60s max)
              const taskId = data.data?.task_id || data.data?.taskId || data.data?.id;
              if (!taskId) throw new Error('No taskId or URL');

              console.log(`[QUICK GENERATE] Polling task ${taskId}...`);
              const maxPolls = 20; // 20 × 2s = 40s max de polling
              const pollInterval = 2000;

              for (let i = 0; i < maxPolls; i++) {
                await new Promise(r => setTimeout(r, pollInterval));

                try {
                  // Alterner entre les deux formats de paramètre
                  const paramName = i % 2 === 0 ? 'taskId' : 'task_id';
                  const statusResp = await fetch(
                    `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?${paramName}=${taskId}`,
                    { headers: { 'Authorization': `Bearer ${NANONBANANA_API_KEY}`, 'Content-Type': 'application/json' } }
                  );

                  if (statusResp.ok) {
                    const statusData = await statusResp.json();
                    
                    if (statusData.code === 200 || statusData.code === 0 || statusData.msg === 'success') {
                      const url = statusData.data?.response?.resultImageUrl
                        || statusData.data?.response?.originImageUrl
                        || statusData.data?.url || statusData.data?.image_url
                        || statusData.data?.imageUrl || statusData.url || statusData.image_url;

                      if (url) {
                        console.log(`[QUICK GENERATE] ✅ Image ${index + 1} found on poll ${i + 1}`);
                        return { id: `img-${Date.now()}-${index}`, url };
                      }
                    }
                    
                    const status = statusData.data?.status || statusData.data?.state;
                    if (i % 5 === 0) console.log(`[QUICK GENERATE] Poll ${i + 1}/${maxPolls}: status=${status}`);
                  }
                } catch { /* continue polling */ }
              }

              // Dernière tentative
              try {
                const lastResp = await fetch(
                  `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?task_id=${taskId}`,
                  { headers: { 'Authorization': `Bearer ${NANONBANANA_API_KEY}`, 'Content-Type': 'application/json' } }
                );
                if (lastResp.ok) {
                  const lastData = await lastResp.json();
                  const lastUrl = lastData.data?.response?.resultImageUrl || lastData.data?.url || lastData.url;
                  if (lastUrl) {
                    console.log(`[QUICK GENERATE] ✅ Image ${index + 1} found on last attempt`);
                    return { id: `img-${Date.now()}-${index}`, url: lastUrl };
                  }
                }
              } catch { /* ignore */ }

              throw new Error(`Polling failed for task ${taskId} after ${maxPolls} attempts`);
            } catch (err: any) {
              console.error(`[QUICK GENERATE] Image ${index + 1} failed:`, err.message);
              return { id: `img-err-${Date.now()}-${index}`, url: '', error: err.message };
            } finally {
              clearTimeout(timeoutId);
            }
          });

          const results = await Promise.allSettled(genPromises);
          const images = results.map((r, i) =>
            r.status === 'fulfilled' ? r.value : { id: `img-err-${Date.now()}-${i}`, url: '', error: r.reason?.message }
          );
          const valid = images.filter(img => img.url && img.url.startsWith('http') && !img.error);
          console.log(`[QUICK GENERATE] Images: ${valid.length}/${quantity} valid`);
          return { success: valid.length > 0, images: valid, error: valid.length === 0 ? 'No images generated' : undefined };
        } catch (e: any) {
          console.error('[QUICK GENERATE] Image gen error:', e.message);
          return { success: false, images: [], error: e.message };
        }
      })(),
    ]);

    // Résultats
    const description = descriptionResult.success ? descriptionResult.description : (productVisualDescription || '');
    const title = titleTagsResult.success ? titleTagsResult.title : (productVisualDescription?.substring(0, 140) || 'Product');
    const tags = titleTagsResult.success ? titleTagsResult.tags : ['handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'];
    const materials = titleTagsResult.success ? titleTagsResult.materials : 'Various materials';
    const finalImages = imagesResult.success ? imagesResult.images : [];

    console.log('[QUICK GENERATE] Results:', { title: title.length, desc: description.length, tags: tags.length, images: finalImages.length });

    // Si aucune image → listing seul (1 crédit)
    if (finalImages.length === 0) {
      try { await incrementAnalysisCount(user.id, 1.0); } catch {}
      return NextResponse.json({
        success: true,
        warning: 'La génération d\'images a échoué. Le listing a été généré. Réessayez depuis l\'onglet Images.',
        listing: { title, description, tags, materials },
        images: [],
        imagesError: imagesResult.error,
      });
    }

    // Listing + images → 2 crédits
    try {
      quotaResult = await incrementAnalysisCount(user.id, creditNeeded);
      if (quotaResult?.success) console.log('[QUICK GENERATE] ✅ Quota:', { used: quotaResult.used, remaining: quotaResult.remaining });
    } catch (e: any) {
      console.error('[QUICK GENERATE] Quota error:', e.message);
    }

    return NextResponse.json({
      success: true,
      listing: { title, description, tags, materials },
      images: finalImages,
      quotaUpdated: quotaResult !== null,
      ...(quotaResult?.success ? { quota: { used: quotaResult.used, remaining: quotaResult.remaining, quota: quotaResult.quota } } : {}),
    });
  } catch (error: any) {
    console.error('[QUICK GENERATE] ❌ Fatal:', error.message);
    return NextResponse.json({ error: 'GENERATION_ERROR', message: error.message }, { status: 500 });
  }
}
