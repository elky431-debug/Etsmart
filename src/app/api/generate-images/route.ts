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

    const { sourceImage, backgroundImage, quantity = 1, aspectRatio = '1:1', customInstructions, productTitle, tags, materials, engine, style, skipCreditDeduction } = body;
    if (!sourceImage) return NextResponse.json({ error: 'Image source requise' }, { status: 400 });
    if (quantity < 1 || quantity > 10) return NextResponse.json({ error: 'Quantité entre 1 et 10' }, { status: 400 });

    // Quand skipCreditDeduction est true (ex: génération rapide), on ne vérifie pas le quota restant ni on ne déduit (déjà fait côté client).
    if (!skipCreditDeduction) {
      if (quotaInfo.remaining < 1) {
        return NextResponse.json({ error: 'QUOTA_EXCEEDED', message: 'Insufficient quota. You need 1 credit.' }, { status: 403 });
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

    // ── GEMINI (Imagen API :predict) : texte → images, retour direct ──
    if (useGemini) {
      const productDesc = (productTitle && String(productTitle).trim())
        ? String(productTitle).trim().substring(0, 200)
        : 'product from the listing';
      const tagsList = Array.isArray(tags) ? tags.slice(0, 15).join(', ') : '';
      const materialsStr = (materials && String(materials).trim()) ? String(materials).trim().substring(0, 150) : '';
      const extra = [];
      if (tagsList) extra.push(`Keywords: ${tagsList}`);
      if (materialsStr) extra.push(`Materials: ${materialsStr}`);
      const keywordPart = extra.length ? ` ${extra.join('. ')}.` : '';
      const styleHint = style === 'studio' ? 'Studio product photo on clean neutral background.' : style === 'lifestyle' ? 'Lifestyle scene with product in a real environment.' : style === 'illustration' ? 'Clean digital illustration style.' : 'Photorealistic product photo, soft natural light, high-end Etsy style.';
      const prompt = `A photo of ${productDesc}.${keywordPart} ${styleHint} Do not modify the main product, keep same shape and details. Only change the background to an original, aesthetic, cozy, warm and professional Etsy-style space. Realistic, respectful of Etsy selling conditions. Square format, no watermark, no text on image.`;
      const numImages = Math.min(Math.max(quantity, 1), 4);
      const model = 'imagen-4.0-generate-001';
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': GEMINI_KEY!,
            },
            body: JSON.stringify({
              instances: [{ prompt }],
              parameters: {
                sampleCount: numImages,
                aspectRatio: aspectRatio === '16:9' ? '16:9' : aspectRatio === '9:16' ? '9:16' : aspectRatio === '4:3' ? '4:3' : aspectRatio === '3:4' ? '3:4' : '1:1',
              },
            }),
          }
        );
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[IMAGE GEN] Imagen ${model} error:`, res.status, errText.substring(0, 300));
          return NextResponse.json({
            success: false,
            imageTaskIds: [],
            imageDataUrls: [],
            error: 'IMAGE_SUBMIT_FAILED',
            message: 'Le service Google (Imagen) n\'a pas pu générer les images. Vérifiez GEMINI_API_KEY et la facturation (peut prendre 5–15 min après activation).',
          });
        }
        const data = await res.json();
        const imageDataUrls: string[] = [];
        const predictions = data?.predictions ?? [];
        for (const pred of predictions) {
          const b64 = pred?.bytesBase64Encoded ?? pred?.image?.bytesBase64Encoded ?? pred?.bytesBase64 ?? pred?.imageBytes;
          if (b64 && typeof b64 === 'string') {
            imageDataUrls.push(`data:image/png;base64,${b64}`);
          }
        }
        if (imageDataUrls.length === 0) {
          console.error('[IMAGE GEN] Imagen response had no images:', JSON.stringify(data).substring(0, 500));
          return NextResponse.json({
            success: false,
            imageTaskIds: [],
            imageDataUrls: [],
            error: 'IMAGE_SUBMIT_FAILED',
            message: 'Imagen n\'a pas renvoyé d\'image. Réessayez ou vérifiez la facturation Google.',
          });
        }
        if (!skipCreditDeduction) {
          try {
            await incrementAnalysisCount(user.id, 1.0);
          } catch (e: any) {
            console.error(`[IMAGE GEN] Credit deduction error: ${e.message}`);
          }
        }
        console.log(`[IMAGE GEN] Imagen: ${imageDataUrls.length} image(s) in ${Date.now() - startTime}ms`);
        return NextResponse.json({
          success: true,
          imageTaskIds: [],
          imageDataUrls,
        });
      } catch (e: any) {
        console.error('[IMAGE GEN] Imagen fatal:', e.message);
        return NextResponse.json({
          success: false,
          imageTaskIds: [],
          imageDataUrls: [],
          error: 'IMAGE_SUBMIT_FAILED',
          message: e.message || 'Erreur lors de l\'appel à Imagen. Vérifiez GEMINI_API_KEY.',
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

    const engineSafe: 'flash' | 'pro' = (engine === 'pro' ? 'pro' : 'flash');

    // Style presets pour moduler le rendu
    const STYLE_SUFFIX: Record<string, string> = {
      realistic: ' Style: photo produit ultra réaliste, éclairage naturel doux, rendu Etsy haut de gamme.',
      studio: ' Style: photo studio produit sur fond neutre propre, lumière contrôlée, ombres douces.',
      lifestyle: ' Style: scène lifestyle avec le produit dans un environnement réel cohérent, mise en scène naturelle.',
      illustration: ' Style: illustration digitale propre, légèrement stylisée, couleurs harmonieuses, mais produit parfaitement reconnaissable.',
    };

    // ── Build prompt ──
    let productContext = productTitle && String(productTitle).trim()
      ? `Nous générons les visuels pour un produit Etsy : ${String(productTitle).trim().substring(0, 140)}.`
      : 'Nous générons les visuels pour un produit Etsy à partir de la photo de référence.';
    const tagsStr = Array.isArray(tags) && tags.length ? ` Tags / mots-clés : ${tags.slice(0, 15).join(', ')}.` : '';
    const materialsStrNano = (materials && String(materials).trim()) ? ` Matériaux : ${String(materials).trim().substring(0, 120)}.` : '';
    if (tagsStr || materialsStrNano) productContext += tagsStr + materialsStrNano;

    const produitRef = (productTitle && String(productTitle).trim()) ? String(productTitle).trim().substring(0, 80) : 'le produit';
    const PROMPT_IMAGE_ETSMART = `Entame un processus de modification avec toutes mes règles imposées pour l'image ci jointe sans modifier un seul pixel de l'objet principal (ici ${produitRef}) sous aucun prétexte. Il doit garder la même forme, mêmes détails exacts que sur l'image, même apparence. Il t'est interdit de le modifier. Modifie absolument l'arrière-plan, il faut que le rendu soit original et unique. Modifie tous les éléments qui sont différents du produit et modifie entièrement les éléments présents toujours pour un rendu réaliste et respectueux des conditions de vente d'Etsy, le tout pour recréer un espace original, esthétique, cosy, chaleureux et professionnel. Génère l'image au format carré absolument.`;

    const IMAGE_PROMPTS = [
      PROMPT_IMAGE_ETSMART,
      PROMPT_IMAGE_ETSMART,
      PROMPT_IMAGE_ETSMART,
      PROMPT_IMAGE_ETSMART,
      PROMPT_IMAGE_ETSMART,
    ];
    const extraInstructions = (customInstructions && customInstructions.trim()) ? customInstructions.trim() : '';

    console.log(`[IMAGE GEN] Setup done in ${Date.now() - startTime}ms, submitting ${quantity} image(s)...`);

    // ── Submit image generation tasks to NanoBanana (with retry) ──
    const payloadSize = imageDataUrl.length;
    console.log(`[IMAGE GEN] Image payload size: ${(payloadSize / 1024).toFixed(0)}KB, sharp: ${!!sharp}`);

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
              imageUrls: [imageDataUrl],
              resolution: '1K',
              aspectRatio: imgSize,
              callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
            }
          : {
              type: 'IMAGETOIAMGE',
              prompt,
              imageUrls: [imageDataUrl],
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
      return { taskId: null, error: 'All 3 attempts failed' };
    };

    const taskIds: string[] = [];
    const errors: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const result = await submitWithRetry(i);
      if (result.taskId) taskIds.push(result.taskId);
      else errors.push(result.error || 'failed');
      if (i < quantity - 1) await new Promise(r => setTimeout(r, 150));
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
