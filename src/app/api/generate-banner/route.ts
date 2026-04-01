import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import { geminiGenerateImageBuffer, GEMINI_IMAGE_MODEL } from '@/lib/gemini-image-generate';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import path from 'path';

// Point librsvg (Sharp) to our bundled fonts — avoids missing font squares on Netlify Linux
const FONTS_DIR = path.join(process.cwd(), 'src', 'fonts');
process.env.FONTCONFIG_PATH = FONTS_DIR;

const BANNER_CREDITS = 2;

export const maxDuration = 90;
export const runtime = 'nodejs';

async function scrapeEtsyContext(url: string): Promise<{
  shopName: string;
  listingTitle: string;
  description: string;
  imageUrl: string;
}> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
    },
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`SCRAPE_FAILED_${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  let shopName = $('meta[property="og:site_name"]').attr('content')?.trim() || '';
  let listingTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';
  let description = $('meta[property="og:description"]').attr('content')?.trim() || '';
  let imageUrl = $('meta[property="og:image"]').attr('content')?.trim() || '';

  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (!content) return;
    try {
      const parsed = JSON.parse(content);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const product =
          node?.['@type'] === 'Product'
            ? node
            : node?.mainEntity?.['@type'] === 'Product'
              ? node.mainEntity
              : null;
        if (product) {
          if (!listingTitle && product.name) listingTitle = String(product.name).trim();
          if (!description && product.description) description = String(product.description).trim();
          if (!imageUrl && product.image) {
            imageUrl = Array.isArray(product.image) ? String(product.image[0] || '') : String(product.image);
          }
        }
        const org = node?.['@type'] === 'Organization' ? node : null;
        if (org && !shopName && org.name) shopName = String(org.name).trim();
      }
    } catch {
      // ignore malformed json
    }
  });

  shopName = shopName || $('h1').first().text().trim() || 'Etsy Shop';
  listingTitle = listingTitle || $('h1').first().text().trim() || 'Handmade Product';
  description = description || 'Handmade product crafted with care.';

  return { shopName, listingTitle, description, imageUrl };
}

async function imageUrlToBase64(url: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'image/*,*/*;q=0.8',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return null;
    const b = Buffer.from(await res.arrayBuffer());
    return `data:${ct};base64,${b.toString('base64')}`;
  } catch {
    return null;
  }
}

function parseDataUrl(input: string): { mimeType: string; data: string } | null {
  const m = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim();
    if (!GEMINI_KEY) {
      return NextResponse.json(
        { error: 'SERVER_CONFIG_ERROR', message: 'GEMINI_API_KEY manquante sur le serveur (génération bannière).' },
        { status: 500 }
      );
    }

    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json(
        {
          error: 'SUBSCRIPTION_REQUIRED',
          message: 'Un abonnement actif est requis pour générer une bannière.',
          subscriptionStatus: quotaInfo.status,
        },
        { status: 403 }
      );
    }
    if (quotaInfo.remaining < BANNER_CREDITS) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: `Génération de bannière : ${BANNER_CREDITS} crédits requis. Il te reste ${quotaInfo.remaining} crédit(s).`,
          used: quotaInfo.used,
          quota: quotaInfo.quota,
          remaining: quotaInfo.remaining,
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const providedShopName = String(body?.shopName || '').trim();
    const etsyUrl = String(body?.etsyUrl || '').trim();
    const modelPreference = String(body?.modelPreference || 'auto').toLowerCase();
    const productImage = String(body?.productImage || '').trim();

    if (!etsyUrl && !productImage) {
      return NextResponse.json(
        { error: 'MISSING_INPUT', message: 'Provide either an Etsy URL or a product image.' },
        { status: 400 }
      );
    }

    let shopName = 'Etsy Shop';
    let listingTitle = 'Handmade Product';
    let description = 'Handmade products crafted with care.';
    let referenceImageData = productImage || '';

    if (etsyUrl) {
      const context = await scrapeEtsyContext(etsyUrl);
      shopName = context.shopName || shopName;
      listingTitle = context.listingTitle || listingTitle;
      description = context.description || description;
      if (!referenceImageData && context.imageUrl) {
        const fromUrl = await imageUrlToBase64(context.imageUrl);
        if (fromUrl) referenceImageData = fromUrl;
      }
    }
    if (providedShopName) {
      shopName = providedShopName;
    }

    const hasReferenceImage = Boolean(referenceImageData);
    const themeContext = `${shopName} ${listingTitle} ${description}`.toLowerCase();

    // Niche detection — ordre important : les niches spécifiques avant les génériques
    const isAnimeGaming = /(anime|manga|gaming|gamer|glow|neon|dragon|naruto|pokemon|zelda|fantasy|sci.?fi|cyber|pixel|figurine|figure|diorama|led|rgb|night.?light|veilleuse|fantasy lamp|resin lamp)/i.test(themeContext);
    const isBookNiche   = /(book|nook|library|story|storynook|reading|literature|miniature diorama|shelf|bibliothèque)/i.test(themeContext);
    const isWoodCraft   = /(wood|bois|oak|walnut|cedar|handmade decor)/i.test(themeContext);
    const isPastelNiche = /(baby|wedding|floral|soft|minimal)/i.test(themeContext);
    // Lamp niche seulement si PAS anime/gaming (lampAnime → anime prime sur lamp)
    const isLampNiche   = !isAnimeGaming && /(lamp|lampe|lighting|luminaire|light)/i.test(themeContext);

    let paletteInstruction: string;
    let backgroundInstruction: string;

    if (isAnimeGaming) {
      paletteInstruction =
        'Use a DARK, RICH palette: deep black or very dark navy background, with vivid accent colors that match the products — glowing oranges, electric blues, neon purples, fiery reds, or vibrant teals. High contrast, dramatic, cinematic. Think movie poster or gaming setup aesthetics. NO beige, NO cream, NO plain white.';
      backgroundInstruction =
        'Background: DARK and ATMOSPHERIC — deep shadows, dramatic cinematic lighting, volumetric light rays or glowing haze emanating from the products. The scene should feel like a darkened room lit only by the glowing lamps/items. Think: dark wooden shelf, moody night scene, subtle smoke or particles in the air, deep bokeh. The products must GLOW and POP against the dark background. NOT a bright studio, NOT beige, NOT plain.';
    } else if (isBookNiche) {
      paletteInstruction =
        'Use warm literary tones: deep cream, antique paper, warm wood browns, soft golden highlights, muted burgundy or forest green accents.';
      backgroundInstruction =
        'Background: cozy library, warm wooden shelves, old books in soft bokeh, soft golden lamp light, magical and inviting atmosphere. NOT sterile studio, NOT plain countertop.';
    } else if (isWoodCraft) {
      paletteInstruction =
        'Use warm natural tones: beige, linen, tan, walnut brown, off-white. Earthy and premium.';
      backgroundInstruction =
        'Background: natural artisan setting — warm wood surfaces, workshop or cozy interior, no sterile white studio.';
    } else if (isPastelNiche) {
      paletteInstruction =
        'Use soft pastel neutrals: cream, light beige, dusty rose, muted warm gray. Delicate and clean.';
      backgroundInstruction =
        'Background: soft delicate setting — light fabrics, gentle pastel tones, dreamy and clean.';
    } else if (isLampNiche) {
      paletteInstruction =
        'Use a warm beige palette: light beige, cream, sand, warm taupe, soft golden highlights. The lamps must emit visible warm golden light that fills the scene.';
      backgroundInstruction =
        'Background: warm cozy interior — the SUSPENSION LAMPS are the clear HERO of the image, hanging prominently and lit up, emitting beautiful warm golden light. Multiple lamps filling the scene from left to right. Soft shadows, bokeh background, high-end interior photography feel. The lamps must be large, close-up, and visually dominant — NOT tiny or in the distance.';
    } else {
      paletteInstruction =
        'Use a tasteful palette that matches the product niche. Prefer rich, atmospheric tones over plain neutrals.';
      backgroundInstruction =
        'Background: immersive lifestyle setting that visually echoes the product — warm, atmospheric, with real depth. Not sterile or plain.';
    }

    // On demande à Gemini UN FOND SANS TEXTE — le shop name sera composité par Sharp en typo parfaite
    const prompt = `Generate a professional Etsy shop banner BACKGROUND IMAGE only — NO TEXT, NO WORDS, NO LETTERS anywhere in the image.

