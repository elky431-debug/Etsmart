import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';

export const maxDuration = 60;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface ScrapedContext {
  sourceUrl: string;
  sourceType: 'shop' | 'listing' | 'unknown';
  shopName: string;
  listingTitle: string;
  listingDescription: string;
  tags: string[];
  productKeywords: string[];
}

function normalizeInputToUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/etsy\.com\//i.test(raw)) return `https://${raw.replace(/^\/+/, '')}`;
  return '';
}

function extractKeywords(title: string, tags: string[]): string[] {
  const fromTitle = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
  const fromTags = tags
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
  return Array.from(new Set([...fromTitle, ...fromTags])).slice(0, 15);
}

async function scrapeEtsyContext(url: string): Promise<ScrapedContext> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`SCRAPE_FAILED_${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const isListing = url.includes('/listing/');
  const isShop = url.includes('/shop/');

  const pageTitle = $('title').text().replace(/\s*\|\s*Etsy.*$/i, '').trim();
  const h1 = $('h1').first().text().trim();
  const shopNameMeta =
    $('meta[property="og:site_name"]').attr('content')?.trim() ||
    $('[data-shop-name]').first().text().trim() ||
    '';

  let listingTitle = '';
  let listingDescription = '';
  let tags: string[] = [];
  let shopName = '';

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
          if (!listingDescription && product.description)
            listingDescription = String(product.description).trim();
          if (Array.isArray(product.keywords)) {
            tags = product.keywords.map(String).map((t) => t.trim()).filter(Boolean);
          } else if (typeof product.keywords === 'string') {
            tags = product.keywords.split(',').map((t: string) => t.trim()).filter(Boolean);
          }
        }

        const organization = node?.['@type'] === 'Organization' ? node : null;
        if (organization && !shopName && organization.name) {
          shopName = String(organization.name).trim();
        }
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  });

  if (!listingTitle) listingTitle = h1 || pageTitle;
  if (!shopName) {
    if (isShop) {
      shopName = h1 || pageTitle || shopNameMeta;
    } else {
      shopName = shopNameMeta || '';
    }
  }
  if (!shopName) shopName = 'Boutique Etsy';

  const keywords = extractKeywords(listingTitle, tags);

  return {
    sourceUrl: url,
    sourceType: isShop ? 'shop' : isListing ? 'listing' : 'unknown',
    shopName,
    listingTitle,
    listingDescription,
    tags,
    productKeywords: keywords,
  };
}

function safePinterestImageUrl(input: string): string | null {
  const url = input.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  if (!/pinimg\.com/i.test(url)) return null;
  if (/logo|favicon|pin_logo|pinterest/i.test(url)) return null;
  return url;
}

async function tryFetchPinterestImage(query: string): Promise<string | null> {
  const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const ogImage = $('meta[property="og:image"]').attr('content');
    const directOg = ogImage ? safePinterestImageUrl(ogImage) : null;
    if (directOg) return directOg;

    const candidates = html.match(/https:\/\/i\.pinimg\.com\/[^"'\\\s]+/gi) || [];
    for (const raw of candidates) {
      const clean = safePinterestImageUrl(raw);
      if (!clean) continue;
      // Favor larger pin image formats for profile-like visuals
      if (/\/(?:236x|474x|564x|736x|1200x)\//.test(clean)) return clean;
    }
    for (const raw of candidates) {
      const clean = safePinterestImageUrl(raw);
      if (clean) return clean;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
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
    const ct = (res.headers.get('content-type') || 'image/jpeg').toLowerCase();
    if (!ct.startsWith('image/')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) return null;
    return `data:${ct};base64,${buffer.toString('base64')}`;
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

async function tryFetchGoogleImage(query: string): Promise<string | null> {
  const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const candidates = html.match(/https?:\/\/[^"'\\\s)]+\.(?:jpg|jpeg|png|webp)/gi) || [];
    for (const raw of candidates) {
      if (/gstatic|googlelogo|logo|sprite|icon/i.test(raw)) continue;
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

async function generateCharacterPortraitDataUrl(params: {
  name: string;
  role: string;
  summary: string;
  niche: string;
}): Promise<string | null> {
  if (!openai) return null;
  try {
    const prompt = `Create a realistic portrait photo of one Etsy seller character.
