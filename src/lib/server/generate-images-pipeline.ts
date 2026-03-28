/**
 * Pipeline partagé : route Next `/api/generate-images` + Netlify Background Function (bundlée).
 * Ne pas importer `next/server` ici (esbuild worker).
 */
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { geminiStyleHint } from '@/lib/image-style-presets';
import { isAthleticOrFormFittingApparel, isLikelyApparelProduct } from '@/lib/apparel-product-detection';

let sharp: any;
try { sharp = require('sharp'); } catch { sharp = null; }

/** Timeout HTTP par appel Gemini (les preview 3.x sont plus lents que 2.5). */
const GEMINI_IMAGE_FETCH_TIMEOUT_MS = 45_000;
/** Nano Banana — Gemini 2.5 Flash Image (option économique / rapide). */
const GEMINI_IMAGE_MODEL_FLASH = 'gemini-2.5-flash-image';
/** Nano Banana 2 — Gemini 3.1 Flash Image (preview, option qualité / crédits Pro). */
const GEMINI_IMAGE_MODEL_PRO = 'gemini-3.1-flash-image-preview';
/** Budget max pour 1 image en mode « chunked » (1 image / requête côté client). */
const GEMINI_FAST_SINGLE_WALL_MS = 60_000;
/** Pro preview : plusieurs essais possibles + génération lente. */
const GEMINI_PRO_SINGLE_WALL_MS = 120_000;
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
function readGeminiChunkSingleWallMs(isProEngine: boolean, netlifyBackgroundWorker: boolean): number {
  const raw = process.env.GEMINI_CHUNK_SINGLE_WALL_MS;
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 12_000 && n <= 120_000) return Math.floor(n);
  }
  if (isNetlifyRuntime() && !netlifyBackgroundWorker) return 25_000;
  return isProEngine ? GEMINI_PRO_SINGLE_WALL_MS : GEMINI_FAST_SINGLE_WALL_MS;
}

/**
 * Timeout HTTP Gemini pour 1 image en mode chunked sur Netlify.
 * Le gateway coupe souvent ~26 s **au total** (auth + sharp + Gemini + upload Supabase) : référence plus petite + 1 tentative.
 * Monte `GEMINI_NETLIFY_FAST_HTTP_MS` jusqu’à 25000 si ton plan tolère ; au-delà → 504 ou Vercel.
 */
function readGeminiNetlifyFastHttpMs(): number {
  const raw = process.env.GEMINI_NETLIFY_FAST_HTTP_MS;
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 12_000 && n <= 26_000) return Math.floor(n);
  }
  return 22_000;
}

function geminiFetchSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), timeoutMs);
  return c.signal;
}

async function uploadBase64ToSupabase(
  supabase: any,
  base64DataUrl: string,
  userId: string,
  index: number
): Promise<string | null> {
  try {
    const match = base64DataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    const b64 = match[2];
    const ext = mime.includes('png') ? 'png' : 'jpg';
    const fileName = `${userId}/${Date.now()}_${index}.${ext}`;
    const buffer = Buffer.from(b64, 'base64');
    const { error } = await supabase.storage
      .from('generated-images')
      .upload(fileName, buffer, { contentType: mime, upsert: true });
    if (error) {
      console.warn('[IMAGE GEN] Supabase upload error:', error.message);
      return null;
    }
    // URL signée (fonctionne même si le bucket n’est pas « public » en lecture).
    const signed = await supabase.storage
      .from('generated-images')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365);
    if (!signed.error && signed.data?.signedUrl) {
      return signed.data.signedUrl;
    }
    const { data } = supabase.storage.from('generated-images').getPublicUrl(fileName);
    return data?.publicUrl ?? null;
  } catch (e: any) {
    console.warn('[IMAGE GEN] Supabase upload crash:', e.message);
    return null;
  }
}

