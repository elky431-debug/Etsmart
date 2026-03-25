import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { geminiStyleHint, nanoStyleSuffixFr } from '@/lib/image-style-presets';

let sharp: any;
try { sharp = require('sharp'); } catch { sharp = null; }

// Vercel: aligné avec vercel.json. Netlify: gateway ~26s → mode chunked, budget serré (voir readGeminiChunkSingleWallMs + cap Gemini).
export const maxDuration = 120;
export const runtime = 'nodejs';

const GEMINI_IMAGE_FETCH_TIMEOUT_MS = 28_000;
/** Budget max pour 1 image en mode « chunked » (1 image / requête côté client). */
const GEMINI_FAST_SINGLE_WALL_MS = 45_000;
/** Pro chunked : un peu plus de marge qu’un seul essai Gemini, tout en restant sous timeout gateway (~60s). */
const GEMINI_PRO_SINGLE_WALL_MS = 45_000;
/** Budget pour 2+ images dans un même POST (plusieurs vagues batch internes). */
const GEMINI_PAIR_WALL_MS = 110_000;
const GEMINI_MULTI_BATCH_WALL_MS = 115_000;

function isNetlifyRuntime(): boolean {
  return Boolean(process.env.SITE_ID && process.env.URL);
}

/**
 * Budget « 1 image / requête » (génération rapide chunked).
 * Sur Netlify gratuit (~26s gateway), défaut court — voir GEMINI_CHUNK_SINGLE_WALL_MS.
 */
function readGeminiChunkSingleWallMs(isProFastSingle: boolean): number {
  const raw = process.env.GEMINI_CHUNK_SINGLE_WALL_MS;
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 12_000 && n <= 120_000) return Math.floor(n);
  }
  if (isNetlifyRuntime()) return 21_000;
  return isProFastSingle ? GEMINI_PRO_SINGLE_WALL_MS : GEMINI_FAST_SINGLE_WALL_MS;
}

function geminiFetchSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), timeoutMs);
  return c.signal;
}

