import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';

export const maxDuration = 120;
export const runtime = 'nodejs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/** Contexte unifié pour la génération texte (plus de scraping Etsy) */
export interface ShopStoryVisionContext {
  sourceType: 'vision';
  shopName: string;
  city: string;
  country: string;
  listingTitle: string;
  listingDescription: string;
  tags: string[];
  productKeywords: string[];
  visualSummary: string;
}

function extractKeywords(title: string, tags: string[]): string[] {
  const fromTitle = title
    .toLowerCase()
    .split(/[^a-z0-9àâäéèêëïîôùûüçœ]+/i)
    .filter((w) => w.length >= 3);
  const fromTags = tags
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9àâäéèêëïîôùûüçœ]+/i)
    .filter((w) => w.length >= 3);
  return Array.from(new Set([...fromTitle, ...fromTags])).slice(0, 18);
}

async function toVisionJpegDataUrl(input: string): Promise<string | null> {
  try {
    const raw = String(input).trim();
    const dataUrl = raw.startsWith('data:image/') ? raw : `data:image/jpeg;base64,${raw}`;
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    const c = await sharp(buf)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${c.toString('base64')}`;
  } catch {
    return null;
  }
}

function buildInlineAvatarDataUrl(name: string, role: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  const safeInitials = initials || 'ES';
  const subtitle = role.slice(0, 40).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00d4ff"/>
      <stop offset="100%" stop-color="#00c9b7"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="#0a0a0a"/>
  <circle cx="512" cy="430" r="190" fill="url(#g)" opacity="0.9"/>
  <text x="512" y="472" text-anchor="middle" font-size="150" font-family="Arial, Helvetica, sans-serif" fill="#041014" font-weight="700">${safeInitials}</text>
  <rect x="170" y="700" width="684" height="180" rx="28" fill="#111827" stroke="#1f2937"/>
  <text x="512" y="785" text-anchor="middle" font-size="48" font-family="Arial, Helvetica, sans-serif" fill="#e5e7eb" font-weight="700">${name.replace(
    /[<>&"]/g,
    ''
  )}</text>
  <text x="512" y="835" text-anchor="middle" font-size="30" font-family="Arial, Helvetica, sans-serif" fill="#93c5fd">${subtitle}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

type ShopTone = 'luxury_professional' | 'chill_small';

async function bufferFromOpenAiImageData(data: {
  b64_json?: string | null;
  url?: string | null;
}): Promise<Buffer | null> {
  if (data.b64_json) {
    try {
      return Buffer.from(data.b64_json, 'base64');
    } catch {
      return null;
    }
  }
  if (data.url) {
    try {
      const res = await fetch(data.url, { signal: AbortSignal.timeout(45_000) });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Portrait fondateur fictif, photoréaliste (OpenAI), aligné sur le ton de marque et le brief visuel.
 */
async function generateFounderPortraitDataUrl(params: {
  client: OpenAI;
  shopTone: ShopTone;
  city: string;
  country: string;
  visualStyle?: string;
  nicheSummary?: string;
  productTypes?: string[];
  characterRole?: string;
  personaSummary?: string;
}): Promise<{ dataUrl: string; model: string } | null> {
  const toneBlock =
    params.shopTone === 'luxury_professional'
      ? 'Upscale atelier or boutique setting, refined wardrobe, premium materials subtly visible, elegant minimal background.'
      : 'Cozy workshop or studio, warm natural textures, handmade tools or materials subtly in background, authentic craft vibe.';

  const nicheBits = [
    params.nicheSummary?.slice(0, 420),
    Array.isArray(params.productTypes) ? params.productTypes.slice(0, 5).join(', ') : '',
  ]
    .filter(Boolean)
    .join(' ');

  const prompt = [
    'Photorealistic professional head-and-shoulders portrait of ONE fictional small-business founder (generic, not a celebrity or real person).',
    toneBlock,
    `Regional context: based in ${params.city}, ${params.country} — believable everyday styling, respectful representation.`,
    `Their work: ${String(params.characterRole || 'artisan / independent maker').slice(0, 120)}.`,
    nicheBits ? `Business / craft niche mood: ${nicheBits.slice(0, 520)}.` : '',
    params.personaSummary ? `Character vibe (pose/expression only): ${params.personaSummary.slice(0, 200)}` : '',
    params.visualStyle
      ? `Echo the brand atmosphere (lighting/palette/mood only, no logos): ${params.visualStyle.slice(0, 260)}`
      : '',
    'Camera: soft window light, shallow depth of field, 85mm portrait look, sharp eyes, natural skin texture, clean composition.',
    'No text, no watermark, no logo, no extra people, no cluttered hands near face.',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 3800);

  let imageBuf: Buffer | null = null;
  let modelUsed = '';

  try {
    const img1 = await params.client.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
    });
    const d0 = img1.data?.[0];
    if (d0) {
      imageBuf = await bufferFromOpenAiImageData(d0);
      if (imageBuf) modelUsed = 'gpt-image-1';
    }
  } catch (e) {
    console.warn('[shop-story] gpt-image-1 portrait failed:', e);
  }

  if (!imageBuf) {
    try {
      const img3 = await params.client.images.generate({
        model: 'dall-e-3',
        prompt: prompt.slice(0, 3900),
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'natural',
      });
      const d0 = img3.data?.[0];
      if (d0) {
        imageBuf = await bufferFromOpenAiImageData(d0);
        if (imageBuf) modelUsed = 'dall-e-3';
      }
    } catch (e2) {
      console.warn('[shop-story] dall-e-3 portrait failed:', e2);
    }
  }

  if (!imageBuf) return null;

  try {
    const png = await sharp(imageBuf)
      .resize(1024, 1024, { fit: 'cover', position: 'attention' })
      .png({ quality: 92 })
      .toBuffer();
    return { dataUrl: `data:image/png;base64,${png.toString('base64')}`, model: modelUsed };
  } catch (e) {
    console.warn('[shop-story] portrait sharp post-process failed:', e);
    return null;
  }
}

function firstPersonScore(text: string): number {
  const lower = text.toLowerCase();
  const hits = [
    /\bje\b/g,
    /\bj['’]/g,
    /\bmoi\b/g,
    /\bmon\b/g,
    /\bma\b/g,
    /\bmes\b/g,
    /\bme\b/g,
    /\bm['’]/g,
    /\bi\b/g,
    /\bmy\b/g,
    /\bwe\b/g,
    /\bour\b/g,
  ];
  return hits.reduce((acc, re) => acc + (lower.match(re)?.length || 0), 0);
}

async function rewriteBiographyToFirstPerson(input: string): Promise<string> {
  if (!openai || !input.trim()) return input;
  try {
    const rewritten = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Rewrite the text in first person (I, my, me). Keep the same meaning, natural tone. Output only the final text.',
        },
        { role: 'user', content: input },
      ],
    });
    return rewritten.choices[0]?.message?.content?.trim() || input;
  } catch {
    return input;
  }
}

type VisionExtract = {
  shopNameFromVisuals?: string;
  nicheSummary?: string;
  productTypes?: string[];
  visualStyle?: string;
  keywords?: string[];
  listingTitleGuess?: string;
  shopTone?: 'luxury_professional' | 'chill_small';
};

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY_MISSING', message: 'OPENAI_API_KEY manquante côté serveur.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const bannerRaw = String(body?.bannerImage || '').trim();
    const productRaws: string[] = Array.isArray(body?.productImages)
      ? body.productImages.map((x: unknown) => String(x || '').trim()).filter(Boolean)
      : body?.productImage
        ? [String(body.productImage).trim()]
        : [];

    const shopNameUser = String(body?.shopName || '').trim();
    const city = String(body?.city || '').trim();
    const country = String(body?.country || '').trim();

    if (!bannerRaw) {
      return NextResponse.json(
        { error: 'MISSING_BANNER', message: 'Ajoute une capture de la bannière de ta boutique.' },
        { status: 400 }
      );
    }
    if (productRaws.length < 1) {
      return NextResponse.json(
        { error: 'MISSING_PRODUCTS', message: 'Ajoute au moins une image de produit.' },
        { status: 400 }
      );
    }
    if (city.length < 2 || country.length < 2) {
      return NextResponse.json(
        { error: 'MISSING_LOCATION', message: 'Indique au moins le pays et la ville (cohérence avec ta fiche Etsy).' },
        { status: 400 }
      );
    }

    const bannerDataUrl = await toVisionJpegDataUrl(bannerRaw);
    if (!bannerDataUrl) {
      return NextResponse.json(
        { error: 'INVALID_BANNER_IMAGE', message: 'Image bannière invalide (JPG, PNG ou WebP).' },
        { status: 400 }
      );
    }

    const productDataUrls = (
      await Promise.all(productRaws.slice(0, 4).map((p) => toVisionJpegDataUrl(p)))
    ).filter((u): u is string => Boolean(u));
    if (productDataUrls.length < 1) {
      return NextResponse.json(
        { error: 'INVALID_PRODUCT_IMAGES', message: 'Images produits invalides.' },
        { status: 400 }
      );
    }

    const userContextNote =
      shopNameUser.length >= 2
        ? `The user provided shop name: "${shopNameUser}".`
        : 'The user did NOT provide a shop name; infer the shop name from the banner if visible, else use a short plausible placeholder name in the analysis only.';

    type VisionPart =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' | 'auto' } };

    const visionUserContent: VisionPart[] = [
      {
        type: 'text',
        text: `You analyze Etsy shop branding from images.

Image order:
1) FIRST image = shop BANNER
2) Following images = PRODUCT photos