function allowBase64ImageFallback(): boolean {
  return (
    process.env.NODE_ENV === 'development' || process.env.IMAGE_ALLOW_BASE64_FALLBACK === 'true'
  );
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

export type GenerateImagesPipelineResult = { status: number; json: Record<string, unknown> };

/**
 * Exécution Gemini + upload (après auth/quota/validation côté route).
 * `netlifyBackgroundWorker`: true dans la Background Function Netlify → pas de plafond ~26 s (timeouts « normaux »).
 */
export async function runGenerateImagesPipeline(opts: {
  body: Record<string, unknown>;
  user: User;
  supabase: SupabaseClient;
  startTime: number;
  netlifyBackgroundWorker?: boolean;
}): Promise<GenerateImagesPipelineResult> {
  const { body, user, supabase, startTime } = opts;
  const netlifyBackgroundWorker = opts.netlifyBackgroundWorker === true;
  const { incrementAnalysisCount, getUserQuotaInfo } = await import('@/lib/subscription-quota');

  try {
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
      isApparel: isApparelRaw,
      productKind,
    } = body as Record<string, any>;
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
    if (!sourceImage) return { status: 400, json: { error: 'Image source requise' } };
    if (quantity < 1 || quantity > 10) return { status: 400, json: { error: 'Quantité entre 1 et 10' } };

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
      const quotaInfoInner = await getUserQuotaInfo(user.id);
      if (quotaInfoInner.remaining < 1) {
        return {
          status: 403,
          json: {
            error: 'QUOTA_EXCEEDED',
            message: 'Crédits insuffisants. Il te faut au moins 1 crédit pour générer des images.',
          },
        };
      }
    }

    const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim();
    if (!GEMINI_KEY) {
      console.error('[IMAGE GEN] GEMINI_API_KEY manquante');
      return {
        status: 500,
        json: {
          error: 'SERVER_CONFIG_ERROR',
          message:
            'GEMINI_API_KEY est requise pour la génération d\'images (API Google Gemini — Nano Banana / Nano Banana 2).',
        },
      };
    }

    // ── GEMINI : Nano Banana (flash) / Nano Banana 2 (pro) ──
    {
      const productDesc = (productTitle && String(productTitle).trim())
        ? String(productTitle).trim().substring(0, 200)
        : 'product from the listing';
      const tagsList = Array.isArray(tags) ? tags.slice(0, 15).join(', ') : '';
      const materialsStr = (materials && String(materials).trim()) ? String(materials).trim().substring(0, 150) : '';
      const keywordPart = [tagsList && `Keywords: ${tagsList}`, materialsStr && `Materials: ${materialsStr}`].filter(Boolean).join('. ') || '';
      const styleHint = geminiStyleHint(typeof style === 'string' ? style : undefined);
      // Prod historique = prompts génériques ; l'heuristique titre/tags active les prompts textile (souvent plus de refus Gemini).
      const apparelKeywordHeuristic =
        process.env.APPAREL_IMAGE_PROMPTS === '1' || process.env.APPAREL_IMAGE_PROMPTS === 'true';
      const apparelMode = isLikelyApparelProduct({
        productTitle: productDesc,
        tags,
        materials,
        forceApparel: isApparelRaw === true,
        forceNotApparel: isApparelRaw === false,
        productKind: typeof productKind === 'string' ? productKind : null,
        keywordHeuristicEnabled: apparelKeywordHeuristic,
      });
      const athleticImageSafeMode =
        apparelMode &&
        isAthleticOrFormFittingApparel({
          productTitle: productDesc,
          tags,
          materials,
        });

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
      const isNetlifyHost = isNetlifyRuntime() && !netlifyBackgroundWorker;
      const engineSafe: 'flash' | 'pro' = engine === 'pro' ? 'pro' : 'flash';
      const isProEngine = engineSafe === 'pro';
      const geminiImageEditModel =
        engineSafe === 'pro' ? GEMINI_IMAGE_MODEL_PRO : GEMINI_IMAGE_MODEL_FLASH;
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
            // Netlify : image plus légère = moins de temps sharp + payload Gemini + upload (marge pour le plafond ~26 s).
            const maxSide = isNetlifyFastSingle
              ? 640
              : isFastChunkedSingle
                ? (isProEngine ? 1024 : 896)
                : isProEngine
                  ? 1024
                  : 768;
            const jpegQ = isNetlifyFastSingle
              ? 72
              : isFastChunkedSingle
                ? (isProEngine ? 88 : 80)
                : isProEngine
                  ? 85
                  : 72;
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
        return {
          status: 200,
          json: {
            success: false,
            imageTaskIds: [],
            imageDataUrls: [],
            error: 'IMAGE_SUBMIT_FAILED',
            message: 'Gemini n\'a reçu aucune image de référence valide.',
          },
        };
      }

      const realismBoost =
        engineSafe === 'pro'
          ? 'High-fidelity pro render: crisp details, natural micro-textures, realistic global illumination, physically plausible contact shadows and reflections, accurate perspective and scale.'
          : isFastChunkedSingle
            ? 'Photorealistic Etsy listing quality: sharp product focus, natural soft light, accurate colors and materials, subtle realistic shadows, avoid plastic/AI look.'
            : 'Fast realistic render with clean natural lighting.';
      const apparelContextNote = apparelMode
        ? athleticImageSafeMode
          ? `
TEXTILE (ACTIVEWEAR / SPORT): Même article que les références. Présentation e-commerce SANS personne ni peau: ghost mannequin, cintre mural, flat-lay ou forme de couture — évite les refus API image sur sport / yoga. Tissu avec relief et plis naturels. Pas de table ronde type « miroir » ni cadre circulaire.
`
          : `
TEXTILE: Même article que sur les références. Porté = cadrage buste / taille (épaules → hanches), jamais silhouette entière sans visage (évite artefacts). Ghost mannequin, cintre mural ou mannequin buste OK. Tissu avec relief et plis naturels. Pas de table ronde type « miroir » ni cadre circulaire autour du produit.
`
        : '';
      const baseContext = `Product: ${productDesc}.${keywordPart ? ` ${keywordPart}.` : ''} ${styleHint} ${realismBoost}${apparelContextNote}
CRITICAL: Use ONLY the provided reference images for the product source of truth (main physical object only). Keep EXACT same shape, silhouette, geometry, proportions, colors and materials for the main product object.
Never replace the main product with another object/person.${
        apparelMode
          ? athleticImageSafeMode
            ? ' Do not show human skin or photo-realistic models; use invisible mannequin, dress form, or hanger only.'
            : ' A neutral fit model may wear the garment only to show the same item from references (not a substitute product).'
          : ''
      }
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
        `Cohérence visuelle entre toutes les images générées (même produit, même style global, mais décors distincts).` +
        (apparelMode
          ? ` PRIORITÉ TEXTILE: relief du tissu, plis crédibles, chute naturelle — pas d'article raide ou sans volume. Éviter table ronde, plateau circulaire et effet miroir circulaire sur le produit.`
          : '');

      const STYLE_EXPECTED_GEMINI =
        `Style visuel attendu: tons chauds et naturels, lumière douce, ambiance propre et rassurante, fond simple et élégant.`;

      const IMAGE_PROMPTS_DEFAULT = [
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

      const IMAGE_PROMPTS_APPAREL = [
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – PORTÉ / LOOKBOOK (CADRAGE BUSTE):
Le vêtement EXACT des références est porté, pose calme type catalogue Etsy.
OBLIGATOIRE: cadrage du milieu de poitrine au haut des hanches (buste / taille) OU épaules+torse uniquement — le textile occupe ~70–85% du cadre.
INTERDIT: plan corps entier (tête aux pieds) avec tête absente, floutée ou coupée — provoque des corps irréalistes.
Intérieur lumineux, lumière douce latérale. Plis naturels.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 2 – GHOST MANNEQUIN 3D:
Même article sur ghost mannequin (volume creux visible au col, textile en relief). Tombé naturel type boutique premium. Fond studio gris clair ou blanc cassé.
Pas de rendu « collage » sans épaisseur.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 3 – CINTRE MURAL:
Même vêtement sur cintre (bois ou métal sobre), suspendu face à un mur plat vertical studio (pas de vue plongeante). Plis dus à la gravité. Le textile occupe ~70% du cadre.
INTERDIT: table ronde, plateau circulaire, surface « miroir », piédestal cylindrique, flat-lay pour ce prompt.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 4 – MENSURATIONS (OBLIGATOIRE):
Flat-lay vu du dessus, orthogonale, sur fond rectangulaire premium: papier seamless blanc/crème, lin clair sur table à angles droits, ou panneau studio gris — bords droits visibles au cadre.
INTERDIT: table ronde, plateau circulaire, reflet miroir, cadre ovale/circulaire, décor type annonce marketplace cheap.
Le vêtement garde un léger relief, lisible de face.
${dimensionsStrictBlock}
Flèches fines avec labels numériques. Style sobre et haut de gamme.
Texte uniquement pour les mensurations (pas de texte marketing).`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 5 – GROS PLAN MATIÈRE:
Extrême proximité sur texture, couture ou maille — identique aux références. Le tissu suit une courbe ou un pli (volume conservé). Fond neutre flouté.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 6 – AMBIANCE SOIR (BUSTE OU MANNEQUIN):
Même article: soit porté en cadrage buste–hanches (comme prompt 1), soit sur ghost mannequin ou mannequin buste. Lumière tamisée chaude (lampe, golden hour intérieur). Drapé et volume visibles.
INTERDIT: silhouette humaine entière sans tête.
Pas de texte. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 7 – ÉCHELLE & VOLUME:
Empilement plié avec épaisseur visible, OU même vêtement sur cintre à côté d'un livre fermé format poche pour l'échelle. Pas de mini-vêtement noyé dans un décor immense.
Pas de texte marketing. Pas de watermark.`
          + `\n${GLOBAL_PROMPT_RULES_GEMINI}`,
      ];

      const IMAGE_PROMPTS_APPAREL_EFFECTIVE = athleticImageSafeMode
        ? (() => {
            const p1NoHuman =
              `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – STUDIO SANS MODÈLE (SPORT / ACTIVEWEAR):
Même article EXACT que les références sur **ghost mannequin** (volume 3D, intérieur de col visible) OU **cintre mural** sur fond studio neutre. Look fiche produit technique, sobre, familial — type boutique running / yoga en ligne.
INTERDIT sur cette image: peau humaine, silhouette réaliste, modèle « fitness », mise en scène suggestive.
Pas de texte. Pas de watermark.` + `\n${GLOBAL_PROMPT_RULES_GEMINI}`;
            const p6NoHuman =
              `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 6 – LUMIÈRE CHAUDE (SANS PERSONNE):
Même vêtement sur **ghost mannequin** ou **cintre**; lumière tamisée chaude (lampe indirecte). Arrière-plan discret. Aucun humain, aucune peau.
Pas de texte. Pas de watermark.` + `\n${GLOBAL_PROMPT_RULES_GEMINI}`;
            return IMAGE_PROMPTS_APPAREL.map((p, i) => (i === 0 ? p1NoHuman : i === 5 ? p6NoHuman : p));
          })()
        : IMAGE_PROMPTS_APPAREL;

      const IMAGE_PROMPTS_GEMINI = apparelMode ? IMAGE_PROMPTS_APPAREL_EFFECTIVE : IMAGE_PROMPTS_DEFAULT;

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
      const chunkSingleWallMs = readGeminiChunkSingleWallMs(isProEngine, netlifyBackgroundWorker);
      console.log(
        `[IMAGE GEN] Gemini engine=${engineSafe}, apparel=${apparelMode}, athleticSafe=${athleticImageSafeMode}, refs=${inlineImageParts.length}, fastSingle=${isFastChunkedSingle}, chunkWall=${chunkSingleWallMs}, model=${geminiImageEditModel}`
      );

      const geminiErrors: string[] = [];

      const tryGeminiOnce = async (
        prompt: string,
        model: string,
        partsForAttempt: { inlineData: { mimeType: string; data: string } }[],
        timeoutMs: number
      ): Promise<string | null> => {
        try {
          const t0 = Date.now();
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
          const elapsed = Date.now() - t0;
          if (!res.ok) {
            const t = await res.text().catch(() => '');
            const errMsg = `HTTP ${res.status} (${elapsed}ms): ${t.substring(0, 200)}`;
            console.warn(`[IMAGE GEN] Gemini ${model} non-ok:`, errMsg);
            geminiErrors.push(errMsg);
            if (res.status === 429 || res.status === 503) {
              await new Promise((r) => setTimeout(r, 400));
            }
            return null;
          }
          const data = await res.json();
          if (data?.error && !data?.candidates) {
            const ge = data.error;
            const errMsg =
              typeof ge === 'object' && ge !== null && 'message' in ge
                ? `API error: ${String((ge as { message?: string }).message)}`
                : `API error: ${JSON.stringify(ge).substring(0, 220)}`;
            console.warn(`[IMAGE GEN] Gemini ${model}`, errMsg);
            geminiErrors.push(errMsg);
            return null;
          }
          const cand0 = data?.candidates?.[0];
          const parts = cand0?.content?.parts || [];
          for (const part of parts) {
            const blob = (part as { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } })
              ?.inlineData ?? (part as { inline_data?: { data?: string; mime_type?: string } })?.inline_data;
            const b64 = blob?.data;
            const mime = (blob as { mimeType?: string; mime_type?: string } | undefined)?.mimeType
              ?? (blob as { mime_type?: string } | undefined)?.mime_type
              ?? 'image/png';
            if (typeof b64 === 'string' && b64.length > 100) {
              console.log(`[IMAGE GEN] Gemini ${model} OK (${elapsed}ms), image ${b64.length} bytes`);
              return `data:${mime};base64,${b64}`;
            }
          }
          const finishReason = cand0?.finishReason;
          const blockReason = data?.promptFeedback?.blockReason ?? cand0?.promptFeedback?.blockReason;
          const errMsg = `No image in response (${elapsed}ms) finish=${finishReason} block=${blockReason} candidates=${data?.candidates?.length ?? 0}`;
          console.warn(`[IMAGE GEN] Gemini ${model}`, errMsg);
          geminiErrors.push(errMsg);
        } catch (e: any) {
          const name = e?.name || '';
          if (name === 'TimeoutError' || /abort/i.test(String(e?.message))) {
            const errMsg = `Timeout/abort after ${timeoutMs}ms`;
            console.warn(`[IMAGE GEN] Gemini ${model}`, errMsg);
            geminiErrors.push(errMsg);
          } else {
            const errMsg = `Exception: ${e?.message || e}`;
            console.warn(`[IMAGE GEN] Gemini ${model}`, errMsg);
            geminiErrors.push(errMsg);
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
        return tryGeminiOnce(prompt, geminiImageEditModel, partsForAttempt, timeoutMs);
      };

      /**
       * Netlify : gateway ~26 s → une seule tentative Gemini assez courte (chunked 1 image / requête).
       * Hors Netlify ou hors chunked : budgets longs + retries.
       */
      const netlifyFastSingle = isNetlifyHost && isFastChunkedSingle;
      const geminiHttpCapMs = netlifyFastSingle
        ? readGeminiNetlifyFastHttpMs()
        : isNetlifyHost
          ? Math.min(GEMINI_IMAGE_FETCH_TIMEOUT_MS, engineSafe === 'pro' ? 25_000 : 20_000)
          : engineSafe === 'pro'
            ? 95_000
            : GEMINI_IMAGE_FETCH_TIMEOUT_MS;

      const generateOne = async (prompt: string, promptIndex: number): Promise<string | null> => {
        const mainPart = [inlineImageParts[0]].filter(
          (part): part is { inlineData: { mimeType: string; data: string } } => Boolean(part)
        );
        const isMensurationsPrompt = promptIndex === 3;
        const maxStandardAttempts = netlifyFastSingle ? 1 : 3;

        const apparelMensurationsFallback = apparelMode
          ? `\n\nSIMPLIFY: Top-down flat-lay on plain rectangular off-white paper; straight edges; dimension arrows only; no round table, no mirror, no circle frame.`
          : '';
        const apparelGenericFallback = apparelMode
          ? `\n\nSIMPLIFY: Same garment, soft studio light, clean neutral backdrop, minimal scene — professional Etsy product shot.`
          : '';

        if (isMensurationsPrompt) {
          if (netlifyFastSingle) {
            let img = await tryGeminiForMensurations(prompt, mainPart, geminiHttpCapMs);
            if (img) return img;
            if (apparelMensurationsFallback) {
              img = await tryGeminiOnce(
                prompt + apparelMensurationsFallback,
                geminiImageEditModel,
                mainPart,
                geminiHttpCapMs
              );
            }
            return img;
          }
          for (let round = 0; round < 3; round++) {
            let img = await tryGeminiForMensurations(prompt, mainPart, geminiHttpCapMs);
            if (img) return img;
            await new Promise((r) => setTimeout(r, 1500));
            img = await tryGeminiForMensurations(prompt, mainPart, geminiHttpCapMs);
            if (img) return img;
            if (round < 2) await new Promise((r) => setTimeout(r, 1000 * (round + 1)));
          }
          if (apparelMensurationsFallback) {
            const imgFb = await tryGeminiOnce(
              prompt + apparelMensurationsFallback,
              geminiImageEditModel,
              mainPart,
              geminiHttpCapMs
            );
            if (imgFb) return imgFb;
          }
          return null;
        }

        for (let attempt = 0; attempt < maxStandardAttempts; attempt++) {
          const img = await tryGeminiOnce(prompt, geminiImageEditModel, mainPart, geminiHttpCapMs);
          if (img) return img;
          if (attempt < maxStandardAttempts - 1) await new Promise((r) => setTimeout(r, 900 + attempt * 700));
        }
        if (apparelGenericFallback) {
          const imgFb = await tryGeminiOnce(
            prompt + apparelGenericFallback,
            geminiImageEditModel,
            mainPart,
            geminiHttpCapMs
          );
          if (imgFb) return imgFb;
        }
        return null;
      };

      try {
        // Fast single : 1 image / requête.
        // Pro (hors chunked) : jamais de parallèle interne — évite 504 sur hébergeurs ~60s.
        // Flash 2+ : jusqu'à 3 prompts Gemini en parallèle par vague.
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
          const geminiDetail = geminiErrors.length > 0
            ? geminiErrors.slice(-3).join(' | ')
            : 'Aucune erreur Gemini capturée (réponses vides ?)';
          console.error(`[IMAGE GEN] Gemini 0 images. Errors: ${geminiDetail}`);
          const netlifyHint =
            netlifyFastSingle && isNetlifyHost
              ? ' Sur Netlify (~25 s max par requête), réessaie ou utilise « Nano Banana (2.5) » si l’IA est trop lente.'
              : '';
          return {
            status: 200,
            json: {
              success: false,
              imageTaskIds: [],
              imageDataUrls: [],
              error: 'IMAGE_SUBMIT_FAILED',
              message: `Gemini ${geminiImageEditModel}: ${geminiDetail}${netlifyHint}`,
            },
          };
        }
        if (!skipCreditDeduction) {
          try {
            await incrementAnalysisCount(user.id, 1.0);
          } catch (e: any) {
            console.error(`[IMAGE GEN] Credit deduction error: ${e.message}`);
          }
        }
        // ── Upload to Supabase Storage to avoid Netlify 6MB response limit ──
        const uploadedUrls: string[] = [];
        for (let i = 0; i < imageDataUrls.length; i++) {
          const url = await uploadBase64ToSupabase(supabase, imageDataUrls[i], user.id, i);
          if (url) {
            uploadedUrls.push(url);
            console.log(`[IMAGE GEN] Uploaded image ${i + 1} to Supabase: ${url.substring(0, 80)}`);
          } else if (allowBase64ImageFallback()) {
            uploadedUrls.push(imageDataUrls[i]);
            console.warn(`[IMAGE GEN] Upload failed for image ${i + 1}, falling back to base64 (dev only)`);
          } else {
            console.error(
              `[IMAGE GEN] Upload failed for image ${i + 1}; refusing base64 in prod (réponse JSON > limite gateway)`
            );
            return {
              status: 500,
              json: {
                success: false,
                imageTaskIds: [],
                imageDataUrls: [],
                error: 'IMAGE_STORAGE_FAILED',
                message:
                  'Enregistrement des images impossible (Supabase). Vérifie le bucket « generated-images », les droits du service role, et NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sur Netlify.',
              },
            };
          }
        }
        const partial = uploadedUrls.length < numImages;
        console.log(
          `[IMAGE GEN] Gemini image-edit: ${uploadedUrls.length}/${numImages} image(s) in ${Date.now() - startTime}ms${partial ? ' (partial)' : ''}`
        );
        return {
          status: 200,
          json: {
            success: true,
            imageTaskIds: [],
            imageDataUrls: uploadedUrls,
            provider: 'gemini',
            model: geminiImageEditModel,
            requestedEngine: engineSafe,
            ...(partial && {
              message: `Seulement ${uploadedUrls.length} image(s) sur ${numImages} (temps ou quota). Réessaie « Nouvelle génération » pour compléter.`,
            }),
          },
        };
      } catch (e: any) {
        console.error('[IMAGE GEN] Gemini fatal:', e.message);
        const raw = (e?.message || '').toString();
        const isQuota = /quota|exceeded|limit/i.test(raw);
        return {
          status: 200,
          json: {
            success: false,
            imageTaskIds: [],
            imageDataUrls: [],
            error: isQuota ? 'QUOTA_EXCEEDED' : 'IMAGE_SUBMIT_FAILED',
            message: isQuota
              ? 'Crédits insuffisants. Passe à un plan supérieur ou attends le prochain cycle.'
              : (raw || 'Erreur Gemini image generation.'),
          },
        };
      }
    }
    throw new Error('generate-images-pipeline: fin de flux inattendue');
  } catch (error: any) {
    console.error(`[IMAGE GEN] Fatal error (${Date.now() - startTime}ms):`, error.message);
    return {
      status: 500,
      json: { error: error.message || 'Erreur lors de la génération des images' },
    };
  }
}
