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
      forceNanobanana,
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
      type ProductCategory = 'clothing' | 'furniture' | 'jewelry' | 'home_decor' | 'general';
      function detectProductCategory(): ProductCategory {
        const text = `${productTitle || ''} ${tagsList} ${materialsStr}`.toLowerCase();
        if (/\b(shirt|dress|jacket|pant|jeans|hoodie|sweatshirt|vest|coat|blouse|top|skirt|shorts|tshirt|t-shirt|legging|cardigan|sweater|pullover|suit|trouser|sock|boot|shoe|sneaker|hat|cap|scarf|glove|belt|bag|purse|handbag|backpack|wallet|clothing|apparel|garment|wearable|wear|vêtement|chemise|robe|manteau|pantalon|jean|sweat|pull|veste|jupe|short|chaussure|botte|chapeau|écharpe|bonnet|sac)\b/.test(text)) {
          return 'clothing';
        }
        if (/\b(chair|table|sofa|couch|desk|shelf|shelves|cabinet|dresser|nightstand|bench|wardrobe|armoire|bookcase|ottoman|stool|rack|storage|furniture|drawer|credenza|sideboard|console|sectional|loveseat|chaise|fauteuil|canapé|bureau|étagère|armoire|commode|meuble|tiroir|placard|buffet|table)\b/.test(text)) {
          return 'furniture';
        }
        if (/\b(ring|bracelet|necklace|earring|pendant|jewelry|jewel|chain|bangle|choker|brooch|anklet|cuff|bague|collier|bracelet|boucle|pendentif|bijou|chaîne)\b/.test(text)) {
          return 'jewelry';
        }
        if (/\b(candle|vase|pillow|cushion|rug|blanket|throw|curtain|lamp|lantern|frame|mirror|clock|planter|pot|basket|tray|bowl|mug|cup|plate|towel|mat|decoration|decor|bougie|coussin|tapis|couverture|rideau|lampe|cadre|miroir|horloge|plateau|bol|tasse|assiette|décoration)\b/.test(text)) {
          return 'home_decor';
        }
        return 'general';
      }
      const productCategory = detectProductCategory();

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
      const GEMINI_IMAGE_EDIT_MODEL = 'gemini-2.5-flash-image';
      // Flash: 2 essais Gemini / Pro: 3 essais Gemini (plus fiable)
      const geminiAttemptsPerImage = engineSafe === 'flash' ? 2 : 3;
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
            // Flash: résolution réduite pour aller plus vite. Pro: résolution maximale pour la qualité.
            const maxSide = isNetlifyFastSingle
              ? (engineSafe === 'pro' ? 768 : 640)
              : isFastChunkedSingle
                ? (engineSafe === 'pro' ? 896 : 640)
                : 768;
            const jpegQ = engineSafe === 'pro' ? 82 : 72;
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
          ? 'High-fidelity pro render: crisp details, natural micro-textures, realistic global illumination, physically plausible contact shadows and reflections, accurate perspective and scale. Maximum realism, avoid any AI plastic look.'
          : 'Photorealistic Etsy listing quality: sharp product focus, natural soft light, accurate colors and materials, subtle realistic shadows, avoid plastic/AI look.';
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

      // Prompt commun dimensions (image 4 pour toutes les catégories)
      const DIMENSIONS_PROMPT = `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 4 – PHOTO AVEC MENSURATIONS / DIMENSIONS (OBLIGATOIRE):
Image type fiche produit sur fond blanc pur ou gris très clair épuré: dimensions clairement visibles.
${dimensionsStrictBlock}
Flèches de dimension fines avec labels numériques nets. Style graphique minimaliste.
Texte uniquement pour les mensurations (pas de texte marketing).
\n${GLOBAL_PROMPT_RULES_GEMINI}`;

      // Règle commune vêtements — fond studio neutre, rendu commercial anti-IA
      const CLOTHING_STUDIO_RULE =
        `PHOTOGRAPHIE COMMERCIALE PROFESSIONNELLE: rendu réaliste de studio produit, pas de style "IA" ou illustratif. ` +
        `Fond SIMPLE et NEUTRE uniquement (blanc pur, gris très clair, ou beige crème): aucun décor, aucune pièce entière, aucun meuble en fond. ` +
        `Éclairage de studio contrôlé (softbox diffus), ombres naturelles douces au sol — jamais d'éclairage dramatique ou artificiel. ` +
        `Le vêtement occupe 70-80% du cadre, proprement cadré, couleurs fidèles à la référence. ` +
        `VOLUME 3D OBLIGATOIRE: le vêtement a du drapé et des plis naturels, comme s'il était sur un mannequin invisible. INTERDIT: tissu aplati 2D.`;

      // Prompts spécialisés VÊTEMENTS : style catalogue commercial Etsy, fond studio, anti-IA
      const CLOTHING_PROMPTS = [
        `${baseContext}
PROMPT 1 – PACKSHOT STUDIO FOND BLANC:
${CLOTHING_STUDIO_RULE}
Vue de face complète sur fond blanc pur ou gris très clair, éclairage softbox diffus symétrique.
Le vêtement est centré, présenté en ghost mannequin avec volume naturel, ombres portées douces au sol.
Photo catalogue ultra-propre, style commercial premium Etsy.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
PROMPT 2 – PACKSHOT STUDIO FOND CRÈME / LÉGÈREMENT INCLINÉ:
${CLOTHING_STUDIO_RULE}
Même style studio que le prompt 1 mais fond beige crème ou gris doux, et vêtement légèrement tourné de 3/4 pour montrer la profondeur et le volume.
Lumière naturelle de studio douce, pas de couleur artificielle sur le tissu.
Photo catalogue nette, fidèle aux couleurs réelles, style professionnel Etsy.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
PROMPT 3 – GROS PLAN / DÉTAIL MATIÈRE ET FINITIONS:
Photo rapprochée sur les détails du tissu: texture, coutures, boutons, fermeture éclair, broderies ou bords.
Bokeh très doux sur les bords, netteté maximale sur la matière principale.
Fond neutre épuré (blanc ou beige mat), lumière latérale douce révélant la texture et les reliefs du tissu.
Produit occupant 75-85% du cadre. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        DIMENSIONS_PROMPT,
        `${baseContext}
PROMPT 5 – CINTRE SUR MUR NEUTRE:
${CLOTHING_STUDIO_RULE}
Le vêtement est suspendu sur un cintre en bois naturel simple, accroché à une patère ou un crochet discret sur un mur blanc lisse ou légèrement texturé.
Lumière naturelle douce venant d'une fenêtre hors-champ (gauche ou droite), ombres très légères.
Le vêtement tombe librement, plis naturels, forme 3D authentique — fond minimaliste, rien d'autre dans le cadre.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
PROMPT 6 – FLAT LAY MINIMALISTE SUR SURFACE NEUTRE:
Le vêtement est plié ou présenté à plat de manière nette sur une surface neutre et propre: marbre blanc veiné clair, surface en bois clair, ou fond tissu lin beige.
Vue de dessus à 90°, éclairage naturel doux et homogène, ombres très légères.
Forme du vêtement clairement visible, tissu bien étalé et net, 1-2 accessoires très discrets au maximum (jamais sur le vêtement).
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
PROMPT 7 – VUE CATALOGUE / FOND STUDIO GRIS:
${CLOTHING_STUDIO_RULE}
Vue d'ensemble complète, vêtement entier visible, fond gris clair neutre (#e8e8e8), éclairage studio homogène.
Ghost mannequin, volume naturel, silhouette complète lisible, proportions réelles fidèles.
Rendu propre type catalogue professionnel haut de gamme, zéro effet IA visible.
Pas de texte marketing. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
      ];

      // Prompts spécialisés MEUBLES : pièces TRÈS différentes avec couleurs et styles explicites
      const FURNITURE_PROMPTS = [
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – SALON SCANDINAVE CLAIR:
Le meuble est dans un salon de style SCANDINAVE: murs blancs cassés, parquet pin clair, canapé gris clair bas, plante tropicale (monstera ou palmier) dans un pot en céramique blanche.
Lumière du matin abondante venant d'une grande fenêtre à gauche, ambiance aérée et sereine.
Cadrage large montrant l'ensemble de la pièce avec le meuble mis en valeur.
Décoration minimaliste. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 2 – CHAMBRE ADULTE COSY COULEUR FORTE:
Le meuble est dans une chambre adulte: MUR COULEUR VERT SAUGE foncé ou BLEU NUIT (choisir une couleur murale forte, pas blanche).
Tête de lit en velours côtelé beige ou gris, linge blanc cassé froissé, lampe de chevet laiton doré.
Lumière tamisée dorée en soirée, ambiance cocooning intime.
Plan moyen-large. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 3 – GROS PLAN / TEXTURE ET FINITIONS:
Photo très rapprochée sur les détails de fabrication: bois, metal, tissu, coutures, charnières ou pieds du meuble.
Bokeh doux sur les bords, mise au point maximale sur la matière principale.
Lumière directionnelle latérale révélant les reliefs, le grain du bois ou la texture du tissu.
Fond neutre mat derrière. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        DIMENSIONS_PROMPT,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 5 – BUREAU OU CUISINE INDUSTRIELLE:
Le meuble est dans un BUREAU MODERNE ou une CUISINE OUVERTE au style INDUSTRIEL: briques apparentes peintes en blanc, métal noir mat, bois recyclé, ampoules Edison suspendues.
Palette: tons charbon, ivoire et bois brun chaud. Lumière artificielle chaleureuse.
Cadrage large, ambiance loft urbain chic. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 6 – SALLE À MANGER MÉDITERRANÉENNE:
Le meuble est dans une salle à manger ou un espace repas de style MÉDITERRANÉEN: mur chaux blanc, carreaux de ciment colorés au sol (bleu et blanc), arche en stuc, plantes d'intérieur vertes.
Lumière du sud abondante et chaude, ombres courtes, tons ocre et blanc.
Cadrage large aéré. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 7 – VUE ISOMÉTRIQUE / RÉFÉRENCE D'ÉCHELLE:
Photo technique montrant le meuble avec une référence d'échelle discrète (livre, plante en pot, tasse posés à côté).
Angle légèrement en hauteur (45 degrés), lumière naturelle douce uniforme, fond épuré clair.
Toutes les dimensions et proportions réelles du meuble clairement visibles dans le cadre.
Rendu propre type catalogue premium. Pas de texte marketing. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
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
      const GENERAL_PROMPTS = [
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 1 – VUE LARGE / CONTEXTE LIFESTYLE:
Plan large, produit intégré dans un espace de vie réaliste et chaleureux (salon, cuisine ou chambre selon le produit).
Le produit à son échelle réelle, cadrage large montrant le contexte autour.
Lumière du matin venant de la gauche, mur blanc cassé, parquet clair, tableau abstrait discret en fond.
Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 2 – PLAN MOYEN / DÉCOR SOIGNÉ:
Plan moyen: produit au centre, espace visible autour, 1-2 accessoires neutres complémentaires.
Mur beige doux, surface en bois, lumière chaud type lampe indirecte.
Décor sobre sans surcharger. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 3 – GROS PLAN / TEXTURE ET FINITIONS:
Photo rapprochée sur texture, matériaux et finitions. Bokeh doux sur les bords.
Fond neutre épuré, lumière directionnelle douce révélant les reliefs.
Produit 60-70% du cadre. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        DIMENSIONS_PROMPT,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 5 – AMBIANCE SOIR / LUMIÈRE TAMISÉE:
Éclairage chaud de soirée, lumière indirecte dorée, ombres douces et longues.
Bougie ou lampe d'appoint visible en arrière-plan, intérieur feutré.
Plan moyen, produit à son échelle. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 6 – AUTRE PIÈCE / PALETTE DIFFÉRENTE:
Même produit dans une PIÈCE COMPLÈTEMENT DIFFÉRENTE des images 1 et 2 avec une PALETTE DE COULEURS DIFFÉRENTE.
Si image 1 était blanc/beige: utiliser chambre avec mur coloré (vert, bleu, terracotta) ou cuisine industrielle.
Lumière naturelle zénithale, cadrage large. Pas de texte. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
        `${baseContext}
${STYLE_EXPECTED_GEMINI}
PROMPT 7 – RÉFÉRENCE D'ÉCHELLE / USAGE:
Photo montrant la taille réelle du produit avec un objet connu à côté (tasse, livre, plante en pot).
Plan moyen, produit et objet de référence nets et bien cadrés.
Fond épuré, lumière naturelle douce. Pas de texte marketing. Pas de watermark.\n${GLOBAL_PROMPT_RULES_GEMINI}`,
      ];

      // Sélection des prompts selon la catégorie détectée
      const IMAGE_PROMPTS_GEMINI = productCategory === 'clothing' ? CLOTHING_PROMPTS
        : productCategory === 'furniture' ? FURNITURE_PROMPTS
        : productCategory === 'jewelry' ? JEWELRY_PROMPTS
        : GENERAL_PROMPTS;

      console.log(`[IMAGE GEN] Catégorie détectée: ${productCategory}`);

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

      /** Hors Netlify : budget complet 28s. Netlify : court pour la gateway. */
      const geminiHttpCapMs = isNetlifyHost
        ? Math.min(GEMINI_IMAGE_FETCH_TIMEOUT_MS, 18_000)
        : GEMINI_IMAGE_FETCH_TIMEOUT_MS;

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

        for (let attempt = 0; attempt < geminiAttemptsPerImage; attempt++) {
          const img = await tryGeminiOnce(prompt, GEMINI_IMAGE_EDIT_MODEL, mainPart, geminiHttpCapMs);
          if (img) return img;
          if (attempt < geminiAttemptsPerImage - 1) await new Promise((r) => setTimeout(r, 900 + attempt * 700));
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
