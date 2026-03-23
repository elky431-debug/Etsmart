import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import { geminiGenerateImageBuffer, GEMINI_IMAGE_MODEL } from '@/lib/gemini-image-generate';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

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
    const isLampNiche = /(lamp|lampe|lighting|luminaire|light)/i.test(themeContext);
    const isWoodCraft = /(wood|bois|oak|walnut|cedar|handmade decor)/i.test(themeContext);
    const isPastelNiche = /(baby|wedding|floral|soft|minimal)/i.test(themeContext);
    const isBookNiche =
      /(book|nook|library|story|storynook|reading|literature|miniature diorama|diorama|shelf|bibliothèque)/i.test(
        themeContext
      );

    let paletteInstruction =
      'Use a tasteful neutral palette that matches the product. Prefer soft cream, warm gray, and subtle accent tones.';
    if (isLampNiche) {
      paletteInstruction =
        'Use a warm beige palette: light beige, cream, sand, warm taupe, and soft golden highlights. Avoid dominant blue tones.';
    } else if (isWoodCraft) {
      paletteInstruction =
        'Use warm natural tones: beige, linen, tan, walnut brown, and off-white. Keep colors earthy and premium.';
    } else if (isPastelNiche) {
      paletteInstruction =
        'Use soft pastel neutrals: cream, light beige, dusty rose, and muted warm gray. Keep it delicate and clean.';
    } else if (isBookNiche) {
      paletteInstruction =
        'Use warm literary tones: deep cream, antique paper, warm wood browns, soft golden highlights, muted burgundy or forest green accents. Cozy and inviting.';
    }

    let backgroundInstruction =
      'Background: choose a setting that visually echoes the product niche — warm and inviting, not sterile or plain.';
    if (isBookNiche) {
      backgroundInstruction =
        'Background: create a THEMATIC setting — cozy library, warm wooden shelves, old books in soft bokeh, soft golden lamp light, magical and inviting atmosphere. NO sterile studio, NO plain white countertop, NO generic bright room. The scene should feel like a reading nook or secret library.';
    } else if (isLampNiche) {
      backgroundInstruction =
        'Background: warm ambient setting that complements the lighting products — soft shadows, gentle glow, not a cold or sterile studio.';
    } else if (isWoodCraft) {
      backgroundInstruction =
        'Background: natural, artisan setting — warm wood surfaces, workshop or cozy interior, no sterile white studio.';
    } else if (isPastelNiche) {
      backgroundInstruction =
        'Background: soft, delicate setting — light fabrics, gentle pastel tones in the scene, dreamy and clean.';
    }

    const prompt = `Create one Etsy shop banner in a clean, simple, premium style.
CRITICAL — EXACT 4:1 BANNER (same proportions as 1200 pixels wide × 300 pixels tall):
- The output image MUST be a single ultra-wide 4:1 rectangle. No square canvas, no tall portrait, no extra margins outside the design.
- Full-bleed panoramic hero: background and scene fill the ENTIRE width and height edge to edge.
- NO "postcard" on gray: no huge empty pillars left/right. NO collage or screenshot look.

SHOP NAME — GEOMETRIC CENTER (NON-NEGOTIABLE):
- Render the exact text "${shopName}" as the main title.
- Place it at the TRUE CENTER of the frame: horizontally centered (equal space left and right) AND vertically centered (equal space above and below the text block). NOT low, NOT sitting on the bottom third, NOT corner-aligned.
- The name must be large, crisp, and readable; high contrast against the background; with comfortable padding from all four edges so it is never clipped after export.

COMPOSITION — PRODUCTS AROUND THE TITLE:
- Products / decor support the title but must not push the shop name off-center. If you show products, balance them symmetrically or softly around the centered title so the optical focus stays on "${shopName}".
- 1–3 hero items max; scale them for a SHORT banner height (~300px class); avoid cramming or extreme side crops.

MANDATORY — SHOP NAME MUST BE VISIBLE:
- You MUST display the shop name "${shopName}" as readable text on the banner.
- Use elegant, clear typography (serif or sans-serif). The shop name is the main title of the banner.
- Do not omit the shop name. The banner is for the Etsy shop "${shopName}" and the name must appear on it.

Main objective:
- The banner must clearly represent the shop and its products.
- Keep composition simple and focused, not overloaded.

Design direction:
- ${paletteInstruction}
- ${backgroundInstruction}
- Product-focused visual: show relevant products matching "${listingTitle}".
- Products should be visible and aesthetically arranged (not tiny, not chaotic, not harshly cropped).
- Add soft lighting and depth, but keep it minimal and clean.

Context:
- Shop name (MUST appear as text on banner): ${shopName}
- Product focus: ${listingTitle}
- Description summary: ${description.slice(0, 240)}
${hasReferenceImage ? '- A product reference image is provided by the user; echo similar product style and palette, and frame subjects so they read well in a wide short banner (avoid extreme side cropping).' : ''}

Strict rules:
- The shop name "${shopName}" MUST be written as visible text on the image. No exceptions.
- no watermark
- no random symbols or abstract circles unrelated to the brand
- no collage/grid/screenshot look
- avoid clutter
- one coherent hero banner ready for Etsy

IMAGE QUALITY HINT (user preference "${modelPreference}"):
${
      modelPreference === 'pro'
        ? 'Premium render: refined lighting, crisp typography, rich but not cluttered composition.'
        : modelPreference === 'flash'
          ? 'Clean efficient render: readable shop name, clear focal hierarchy, avoid excessive micro-detail.'
          : 'Balanced Etsy-ready quality.'
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

    const meta = await sharp(raw).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const ratio = w > 0 && h > 0 ? w / h : 4;
    const isNearFourToOne = Math.abs(ratio - 4) < 0.35;

    const bannerBuffer = isNearFourToOne
      ? await sharp(raw).resize(1200, 300, { fit: 'fill' }).png({ quality: 92 }).toBuffer()
      : await sharp(raw).resize(1200, 300, { fit: 'cover', position: 'centre' }).png({ quality: 92 }).toBuffer();

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