${userContextNote}
User location for coherence (use in your analysis; do not invent fake addresses): City: "${city}", Country: "${country}".

Return ONLY valid JSON:
{
  "shopNameFromVisuals": "exact shop name visible on banner or empty string",
  "listingTitleGuess": "short phrase summarizing main product line",
  "nicheSummary": "3-5 sentences in English describing niche, quality level, audience, mood",
  "productTypes": ["3-8 short labels in English"],
  "visualStyle": "1-2 sentences: colors, typography feel, aesthetic",
  "keywords": ["12-20 relevant English keywords for Etsy"],
  "shopTone": "luxury_professional" or "chill_small"
}
shopTone: use "luxury_professional" for high-end, premium, luxury, designer, expensive products. Use "chill_small" for handmade, craft, cozy, small-batch, affordable, indie.`,
      },
      { type: 'image_url', image_url: { url: bannerDataUrl, detail: 'high' } },
      ...productDataUrls.map((url) => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'high' as const },
      })),
    ];

    const visionCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior Etsy brand analyst. You only output strict JSON. Be accurate about what is visible; do not hallucinate text that is unreadable.',
        },
        { role: 'user', content: visionUserContent },
      ],
    });

    let vision: VisionExtract = {};
    try {
      vision = JSON.parse(visionCompletion.choices[0]?.message?.content || '{}') as VisionExtract;
    } catch {
      vision = {};
    }

    const resolvedShopName =
      shopNameUser ||
      String(vision.shopNameFromVisuals || '').trim() ||
      'Handmade Shop';

    const shopTone: ShopTone =
      vision.shopTone === 'luxury_professional' || vision.shopTone === 'chill_small'
        ? vision.shopTone
        : 'chill_small';

    const tags = Array.isArray(vision.keywords) ? vision.keywords.map(String).filter(Boolean).slice(0, 24) : [];
    const productTypes = Array.isArray(vision.productTypes)
      ? vision.productTypes.map(String).filter(Boolean)
      : [];
    const listingTitle =
      String(vision.listingTitleGuess || '').trim() ||
      productTypes.slice(0, 3).join(', ') ||
      resolvedShopName;
    const listingDescription = [
      String(vision.nicheSummary || '').trim(),
      String(vision.visualStyle || '').trim(),
      productTypes.length ? `Types de produits: ${productTypes.join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const productKeywords = extractKeywords(listingTitle, [...tags, ...productTypes]);

    const context: ShopStoryVisionContext = {
      sourceType: 'vision',
      shopName: resolvedShopName,
      city,
      country,
      listingTitle,
      listingDescription,
      tags,
      productKeywords,
      visualSummary: listingDescription.slice(0, 2000),
    };

    const nicheContext = [context.listingTitle, ...context.tags].filter(Boolean).join(', ');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content:
            'You are an Etsy branding expert. Output ONLY valid JSON. Write in natural English, concrete, no fluff.',
        },
        {
          role: 'user',
          content: `Generate an Etsy shop story + founder character consistent with the visuals and location. Output in ENGLISH.

Critical constraints:
- Human, credible, premium tone.
- Story and character COHERENT with: city "${city}", country "${country}" (workshop, origin, local inspiration — naturally, no invented addresses).
- Character plausible for this region and product niche.
- Story explains why the person started their shop (passion, trigger, mission).
- Biography in FIRST PERSON (I, my, me).
- No inconsistency with product types. Ready for Etsy.

Shop name: "${resolvedShopName}" (use in story if natural).

Context from vision analysis:
${JSON.stringify(
  {
    nicheSummary: vision.nicheSummary,
    productTypes: vision.productTypes,
    visualStyle: vision.visualStyle,
    keywords: vision.keywords,
    listingTitleGuess: vision.listingTitleGuess,
  },
  null,
  2
)}

Return STRICTLY this JSON:
{
  "shopStory": "120-220 words in English",
  "character": {
    "name": "Realistic FirstName LastName for ${country}",
    "role": "role/title",
    "personaSummary": "1 sentence",
    "biography": "90-170 words in English, first person",
    "traits": ["trait1","trait2","trait3","trait4"]
  }
}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as {
      shopStory?: string;
      character?: {
        name?: string;
        role?: string;
        personaSummary?: string;
        biography?: string;
        traits?: string[];
      };
    };

    let biography = String(parsed.character?.biography || '');
    if (firstPersonScore(biography) < 2) {
      biography = await rewriteBiographyToFirstPerson(biography);
    }

    const characterName = String(parsed.character?.name || 'Etsy Creator');
    const characterRole = String(parsed.character?.role || 'Artisan / Creator');
    const characterSummary = String(parsed.character?.personaSummary || '');

    const aiPortrait = await generateFounderPortraitDataUrl({
      client: openai,
      shopTone,
      city,
      country,
      visualStyle: vision.visualStyle,
      nicheSummary: vision.nicheSummary,
      productTypes: vision.productTypes,
      characterRole,
      personaSummary: characterSummary,
    });

    const imageDataUrl = aiPortrait?.dataUrl || buildInlineAvatarDataUrl(characterName, characterRole);
    const imageSource: 'openai-portrait' | 'inline-svg' = aiPortrait ? 'openai-portrait' : 'inline-svg';

    return NextResponse.json({
      success: true,
      source: context,
      result: {
        shopStory: parsed.shopStory || '',
        character: {
          name: characterName,
          role: characterRole,
          personaSummary: characterSummary,
          biography,
          traits: Array.isArray(parsed.character?.traits) ? parsed.character?.traits.slice(0, 6) : [],
          imageDataUrl,
          imageUrl: '',
        },
      },
      meta: {
        sourceMode: 'vision',
        imageSource,
        portraitModel: aiPortrait?.model,
        nicheContext,
        resolvedShopName,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[shop-story/generate]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