━━━ FORMAT ━━━
• Ultra-wide 4:1 panoramic rectangle (same proportions as 1200×300).
• Full-bleed edge-to-edge. No borders, no margins, no letterboxing.
• Single cohesive scene — NOT a collage, NOT a grid, NOT multiple panels.

━━━ VISUAL CONTENT ━━━
• ${backgroundInstruction}
• ${paletteInstruction}
• The PRODUCTS matching "${listingTitle}" are the MAIN SUBJECT — they must be LARGE, PROMINENT, and clearly visible. Not background props, not tiny accents — the products fill the scene.
${hasReferenceImage ? '• A reference product image is provided — reproduce its exact style, shape, colors and subject. The products shown MUST closely match the reference.' : '• No reference provided — generate the most visually appealing version of this product type.'}
• Composition: products arranged across the full width of the banner — LEFT side, CENTER zone, and RIGHT side all feel balanced and filled with the actual products.
• The CENTER ZONE (roughly the middle 35% of the width) should be slightly less visually busy — a soft background area where overlaid text will be readable. Think of it as a "clearing" in the composition: still part of the scene, but not crowded with objects.
• Lighting: cinematic and atmospheric — directional soft light, shallow depth of field (bokeh), warm or cool tones depending on niche. NOT flat white studio.
• Depth layers: foreground soft elements, midground hero products, atmospheric background. Editorial lifestyle feel.

