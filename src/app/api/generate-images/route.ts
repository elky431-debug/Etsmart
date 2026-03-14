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

    const { sourceImage, backgroundImage, quantity = 1, aspectRatio = '1:1', customInstructions, productTitle, engine, style, skipCreditDeduction } = body;
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

    // ── GEMINI (Imagen / generateContent) : texte → images, retour direct ──
    if (useGemini) {
      const productDesc = (productTitle && String(productTitle).trim())
        ? String(productTitle).trim().substring(0, 200)
        : 'product from the listing';
      const styleHint = style === 'studio' ? 'Studio product photo on clean neutral background.' : style === 'lifestyle' ? 'Lifestyle scene with product in a real environment.' : style === 'illustration' ? 'Clean digital illustration style.' : 'Photorealistic product photo, soft natural light, high-end Etsy style.';
      const prompt = `Generate a professional e-commerce product photo. Product: ${productDesc}. ${styleHint} No watermark, no text on image. Single square image, high quality.`;
      const numImages = Math.min(Math.max(quantity, 1), 4);
      const model = 'gemini-2.0-flash-exp';
      try {
        const imageDataUrls: string[] = [];
        for (let i = 0; i < numImages; i++) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_KEY!,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseModalities: ['IMAGE', 'TEXT'],
                },
              }),
            }
          );
          if (!res.ok) {
            const errText = await res.text();
            console.error(`[IMAGE GEN] Gemini ${model} error:`, res.status, errText.substring(0, 200));
            if (imageDataUrls.length === 0) {
              return NextResponse.json({
                success: false,
                imageTaskIds: [],
                imageDataUrls: [],
                error: 'IMAGE_SUBMIT_FAILED',
                message: 'Le service Google (Gemini) n\'a pas pu générer les images. Vérifiez GEMINI_API_KEY et la facturation (peut prendre 5–15 min après activation).',
              });
            }
            break;
          }
          const data = await res.json();
          const parts = data?.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              const mime = part.inlineData?.mimeType || 'image/png';
              imageDataUrls.push(`data:${mime};base64,${part.inlineData.data}`);
            }
          }
          if (i < numImages - 1) await new Promise(r => setTimeout(r, 400));
        }
        if (imageDataUrls.length === 0) {
          return NextResponse.json({
            success: false,
            imageTaskIds: [],
            imageDataUrls: [],
            error: 'IMAGE_SUBMIT_FAILED',
            message: 'Gemini n\'a pas renvoyé d\'image. Réessayez ou vérifiez la facturation Google.',
          });
        }
        if (!skipCreditDeduction) {
          try {
            await incrementAnalysisCount(user.id, 1.0);
          } catch (e: any) {
            console.error(`[IMAGE GEN] Credit deduction error: ${e.message}`);
          }
        }
        console.log(`[IMAGE GEN] Gemini: ${imageDataUrls.length} image(s) in ${Date.now() - startTime}ms`);
        return NextResponse.json({
          success: true,
          imageTaskIds: [],
          imageDataUrls,
        });
      } catch (e: any) {
        console.error('[IMAGE GEN] Gemini fatal:', e.message);
        return NextResponse.json({
          success: false,
          imageTaskIds: [],
          imageDataUrls: [],
          error: 'IMAGE_SUBMIT_FAILED',
          message: e.message || 'Erreur lors de l\'appel à Gemini. Vérifiez GEMINI_API_KEY.',
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
    const productContext = productTitle && String(productTitle).trim()
      ? `Nous générons les visuels pour un produit Etsy : ${String(productTitle).trim().substring(0, 140)}.`
      : 'Nous générons les visuels pour un produit Etsy à partir de la photo de référence.';

    const globalRules =
      'RÈGLES GLOBALES : ne JAMAIS modifier la forme ni les détails du produit principal, uniquement le décor et la mise en scène. Analyse le type de produit et son univers (figurine manga, jouet enfant, accessoire gaming, déco murale, tapis, affiche, bijou, ustensile de cuisine, etc.) à partir de l\'image de référence et choisis un environnement PARFAITEMENT COHÉRENT avec ce produit. Exemple : figurine ou personnage manga → bureau ou étagère otaku moderne, setup gaming, posters ou manga en arrière‑plan ; jouet enfant → chambre d\'enfant ; déco bohème → salon bohème lumineux ; affiche → mur propre avec encadrement adapté ; tapis → sol et mobilier cohérents, etc. Interdiction d\'utiliser un décor générique de salon/canapé/couverture qui n\'a aucun rapport avec le produit. AUCUN watermark, AUCUN texte marketing (sauf si dimensions demandées), rendu photo réaliste type Etsy haut de gamme, lumière douce et naturelle, cohérence visuelle entre toutes les images, aucune apparence trop IA, toujours privilégier la lisibilité, la chaleur et la crédibilité.';

    const IMAGE_PROMPTS = [
      // 1️⃣ Vue éloignée / ambiance
      `${productContext} GÉNÈRE UNE PHOTO PRODUIT AVEC ANGLE DE VUE ÉLOIGNÉ. Le produit est placé dans un environnement complet et réaliste (intérieur chaleureux, lumière douce, décor cohérent avec le produit). On doit voir la pièce ou l'espace autour du produit pour montrer comment il s'intègre dans un vrai contexte de vie (home decor, lifestyle, usage naturel). Le produit reste bien visible, mais intégré dans la scène. Style : photo Etsy professionnelle, naturelle, non artificielle, sans effet studio agressif. ${globalRules}`,
      // 2️⃣ Vue intermédiaire
      `${productContext} GÉNÈRE UNE PHOTO PRODUIT AVEC ANGLE INTERMÉDIAIRE. Le produit occupe le centre de l'image, avec une partie de l'environnement encore visible autour. Objectif : mettre en valeur clairement la forme, le design et les proportions générales du produit, tout en gardant un décor sobre et cohérent. Lumière chaude, rendu réaliste, style Etsy premium, fond simple et élégant.`,
      // 3️⃣ Zoom / détail
      `${productContext} GÉNÈRE UNE PHOTO ZOOMÉE SUR LE PRODUIT. Focus sur les détails importants : texture, matière, finitions, qualité perçue. Le fond doit être flou ou très simple pour ne pas détourner l'attention. Objectif : rassurer l'acheteur sur la qualité et le soin apporté au produit. Style : photo nette, naturelle, sans sur‑retouche ni effet plastique.`,
      // 4️⃣ Photo avec mensurations
      `${productContext} GÉNÈRE UNE IMAGE AVEC MENSURATIONS / DIMENSIONS DU PRODUIT. Le produit est affiché proprement au centre, et les dimensions (hauteur, largeur, profondeur ou longueur) sont indiquées avec des traits fins et du texte discret mais parfaitement lisible, dans un style graphique simple et professionnel. L'image doit rester esthétique, fond clair et propre, comme une fiche produit technique sur Etsy.`,
      // 5️⃣ Image stratégique
      `${productContext} GÉNÈRE UNE IMAGE STRATÉGIQUE SUPPLÉMENTAIRE POUR LA FICHE ETSY. Choisis automatiquement l'option la plus pertinente : soit une mise en situation alternative, soit un angle original, soit un focus sur l'usage (avant / après, détail clé en action). L'objectif est d'augmenter la compréhension du produit et la confiance de l'acheteur, toujours dans un style chaleureux, réaliste et professionnel. ${globalRules}`,
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
