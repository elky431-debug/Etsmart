import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * API ROUTE - GÉNÉRATION COMBINÉE LISTING + IMAGES
 * Coût total : 2.0 crédits (1 pour le listing + 1 pour les images)
 * 
 * OPTIMISÉ pour rester sous le timeout Netlify (~50s)
 * - Étape 1: Analyse produit + description fond EN PARALLÈLE (~5s)
 * - Étape 2: Description + titre/tags + images EN PARALLÈLE (~25-35s)
 */
export async function POST(request: NextRequest) {
  try {
    // 🔒 Auth
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' }, { status: 401 });
    }

    // Parse body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'INVALID_REQUEST', message: 'Invalid request body' }, { status: 400 });
    }

    const { sourceImage, backgroundImage, quantity = 1, aspectRatio = '1:1' } = body;

    if (!sourceImage) {
      return NextResponse.json({ error: 'MISSING_IMAGE', message: 'Source image is required' }, { status: 400 });
    }

    // Check quota
    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    
    if (quotaInfo.status !== 'active') {
      return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required.' }, { status: 403 });
    }

    const creditNeeded = 2.0;
    if (quotaInfo.remaining < creditNeeded) {
      return NextResponse.json({ error: 'QUOTA_EXCEEDED', message: `Insufficient quota. Need ${creditNeeded} credits.` }, { status: 403 });
    }

    let quotaResult: { success: boolean; used: number; quota: number; remaining: number; error?: string } | null = null;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY_MISSING', message: 'OpenAI API key is not configured' }, { status: 500 });
    }

    const NANONBANANA_API_KEY = process.env.NANONBANANA_API_KEY || '758a24cfaef8c64eed9164858b941ecc';

    // Préparer l'image (déjà compressée côté frontend)
    let imageForAnalysis = sourceImage;
    if (!imageForAnalysis.startsWith('data:image/')) {
      imageForAnalysis = `data:image/jpeg;base64,${imageForAnalysis}`;
    }

    // Extraire le base64 brut pour Nanonbanana
    let imageBase64 = sourceImage;
    if (imageBase64.startsWith('data:image/')) {
      const parts = imageBase64.split(',');
      if (parts.length > 1) imageBase64 = parts[1];
    }
    const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;

    console.log('[QUICK GENERATE] Starting for user:', user.id, '| quantity:', quantity, '| bg:', !!backgroundImage);

    // ═══════════════════════════════════════════════════════════════════════════════
    // ÉTAPE 1: Analyse produit + Description fond EN PARALLÈLE (gain ~5s)
    // ═══════════════════════════════════════════════════════════════════════════════
    const step1Promises: Promise<any>[] = [
      // 1a. Analyser le produit
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this product image. Describe the product type, materials, colors, design, and key features in English. Be concise but detailed (100-200 words).' },
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

    // 1b. Décrire le fond (si fourni) EN PARALLÈLE avec l'analyse produit
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
                { type: 'text', text: 'Describe this background/scene for an AI image generator. Focus on colors, textures, lighting, atmosphere, environment. 2-3 sentences. Only the scene, no products.' },
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
      return NextResponse.json({ error: 'IMAGE_ANALYSIS_FAILED', message: 'Failed to analyze product image' }, { status: 500 });
    }

    console.log('[QUICK GENERATE] ✅ Step 1 done. Product:', productVisualDescription.substring(0, 80) + '...', backgroundDescription ? `| BG: ${backgroundDescription.substring(0, 60)}...` : '');

    // ═══════════════════════════════════════════════════════════════════════════════
    // ÉTAPE 2: Description + Titre/Tags + Images EN PARALLÈLE
    // ═══════════════════════════════════════════════════════════════════════════════

    // Construire le prompt Nanonbanana
    let nanonbananaPrompt: string;
    if (backgroundDescription) {
      nanonbananaPrompt = `Professional Etsy lifestyle product photography.

MANDATORY BACKGROUND: "${backgroundDescription}"
The background MUST look like the described scene.

Rules:
- Keep the product EXACTLY IDENTICAL (shape, colors, textures, details).
- Place product naturally in that scene with matching lighting and shadows.
- Soft natural lighting, depth of field, warm Etsy feel.
- NO text, logos, watermarks, badges, borders.
- Ultra-realistic professional product photography.`;
    } else {
      nanonbananaPrompt = `Professional Etsy lifestyle product photography.

Rules:
- Keep the product EXACTLY IDENTICAL (shape, colors, textures, details).
- Create a NEW cozy lifestyle background.
- Soft natural lighting, depth of field, warm and inviting atmosphere.
- NO text, logos, watermarks, badges, borders.
- Ultra-realistic premium product photography.`;
    }

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
                { role: 'user', content: `Generate an Etsy product description in ENGLISH based on this product:\n\n${productVisualDescription}\n\nRules: Include 8-12 emojis, warm tone, 300-500 words, ready to copy-paste. Structure: 1) Emotional hook 2) Product presentation 3) Features & benefits 4) Why buy it 5) Ideal for... 6) Quality 7) Care 8) Call-to-action. Return ONLY the description text.` },
              ],
              temperature: 0.7,
              max_tokens: 1500,
            }),
          });
          if (!r.ok) throw new Error(`${r.status}`);
          const d = await r.json();
          return { success: true, description: d.choices?.[0]?.message?.content?.trim() || '' };
        } catch (e: any) {
          console.error('[QUICK GENERATE] Description failed:', e.message);
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
                { role: 'system', content: 'You are an Etsy SEO expert. Return valid JSON only.' },
                { role: 'user', content: `Generate for this product:\n${productVisualDescription}\n\nReturn JSON: {"title": "SEO title 100-140 chars", "tags": "tag1, tag2, ..., tag13", "materials": "mat1, mat2, mat3"}\n\nTitle MUST be 100-140 characters. Exactly 13 tags (max 20 chars each). English only.` },
              ],
              temperature: 0.7,
              max_tokens: 400,
              response_format: { type: 'json_object' },
            }),
          });
          if (!r.ok) throw new Error(`${r.status}`);
          const d = await r.json();
          const content = d.choices?.[0]?.message?.content?.trim();
          const parsed = JSON.parse(content);
          let title = parsed.title || '';
          const tags = (parsed.tags || '').split(',').map((t: string) => t.trim()).filter((t: string) => t && t.length <= 20).slice(0, 13);
          const materials = parsed.materials || '';
          
          // Quick title padding if too short
          if (title && title.length < 100) {
            const suffixes = [' - Perfect Gift Idea for Any Occasion', ' - Unique Handcrafted Home Decor', ' - Modern Design Stylish Aesthetic'];
            for (const s of suffixes) {
              if (title.length + s.length <= 140 && title.length < 100) { title += s; break; }
            }
          }
          return { success: true, title, tags, materials };
        } catch (e: any) {
          console.error('[QUICK GENERATE] Title/tags failed:', e.message);
          return { success: false, title: '', tags: [], materials: '', error: e.message };
        }
      })(),

      // 2c. Images Nanonbanana
      (async () => {
        try {
          const VIEWPOINTS = ['frontal eye-level view', '45-degree angle view', 'top-down overhead view', 'close-up detail view', 'wide environmental shot', 'three-quarter view', 'low angle view', 'side profile view'];
          
          const generationPromises = Array.from({ length: quantity }, async (_, index) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 40000); // 40s per image
            
            try {
              const viewpoint = VIEWPOINTS[index % VIEWPOINTS.length];
              let prompt = `CAMERA ANGLE: ${viewpoint}.\n\n${nanonbananaPrompt}`;
              if (prompt.length > 1800) prompt = prompt.substring(0, 1800);
              
              console.log(`[QUICK GENERATE] Image ${index + 1}/${quantity} - prompt: ${prompt.length} chars`);

              const requestBody = {
                type: 'IMAGETOIAMGE',
                prompt,
                imageUrls: [imageDataUrl],
                image_size: aspectRatio === '16:9' ? '16:9' : aspectRatio === '9:16' ? '9:16' : '1:1',
                numImages: 1,
                callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
              };

              const nanonbananaResponse = await fetch('https://api.nanobananaapi.ai/api/v1/nanobanana/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NANONBANANA_API_KEY}` },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
              });

              if (!nanonbananaResponse.ok) {
                const errText = await nanonbananaResponse.text().catch(() => '');
                throw new Error(`Nanonbanana ${nanonbananaResponse.status}: ${errText.substring(0, 200)}`);
              }

              const nanonbananaData = await nanonbananaResponse.json();
              console.log('[QUICK GENERATE] Nanonbanana response code:', nanonbananaData.code);

              // Check for direct URL first
              let imageUrl = nanonbananaData.data?.response?.resultImageUrl
                || nanonbananaData.data?.url || nanonbananaData.url || nanonbananaData.image_url;

              if (imageUrl) {
                console.log(`[QUICK GENERATE] ✅ Image ${index + 1} direct URL found`);
                return { id: `img-${Date.now()}-${index}`, url: imageUrl };
              }

              // Need to poll for task
              const taskId = nanonbananaData.data?.task_id || nanonbananaData.data?.taskId || nanonbananaData.data?.id;
              if (!taskId) throw new Error('No taskId or URL in response');

              console.log(`[QUICK GENERATE] Polling task ${taskId}...`);

              // Poll with increasing intervals: 3s, 3s, 4s, 4s, 5s, 5s = 24s total max
              const pollDelays = [3000, 3000, 4000, 4000, 5000, 5000];
              let finalUrl: string | null = null;

              for (let i = 0; i < pollDelays.length && !finalUrl; i++) {
                await new Promise(resolve => setTimeout(resolve, pollDelays[i]));
                
                try {
                  // Try both parameter formats
                  const paramName = i % 2 === 0 ? 'taskId' : 'task_id';
                  const statusResponse = await fetch(
                    `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?${paramName}=${taskId}`,
                    { headers: { 'Authorization': `Bearer ${NANONBANANA_API_KEY}`, 'Content-Type': 'application/json' } }
                  );

                  if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    const url = statusData.data?.response?.resultImageUrl
                      || statusData.data?.response?.originImageUrl
                      || statusData.data?.url || statusData.data?.image_url || statusData.data?.imageUrl
                      || statusData.url || statusData.image_url;
                    
                    if (url) {
                      finalUrl = url;
                      console.log(`[QUICK GENERATE] ✅ Image ${index + 1} found on poll ${i + 1}`);
                    } else {
                      const status = statusData.data?.status || statusData.data?.state;
                      console.log(`[QUICK GENERATE] Poll ${i + 1}/${pollDelays.length}: status=${status}`);
                    }
                  }
                } catch (pollErr) {
                  console.log(`[QUICK GENERATE] Poll ${i + 1} error, continuing...`);
                }
              }

              if (!finalUrl) throw new Error(`Polling failed for task ${taskId}`);
              return { id: `img-${Date.now()}-${index}`, url: finalUrl };
            } catch (err: any) {
              console.error(`[QUICK GENERATE] Image ${index + 1} failed:`, err.message);
              return { id: `img-error-${Date.now()}-${index}`, url: '', error: err.message };
            } finally {
              clearTimeout(timeoutId);
            }
          });

          const results = await Promise.allSettled(generationPromises);
          const images = results.map((r, i) => {
            if (r.status === 'fulfilled') return r.value;
            return { id: `img-error-${Date.now()}-${i}`, url: '', error: r.reason?.message || 'Unknown' };
          });

          const valid = images.filter(img => img.url && img.url.startsWith('http') && !img.error);
          console.log(`[QUICK GENERATE] Images: ${valid.length}/${quantity} valid`);
          
          return { success: valid.length > 0, images: valid, error: valid.length === 0 ? 'No images generated' : undefined };
        } catch (e: any) {
          console.error('[QUICK GENERATE] Image generation error:', e.message);
          return { success: false, images: [], error: e.message };
        }
      })(),
    ]);

    // ═══════════════════════════════════════════════════════════════════════════════
    // RÉSULTATS
    // ═══════════════════════════════════════════════════════════════════════════════
    let description = descriptionResult.success ? descriptionResult.description : (productVisualDescription || '');
    let title = titleTagsResult.success ? titleTagsResult.title : (productVisualDescription?.substring(0, 140) || 'Product');
    let tags = titleTagsResult.success ? titleTagsResult.tags : ['handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'];
    let materials = titleTagsResult.success ? titleTagsResult.materials : 'Various materials';
    const finalImages = imagesResult.success ? imagesResult.images : [];

    console.log('[QUICK GENERATE] Results:', { title: title.length, desc: description.length, tags: tags.length, images: finalImages.length });

    // Si aucune image, déduire 1 seul crédit (listing uniquement)
    if (finalImages.length === 0) {
      console.warn('[QUICK GENERATE] ⚠️ No images - listing only');
      try {
        await incrementAnalysisCount(user.id, 1.0);
      } catch (e: any) {
        console.error('[QUICK GENERATE] Quota deduction failed:', e.message);
      }
      
      return NextResponse.json({
        success: true,
        warning: 'La génération d\'images a échoué. Le listing a été généré avec succès. Réessayez depuis l\'onglet Images.',
        listing: { title, description, tags, materials },
        images: [],
        imagesError: imagesResult.error || 'Image generation failed',
      });
    }

    // Déduire 2 crédits
    try {
      quotaResult = await incrementAnalysisCount(user.id, creditNeeded);
      if (!quotaResult.success) {
        console.error('[QUICK GENERATE] Quota deduction failed:', quotaResult.error);
      } else {
        console.log('[QUICK GENERATE] ✅ Quota updated:', { used: quotaResult.used, remaining: quotaResult.remaining });
      }
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
    console.error('[QUICK GENERATE] ❌ Fatal error:', error.message);
    return NextResponse.json(
      { error: 'GENERATION_ERROR', message: `Failed: ${error.message}` },
      { status: 500 }
    );
  }
}
