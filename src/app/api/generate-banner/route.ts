import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

const BANNER_CREDITS = 2;

export const maxDuration = 90;
export const runtime = 'nodejs';

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = 50000, ...fetchOptions } = options;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...fetchOptions, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

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

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      return NextResponse.json(
        { error: 'SERVER_CONFIG_ERROR', message: 'GEMINI_API_KEY missing on server.' },
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
    const productContext = `${listingTitle} ${description}`.toLowerCase();
    const isLampNiche = /(lamp|lampe|lighting|luminaire|light)/i.test(productContext);
    const isWoodCraft = /(wood|bois|oak|walnut|cedar|handmade decor)/i.test(productContext);
    const isPastelNiche = /(baby|wedding|floral|soft|minimal)/i.test(productContext);

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
    }

    const prompt = `Create one Etsy shop banner in a clean, simple, premium style (4:1 ratio).
Target export: 1200x300.

MANDATORY — SHOP NAME MUST BE VISIBLE:
- You MUST display the shop name "${shopName}" as readable text on the banner.
- Place the text "${shopName}" in the CENTER of the banner, large enough to be clearly legible.
- Use elegant, clear typography (serif or sans-serif). The shop name is the main title of the banner.
- Do not omit the shop name. The banner is for the Etsy shop "${shopName}" and the name must appear on it.

Main objective:
- The banner must clearly represent the shop and its products.
- Keep composition simple and focused, not overloaded.

Design direction:
- ${paletteInstruction}
- Product-focused visual: show relevant products matching "${listingTitle}".
- Products should be visible and aesthetically arranged (not tiny, not chaotic).
- Add soft lighting and depth, but keep it minimal and clean.

Context:
- Shop name (MUST appear as text on banner): ${shopName}
- Product focus: ${listingTitle}
- Description summary: ${description.slice(0, 240)}
${hasReferenceImage ? '- A product reference image is provided by the user; keep similar product style and palette.' : ''}

Strict rules:
- The shop name "${shopName}" MUST be written as visible text on the image. No exceptions.
- no watermark
- no random symbols or abstract circles unrelated to the brand
- no collage/grid/screenshot look
- avoid clutter
- one coherent hero banner ready for Etsy`;

    const userParts: Array<Record<string, unknown>> = [{ text: prompt }];
    const parsedRef = referenceImageData ? parseDataUrl(referenceImageData) : null;
    if (parsedRef) {
      userParts.push({
        inlineData: {
          mimeType: parsedRef.mimeType,
          data: parsedRef.data,
        },
      });
    }

    const modelCandidates =
      modelPreference === 'pro'
        ? ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-flash', 'gemini-3-pro-image-preview']
        : modelPreference === 'flash'
        ? ['gemini-2.5-flash', 'gemini-3.1-flash-image-preview']
        : [
            'gemini-2.5-flash-preview-05-20',
            'gemini-2.5-flash',
            'gemini-3-pro-image-preview',
            'gemini-3.1-flash-image-preview',
          ];

    let b64: string | null = null;
    let lastError = '';
    for (const model of modelCandidates) {
      try {
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': GEMINI_KEY,
            },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: userParts,
                },
              ],
              generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
              },
            }),
            timeoutMs: 70000,
          }
        );
        const rawText = await res.text();
        if (!res.ok) {
          lastError = `${model}: ${res.status} ${rawText.slice(0, 300)}`;
          console.warn('[generate-banner]', lastError);
          if (res.status === 429) {
            await new Promise((r) => setTimeout(r, 3000));
            try {
              const retryRes = await fetchWithTimeout(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_KEY,
                  },
                  body: JSON.stringify({
                    contents: [{ role: 'user', parts: userParts }],
                    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
                  }),
                  timeoutMs: 70000,
                }
              );
              const retryText = await retryRes.text();
              if (retryRes.ok) {
                const retryData = JSON.parse(retryText);
                const retryParts = retryData?.candidates?.[0]?.content?.parts ?? [];
                const retryImg = retryParts.find((p: any) => typeof p?.inlineData?.data === 'string');
                if (retryImg?.inlineData?.data) {
                  b64 = retryImg.inlineData.data;
                  break;
                }
              }
            } catch {
              // ignore retry failure
            }
          }
          continue;
        }
        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch {
          lastError = `${model}: invalid JSON`;
          continue;
        }
        const candidate = data?.candidates?.[0];
        const blockReason = candidate?.finishReason ?? data?.promptFeedback?.blockReason;
        if (blockReason && blockReason !== 'STOP') {
          lastError = `${model}: ${blockReason}`;
        }
        const parts = candidate?.content?.parts ?? [];
        const imagePart = parts.find((p: any) => typeof p?.inlineData?.data === 'string');
        if (imagePart?.inlineData?.data) {
          b64 = imagePart.inlineData.data;
          break;
        }
      } catch (err: any) {
        lastError = err?.message ?? String(err);
        console.warn('[generate-banner]', model, err);
      }
    }

    if (!b64) {
      const isQuota = lastError.includes('429') || /quota|billing|limit/i.test(lastError);
      const message = isQuota
        ? 'Quota Gemini dépassé. Vérifie ton plan et la facturation dans Google AI Studio (aistudio.google.com), ou réessaie dans quelques minutes.'
        : lastError
          ? `Bannière non générée (${lastError.slice(0, 120)}). Vérifie ta clé Gemini ou réessaie.`
          : 'No banner generated with Gemini.';
      return NextResponse.json(
        { error: 'GENERATION_FAILED', message },
        { status: 500 }
      );
    }

    const raw = Buffer.from(b64, 'base64');
    // Redimensionnement direct en 1200x300, recadrage centré : bannière entièrement nette, sans bandes floues
    const bannerBuffer = await sharp(raw)
      .resize(1200, 300, { fit: 'cover', position: 'center' })
      .png({ quality: 92 })
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
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
