import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { geminiStyleHint, nanoStyleSuffixFr } from '@/lib/image-style-presets';

let sharp: any;
try { sharp = require('sharp'); } catch { sharp = null; }

// Vercel: aligné avec vercel.json (plusieurs images Gemini = besoin de >25s). Netlify free reste limité ~26s.
export const maxDuration = 120;
export const runtime = 'nodejs';

const GEMINI_IMAGE_FETCH_TIMEOUT_MS = 90_000;

function geminiFetchSignal(): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(GEMINI_IMAGE_FETCH_TIMEOUT_MS);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), GEMINI_IMAGE_FETCH_TIMEOUT_MS);
  return c.signal;
}

async function runGeminiImagePromptsInBatches(
  prompts: string[],
  generateOne: (prompt: string) => Promise<string | null>,
  batchSize: number,
  startTime: number,
  wallMs: number
): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < prompts.length; i += batchSize) {
    if (Date.now() - startTime > wallMs) {
      console.warn(`[IMAGE GEN] Batch stop: time budget (${wallMs}ms)`);
      break;
    }
    const slice = prompts.slice(i, i + batchSize);
    const batch = await Promise.all(slice.map((p) => generateOne(p)));
    for (const u of batch) {
      if (u) out.push(u);
    }
  }
  return out;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * API ROUTE - IMAGE GENERATION (SUBMIT + RETURN TASK IDS)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Architecture:
 * 1. Compress & validate the source image
 * 2. Par défaut : Gemini (GEMINI_API_KEY) si définie — génération synchrone, renvoie imageDataUrls.
 * 3. Sinon Nanobanana : taskIds → le client poll via /api/check-image-status
 *
 * Forcer Nanobanana malgré une clé Gemini : USE_NANOBANANA_IMAGES=true
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
    // Support common env var naming variants (Netlify often differs).
    const NANO_KEY =
      process.env.NANONBANANA_API_KEY ||
      process.env.NANOBANANA_API_KEY ||
      process.env.NANO_BANANA_API_KEY ||
      process.env.NANONBANANA_KEY ||
      process.env.NANOBANANA_KEY;
    // Priorité Gemini dès que GEMINI_API_KEY est définie (comportement attendu sur Etsmart).
    // Nanobanana seulement si pas de clé Gemini, ou si USE_NANOBANANA_IMAGES=true (opt-in explicite).
    const forceNano = process.env.USE_NANOBANANA_IMAGES === 'true';
    const useGemini = !!GEMINI_KEY && !forceNano;

    if (!useGemini && !NANO_KEY) {
      console.error('[IMAGE GEN] Aucune clé image utilisable (GEMINI_API_KEY ou clés Nanobanana)');
      return NextResponse.json(
        {
          error: 'SERVER_CONFIG_ERROR',
          message:
            'Clé API image manquante. Définissez GEMINI_API_KEY (recommandé) ou NANONBANANA_API_KEY / NANOBANANA_API_KEY.',
        },
        { status: 500 },
      );
    }

    // ── GEMINI (image + texte) : moteur par défaut si GEMINI_API_KEY ──
    if (useGemini) {
      const productDesc = (productTitle && String(productTitle).trim())
        ? String(productTitle).trim().substring(0, 200)
        : 'product from the listing';
      const tagsList = Array.isArray(tags) ? tags.slice(0, 15).join(', ') : '';
      const materialsStr = (materials && String(materials).trim()) ? String(materials).trim().substring(0, 150) : '';
      const keywordPart = [tagsList && `Keywords: ${tagsList}`, materialsStr && `Materials: ${materialsStr}`].filter(Boolean).join('. ') || '';
      const styleHint = geminiStyleHint(typeof style === 'string' ? style : undefined);

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
      const baseContext = `Product: ${productDesc}.${keywordPart ? ` ${keywordPart}.` : ''} ${styleHint} ${realismBoost} CRITICAL: Use ONLY the provided reference images as the product source of truth. Keep EXACT same shape, silhouette, geometry, proportions, colors and materials. Never replace the product with another object/person. The product must be naturally integrated in the scene (no sticker/cutout look): proper contact shadow on surfaces, coherent occlusion, coherent perspective, coherent depth of field, coherent color temperature. Only change scene/background/camera angle. SOURCE CLEANUP (MANDATORY): Reference screenshots often include marketplace watermarks, AliExpress/Amazon-style logos, supplier brand marks, corner badges, promotional strips, price tags, QR codes, or overlaid text — DO NOT reproduce any of them. Remove them completely. Final image must be a clean, premium, seller-neutral Etsy listing photo with zero third-party branding or embedded marketplace UI.`;
      // Prompts alignés sur le flow "génération rapide" :
      // 5 visuels différents (contexte, équilibre, zoom, mensurations, stratégique) + règles globales.
      const GLOBAL_PROMPT_RULES_GEMINI =
        `RÈGLES GLOBALES (TRÈS IMPORTANT): ` +
        `Si la photo source contient logos fournisseur, filigranes, bandeaux AliExpress/marketplace, texte incrusté ou badges en coin : NE JAMAIS les recopier — les effacer entièrement sur l'image générée (photo produit propre, sans marque tierce). ` +
        `Pas de watermark. ` +
        `Pas de texte marketing sur l'image (sauf les mensurations sur l'image 4). ` +
        `Rendu photo réaliste type Etsy haut de gamme, pas de style trop "IA". ` +
        `Style visuel: tons chauds et naturels, lumière douce (daylight ou warm indoor light), ambiance propre et élégante, univers premium mais accessible. ` +
        `Fond simple (table/mur clair/intérieur moderne ou studio léger). ` +
        `Cohérence visuelle entre toutes les images générées (même produit, même style global, variantes d'angles/background seulement).`;

      const STYLE_EXPECTED_GEMINI =
        `Style visuel attendu: tons chauds et naturels, lumière douce, ambiance propre et rassurante, fond simple et élégant.`;

      const IMAGE_PROMPTS_GEMINI = [
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – ANGLE DE VUE ÉLOIGNÉ (CONTEXTE & AMBIANCE):
Génère une photo produit avec un angle éloigné montrant l’article dans un environnement réaliste et chaleureux.
Le produit doit être clairement visible, intégré à la scène (home decor / lifestyle usage naturel), rendu photo Etsy haut de gamme.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 2 – ANGLE DE VUE INTERMÉDIAIRE (ÉQUILIBRE PRODUIT / DÉTAIL):
Génère une photo produit avec un angle intermédiaire: produit au centre, environnement visible, composition équilibrée.
Met en valeur formes, design et proportions globales. Rendu réaliste et net, ombres cohérentes, fond sobre.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 3 – ZOOM / DÉTAIL PRODUIT:
Génère un gros plan sur le produit (texture, matière, finitions) avec une netteté premium.
Le fond doit rester simple et élégant pour ne pas détourner l’attention.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 4 – PHOTO AVEC MENSURATIONS / DIMENSIONS (OBLIGATOIRE):
Génère une image du produit avec les mensurations clairement visibles:
- flèches de dimension (guidelines) et labels numériques lisibles,
- style graphique simple et propre (traits fins),
- texte uniquement pour les dimensions (pas de texte marketing).
Le produit reste le sujet principal, rendu cohérent et crédible Etsy.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 5 – IMAGE STRATÉGIQUE (À VALEUR AJOUTÉE):
Génère une image supplémentaire qui ajoute de la valeur à la fiche:
angle/variation d’ambiance pertinente, focus usage (avant / après, détail clé, ou mise en situation alternative).
Objectif: augmenter la compréhension et la confiance.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 6 – SCÈNE ALTERNATIVE / AUTRE PIÈCE:
Même produit dans un autre contexte d’intérieur crédible (autre pièce ou ambiance légèrement différente).
Composition fraîche mais cohérente avec le set, lumière douce, rendu photo Etsy premium.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 7 – MISE EN VALEUR USAGE / ÉCHELLE:
Image qui montre le produit en situation d’usage ou avec une référence d’échelle subtile (sans personnage si évitable, ou mains/objet neutre).
Renforce la compréhension de la taille et de l’usage, rendu naturel et haut de gamme.
Pas de texte marketing. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
      ];
      const numImages = Math.min(Math.max(quantity, 1), 10);
      const promptsToUse = Array.from(
        { length: numImages },
        (_, i) => IMAGE_PROMPTS_GEMINI[i % IMAGE_PROMPTS_GEMINI.length]
      );
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

      const generateOneAttempt = async (prompt: string): Promise<string | null> => {
        const imagePartSets = [
          inlineImageParts,
          [inlineImageParts[0]].filter(Boolean),
        ];
        for (const partsForAttempt of imagePartSets) {
          for (const model of modelCandidates) {
            try {
              const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                {
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
                  signal: geminiFetchSignal(),
                }
              );
              if (!res.ok) {
                const t = await res.text().catch(() => '');
                console.warn(`[IMAGE GEN] Gemini ${model} non-ok:`, res.status, t.substring(0, 180));
                if (res.status === 429 || res.status === 503) {
                  await new Promise((r) => setTimeout(r, 1500));
                }
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
              const name = e?.name || '';
              if (name === 'TimeoutError' || /abort/i.test(String(e?.message))) {
                console.warn(`[IMAGE GEN] Gemini ${model} timeout/abort`);
              } else {
                console.warn(`[IMAGE GEN] Gemini ${model} error:`, e?.message || e);
              }
            }
          }
        }
        return null;
      };

      const generateOne = async (prompt: string): Promise<string | null> => {
        let r = await generateOneAttempt(prompt);
        if (r) return r;
        await new Promise((x) => setTimeout(x, 1200));
        return generateOneAttempt(prompt);
      };

      try {
        // Par lots de 2 : moins de timeouts plateforme / rate limit qu’un Promise.all sur 5–10 appels.
        const imageDataUrls = await runGeminiImagePromptsInBatches(
          promptsToUse,
          generateOne,
          2,
          startTime,
          115_000
        );
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
        const partial = imageDataUrls.length < numImages;
        console.log(
          `[IMAGE GEN] Gemini image-edit: ${imageDataUrls.length}/${numImages} image(s) in ${Date.now() - startTime}ms${partial ? ' (partial)' : ''}`
        );
        return NextResponse.json({
          success: true,
          imageTaskIds: [],
          imageDataUrls,
          ...(partial && {
            message: `Seulement ${imageDataUrls.length} image(s) sur ${numImages} (temps ou quota). Réessaie « Nouvelle génération » pour compléter.`,
          }),
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

    // ── Build prompt ──
    const tagsStr = Array.isArray(tags) && tags.length ? ` Tags / mots-clés : ${tags.slice(0, 15).join(', ')}.` : '';
    const materialsStrNano = (materials && String(materials).trim()) ? ` Matériaux : ${String(materials).trim().substring(0, 120)}.` : '';
    const productContextText = (productTitle && String(productTitle).trim()
      ? `Nous générons les visuels pour un produit Etsy : ${String(productTitle).trim().substring(0, 140)}.`
      : 'Nous générons les visuels pour un produit Etsy à partir de la photo de référence.')
      + tagsStr
      + materialsStrNano;

    const produitRef = (productTitle && String(productTitle).trim()) ? String(productTitle).trim().substring(0, 80) : 'le produit';
    const reglesCommunes = `RÈGLE ABSOLUE: l'objet principal (${produitRef}) doit garder sa forme, ses proportions, couleurs et matières EXACTES.
Tu ne modifies que l'arrière-plan/décor et l'angle de prise de vue (pas de changement de produit).
Rendu réaliste photo Etsy haut de gamme (pas de style "IA"), chaleureux et naturel.
RÈGLES VISUELLES: Pas de watermark. Pas de texte marketing sur l'image (sauf mensurations sur l'image 4).
Style visuel: tons chauds et naturels, lumière douce (daylight ou warm indoor light), ambiance propre et élégante, fond simple (table/mur clair/studio léger).
Cohérence entre tous les visuels (même produit, même style global, variantes d'angles/background uniquement).`;

    const IMAGE_PROMPTS = [
      `${productContextText}
PROMPT 1 – ANGLE DE VUE ÉLOIGNÉ (CONTEXTE & AMBIANCE):
Plan large, produit intégré dans une scène lifestyle réaliste (home decor / usage naturel).
Le produit est clairement visible, lumière douce, tons chauds, fond simple et élégant.
Pas de texte. Pas de watermark.
${reglesCommunes}`,
      `${productContextText}
PROMPT 2 – ANGLE DE VUE INTERMÉDIAIRE (ÉQUILIBRE PRODUIT / DÉTAIL):
Angle intermédiaire, produit au centre, environnement visible mais fond sobre.
Met en valeur design, formes et proportions globales, ombres cohérentes et rendu net.
Pas de texte. Pas de watermark.
${reglesCommunes}`,
      `${productContextText}
PROMPT 3 – ZOOM / DÉTAIL PRODUIT:
Gros plan sur texture, matière et finitions, netteté premium.
Fond simple et élégant pour ne pas détourner l’attention.
Pas de texte. Pas de watermark.
${reglesCommunes}`,
      `${productContextText}
PROMPT 4 – PHOTO AVEC MENSURATIONS / DIMENSIONS (OBLIGATOIRE):
Image type fiche produit: dimensions clairement visibles avec flèches de dimension et labels numériques lisibles.
Style graphique simple (traits fins, texte clair) et esthétique.
Texte uniquement pour les mensurations (pas de texte marketing).
${reglesCommunes}`,
      `${productContextText}
PROMPT 5 – IMAGE STRATÉGIQUE (À VALEUR AJOUTÉE):
Image supplémentaire pertinente: mise en situation alternative ou focus usage / détail clé.
Objectif: augmenter compréhension et confiance, rendu photo Etsy haut de gamme.
Pas de texte. Pas de watermark.
${reglesCommunes}`,
      `${productContextText}
PROMPT 6 – SCÈNE ALTERNATIVE / AUTRE AMBIANCE:
Même produit dans un autre décor intérieur crédible (autre pièce ou lumière légèrement différente).
Composition soignée, tons chauds, fond simple, style photo Etsy premium.
Pas de texte. Pas de watermark.
${reglesCommunes}`,
      `${productContextText}
PROMPT 7 – USAGE / ÉCHELLE:
Mise en situation qui aide à juger taille et usage (référence d’échelle discrète, mains neutres ou objet de comparaison simple).
Rendu naturel, pas de texte marketing, pas de watermark.
${reglesCommunes}`,
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
      const promptIndex = index % IMAGE_PROMPTS.length;
      let finalPrompt = IMAGE_PROMPTS[promptIndex];
      if (extraInstructions) finalPrompt += ` ${extraInstructions}`;
      const styleSuffix = nanoStyleSuffixFr(typeof style === 'string' ? style : undefined);
      if (styleSuffix) finalPrompt += ` ${styleSuffix}`;
      // Ré-affirmer les règles à la fin (customInstructions peut autrement les contredire).
      if (promptIndex === 3) {
        finalPrompt += ` Pas de watermark ni logos fournisseur. Texte uniquement pour les mensurations (dimensions).`;
      } else {
        finalPrompt += ` Pas de watermark, pas de logos/textes AliExpress ou marketplace sur l'image — photo produit propre. Pas de texte marketing.`;
      }
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
      if (i < quantity - 1) await new Promise(r => setTimeout(r, 40));
    }

    console.log(`[IMAGE GEN] Submitted ${taskIds.length}/${quantity} in ${Date.now() - startTime}ms`);

    if (taskIds.length === 0) {
      return NextResponse.json({
        success: false,
        imageTaskIds: [],
        error: 'IMAGE_SUBMIT_FAILED',
        message:
          'Le service Nanobanana n\'a pas accepté la requête. Vérifiez NANONBANANA_API_KEY (ou utilisez GEMINI_API_KEY sans USE_NANOBANANA_IMAGES).',
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