No logos, no text, no watermark, no collage.
Only one person, chest-up, neutral background, natural lighting.
The person must fit this context:
- Name: ${params.name}
- Role: ${params.role}
- Persona: ${params.summary}
- Product niche: ${params.niche}
Style: premium, professional, friendly, authentic, suitable for a shop biography profile image.`;

    const imageResponse = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
    });

    const b64 = imageResponse.data?.[0]?.b64_json;
    if (!b64) return null;
    return `data:image/png;base64,${b64}`;
  } catch {
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
  ];
  return hits.reduce((acc, re) => acc + (lower.match(re)?.length || 0), 0);
}

async function rewriteBiographyToFirstPerson(input: string): Promise<string> {
  if (!openai || !input.trim()) return input;
  try {
    const rewritten = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Réécris le texte en français à la première personne du singulier. Garde le même sens, un ton naturel, et retourne uniquement le texte final.',
        },
        { role: 'user', content: input },
      ],
    });
    return rewritten.choices[0]?.message?.content?.trim() || input;
  } catch {
    return input;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY_MISSING', message: 'OPENAI_API_KEY manquante côté serveur.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const inputUrl = normalizeInputToUrl(String(body?.url || body?.shopUrl || body?.listingUrl || ''));
    if (!inputUrl || !/etsy\.com/i.test(inputUrl)) {
      return NextResponse.json(
        { error: 'INVALID_URL', message: 'Merci de fournir un lien Etsy valide (produit ou boutique).' },
        { status: 400 }
      );
    }

    const context = await scrapeEtsyContext(inputUrl);
    const nicheContext = [context.listingTitle, ...context.tags].filter(Boolean).join(', ');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content:
            "Tu es un expert branding Etsy. Tu réponds uniquement en JSON valide. Tu écris en français naturel, concret, sans blabla.",
        },
        {
          role: 'user',
          content: `Génère une histoire de boutique Etsy + un personnage fondateur cohérent avec la niche produit.

Contraintes critiques:
- Le ton doit être humain, crédible, premium.
- L'histoire doit expliquer pourquoi la personne a lancé sa boutique (passion, déclic, mission, valeur client).
- La biographie doit créer un personnage cohérent avec le produit/niche. 
- La biographie doit être écrite à la PREMIÈRE PERSONNE (je, mon, ma), comme si le personnage se présentait lui-même.
- Evite les incohérences (ex: personnage inadapté au type de produit).
- Le résultat doit être directement utilisable sur une page Etsy.

Contexte scrapé:
${JSON.stringify(context, null, 2)}

Retourne STRICTEMENT ce JSON:
{
  "shopStory": "texte de 120 à 220 mots",
  "character": {
    "name": "Prénom Nom",
    "role": "rôle/fonction",
    "personaSummary": "1 phrase",
    "biography": "texte de 90 à 170 mots",
    "traits": ["trait1","trait2","trait3","trait4"]
  },
  "imageSearchQuery": "requête pinterest claire pour trouver un portrait cohérent"
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
      imageSearchQuery?: string;
    };

    const imageQuery =
      parsed.imageSearchQuery?.trim() ||
      `${context.listingTitle || context.shopName} creator portrait handmade etsy`;

    let biography = String(parsed.character?.biography || '');
    if (firstPersonScore(biography) < 2) {
      biography = await rewriteBiographyToFirstPerson(biography);
    }

    const characterName = String(parsed.character?.name || 'Createur Etsy');
    const characterRole = String(parsed.character?.role || 'Artisan/Creatif');
    const characterSummary = String(parsed.character?.personaSummary || '');

    const aiPortraitDataUrl = await generateCharacterPortraitDataUrl({
      name: characterName,
      role: characterRole,
      summary: characterSummary,
      niche: nicheContext || context.listingTitle || context.shopName,
    });

    const googleImageUrl = aiPortraitDataUrl ? null : await tryFetchGoogleImage(imageQuery);
    const pinterestImageUrl =
      aiPortraitDataUrl || googleImageUrl ? null : await tryFetchPinterestImage(imageQuery);
    const fallbackImageUrl = `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(
      parsed.character?.name || context.shopName || 'etsmart-creator'
    )}&backgroundType=gradientLinear`;
    const finalImageUrl = googleImageUrl || pinterestImageUrl || fallbackImageUrl;
    const fetchedDataUrl = aiPortraitDataUrl || (await fetchImageAsDataUrl(finalImageUrl));
    const imageDataUrl = fetchedDataUrl || buildInlineAvatarDataUrl(characterName, characterRole);

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
          imageUrl: finalImageUrl,
        },
      },
      meta: {
        pinterestAttempted: true,
        imageSource: aiPortraitDataUrl
          ? 'ai-portrait'
          : googleImageUrl
          ? 'google'
          : pinterestImageUrl
          ? 'pinterest'
          : fetchedDataUrl
          ? 'fallback'
          : 'inline-svg',
        imageQuery,
        nicheContext,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}

