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

    // ── Parse body ───────────────────────────────────────────
    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Format de requête invalide' }, { status: 400 }); }

    const { sourceImage, backgroundImage, quantity = 1, aspectRatio = '1:1', customInstructions, productTitle, tags, materials, engine, style, skipCreditDeduction, productContext } = body;
    if (!sourceImage) return NextResponse.json({ error: 'Image source requise' }, { status: 400 });
    if (quantity < 1 || quantity > 10) return NextResponse.json({ error: 'Quantité entre 1 et 10' }, { status: 400 });

    // Quand skipCreditDeduction est true (ex: génération rapide), on ne vérifie pas le quota restant ni on ne déduit (déjà fait côté client).
    if (!skipCreditDeduction) {
      if (quotaInfo.remaining < 1) {
        return NextResponse.json({ error: 'QUOTA_EXCEEDED', message: 'Crédits insuffisants. Il te faut au moins 1 crédit pour générer des images.' }, { status: 403 });
      }
    }

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const NANO_KEY = process.env.NANONBANANA_API_KEY;
    const useGemini = !!GEMINI_KEY;

    if (!useGemini && !NANO_KEY) {
      console.error('[IMAGE GEN] Aucune clé image (GEMINI_API_KEY ou NANONBANANA_API_KEY)');
      return NextResponse.json(
        { error: 'SERVER_CONFIG_ERROR', message: 'Clé API image manquante. Définissez GEMINI_API_KEY ou NANONBANANA_API_KEY.' },
        { status: 500 },
      );
    }

    // ── GEMINI (image + texte) : moteur prioritaire (3 refs -> 5 angles) ──
    if (useGemini) {
      const productDesc = (productTitle && String(productTitle).trim())
        ? String(productTitle).trim().substring(0, 200)
        : 'product from the listing';
      const tagsList = Array.isArray(tags) ? tags.slice(0, 15).join(', ') : '';
      const materialsStr = (materials && String(materials).trim()) ? String(materials).trim().substring(0, 150) : '';
      const keywordPart = [tagsList && `Keywords: ${tagsList}`, materialsStr && `Materials: ${materialsStr}`].filter(Boolean).join('. ') || '';
      const styleHint =
        style === 'studio'
          ? 'Studio product photo on clean neutral background.'
          : style === 'lifestyle'
            ? 'Lifestyle scene with product in a real environment.'
            : style === 'illustration'
              ? 'Clean digital illustration style.'
              : 'Photorealistic product photo, soft natural light, high-end Etsy style.';

      const refInputs: string[] = [];
      if (typeof sourceImage === 'string' && sourceImage.trim().length > 0) {
        refInputs.push(sourceImage.startsWith('data:image/') ? sourceImage : `data:image/jpeg;base64,${sourceImage}`);
      }
      if (productContext && typeof productContext === 'object' && Array.isArray(productContext.referenceImages)) {
        for (const ref of productContext.referenceImages.slice(0, 2)) {
          if (typeof ref === 'string' && ref.trim().length > 0) refInputs.push(ref.trim());
        }
      }

      const toInlineImagePart = async (input: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> => {
        try {
          const raw = input.trim();
          const dataUrl = raw.startsWith('data:image/') ? raw : `data:image/jpeg;base64,${raw}`;
          const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (!m) return null;
          let mime = m[1];
          let b64 = m[2];
          if (sharp) {
            const buf = Buffer.from(b64, 'base64');
            // Compression légère pour accélérer et éviter des requêtes trop lourdes
            const c = await sharp(buf).resize(768, 768, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
            mime = 'image/jpeg';
            b64 = c.toString('base64');
          }
          return { inlineData: { mimeType: mime, data: b64 } };
        } catch {
          return null;
        }
      };

      const inlineImageParts = (await Promise.all(refInputs.slice(0, 3).map(toInlineImagePart))).filter((p): p is { inlineData: { mimeType: string; data: string } } => !!p);
      if (inlineImageParts.length === 0) {
        return NextResponse.json({
          success: false,
          imageTaskIds: [],
          imageDataUrls: [],
          error: 'IMAGE_SUBMIT_FAILED',
          message: 'Gemini n\'a reçu aucune image de référence valide.',
        });
      }

      const engineSafe: 'flash' | 'pro' = engine === 'pro' ? 'pro' : 'flash';
      const realismBoost =
        engineSafe === 'pro'
          ? 'High-fidelity pro render: crisp details, natural micro-textures, realistic global illumination, physically plausible contact shadows and reflections, accurate perspective and scale.'
          : 'Fast realistic render with clean natural lighting.';
      const baseContext = `Product: ${productDesc}.${keywordPart ? ` ${keywordPart}.` : ''} ${styleHint} ${realismBoost} CRITICAL: Use ONLY the provided reference images as the product source of truth. Keep EXACT same shape, silhouette, geometry, proportions, colors and materials. Never replace the product with another object/person. The product must be naturally integrated in the scene (no sticker/cutout look): proper contact shadow on surfaces, coherent occlusion, coherent perspective, coherent depth of field, coherent color temperature. Only change scene/background/camera angle.`;
      const IMAGE_PROMPTS_GEMINI = [
        `${baseContext} IMAGE 1: wide contextual shot with premium Etsy realism, clean composition, natural light, strong depth and crisp details. NO text, NO measurement overlay.`,
        `${baseContext} IMAGE 2: medium shot centered on product, balanced background, high sharpness and realistic shadows/reflections. NO text, NO measurement overlay.`,
        `${baseContext} IMAGE 3: close-up detail shot (materials, texture, finishes), ultra clean and sharp focus, realistic micro-textures. NO text, NO measurement overlay.`,
        `${baseContext} IMAGE 4 (MANDATORY MEASUREMENTS): create a clean product-sheet style image with visible dimension arrows and numeric labels on the product. If a reference image includes measurements, replicate that measurement style and keep it clearly readable. This image MUST include measurements (do not return a plain lifestyle shot).`,
        `${baseContext} IMAGE 5: strategic conversion-focused angle, premium realistic lighting, coherent perspective, very clean output. NO text, NO measurement overlay.`,
      ];
      const numImages = Math.min(Math.max(quantity, 1), 5);
      const promptsToUse = IMAGE_PROMPTS_GEMINI.slice(0, numImages);
      const modelCandidates =
        engineSafe === 'pro'
          ? [
              'gemini-3-pro-image-preview',
              'nano-banana-pro-preview',
              'gemini-3.1-flash-image-preview',
              'gemini-2.5-flash-image',
            ]
          : [
              'gemini-2.5-flash-image',
              'gemini-3.1-flash-image-preview',
              'gemini-3-pro-image-preview',
              'nano-banana-pro-preview',
            ];
      console.log(`[IMAGE GEN] Gemini engine=${engineSafe}, refs=${inlineImageParts.length}, models=${modelCandidates.join(',')}`);

      const generateOne = async (prompt: string): Promise<string | null> => {
        const imagePartSets = [
          inlineImageParts,
          [inlineImageParts[0]].filter(Boolean),
        ];
        for (const partsForAttempt of imagePartSets) {
          for (const model of modelCandidates) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY! },
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [{ text: prompt }, ...partsForAttempt],
                  },
                ],
                generationConfig: {
                  responseModalities: ['TEXT', 'IMAGE'],
                },
              }),
            });
            if (!res.ok) {
              const t = await res.text().catch(() => '');
              console.warn(`[IMAGE GEN] Gemini ${model} non-ok:`, res.status, t.substring(0, 180));
              continue;
            }
            const data = await res.json();
            const parts = data?.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              const b64 = part?.inlineData?.data;
              const mime = part?.inlineData?.mimeType || 'image/png';
              if (typeof b64 === 'string' && b64.length > 100) {
                return `data:${mime};base64,${b64}`;
              }
            }
          } catch (e: any) {
            console.warn(`[IMAGE GEN] Gemini ${model} error:`, e?.message || e);
          }
        }
        }
        return null;
      };

      try {
        const imageDataUrls = (await Promise.all(promptsToUse.map((p) => generateOne(p)))).filter((u): u is string => !!u);
        if (imageDataUrls.length === 0) {
          return NextResponse.json({
            success: false,
            imageTaskIds: [],
            imageDataUrls: [],
            error: 'IMAGE_SUBMIT_FAILED',
            message: 'Gemini n\'a pas renvoyé d\'image. Vérifie la clé et les permissions image generation.',
          });
        }
        if (!skipCreditDeduction) {
          try {
            await incrementAnalysisCount(user.id, 1.0);
          } catch (e: any) {
            console.error(`[IMAGE GEN] Credit deduction error: ${e.message}`);
          }
        }
        console.log(`[IMAGE GEN] Gemini image-edit: ${imageDataUrls.length} image(s) in ${Date.now() - startTime}ms`);
        return NextResponse.json({
          success: true,
          imageTaskIds: [],
          imageDataUrls,
        });
      } catch (e: any) {
        console.error('[IMAGE GEN] Gemini fatal:', e.message);
        const raw = (e?.message || '').toString();
        const isQuota = /quota|exceeded|limit/i.test(raw);
        return NextResponse.json({
          success: false,
          imageTaskIds: [],
          imageDataUrls: [],
          error: isQuota ? 'QUOTA_EXCEEDED' : 'IMAGE_SUBMIT_FAILED',
          message: isQuota
            ? 'Crédits insuffisants. Passe à un plan supérieur ou attends le prochain cycle.'
            : (raw || 'Erreur Gemini image generation.'),
        });
      }
    }

    // ── Compress source image (NanoBanana) ────────────────────────────────
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

    // Respect the engine selected in the UI (flash/pro).
    const engineSafe: 'flash' | 'pro' = engine === 'pro' ? 'pro' : 'flash';

    // Style presets pour moduler le rendu
    const STYLE_SUFFIX: Record<string, string> = {
      realistic: ' Style: photo produit ultra réaliste, éclairage naturel doux, rendu Etsy haut de gamme.',
      studio: ' Style: photo studio produit sur fond neutre propre, lumière contrôlée, ombres douces.',
      lifestyle: ' Style: scène lifestyle avec le produit dans un environnement réel cohérent, mise en scène naturelle.',
      illustration: ' Style: illustration digitale propre, légèrement stylisée, couleurs harmonieuses, mais produit parfaitement reconnaissable.',
    };

    // ── Build prompt ──
    const tagsStr = Array.isArray(tags) && tags.length ? ` Tags / mots-clés : ${tags.slice(0, 15).join(', ')}.` : '';
    const materialsStrNano = (materials && String(materials).trim()) ? ` Matériaux : ${String(materials).trim().substring(0, 120)}.` : '';
    const productContextText = (productTitle && String(productTitle).trim()
      ? `Nous générons les visuels pour un produit Etsy : ${String(productTitle).trim().substring(0, 140)}.`
      : 'Nous générons les visuels pour un produit Etsy à partir de la photo de référence.')
      + tagsStr
      + materialsStrNano;

    const produitRef = (productTitle && String(productTitle).trim()) ? String(productTitle).trim().substring(0, 80) : 'le produit';
    const reglesCommunes = `RÈGLE ABSOLUE : l'objet principal (${produitRef}) doit garder sa FORME EXACTE et ses COULEURS EXACTES. Rond reste rond, ovale reste ovale, courbe reste courbe—ne jamais le rendre carré ou rectangulaire. Même forme, mêmes proportions, mêmes couleurs, mêmes matières. Tu ne modifies que l'arrière-plan et le décor. Rendu réaliste, Etsy, cosy, professionnel. Format carré.`;

    const IMAGE_PROMPTS = [
      `${productContextText} IMAGE 1 – VUE ÉLOIGNÉE : plan large, produit dans son environnement complet, contexte et ambiance. ${reglesCommunes}`,
      `${productContextText} IMAGE 2 – ANGLE INTERMÉDIAIRE : produit au centre, environnement visible. ${reglesCommunes}`,
      `${productContextText} IMAGE 3 – ZOOM DÉTAIL : gros plan sur le produit, texture et finitions. ${reglesCommunes}`,
      `${productContextText} IMAGE 4 – MENSURATIONS : dimensions clairement visibles, style fiche produit. ${reglesCommunes}`,
      `${productContextText} IMAGE 5 – IMAGE STRATÉGIQUE : angle ou mise en situation à valeur ajoutée. ${reglesCommunes}`,
    ];
    const extraInstructions = (customInstructions && customInstructions.trim()) ? customInstructions.trim() : '';

    // ── Images de référence (contexte) : 1 principale + jusqu'à 2 en plus (compressées si data URL) ──
    const baseImageUrls: string[] = [imageDataUrl];
    if (productContext && typeof productContext === 'object' && Array.isArray(productContext.referenceImages)) {
      for (const ref of productContext.referenceImages.slice(0, 2)) {
        if (typeof ref !== 'string' || !ref.trim()) continue;
        const trimmed = ref.trim();
        if (trimmed.startsWith('data:image/')) {
          try {
            const base64Part = trimmed.includes(',') ? trimmed.split(',')[1] : trimmed;
            const buf = Buffer.from(base64Part, 'base64');
            if (buf.length > 300 * 1024 && sharp) {
              const c = await sharp(buf).resize(320, 320, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 60 }).toBuffer();
              baseImageUrls.push(`data:image/jpeg;base64,${c.toString('base64')}`);
            } else {
              baseImageUrls.push(trimmed);
            }
          } catch {
            baseImageUrls.push(trimmed);
          }
        } else {
          baseImageUrls.push(trimmed);
        }
      }
    }
    const payloadSize = baseImageUrls.reduce((s, u) => s + u.length, 0);
    console.log(`[IMAGE GEN] Setup done in ${Date.now() - startTime}ms, submitting ${quantity} image(s), refs: ${baseImageUrls.length}, payload: ${(payloadSize / 1024).toFixed(0)}KB`);

    const sizeMap: Record<string, string> = { '16:9': '16:9', '9:16': '9:16', '4:3': '4:3', '3:4': '3:4' };
    const imgSize = sizeMap[aspectRatio] || '1:1';

    const submitOnce = async (prompt: string, engineToUse: 'flash' | 'pro'): Promise<{ taskId: string | null; error?: string }> => {
      const url =
        engineToUse === 'pro'
          ? 'https://api.nanobananaapi.ai/api/v1/nanobanana/generate-pro'
          : 'https://api.nanobananaapi.ai/api/v1/nanobanana/generate';

      const body: any =
        engineToUse === 'pro'
          ? {
              prompt,
              imageUrls: baseImageUrls,
              resolution: '1K',
              aspectRatio: imgSize,
              callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
            }
          : {
              type: 'IMAGETOIAMGE',
              prompt,
              imageUrls: baseImageUrls,
              image_size: imgSize,
              numImages: 1,
              callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
            };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NANO_KEY}` },
        body: JSON.stringify(body),
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
      let finalPrompt = IMAGE_PROMPTS[index % IMAGE_PROMPTS.length];
      if (extraInstructions) finalPrompt += ` ${extraInstructions}`;
      const styleSuffix = style && STYLE_SUFFIX[style] ? STYLE_SUFFIX[style] : STYLE_SUFFIX.realistic;
      finalPrompt += ` ${styleSuffix}`;
      if (finalPrompt.length > 1800) finalPrompt = finalPrompt.substring(0, 1800);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await submitOnce(finalPrompt, engineSafe);
          if (result.taskId) {
            console.log(`[IMAGE GEN] Image ${index + 1} submitted (attempt ${attempt + 1}): ${result.taskId}`);
            return result;
          }
          console.warn(`[IMAGE GEN] Image ${index + 1} attempt ${attempt + 1} failed: ${result.error}`);
          if (attempt < 2) await new Promise(r => setTimeout(r, 500));
        } catch (e: any) {
          console.error(`[IMAGE GEN] Image ${index + 1} attempt ${attempt + 1} crash: ${e?.message}`);
          if (attempt < 2) await new Promise(r => setTimeout(r, 500));
        }
      }

      // Fallback: if "pro" fails to submit, try "flash" so the user still gets images.
      // This prevents the whole flow from failing when Nanobanana Pro is temporarily unstable.
      if (engineSafe === 'pro') {
        const fallback = await submitOnce(finalPrompt, 'flash');
        if (fallback.taskId) {
          console.warn(`[IMAGE GEN] Pro fallback to Flash succeeded for image ${index + 1}: ${fallback.taskId}`);
          return fallback;
        }
        return { taskId: null, error: fallback.error || 'Pro submit failed and flash fallback failed' };
      }

      return { taskId: null, error: 'All 3 attempts failed' };
    };

    const taskIds: string[] = [];
    const errors: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const result = await submitWithRetry(i);
      if (result.taskId) taskIds.push(result.taskId);
      else errors.push(result.error || 'failed');
      if (i < quantity - 1) await new Promise(r => setTimeout(r, 80));
    }

    console.log(`[IMAGE GEN] Submitted ${taskIds.length}/${quantity} in ${Date.now() - startTime}ms`);

    if (taskIds.length === 0) {
      return NextResponse.json({
        success: false,
        imageTaskIds: [],
        error: 'IMAGE_SUBMIT_FAILED',
        message: 'Le service d\'images n\'a pas accepté la requête. Vérifiez que la clé API (NANONBANANA_API_KEY) est valide et que le service est disponible.',
      });
    }

    // ── Deduct credits (sauf si déjà déduits côté client, ex. génération rapide) ──
    if (!skipCreditDeduction) {
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
    } else {
      console.log(`[IMAGE GEN] Skip credit deduction (quick-generate).`);
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
