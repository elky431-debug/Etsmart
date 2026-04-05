import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { geminiStyleHint, nanoStyleSuffixFr } from '@/lib/image-style-presets';
import { isAthleticOrFormFittingApparel } from '@/lib/apparel-product-detection';

let sharp: any;
try { sharp = require('sharp'); } catch { sharp = null; }

// Vercel: aligné avec vercel.json. Netlify: gateway ~26s → mode chunked, budget serré (voir readGeminiChunkSingleWallMs + cap Gemini).
export const maxDuration = 120;
export const runtime = 'nodejs';

const GEMINI_IMAGE_FETCH_TIMEOUT_MS = 28_000;
/** Budget max pour 1 image en mode « chunked » (1 image / requête côté client). */
const GEMINI_FAST_SINGLE_WALL_MS = 45_000;
/** Pro chunked : un peu plus de marge qu'un seul essai Gemini, tout en restant sous timeout gateway (~60s). */
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
 * Pro (gemini-3.1) est plus lent → budget légèrement plus large.
 */
function readGeminiChunkSingleWallMs(isProFastSingle: boolean): number {
  const raw = process.env.GEMINI_CHUNK_SINGLE_WALL_MS;
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 12_000 && n <= 120_000) return Math.floor(n);
  }
  if (isNetlifyRuntime()) return 24_000;
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

    // ── Parse body ───────────────────────────────────────────
    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Format de requête invalide' }, { status: 400 }); }

    // ── Quota check ──────────────────────────────────────────
    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    const skipCreditDeductionEarly = body?.skipCreditDeduction === true;
    // FREE plan: allowed via quick-generate (credits pre-deducted), blocked otherwise
    if ((quotaInfo.plan === 'FREE' || quotaInfo.status === 'free') && !skipCreditDeductionEarly) {
      return NextResponse.json({ error: 'PLAN_UPGRADE_REQUIRED', message: "La génération d'images nécessite un abonnement payant." }, { status: 403 });
    }
    if (quotaInfo.status !== 'active' && !(quotaInfo.plan === 'FREE' && skipCreditDeductionEarly)) {
      return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required.' }, { status: 403 });
    }

    const {
      sourceImage,
      backgroundImage,
      quantity = 1,
      aspectRatio: aspectRatioRaw = '1:1',
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
      forceNanobanana,
    } = body;
    // Always force 1:1 — Etsy listings must be square
    const aspectRatio = '1:1';
    void aspectRatioRaw; // client value ignored
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
    const forceNano = process.env.USE_NANOBANANA_IMAGES === 'true' || forceNanobanana === true;
    const requestedEngine: 'flash' | 'pro' = body?.engine === 'pro' ? 'pro' : 'flash';
    // Flash → Gemini direct (sync, rapide). Pro → NanoBanana Flash (async, meilleure qualité vêtements/fonds).
    // NanoBanana uniquement si clé disponible, sinon fallback Gemini pour les deux.
    const NANO_KEY_CHECK = process.env.NANONBANANA_API_KEY || process.env.NANOBANANA_API_KEY || process.env.NANO_BANANA_API_KEY || process.env.NANONBANANA_KEY || process.env.NANOBANANA_KEY;
    const useGemini = !!GEMINI_KEY && !forceNano && (requestedEngine === 'flash' || !NANO_KEY_CHECK);
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

      // Détection automatique de la catégorie produit pour des prompts adaptés
      type ProductCategory = 'clothing' | 'furniture' | 'jewelry' | 'lighting' | 'home_decor' | 'general';
      function detectProductCategory(): ProductCategory {
        const text = `${productTitle || ''} ${tagsList} ${materialsStr}`.toLowerCase();
        if (/\b(shirt|dress|jacket|pant|jeans|hoodie|sweatshirt|vest|coat|blouse|top|skirt|shorts|tshirt|t-shirt|legging|cardigan|sweater|pullover|suit|trouser|sock|boot|shoe|sneaker|hat|cap|scarf|glove|belt|bag|purse|handbag|backpack|wallet|clothing|apparel|garment|wearable|wear|vêtement|chemise|robe|manteau|pantalon|jean|sweat|pull|veste|jupe|short|chaussure|botte|chapeau|écharpe|bonnet|sac)\b/.test(text)) {
          return 'clothing';
        }
        if (/\b(chair|table|sofa|couch|desk|shelf|shelves|cabinet|dresser|nightstand|bench|wardrobe|armoire|bookcase|ottoman|stool|rack|storage|furniture|drawer|credenza|sideboard|console|sectional|loveseat|chaise|fauteuil|canapé|bureau|étagère|armoire|commode|meuble|tiroir|placard|buffet|table)\b/.test(text)) {
          return 'furniture';
        }
        if (/\b(ring|bracelet|necklace|earring|pendant jewelry|jewelry|jewel|chain|bangle|choker|brooch|anklet|cuff|bague|collier|boucle|pendentif|bijou|chaîne)\b/.test(text)) {
          return 'jewelry';
        }
        if (/\b(lamp|lampe|pendant lamp|hanging lamp|ceiling lamp|chandelier|sconce|lantern|luminaire|suspension|plafonnier|applique|lustre|ampoule|lighting|light fixture|pendant light|floor lamp|table lamp|wall lamp|led lamp)\b/.test(text)) {
          return 'lighting';
        }
        if (/\b(candle|vase|pillow|cushion|rug|blanket|throw|curtain|frame|mirror|clock|planter|pot|basket|tray|bowl|mug|cup|plate|towel|mat|decoration|decor|bougie|coussin|tapis|couverture|rideau|cadre|miroir|horloge|plateau|bol|tasse|assiette|décoration)\b/.test(text)) {
          return 'home_decor';
        }
        return 'general';
      }
      const productCategory = detectProductCategory();
      const athleticSafeMode = productCategory === 'clothing' && isAthleticOrFormFittingApparel({
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
      const isNetlifyHost = isNetlifyRuntime();
      const engineSafe: 'flash' | 'pro' = engine === 'pro' ? 'pro' : 'flash';
      const isProFastSingle = isFastChunkedSingle && engineSafe === 'pro';
      // Modèle unique gemini-2.5-flash-image pour Flash et Pro — fiable, rapide, pas de timeout.
      // Différenciation Pro/Flash : résolution d'entrée + qualité JPEG + prompts + retries.
      const GEMINI_IMAGE_EDIT_MODEL = 'gemini-2.5-flash-image';
      // Sur Netlify: 1 seul essai serveur (wall clock 24s, 1 essai Gemini = ~22s max, pas de place pour 2+).
      // Hors Netlify (Vercel 120s): Pro = 3 essais, Flash = 2 essais.
      const geminiAttemptsPerImage = isNetlifyHost ? 1 : (engineSafe === 'pro' ? 3 : 2);
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
            // Pro: résolution maximale. Flash sur Netlify: 640px (rapide). Flash ailleurs: 768px.
            const maxSide = engineSafe === 'pro' ? 1024 : (isNetlifyHost ? 640 : 768);
            const jpegQ = engineSafe === 'pro' ? 90 : 72;
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
        engineSafe === 'pro'
          ? 'Ultra high-fidelity professional render: maximum sharpness on every product detail, premium studio-grade lighting with subtle rim light and soft fill, natural micro-textures (wood grain, fabric weave, metal brushing), physically accurate reflections and refractions, cinematic depth of field with creamy bokeh, color-accurate materials faithful to the reference image, zero AI artifacts, zero plastic look — final result must be indistinguishable from a professional $500 product photography session.'
          : 'Photorealistic Etsy listing quality: sharp product focus, natural soft light, accurate colors and materials, subtle realistic shadows, avoid plastic/AI look.';
      const baseContext = `Product: ${productDesc}.${keywordPart ? ` ${keywordPart}.` : ''} ${styleHint} ${realismBoost}
CRITICAL: Use ONLY the provided reference images for the product source of truth (main physical object only). Keep EXACT same shape, silhouette, geometry, proportions, colors and materials for the main product object.
Never replace the main product with another object/person.
Only change scene/background/camera angle/focal length. The rest of the scene (lighting, decor, small props around the product) can change.
PRODUCT PROMINENCE (MANDATORY): The main product must be the undisputed focal point. It must be centered, sharp, and occupy at least 65–75% of the total frame area. Camera stays CLOSE to the product — no wide room shots where the product appears small. Background must be blurred or simple. If the product looks small in the frame, zoom in more.
ANTI-ALlEXPRESS TEMPLATE BREAKER: do not preserve any AliExpress page layout cues (borders, rounded-corner marketplace widgets, promo strips, corner badges, corner labels).
ANTI-TEXT (VERY IMPORTANT): if the reference contains ANY text/letters/numbers-like glyphs (titles, subtitles, promo words, captions, overlays), REMOVE it completely. Never generate new words or typography (except dimension labels on image 4).
SOURCE CLEANUP (MANDATORY): Reference screenshots often include watermarks, AliExpress/Amazon-style logos, supplier brand marks, price tags, QR codes, overlaid text — DO NOT reproduce any of them. Remove them completely.
Final image must be a clean, premium, seller-neutral Etsy listing photo with zero third-party branding or embedded marketplace UI.`;
      // Prompts alignés sur le flow "génération rapide" :
      // 5 visuels différents (contexte, équilibre, zoom, mensurations, stratégique) + règles globales.
      const GLOBAL_PROMPT_RULES_GEMINI =
        `FORMAT OBLIGATOIRE: image CARRÉE 1:1 — aucune image verticale ni horizontale. ` +
        `RÈGLES GLOBALES (TRÈS IMPORTANT): ` +
        `PRODUIT CENTRÉ ET DOMINANT: le produit principal est TOUJOURS au centre du cadre, net, et occupe 65-75% de la surface totale de l'image. Le fond et le décor sont secondaires — jamais plus importants que le produit lui-même. ` +
        `Si la photo source contient logos fournisseur, filigranes, bandeaux AliExpress/marketplace, TEXTE incrusté ou badges en coin : NE JAMAIS les recopier — les effacer entièrement sur l'image générée (photo produit propre, sans marque tierce). ` +
        `Pas de watermark. ` +
        `ZERO TEXTE / ZERO TYPOGRAPHIE: aucune lettre, aucun mot, aucun chiffre, aucun symbole de prix/labels/UI, sauf UNIQUEMENT les labels de DIMENSIONS sur l'image 4. ` +
        `Rendu photo réaliste type Etsy haut de gamme, pas de style trop "IA". ` +
        `Style visuel: tons chauds et naturels, lumière douce (daylight ou warm indoor light), ambiance propre et élégante, univers premium mais accessible. ` +
        (productCategory === 'clothing'
          ? `FOND OBLIGATOIRE (RÈGLE ABSOLUE): ne jamais utiliser un fond blanc uni ou un fond studio blanc vide — chaque image doit montrer une surface ou un arrière-plan avec une couleur, une texture ou une matière clairement visible (bois, béton, tissu, mur coloré, surface sombre, etc.). Le fond blanc pur est INTERDIT sauf pour l'image de mensurations. `
          : `Fond simple (table/mur clair/intérieur moderne ou studio léger). `) +
        `ANTI-COPIER STRICT: chaque prompt doit générer un arrière-plan + décor + éclairage clairement différents (pas un recadrage, pas un copier/coller, pas des éléments identiques). ` +
        `Ne réutilise pas la même disposition des rideaux/tapis/coussins/objets autour du produit d'une image à l'autre. ` +
        `Cohérence visuelle entre toutes les images générées (même produit, même style global, mais décors distincts).`;

      const STYLE_EXPECTED_GEMINI =
        `Style visuel attendu: tons chauds et naturels, lumière douce, ambiance propre et rassurante, fond simple et élégant.`;

      // Prompt commun dimensions (image 4 pour toutes les catégories)
      const DIMENSIONS_PROMPT = `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 4 – PHOTO AVEC MENSURATIONS / DIMENSIONS (OBLIGATOIRE):
Image type fiche produit sur fond blanc pur ou gris très clair épuré: dimensions clairement visibles.
${dimensionsStrictBlock}
Flèches de dimension fines avec labels numériques nets. Style graphique minimaliste.
Texte uniquement pour les mensurations (pas de texte marketing).
\n${GLOBAL_PROMPT_RULES_GEMINI}`;

      // Prompts spécialisés VÊTEMENTS — lifestyle éditorial, porté, fond non-blanc
      const CLOTHING_PROMPTS_BASE = [
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – PORTÉ LIFESTYLE ÉDITORIAL:
Photo mode éditorial: le vêtement EXACT des références est porté dans un contexte lifestyle élégant (rue chic, café, parc ensoleillé, appartement lumineux).
Cadrage du milieu du buste aux hanches — torse + épaules bien visibles, visage hors-champ ou discret, pas de plan pied-tête complet.
Pose naturelle et détendue (pas de pose raide catalogue), lumière naturelle dorée ou douce lumière intérieure.
L'article occupe 65–80% du cadre. Plis et tombé naturels du tissu. Ambiance mode premium type boutique indépendante.
INTERDIT: fond studio blanc vide, mannequin sans volume, fond identique au prompt 2 ou 3.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 2 – PORTÉ DÉTAIL FIT / ANGLE DIFFÉRENT:
Le même vêtement porté, cadrage différent du prompt 1: de dos ou de côté (3/4 dos) pour montrer la coupe, la forme et le tombé depuis un autre angle.
Lumière douce naturelle, intérieur clair ou extérieur urbain. Plis et détails de coupe bien visibles.
Le textile doit montrer son volume réel: pas de rendu plat ou sans relief.
INTERDIT: répéter exactement la même pose ou le même angle que le prompt 1.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 3 – GROS PLAN TEXTURE ET FINITIONS:
Photo très rapprochée sur les détails du tissu: texture, coutures, ceinture élastique, boutons, fermeture éclair, ourlet ou broderie.
Bokeh très doux sur les bords, mise au point maximale sur la matière principale. Lumière latérale douce révélant les reliefs.
Surface neutre derrière (bois clair, lin, béton — pas de blanc uni). Produit occupe 80–85% du cadre.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 4 – PORTÉ VUE DE FACE (CORPS HUMAIN RÉEL):
Photo réaliste d'une PERSONNE HUMAINE portant le vêtement, cadrage DE FACE du buste jusqu'aux genoux. Le vêtement est enfilé sur un vrai corps humain — jambes et hanches visibles dans le vêtement, tissu en contact avec le corps, plis naturels du port. Visage coupé au-dessus du menton (hors-cadre).
Lumière naturelle douce, fond simple et clair (mur blanc cassé, intérieur minimaliste). Posture droite et naturelle.
INTERDIT: mannequin fantôme invisible, vêtement suspendu sans corps, flat-lay, fond studio blanc pur, visage reconnaissable.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 5 – PORTÉ STYLED / TENUE COMPLÈTE:
Le vêtement porté dans une tenue coordonnée stylée: associé à 1–2 accessoires neutres et discrets (ceinture, sac simple, bijou léger) qui valorisent l'article sans le faire disparaître.
Cadrage taille–épaules montrant le styling global. Lumière naturelle douce, fond lifestyle simple (mur clair, végétation floue, intérieur moderne).
L'article principal des références doit rester le centre de l'image — les accessoires sont secondaires.
INTERDIT: accessoires qui masquent le vêtement, fond identique aux prompts 1 et 2.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 6 – PORTÉ VUE DE PROFIL / AMBIANCE MAISON ARTISANALE:
Une VRAIE PERSONNE porte le vêtement, VUE DE CÔTÉ (profil à 90° ou 3/4). Cadrage buste–genoux, visage hors-champ. Tissu effectivement porté sur le corps, silhouette latérale visible.
Fond ARTISANAL et CHALEUREUX façon Etsy: mur en brique apparente peinte blanc, boiseries naturelles, étagère en bois avec quelques plantes ou objets faits main, lumière naturelle douce de fenêtre. Ambiance maison cosy et authentique — pas de studio, pas d'urbain froid.
INTERDIT: fond studio blanc, béton industriel, fond identique aux prompts 1 et 4, visage visible.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 7 – MACRO EXTRÊME TISSU (TRÈS IMPORTANT: caméra ultra proche):
Photo MACRO EXTRÊME: la caméra est à 3–8 cm du tissu. Le textile remplit 85–95% du cadre — on voit clairement les fils individuels, la trame du tissu, les mailles ou les coutures en très grand format.
Focus: ceinture élastique, couture surpiquée, texture de maille ou relief du tissu selon l'article.
ÉCLAIRAGE: lumière latérale forte à 45° révélant les micro-reliefs et la texture en 3D.
Fond: totalement flouté (bokeh), ton neutre clair derrière. Pas de fond blanc uni.
INTERDIT: plan moyen ou large du vêtement entier, objets décoratifs, lifestyle.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
      ];

      // Mode athletic (yoga, leggings, sportswear) : remplacer les prompts avec modèle humain par des flat-lays
      const CLOTHING_PROMPTS = athleticSafeMode
        ? CLOTHING_PROMPTS_BASE.map((p, i) => {
            if (i === 0) return `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – FLAT-LAY ÉDITORIAL VUE DU DESSUS:
La caméra est DIRECTEMENT AU-DESSUS (vue à 90°, plongée verticale). Le vêtement est déployé à plat au centre d'une TABLE EN BOIS FONCÉ WENGÉ (grain du bois visible, surface mate). Le textile occupe 65% du cadre, légèrement froissé pour simuler le volume. Ombres légères sur les bords du tissu. Lumière latérale douce venant de la gauche.
AUCUNE personne ni peau visible dans l'image. Fond: bois foncé uniquement, aucun blanc.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`;
            if (i === 4) return `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 5 – FLAT-LAY SPORT AVEC ACCESSOIRES:
Le vêtement plié soigneusement posé SUR UN TAPIS DE YOGA BLEU/GRIS (texture caoutchouc visible). À droite du vêtement: une bouteille d'eau mate blanche. Lumière naturelle douce zénithale. Cadrage vue de dessus à 75°.
AUCUNE personne ni peau. Surface: tapis de yoga uniquement — pas de fond blanc.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`;
            if (i === 6) return `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 7 – GROS PLAN CEINTURE / DÉTAIL TISSU:
GROS PLAN sur la ceinture élastique du vêtement posée sur une SURFACE EN BÉTON GRIS CLAIR. La ceinture remplit 70% du cadre. On voit clairement la texture du tissu, les coutures et l'élastique. Lumière rasante latérale révélant les reliefs. Fond béton gris visible.
AUCUNE personne ni peau. Surface béton gris — aucun fond blanc.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`;
            return p;
          })
        : CLOTHING_PROMPTS_BASE;

      // Règle commune meubles — toujours ancré dans la pièce, jamais flottant
      const FURNITURE_ANCHOR_RULE =
        `INTÉGRATION OBLIGATOIRE: le meuble est TOUJOURS ancré dans son environnement — posé au sol, adossé à un mur ou dans un coin de la pièce. ` +
        `INTERDIT: meuble flottant ou isolé au milieu d'une pièce vide. ` +
        `Plan moyen, meuble EN PREMIER PLAN et centré (65-70% du cadre) — le décor de la pièce est visible mais flou et secondaire derrière. ` +
        `Angle de prise de vue à hauteur d'œil (pas vue plongeante), style photo d'architecte d'intérieur.`;

      // Prompts spécialisés MEUBLES : pièces TRÈS différentes avec couleurs et styles explicites
      const FURNITURE_PROMPTS = [
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – SALON SCANDINAVE CLAIR:
${FURNITURE_ANCHOR_RULE}
Le meuble est placé contre un mur ou dans un coin d'un salon SCANDINAVE: murs blancs cassés, parquet pin clair, une plante tropicale (monstera) dans un pot en céramique blanche à côté.
Lumière du matin venant d'une fenêtre visible sur le côté, ambiance aérée et sereine.
Décoration minimaliste autour du meuble. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 2 – CHAMBRE ADULTE COSY COULEUR FORTE:
${FURNITURE_ANCHOR_RULE}
Le meuble est dans une chambre adulte, ADOSSÉ au mur: mur couleur VERT SAUGE foncé ou BLEU NUIT derrière lui.
Une lampe de chevet en laiton doré à côté, linge blanc cassé visible, ambiance cocooning intime en soirée.
Le meuble prend appui sur le sol, ombres de contact visibles. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 3 – GROS PLAN / TEXTURE ET FINITIONS:
Photo très rapprochée sur les détails de fabrication: grain du bois, métal, tissu, coutures, charnières ou pieds du meuble.
Bokeh doux sur les bords, mise au point maximale sur la matière principale.
Lumière directionnelle latérale révélant les reliefs et la texture. Fond neutre derrière.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        DIMENSIONS_PROMPT,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 5 – SALON CONTEMPORAIN CHALEUREUX:
${FURNITURE_ANCHOR_RULE}
Le meuble est placé dans un angle d'un SALON CONTEMPORAIN: murs en teinte taupe ou gris clair, parquet chêne moyen, grande fenêtre laissant entrer une lumière naturelle dorée de fin d'après-midi.
Décoration sobre: une plante en pot, quelques livres empilés à côté. Palette tons naturels, chauds et doux.
Meuble en appui au sol, ombres de contact visibles. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 6 – SALLE À MANGER MÉDITERRANÉENNE:
${FURNITURE_ANCHOR_RULE}
Le meuble est intégré dans un coin ou le long d'un mur d'une salle à manger MÉDITERRANÉENNE: mur chaux blanc, carreaux de ciment colorés au sol, arche en stuc visible en arrière-plan.
Lumière chaude et abondante, ombres douces de contact au sol, tons ocre et blanc.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 7 – VUE LÉGÈREMENT EN HAUTEUR / RÉFÉRENCE D'ÉCHELLE:
${FURNITURE_ANCHOR_RULE}
Vue 3/4 légèrement en hauteur (angle ~30°) sur le meuble posé au sol, avec une plante en pot ou un livre posés à côté pour référence d'échelle.
Fond intérieur clair et épuré (mur blanc, parquet clair), lumière naturelle douce uniforme.
Proportions réelles du meuble visibles, ancré au sol avec ombres de contact.
Pas de texte marketing. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
      ];

      // Prompts spécialisés BIJOUX
      const JEWELRY_PROMPTS = [
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – PACKSHOT STUDIO FOND SOMBRE:
Le bijou sur fond SOMBRE (velours noir ou noir mat), lumière directionnelle fine révélant chaque détail métallique.
Reflets contrôlés sur métal et pierres, profondeur et élégance.
Cadrage serré, bijou centré occupant 60% du cadre. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 2 – FLAT LAY LUXE SUR MARBRE:
Le bijou posé sur MARBRE BLANC veiné ou surface en béton ciré clair.
Pétales de fleurs séchées et feuilles d'eucalyptus disposés autour de façon élégante.
Lumière naturelle douce venant du haut, photo lifestyle premium.
Vue de dessus légèrement inclinée. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 3 – GROS PLAN ULTRA-DÉTAIL:
Macro photo du bijou: chaque pierre, sertissage, gravure ou polissage clairement visible.
Profondeur de champ très réduite, bokeh doux crémeux sur les bords.
Fond neutre blanc ou beige pastel, lumière en anneau (ring light) douce.
Bijou occupe 85% du cadre. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        DIMENSIONS_PROMPT,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 5 – LIFESTYLE PORTÉ / CONTEXTE USAGE:
Le bijou est présenté dans son contexte d'utilisation naturel: posé sur une main élégante (sans bague visible), autour d'un poignet ou sur une nuque, en situation réelle.
Fond flou bokeh d'un intérieur chic ou d'une terrasse ensoleillée.
Photo lifestyle haut de gamme. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 6 – ÉCRIN / PACKAGING PREMIUM:
Le bijou est présenté avec ou dans un écrin ouvert: velours blanc ou crème, boîte kraft ou boîte noire mate.
Fond bois clair ou marbre, ambiance cadeau et luxe accessible.
Lumière naturelle douce du matin. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 7 – FOND CLAIR / RÉFÉRENCE TAILLE:
Le bijou sur fond blanc pur avec ombre portée douce.
Un centimètre ou une règle fine positionnée discrètement en bordure pour donner l'échelle.
Lumière studio homogène, rendu catalogue propre et précis.
Bijou net, couleurs fidèles. Pas de texte marketing. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
      ];

      // Prompts généraux pour HOME DECOR et autres catégories
      // RÈGLE ABSOLUE : plan rapproché avec le produit qui remplit le cadre — JAMAIS de plan large lifestyle
      const CLOSE_UP_RULE =
        `CADRAGE OBLIGATOIRE: plan rapproché ou plan moyen SERRÉ — appareil photo très proche du produit. ` +
        `Le produit occupe 70-80% de la surface du cadre, centré et parfaitement net. ` +
        `INTERDIT: plan large avec une pièce entière visible. L'arrière-plan doit être FLOU (bokeh, f/2.8). ` +
        `Le produit est en tout premier plan — il N'EST PAS posé dans un coin de pièce au loin.`;

      const GENERAL_PROMPTS = [
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – PACKSHOT SURFACE NEUTRE:
${CLOSE_UP_RULE}
Produit posé sur une surface propre (plateau en marbre blanc, planche en bois naturel, ou tissu lin beige).
Appareil très près, produit centré et net, occupant 75% du cadre. Arrière-plan flou crème ou blanc.
Lumière naturelle douce venant de la gauche, ombres portées douces.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 2 – SURFACE SOMBRE / CONTRASTE:
${CLOSE_UP_RULE}
Produit posé sur une surface sombre (ardoise noire, bois foncé, velours gris anthracite).
Plan rapproché, produit centré à 70-75% du cadre, arrière-plan flou épuré.
Lumière directionnelle latérale douce révélant les textures et volumes du produit.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 3 – GROS PLAN DÉTAIL / TEXTURE:
Photo TRÈS rapprochée sur les détails, textures et finitions du produit.
Produit occupe 80-85% du cadre, netteté maximale sur la matière principale. Bokeh très doux sur les bords.
Fond neutre épuré (blanc ou beige), lumière latérale douce révélant les reliefs.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        DIMENSIONS_PROMPT,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 5 – LIFESTYLE PROCHE / AMBIANCE COSY:
${CLOSE_UP_RULE}
Produit posé sur une table basse ou tablette, avec 1 seul accessoire complémentaire (petite bougie, tasse, feuille d'eucalyptus) DERRIÈRE lui ou à l'extrême bord du cadre — jamais devant.
Lumière chaude de soirée (bokeh d'une lampe en fond), ambiance feutrée. Produit net, fond flou.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 6 – FOND COLORÉ / MISE EN VALEUR:
${CLOSE_UP_RULE}
Produit centré sur un fond uni coloré mais doux (vert sauge, bleu nuit, terracotta, rose poudré — couleur qui complimente le produit).
Éclairage studio homogène doux, ombres portées très légères. Produit parfaitement net, 75% du cadre.
Style publicité produit haut de gamme. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 7 – RÉFÉRENCE TAILLE / USAGE:
${CLOSE_UP_RULE}
Produit posé à côté d'UN seul objet de référence connu (tasse standard, livre de poche) pour montrer l'échelle réelle.
Plan moyen serré, produit et objet de référence nets, tous deux centrés dans le cadre.
Fond épuré clair, lumière naturelle douce. Pas de texte marketing. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
      ];

      // Prompts spécialisés LUMINAIRES (lampes suspendues, plafonniers, appliques)
      const LIGHTING_ANCHOR_RULE =
        `RÈGLE LUMINAIRE: la lampe est TOUJOURS suspendue ou fixée correctement — jamais posée à plat sur une surface, jamais dans une boîte, jamais entourée de fleurs ou de props décoratifs au premier plan. ` +
        `INTERDIT ABSOLU: flat lay, pétales de fleurs autour de la lampe, composition "bijoux". ` +
        `La lampe doit être vue comme dans la réalité: suspendue au plafond ou sur son support.`;

      const LIGHTING_PROMPTS = [
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – PACKSHOT FOND NOIR STUDIO:
${LIGHTING_ANCHOR_RULE}
La lampe est suspendue sur fond NOIR profond (studio photo haut de gamme).
Éclairage directionnel fin révélant chaque détail: texture de l'abat-jour, finition du métal, cordon ou câble tressé.
La lampe occupe 65-70% du cadre, suspension visible en haut du cadre.
Rendu premium, contraste fort, zéro accessoire autour. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 2 – LIFESTYLE SALLE À MANGER:
${LIGHTING_ANCHOR_RULE}
La lampe est suspendue AU-DESSUS d'une table à manger en bois naturel bien dressée: assiettes, verres, serviettes en lin, quelques bougies basses.
Pièce style SCANDINAVE ou CONTEMPORAIN: murs blancs cassés, parquet clair ou carrelage en pierre.
Lumière chaude et feutrée emanant de la lampe elle-même, ambiance dîner intime.
Plan moyen: on voit la lampe suspendue ET le dessus de la table dessous. Décor flou en arrière-plan.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 3 – LIFESTYLE SALON MODERNE:
${LIGHTING_ANCHOR_RULE}
La lampe est suspendue dans un SALON CONTEMPORAIN, au-dessus d'un canapé ou d'un espace lounge.
Intérieur: mur en béton ciré ou mur blanc avec des étagères flottantes, plante verte en pot, canapé gris ou beige visible en bas du cadre.
Lumière douce de fin de journée, ambiance cocooning chaleureuse.
Plan moyen-large montrant la lampe dans son environnement naturel — pièce visible mais la lampe reste le sujet principal.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        DIMENSIONS_PROMPT,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 5 – GROS PLAN TEXTURE ET DÉTAIL:
La lampe est suspendue sur fond neutre (blanc cassé ou gris perle).
Photo TRÈS rapprochée sur les détails de fabrication: texture de l'abat-jour (béton, tissu, métal, céramique, bois), finition du corps, cordon ou câble, douille ou ampoule visible.
Bokeh très doux sur les bords, netteté maximale sur la matière principale.
Lumière latérale douce révélant reliefs et textures. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 6 – LIFESTYLE CUISINE OUVERTE OU LOFT:
${LIGHTING_ANCHOR_RULE}
La lampe est suspendue dans une CUISINE OUVERTE ou un LOFT INDUSTRIEL: plan de travail en marbre ou béton, tabourets hauts en métal, mur de briques peintes en blanc ou étagères en métal noir.
Lumière chaude artificielle, ambiance urbaine et raffinée.
Plan moyen: la lampe suspendue est bien visible, le décor cuisine en arrière-plan est net mais secondaire.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 7 – PACKSHOT FOND BLANC ÉPURÉ:
${LIGHTING_ANCHOR_RULE}
La lampe est suspendue sur fond BLANC PUR ou gris très clair (style catalogue produit).
Éclairage studio homogène, softbox doux des deux côtés, ombres portées très légères.
La lampe occupe 65-70% du cadre, suspension visible, couleurs fidèles à la référence.
Style fiche produit e-commerce propre et précis. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
      ];

      // Sélection des prompts selon la catégorie détectée
      const IMAGE_PROMPTS_GEMINI = productCategory === 'clothing' ? CLOTHING_PROMPTS
        : productCategory === 'furniture' ? FURNITURE_PROMPTS
        : productCategory === 'jewelry' ? JEWELRY_PROMPTS
        : productCategory === 'lighting' ? LIGHTING_PROMPTS
        : GENERAL_PROMPTS;

      console.log(`[IMAGE GEN] Catégorie détectée: ${productCategory}, athleticSafe=${athleticSafeMode}`);

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
                  aspectRatio: '1:1',
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

      /** Hors Netlify : budget complet 28s. Netlify : 18s max (startup 3s + Gemini 18s + Supabase 2s = 23s < 26s gateway). */
      const geminiHttpCapMs = isNetlifyHost ? 18_000 : GEMINI_IMAGE_FETCH_TIMEOUT_MS;

      const generateOne = async (prompt: string, promptIndex: number): Promise<string | null> => {
        const mainPart = [inlineImageParts[0]].filter(
          (part): part is { inlineData: { mimeType: string; data: string } } => Boolean(part)
        );
        const isMensurationsPrompt = promptIndex === 3;

        if (isMensurationsPrompt) {
          for (let round = 0; round < 3; round++) {
            let img = await tryGeminiForMensurations(prompt, mainPart, geminiHttpCapMs);
            if (img) return img;
            await new Promise((r) => setTimeout(r, 1500));
            img = await tryGeminiForMensurations(prompt, mainPart, geminiHttpCapMs);
            if (img) return img;
            if (round < 2) await new Promise((r) => setTimeout(r, 1000 * (round + 1)));
          }
          return null;
        }

        const retryBackoffMs = engineSafe === 'pro' ? 1500 : 900;
        for (let attempt = 0; attempt < geminiAttemptsPerImage; attempt++) {
          const img = await tryGeminiOnce(prompt, GEMINI_IMAGE_EDIT_MODEL, mainPart, geminiHttpCapMs);
          if (img) return img;
          if (attempt < geminiAttemptsPerImage - 1) await new Promise((r) => setTimeout(r, retryBackoffMs + attempt * 500));
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
            return NextResponse.json(
              {
                success: false,
                imageTaskIds: [],
                imageDataUrls: [],
                error: 'IMAGE_STORAGE_FAILED',
                message:
                  'Enregistrement des images impossible (Supabase). Vérifie le bucket « generated-images », les droits du service role, et NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sur Netlify.',
              },
              { status: 500 }
            );
          }
        }
        const partial = uploadedUrls.length < numImages;
        console.log(
          `[IMAGE GEN] Gemini image-edit: ${uploadedUrls.length}/${numImages} image(s) in ${Date.now() - startTime}ms${partial ? ' (partial)' : ''}`
        );
        return NextResponse.json({
          success: true,
          imageTaskIds: [],
          imageDataUrls: uploadedUrls,
          provider: 'gemini',
          model: GEMINI_IMAGE_EDIT_MODEL,
          requestedEngine: engineSafe,
          ...(partial && {
            message: `Seulement ${uploadedUrls.length} image(s) sur ${numImages} (temps ou quota). Réessaie « Nouvelle génération » pour compléter.`,
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

    // Détection vêtements pour forcer le volume 3D côté NanoBanana
    const nanoTagsText = Array.isArray(tags) && tags.length ? tags.slice(0, 15).join(' ') : '';
    const isClothingProductNano = /\b(shirt|dress|jacket|pant|jeans|hoodie|sweatshirt|vest|coat|blouse|top|skirt|shorts|tshirt|t-shirt|legging|cardigan|sweater|pullover|suit|trouser|sock|boot|shoe|sneaker|hat|cap|scarf|glove|belt|bag|purse|handbag|backpack|wallet|clothing|apparel|garment|wearable|wear|vêtement|chemise|robe|manteau|pantalon|jean|sweat|pull|veste|jupe|short|chaussure|botte|chapeau|écharpe|bonnet|sac)\b/i.test(`${productTitle || ''} ${nanoTagsText}`);
    const clothingVolumePrefixNano = isClothingProductNano
      ? `PHOTOGRAPHIE COMMERCIALE VÊTEMENT: fond studio neutre (blanc pur ou gris clair), éclairage softbox diffus, ghost mannequin — volume 3D naturel du tissu, plis authentiques, silhouette réelle. INTERDIT: décor de pièce, fond lifestyle complexe, tissu aplati 2D. Style catalogue professionnel Etsy, rendu ultra-réaliste pas "IA". `
      : '';

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

    // Upload source image sur Supabase → URL HTTPS pour NanoBanana (évite HTTP 413 avec base64)
    let nanoSourceUrl: string | null = null;
    try {
      nanoSourceUrl = await uploadBase64ToSupabase(supabase, imageDataUrl, user.id, Date.now());
      if (nanoSourceUrl) console.log('[IMAGE GEN] Source uploadée pour NanoBanana:', nanoSourceUrl.substring(0, 80));
    } catch (e: any) {
      console.warn('[IMAGE GEN] Upload source NanoBanana échoué, fallback base64:', e?.message);
    }
    const nanoImageUrls = nanoSourceUrl ? [nanoSourceUrl] : [imageDataUrl];

    const submitOnce = async (prompt: string, engineToUse: 'flash' | 'pro'): Promise<{ taskId: string | null; error?: string }> => {
      const url = 'https://api.nanobananaapi.ai/api/v1/nanobanana/generate';

      const body: any = {
        type: 'IMAGETOIAMGE',
        model: 'gemini-3.1-flash-image-preview',
        prompt,
        imageUrls: nanoImageUrls,
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
      let finalPrompt = (clothingVolumePrefixNano ? clothingVolumePrefixNano : '') + IMAGE_PROMPTS[promptIndex];
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
