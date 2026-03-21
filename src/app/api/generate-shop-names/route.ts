import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import { parseShopNameLanguage, SHOP_NAME_LANGUAGES } from '@/lib/shop-name-languages';
import sharp from 'sharp';

export const maxDuration = 60;
export const runtime = 'nodejs';

const CREDITS = 0.5;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export type ShopNameProposal = {
  shopName: string;
  slogan: string;
  angle: string;
};

async function compressImageToJpegDataUrl(raw: string): Promise<string | null> {
  try {
    const dataUrl = raw.startsWith('data:image/') ? raw : `data:image/jpeg;base64,${raw}`;
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    const c = await sharp(buf)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${c.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Applique les contraintes « mot unique visuel » : pas d’espaces, pas de chiffres ni tirets (aligné prompt Etsy). */
function normalizeShopName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/[-_./\\|]+/g, '')
    .replace(/\d/g, '');
}

function parseProposals(raw: string): ShopNameProposal[] {
  try {
    const j = JSON.parse(raw) as { proposals?: unknown };
    if (!Array.isArray(j.proposals)) return [];
    return j.proposals
      .map((p: unknown) => {
        if (!p || typeof p !== 'object') return null;
        const o = p as Record<string, unknown>;
        const shopNameRaw = typeof o.shopName === 'string' ? o.shopName.trim() : '';
        const shopName = normalizeShopName(shopNameRaw);
        const slogan = typeof o.slogan === 'string' ? o.slogan.trim() : '';
        const angle = typeof o.angle === 'string' ? o.angle.trim() : '';
        if (!shopName || !slogan) return null;
        return { shopName, slogan, angle: angle || '' };
      })
      .filter((x): x is ShopNameProposal => x !== null)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function languageLabel(code: string): string {
  return SHOP_NAME_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_NOT_CONFIGURED', message: 'Génération indisponible (clé OpenAI).' },
        { status: 503 }
      );
    }

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: 'Authentification requise.' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: 'Session invalide.' }, { status: 401 });
    }

    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'SUBSCRIPTION_REQUIRED', message: 'Abonnement actif requis.' },
        { status: 403 }
      );
    }

    if (quotaInfo.remaining < CREDITS && quotaInfo.quota !== -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'QUOTA_EXCEEDED',
          message: `Il te faut ${CREDITS} crédit pour cette suggestion. Crédits restants : ${quotaInfo.remaining}.`,
        },
        { status: 403 }
      );
    }

    let body: { productImage?: string; shopLanguage?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'BAD_JSON', message: 'Corps de requête invalide.' }, { status: 400 });
    }

    const imgRaw = body.productImage && String(body.productImage).trim();
    if (!imgRaw) {
      return NextResponse.json(
        {
          success: false,
          error: 'IMAGE_REQUIRED',
          message: 'Une image produit est obligatoire.',
        },
        { status: 400 }
      );
    }

    const dataUrl = await compressImageToJpegDataUrl(imgRaw);
    if (!dataUrl) {
      return NextResponse.json(
        { success: false, error: 'IMAGE_INVALID', message: 'Image illisible ou format non supporté.' },
        { status: 400 }
      );
    }

    const lang = parseShopNameLanguage(body.shopLanguage);
    const langHuman = languageLabel(lang);

    const system = `You are a branding expert specialized in Etsy shops.
Your goal is to generate a unique, catchy, and memorable shop name and slogan based on the user's niche.

Infer the niche ONLY from the attached product image (what is sold, style, materials, mood, target buyer).

⚠️ STRICT RULES TO FOLLOW:

The shop name must be short (1–3 words max when spoken).
All words must be joined together as ONE string with NO spaces (e.g. CosyNook or cosynook — never "Cosy Nook").
Use clean and readable formatting: prefer CamelCase OR simple lowercase (single continuous string, no separators).
The name must be easy to pronounce and spell.
Avoid numbers, special characters, and hyphens in shopName.
The name must feel brandable and premium (not generic).
The name must be relevant to the niche inferred from the image.

The slogan must be:
- Short (max 8 words in the target language)
- Clear and benefit-driven
- Emotionally appealing or aesthetic

LANGUAGE (mandatory): Write every "shopName" and "slogan" ONLY in **${langHuman}** (code: ${lang}). Do not mix languages.

Generate exactly **5** different options (5 distinct creative directions).

TECHNICAL OUTPUT — reply with ONLY valid JSON, no markdown, no extra text:
{"proposals":[{"shopName":"SingleStringNoSpaces","slogan":"Up to eight words here"}]}

Optional key "angle" per item: one short line in ${langHuman} explaining the vibe (optional; can be omitted).`;

    const userText = `Shop language: ${langHuman} (${lang}).

Analyze the product photo, infer the niche, then output exactly 5 proposals following all Etsy branding rules above.`;

    const userMessage = {
      role: 'user' as const,
      content: [
        { type: 'image_url' as const, image_url: { url: dataUrl, detail: 'low' as const } },
        { type: 'text' as const, text: userText },
      ],
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.85,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, userMessage] as OpenAI.Chat.ChatCompletionMessageParam[],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    const proposals = parseProposals(raw);

    if (proposals.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'PARSE_FAILED',
          message: 'Impossible d’extraire les propositions. Réessaie avec une autre photo.',
        },
        { status: 422 }
      );
    }

    const deduct = await incrementAnalysisCount(user.id, CREDITS);
    if (!deduct.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'BILLING_FAILED',
          message: deduct.error || 'Débit crédits impossible.',
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      success: true,
      proposals,
      shopLanguage: lang,
      creditsUsed: CREDITS,
      creditsRemaining: deduct.remaining,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    console.error('[generate-shop-names]', e);
    return NextResponse.json({ success: false, error: 'SERVER_ERROR', message: msg }, { status: 500 });
  }
}