━━━ ABSOLUTE RULES ━━━
• ZERO TEXT in the image. No letters, no numbers, no words anywhere. The shop name will be added as a separate typographic layer.
• No watermarks, no UI chrome, no lorem ipsum.
• No white backgrounds or plain colored backgrounds — always a real atmospheric setting.
${
      modelPreference === 'pro'
        ? '• QUALITY: maximum render — rich textures, cinematic lighting, fine details, magazine editorial level.'
        : modelPreference === 'flash'
          ? '• QUALITY: efficient render — clear products, strong atmospheric mood, clean composition.'
          : '• QUALITY: balanced — appealing atmosphere, clear product focus, cohesive colors.'
    }`;

    let refJpeg: Buffer | undefined;
    const parsedRef = referenceImageData ? parseDataUrl(referenceImageData) : null;
    if (parsedRef) {
      try {
        refJpeg = await sharp(Buffer.from(parsedRef.data, 'base64'))
          .resize(1536, 1536, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 88, mozjpeg: true })
          .toBuffer();
      } catch (e) {
        console.warn('[generate-banner] ref jpeg prep failed', e);
      }
    }

    const referenceInlineImages = refJpeg?.length
      ? [{ mimeType: 'image/jpeg' as const, data: refJpeg.toString('base64') }]
      : undefined;

    let raw: Buffer | null = null;
    for (let attempt = 0; attempt < 3 && !raw; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
      raw = await geminiGenerateImageBuffer({
        apiKey: GEMINI_KEY,
        prompt,
        referenceInlineImages,
        model: GEMINI_IMAGE_MODEL,
        timeoutMs: 70_000,
      });
    }

    if (!raw) {
      return NextResponse.json(
        {
          error: 'GENERATION_FAILED',
          message:
            'Bannière non générée (Gemini). Vérifie GEMINI_API_KEY, quotas API et réessaie. Voir les logs [Gemini image].',
        },
        { status: 500 }
      );
    }

    // ── 1. Recadrer le fond en 1200×300 ──────────────────────────────────────
    const bgBuffer = await sharp(raw)
      .resize(1200, 300, { fit: 'cover', position: 'centre' })
      .toBuffer();

    // ── 2. Composite SVG : overlay gradient + shop name en typo propre ───────
    const nameLen   = shopName.length;
    const fontSize  = nameLen <= 7 ? 92 : nameLen <= 11 ? 76 : nameLen <= 16 ? 62 : nameLen <= 22 ? 50 : 40;
    const tracking  = nameLen <= 7 ? 12 : nameLen <= 11 ? 8 : nameLen <= 16 ? 5 : 2;

    // Couleurs selon niche : dark pour anime/gaming, light pour pastel
    const darkTheme = isAnimeGaming || isBookNiche;
    const lightTheme = isPastelNiche;
    const textColor = lightTheme ? '#1a1a1a' : '#ffffff';

    const safeName = shopName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const textY = 150 + Math.round(fontSize * 0.36);

    // Shadow color: dark for light text, light for dark text
    const shadowRgb = lightTheme ? '255,255,255' : '0,0,0';

    const svgOverlay = `<svg width="1200" height="300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="vig-h" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="rgba(0,0,0,0.35)"/>
      <stop offset="18%"  stop-color="rgba(0,0,0,0.0)"/>
      <stop offset="82%"  stop-color="rgba(0,0,0,0.0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.35)"/>
    </linearGradient>
    <linearGradient id="vig-v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="rgba(0,0,0,0.22)"/>
      <stop offset="30%"  stop-color="rgba(0,0,0,0.0)"/>
      <stop offset="70%"  stop-color="rgba(0,0,0,0.0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.25)"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="300" fill="url(#vig-h)"/>
  <rect width="1200" height="300" fill="url(#vig-v)"/>

  <!-- Multi-layer shadow (feDropShadow not supported by librsvg) -->
  <text x="606" y="${textY + 6}" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial, Liberation Sans, sans-serif" font-size="${fontSize}" font-weight="700"
    fill="rgba(${shadowRgb},0.35)" letter-spacing="${tracking}">${safeName}</text>
  <text x="604" y="${textY + 4}" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial, Liberation Sans, sans-serif" font-size="${fontSize}" font-weight="700"
    fill="rgba(${shadowRgb},0.50)" letter-spacing="${tracking}">${safeName}</text>
  <text x="602" y="${textY + 2}" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial, Liberation Sans, sans-serif" font-size="${fontSize}" font-weight="700"
    fill="rgba(${shadowRgb},0.65)" letter-spacing="${tracking}">${safeName}</text>

  <!-- Texte principal -->
  <text x="600" y="${textY}" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial, Liberation Sans, sans-serif" font-size="${fontSize}" font-weight="700"
    fill="${textColor}" letter-spacing="${tracking}">${safeName}</text>
</svg>`;

    const bannerBuffer = await sharp(bgBuffer)
      .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
      .png({ quality: 95 })
      .toBuffer();

    const deductResult = await incrementAnalysisCount(user.id, BANNER_CREDITS);
    if (!deductResult.success) {
      console.warn('[generate-banner] Credit deduction failed after success:', deductResult.error);
    }

    return NextResponse.json({
      success: true,
      bannerDataUrl: `data:image/png;base64,${bannerBuffer.toString('base64')}`,
      meta: {
        width: 1200,
        height: 300,
        shopName,
        listingTitle,
        modelPreference,
        imageEngine: 'gemini',
        imageModel: GEMINI_IMAGE_MODEL,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