async function runGeminiImagePromptsInBatches(
  prompts: string[],
  generateOne: (prompt: string, index: number) => Promise<string | null>,
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
    const batchOffset = i;
    const batch = await Promise.all(slice.map((p, idx) => generateOne(p, idx + batchOffset)));
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

    const {
      sourceImage,
      backgroundImage,
      quantity = 1,
      aspectRatio = '1:1',
      customInstructions,
      productTitle,
      tags,
      materials,
      engine = 'pro',
      style,
      skipCreditDeduction,
      productContext,
      clientChunkedSingle,
      singlePromptIndex: singlePromptIndexRaw,
      promptStartIndex: promptStartIndexRaw,
    } = body;
    const clientChunkedSingleFlag = clientChunkedSingle === true;
    const singlePromptIndex =
      typeof singlePromptIndexRaw === 'number' && Number.isFinite(singlePromptIndexRaw)
        ? Math.max(0, Math.floor(singlePromptIndexRaw))
        : null;
    const hasPromptStart =
      typeof promptStartIndexRaw === 'number' &&
      Number.isFinite(promptStartIndexRaw) &&
      promptStartIndexRaw >= 0;
    const promptStartIndex = hasPromptStart ? Math.floor(promptStartIndexRaw) : null;
    if (!sourceImage) return NextResponse.json({ error: 'Image source requise' }, { status: 400 });
    if (quantity < 1 || quantity > 10) return NextResponse.json({ error: 'Quantité entre 1 et 10' }, { status: 400 });

    const extractDimensionsForImage4 = (text: string | undefined | null): {
      unit: string | null;
      values: number[];
    } => {
      const raw = String(text || '').toLowerCase().replace(',', '.');
      if (!raw.trim()) return { unit: null, values: [] };

      // Prefer strict triplet "L x l x H cm|mm|in|inch" if it exists.
      const triplet = raw.match(
        /(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(cm|mm|in|inch)\b/
      );
      if (triplet) {
        const a = Number.parseFloat(triplet[1]!);
        const b = Number.parseFloat(triplet[2]!);
        const c = Number.parseFloat(triplet[3]!);
        const unit = triplet[4] === 'inch' ? 'inch' : triplet[4] === 'in' ? 'in' : triplet[4];
        const values = [a, b, c].filter((n) => Number.isFinite(n) && n > 0);
        return { unit, values };
      }

      // Fallback: any occurrences "number unit". We keep up to 3 values.
      const matches = Array.from(raw.matchAll(/(\d+(?:\.\d+)?)\s*(cm|mm|in|inch)\b/g));
      const normalized = matches
        .map((m) => ({
          n: Number.parseFloat(m[1] ?? ''),
          unit: m[2] === 'inch' ? 'inch' : m[2] === 'in' ? 'in' : m[2],
        }))
        .filter((x) => Number.isFinite(x.n) && x.n > 0);

      if (normalized.length === 0) return { unit: null, values: [] };

      // Pick the most common unit.
      const unitCounts = normalized.reduce<Record<string, number>>((acc, it) => {
        acc[it.unit] = (acc[it.unit] || 0) + 1;
        return acc;
      }, {});
      const unit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const values = normalized.filter((v) => (unit ? v.unit === unit : true)).slice(0, 3).map((v) => v.n);
      return { unit, values };
    };

    const dimsSourceText = `${productTitle || ''} ${customInstructions || ''}`.trim();
    const dims = extractDimensionsForImage4(dimsSourceText);
    const dimensionsStrictBlock =
      dims.unit && dims.values.length > 0
        ? (() => {
            const v = dims.values.map((n) => {
              const rounded = Math.round(n * 100) / 100;
              // Avoid trailing zeros like 10.00.
              return Number.isInteger(rounded) ? String(rounded) : String(rounded);
            });
            const unit = dims.unit!;
            if (v.length >= 3) return `DIMENSIONS EXACTES (NE PAS INVENTER): Longueur ${v[0]} ${unit}, Largeur ${v[1]} ${unit}, Hauteur ${v[2]} ${unit}.`;
            if (v.length === 2) return `DIMENSIONS EXACTES (NE PAS INVENTER): Longueur ${v[0]} ${unit}, Largeur ${v[1]} ${unit}.`;
            return `DIMENSIONS EXACTES (NE PAS INVENTER): Taille ${v[0]} ${unit}.`;
          })()
        : `DIMENSIONS NON FOURNIES: NE PAS INVENTER DE NOMBRES. Dessine uniquement des flèches de dimension avec des labels "--" (ou "N/A") et pas de valeurs chiffrées.`;

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

      const numImages = Math.min(Math.max(quantity, 1), 10);
      const isFastChunkedSingle = clientChunkedSingleFlag && numImages === 1;
      const isNetlifyHost = isNetlifyRuntime();
      const engineSafe: 'flash' | 'pro' = engine === 'pro' ? 'pro' : 'flash';
      /** Routage historique : bouton Pro utilise le même modèle image rapide (stable prod). */
      const forceProToFlash25 = engineSafe === 'pro';
      const isProFastSingle = isFastChunkedSingle && engineSafe === 'pro' && !forceProToFlash25;
      const GEMINI_IMAGE_EDIT_MODEL = 'gemini-2.5-flash-image';
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
            const isNetlifyFastSingle = isNetlifyHost && isFastChunkedSingle;
            const maxSide = isNetlifyFastSingle ? 768 : isFastChunkedSingle ? (isProFastSingle ? 768 : 896) : 768;
            const jpegQ = isNetlifyFastSingle ? 76 : isFastChunkedSingle ? (isProFastSingle ? 76 : 80) : 72;
            const c = await sharp(buf)
              .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: jpegQ, mozjpeg: true })
              .toBuffer();
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

      const realismBoost =
        engineSafe === 'pro' && !forceProToFlash25
          ? 'High-fidelity pro render: crisp details, natural micro-textures, realistic global illumination, physically plausible contact shadows and reflections, accurate perspective and scale.'
          : isFastChunkedSingle
            ? 'Photorealistic Etsy listing quality: sharp product focus, natural soft light, accurate colors and materials, subtle realistic shadows, avoid plastic/AI look.'
            : 'Fast realistic render with clean natural lighting.';
      const baseContext = `Product: ${productDesc}.${keywordPart ? ` ${keywordPart}.` : ''} ${styleHint} ${realismBoost}
CRITICAL: Use ONLY the provided reference images for the product source of truth (main physical object only). Keep EXACT same shape, silhouette, geometry, proportions, colors and materials for the main product object.
Never replace the main product with another object/person.
Only change scene/background/camera angle/focal length. The rest of the scene (lighting, decor, small props around the product) can change.
ANTI-ALlEXPRESS TEMPLATE BREAKER: do not preserve any AliExpress page layout cues (borders, rounded-corner marketplace widgets, promo strips, corner badges, corner labels).
ANTI-TEXT (VERY IMPORTANT): if the reference contains ANY text/letters/numbers-like glyphs (titles, subtitles, promo words, captions, overlays), REMOVE it completely. Never generate new words or typography (except dimension labels on image 4).
SOURCE CLEANUP (MANDATORY): Reference screenshots often include watermarks, AliExpress/Amazon-style logos, supplier brand marks, price tags, QR codes, overlaid text — DO NOT reproduce any of them. Remove them completely.
Final image must be a clean, premium, seller-neutral Etsy listing photo with zero third-party branding or embedded marketplace UI.`;
      // Prompts alignés sur le flow "génération rapide" :
      // 5 visuels différents (contexte, équilibre, zoom, mensurations, stratégique) + règles globales.
      const GLOBAL_PROMPT_RULES_GEMINI =
        `RÈGLES GLOBALES (TRÈS IMPORTANT): ` +
        `Si la photo source contient logos fournisseur, filigranes, bandeaux AliExpress/marketplace, TEXTE incrusté ou badges en coin : NE JAMAIS les recopier — les effacer entièrement sur l'image générée (photo produit propre, sans marque tierce). ` +
        `Pas de watermark. ` +
        `ZERO TEXTE / ZERO TYPOGRAPHIE: aucune lettre, aucun mot, aucun chiffre, aucun symbole de prix/labels/UI, sauf UNIQUEMENT les labels de DIMENSIONS sur l'image 4. ` +
        `Rendu photo réaliste type Etsy haut de gamme, pas de style trop "IA". ` +
        `Style visuel: tons chauds et naturels, lumière douce (daylight ou warm indoor light), ambiance propre et élégante, univers premium mais accessible. ` +
        `Fond simple (table/mur clair/intérieur moderne ou studio léger). ` +
        `ANTI-COPIER STRICT: chaque prompt doit générer un arrière-plan + décor + éclairage clairement différents (pas un recadrage, pas un copier/coller, pas des éléments identiques). ` +
        `Ne réutilise pas la même disposition des rideaux/tapis/coussins/objets autour du produit d'une image à l'autre. ` +
        `Cohérence visuelle entre toutes les images générées (même produit, même style global, mais décors distincts).`;

      const STYLE_EXPECTED_GEMINI =
        `Style visuel attendu: tons chauds et naturels, lumière douce, ambiance propre et rassurante, fond simple et élégant.`;

      const IMAGE_PROMPTS_GEMINI = [
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – VUE LARGE / CONTEXTE LIFESTYLE:
Plan large, produit intégré dans une pièce réaliste et chaleureuse (salon, chambre ou cuisine selon le produit).
Le produit apparaît à son échelle réelle — visible mais pas surdimensionné par rapport aux meubles et à la pièce.
Cadrage large montrant le mobilier, les murs et le sol autour du produit.
Lumière du matin venant de la gauche, mur blanc cassé, parquet clair, tableau abstrait discret en fond.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 2 – PLAN MOYEN / ÉQUILIBRE PRODUIT-SCÈNE:
Plan moyen: produit au centre, scène visible autour (meubles, mur, sol).
Met en valeur design, formes et proportions globales à leur vraie taille dans l'espace.
Éclairage chaud type lampe à droite hors-champ, mur beige doux, surface en bois devant.
Décor sobre: 1-2 accessoires neutres (plante, bougie, livre) sans surcharger la scène.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 3 – GROS PLAN / TEXTURE ET FINITIONS:
Photo rapprochée focalisée sur la texture, les matériaux et les finitions du produit.
Netteté maximale sur les détails de surface, léger bokeh sur le fond.
Fond épuré (surface neutre mate ou studio clair), lumière douce directionnelle révélant les reliefs.
Produit occupant 60-70% du cadre, sans distorsion de perspective.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 4 – PHOTO AVEC MENSURATIONS / DIMENSIONS (OBLIGATOIRE):
Image type fiche produit sur fond clair et épuré: dimensions clairement visibles.
${dimensionsStrictBlock}
Flèches de dimension fines avec labels numériques nets. Style graphique minimaliste.
Texte uniquement pour les mensurations (pas de texte marketing).`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 5 – AMBIANCE SOIR / ÉCLAIRAGE CHAUD:
Photo lifestyle avec éclairage chaud de soirée (lumière tamisée, ambiance cosy).
Produit mis en valeur avec éclairage indirect doux, ombres longues et douces, teintes dorées.
Intérieur feutré: bougie ou lampe d'appoint visible en arrière-plan, textile doux.
Plan moyen, produit à son échelle réelle dans la scène.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 6 – AUTRE PIÈCE / AUTRE AMBIANCE:
Même produit dans une pièce ou un contexte d'intérieur complètement différent des images 1 et 2.
Si image 1 = salon, utiliser cuisine scandinave ou bureau minimaliste ou chambre cosy.
Palette de couleurs différente, lumière naturelle zénithale.
Cadrage large, produit visible et à l'échelle.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 7 – RÉFÉRENCE D'ÉCHELLE / USAGE:
Photo montrant la taille réelle du produit grâce à une référence d'échelle discrète.
Un objet commun connu (tasse, livre, plante en pot) posé à côté du produit pour donner l'échelle.
Plan moyen, produit et objet de référence nets et bien cadrés.
Fond épuré, lumière naturelle douce, rendu naturel et haut de gamme.
Pas de texte marketing. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
      ];

      const geminiExtra =
        customInstructions && String(customInstructions).trim()
          ? `\n\nINSTRUCTIONS SUPPLÉMENTAIRES (à respecter en priorité si cohérent avec le produit): ${String(customInstructions).trim().substring(0, 500)}`
          : '';

      let promptsToUse: string[];
      if (numImages === 1 && singlePromptIndex !== null) {
        const idx = singlePromptIndex % IMAGE_PROMPTS_GEMINI.length;
        promptsToUse = [IMAGE_PROMPTS_GEMINI[idx]];
      } else if (promptStartIndex !== null) {
        promptsToUse = Array.from({ length: numImages }, (_, i) => {
          const idx = promptStartIndex + i;
          if (idx < IMAGE_PROMPTS_GEMINI.length) return IMAGE_PROMPTS_GEMINI[idx];
          return IMAGE_PROMPTS_GEMINI[i % IMAGE_PROMPTS_GEMINI.length];
        });
      } else {
        promptsToUse = Array.from(
          { length: numImages },
          (_, i) => IMAGE_PROMPTS_GEMINI[i % IMAGE_PROMPTS_GEMINI.length]
        );
      }
      if (geminiExtra) {
        promptsToUse = promptsToUse.map((p) => p + geminiExtra);
      }
      const chunkSingleWallMs = readGeminiChunkSingleWallMs(isProFastSingle);
      console.log(
        `[IMAGE GEN] Gemini engine=${engineSafe}, refs=${inlineImageParts.length}, fastSingle=${isFastChunkedSingle}, chunkWall=${chunkSingleWallMs}, model=${GEMINI_IMAGE_EDIT_MODEL}`
      );

      const tryGeminiOnce = async (
        prompt: string,
        model: string,
        partsForAttempt: { inlineData: { mimeType: string; data: string } }[],
        timeoutMs: number
      ): Promise<string | null> => {
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
              signal: geminiFetchSignal(timeoutMs),
            }
          );
          if (!res.ok) {
            const t = await res.text().catch(() => '');
            console.warn(`[IMAGE GEN] Gemini ${model} non-ok:`, res.status, t.substring(0, 180));
            if (res.status === 429 || res.status === 503) {
              await new Promise((r) => setTimeout(r, 400));
            }
            return null;
          }
          const data = await res.json();
          const cand0 = data?.candidates?.[0];
          const parts = cand0?.content?.parts || [];
          for (const part of parts) {
            const b64 = part?.inlineData?.data;
            const mime = part?.inlineData?.mimeType || 'image/png';
            if (typeof b64 === 'string' && b64.length > 100) return `data:${mime};base64,${b64}`;
          }
          console.warn(`[IMAGE GEN] Gemini ${model} réponse sans image`, {
            finishReason: cand0?.finishReason,
            blockReason: data?.promptFeedback?.blockReason ?? cand0?.promptFeedback?.blockReason,
          });
        } catch (e: any) {
          const name = e?.name || '';
          if (name === 'TimeoutError' || /abort/i.test(String(e?.message))) {
            console.warn(`[IMAGE GEN] Gemini ${model} timeout/abort`);
          } else {
            console.warn(`[IMAGE GEN] Gemini ${model} error:`, e?.message || e);
          }
        }
        return null;
      };

      const tryGeminiForMensurations = async (
        prompt: string,
        partsForAttempt: { inlineData: { mimeType: string; data: string } }[],
        timeoutMs: number
      ): Promise<string | null> => {
        console.log('[IMAGE GEN] Prompt 4 mensurations → Gemini');
        return tryGeminiOnce(prompt, GEMINI_IMAGE_EDIT_MODEL, partsForAttempt, timeoutMs);
      };

      const generateOne = async (prompt: string, promptIndex: number): Promise<string | null> => {
        const mainPart = [inlineImageParts[0]].filter(
          (part): part is { inlineData: { mimeType: string; data: string } } => Boolean(part)
        );
        const isMensurationsPrompt = promptIndex === 3;

        if (isMensurationsPrompt) {
          const cap = Math.min(GEMINI_IMAGE_FETCH_TIMEOUT_MS, isNetlifyHost ? 18_000 : 26_000);
          const img = await tryGeminiForMensurations(prompt, mainPart, cap);
          if (img) return img;
          await new Promise((r) => setTimeout(r, 1500));
          return tryGeminiForMensurations(prompt, mainPart, cap);
        }

        const geminiCap = Math.min(GEMINI_IMAGE_FETCH_TIMEOUT_MS, isNetlifyHost ? 18_000 : 26_000);
        return tryGeminiOnce(prompt, GEMINI_IMAGE_EDIT_MODEL, mainPart, geminiCap);
      };

      try {
        // Fast single : 1 image / requête.
        // Pro (hors chunked) : jamais de parallèle interne — évite 504 sur hébergeurs ~60s.
        // Flash 2+ : jusqu’à 3 prompts Gemini en parallèle par vague.
        const batchSize = isFastChunkedSingle
          ? 1
          : engineSafe === 'pro'
            ? 1
            : numImages >= 3
              ? 3
              : numImages === 2
                ? 2
                : 1;
        const wallMs = isFastChunkedSingle
          ? chunkSingleWallMs
          : engineSafe === 'pro'
            ? Math.min(110_000, GEMINI_PRO_SINGLE_WALL_MS * numImages)
            : numImages >= 3
              ? GEMINI_MULTI_BATCH_WALL_MS
              : numImages >= 2
                ? GEMINI_PAIR_WALL_MS
                : 115_000;
        const promptBaseIndex = promptStartIndex ?? singlePromptIndex ?? 0;
        const imageDataUrls = await runGeminiImagePromptsInBatches(
          promptsToUse,
          (prompt, index) => generateOne(prompt, promptBaseIndex + index),
          batchSize,
          startTime,
          wallMs
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
          provider: 'gemini',
          model: GEMINI_IMAGE_EDIT_MODEL,
          requestedEngine: engineSafe,
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
RÈGLES VISUELLES: Pas de watermark.
ZERO TEXTE / ZERO TYPOGRAPHIE: aucune lettre, aucun mot, aucun chiffre, aucun symbole de prix/labels/UI, sauf UNIQUEMENT les labels de DIMENSIONS sur l'image 4.
ANTI-COPIER: ne pas reproduire les codes de page AliExpress/marketplace (bannières, coins/badges, overlays, prix affiché, QR codes, textes incrustés). Recréer un décor photo Etsy propre.
ANTI-SIMILARITÉ STRICT: ne pas réutiliser les mêmes éléments du décor d'une image à l'autre (rideaux/tapis/coussins/objets autour du produit). Décor et éclairage doivent être clairement différents.
Style visuel: tons chauds et naturels, lumière douce (daylight ou warm indoor light), ambiance propre et élégante, fond simple (table/mur clair/studio léger).
Cohérence entre tous les visuels (même produit, même style global, variantes d'angles/background uniquement).`;

    const dimensionsStrictBlockNano = dimensionsStrictBlock; // même logique côté prompt mensurations

    const IMAGE_PROMPTS = [
      `${productContextText}
PROMPT 1 – VUE LARGE / CONTEXTE LIFESTYLE:
Plan large, produit intégré dans une pièce réaliste et chaleureuse (salon, chambre ou cuisine selon le produit).
Le produit apparaît à son échelle réelle — visible mais pas surdimensionné par rapport aux meubles et à la pièce.
Cadrage large montrant le mobilier, les murs et le sol autour du produit.
Lumière du matin venant de la gauche, mur blanc cassé, parquet clair, tableau abstrait discret en fond.
Pas de texte. Pas de watermark.
${reglesCommunes}`,
      `${productContextText}
PROMPT 2 – PLAN MOYEN / ÉQUILIBRE PRODUIT-SCÈNE:
Plan moyen: produit au centre, scène visible autour (meubles, mur, sol).
Met en valeur design, formes et proportions globales à leur vraie taille dans l'espace.
Éclairage chaud type lampe à droite hors-champ, mur beige doux, surface en bois devant.
Décor sobre: 1-2 accessoires neutres (plante, bougie, livre) sans surcharger la scène.
Pas de texte. Pas de watermark.
${reglesCommunes}`,
      `${productContextText}
PROMPT 3 – GROS PLAN / TEXTURE ET FINITIONS:
Photo rapprochée focalisée sur la texture, les matériaux et les finitions du produit.
Netteté maximale sur les détails de surface, léger bokeh sur le fond.
Fond épuré (surface neutre mate ou studio clair), lumière douce directionnelle révélant les reliefs.
Produit occupant 60-70% du cadre, sans distorsion de perspective.
Pas de texte. Pas de watermark.
${reglesCommunes}`,
      `${productContextText}
PROMPT 4 – PHOTO AVEC MENSURATIONS / DIMENSIONS (OBLIGATOIRE):
Image type fiche produit sur fond clair et épuré: dimensions clairement visibles.
${dimensionsStrictBlockNano}
Flèches de dimension fines avec labels numériques nets. Style graphique minimaliste.
Texte uniquement pour les mensurations (pas de texte marketing).
${reglesCommunes}`,
      `${productContextText}
PROMPT 5 – AMBIANCE SOIR / ÉCLAIRAGE CHAUD:
Photo lifestyle avec éclairage chaud de soirée (lumière tamisée, ambiance cosy).
Produit mis en valeur avec éclairage indirect doux, ombres longues et douces, teintes dorées.
Intérieur feutré: bougie ou lampe d'appoint visible en arrière-plan, textile doux.
Plan moyen, produit à son échelle réelle dans la scène.
Pas de texte. Pas de watermark.
${reglesCommunes}`,
      `${productContextText}
PROMPT 6 – AUTRE PIÈCE / AUTRE AMBIANCE:
Même produit dans une pièce ou un contexte d'intérieur complètement différent des images 1 et 2.
Si image 1 = salon, utiliser cuisine scandinave ou bureau minimaliste ou chambre cosy.
Palette de couleurs différente, lumière naturelle zénithale.
Cadrage large, produit visible et à l'échelle.
Pas de texte. Pas de watermark.
${reglesCommunes}`,
      `${productContextText}
PROMPT 7 – RÉFÉRENCE D'ÉCHELLE / USAGE:
Photo montrant la taille réelle du produit grâce à une référence d'échelle discrète.
Un objet commun connu (tasse, livre, plante en pot) posé à côté du produit pour donner l'échelle.
Plan moyen, produit et objet de référence nets et bien cadrés.
Fond épuré, lumière naturelle douce, rendu naturel et haut de gamme.
Pas de texte marketing. Pas de watermark.
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
      const promptIndex =
        quantity === 1 && singlePromptIndex !== null
          ? singlePromptIndex % IMAGE_PROMPTS.length
          : index % IMAGE_PROMPTS.length;
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
      provider: 'nanobanana',
      model: engineSafe === 'pro' ? 'nanobanana-generate-pro' : 'nanobanana-generate',
      requestedEngine: engineSafe,
    });

  } catch (error: any) {
    console.error(`[IMAGE GEN] Fatal error (${Date.now() - startTime}ms):`, error.message);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la génération des images' },
      { status: 500 }
    );
  }
}
