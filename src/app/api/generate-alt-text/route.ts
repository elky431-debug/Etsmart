import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import OpenAI from 'openai';
import sharp from 'sharp';
import { getUserQuotaInfo, incrementAnalysisCount } from '@/lib/subscription-quota';
import { ALT_TEXT_SYSTEM, ALT_TEXT_SINGLE_USER } from '@/lib/etsy-alt-text-prompt';

export const maxDuration = 35;
export const runtime = 'nodejs';

/** Flat cost per click (1 alt text) */
const ALT_TEXT_CREDITS = 0.2;
const MAX_IMAGE_FETCH_BYTES = 8 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 15_000;

function isBlockedImageHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h === '0000:0000:0000:0000:0000:0000:0000:0001') {
    return true;
  }
  if (h.endsWith('.localhost') || h.endsWith('.local')) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

/** URL publique sûre : OpenAI télécharge l’image lui-même (évite fetch serveur + sharp = moins de crashs / plus rapide). */
function validateImageUrlForOpenAi(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') return null;
  if (isBlockedImageHostname(u.hostname)) return null;
  if (u.username || u.password) return null;
  return u.toString();
}

/** Fallback si OpenAI n’accepte pas l’URL (rare) : téléchargement côté serveur. */
async function fetchImageBufferFromUrl(imageUrl: string): Promise<Buffer | null> {
  const validated = validateImageUrlForOpenAi(imageUrl);
  if (!validated) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(validated, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'EtsmartBot/1.0 (alt-text; +https://etsmart.app)',
      },
    });
    if (!res.ok) return null;
    const len = res.headers.get('content-length');
    if (len && Number(len) > MAX_IMAGE_FETCH_BYTES) return null;
    const arr = await res.arrayBuffer();
    if (arr.byteLength > MAX_IMAGE_FETCH_BYTES) return null;
    return Buffer.from(arr);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function bufferToOpenAiJpegDataUrl(buf: Buffer): Promise<string | null> {
  try {
    const jpeg = await sharp(buf)
      .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch (e) {
    console.warn('[generate-alt-text] sharp failed:', e);
    return null;
  }
}

function sanitizeAltLine(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim();
  t = t.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  t = t.replace(/[*#"''`«»]/g, '');
  t = t.replace(/[^a-zA-Z0-9\s,.'-]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentification invalide' }, { status: 401 });
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY_MISSING', message: 'OPENAI_API_KEY manquante côté serveur.' },
        { status: 500 }
      );
    }

    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json(
        {
          error: 'SUBSCRIPTION_REQUIRED',
          message: 'Un abonnement actif est requis pour générer des alt text.',
          subscriptionStatus: quotaInfo.status,
        },
        { status: 403 }
      );
    }
    if (quotaInfo.remaining < ALT_TEXT_CREDITS) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: `Alt text : ${ALT_TEXT_CREDITS} crédit requis. Il te reste ${quotaInfo.remaining} crédit(s).`,
          used: quotaInfo.used,
          quota: quotaInfo.quota,
          remaining: quotaInfo.remaining,
        },
        { status: 403 }
      );
    }

    let body: { image?: string; imageUrl?: string } | null = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const hasImage = typeof body?.image === 'string' && body.image.trim().length > 0;
    const hasImageUrl = typeof body?.imageUrl === 'string' && body.imageUrl.trim().length > 0;
    if (!hasImage && !hasImageUrl) {
      return NextResponse.json(
        { error: 'Image requise : data URL / base64, ou imageUrl (https).' },
        { status: 400 }
      );
    }

    /** URL distante passée telle quelle à OpenAI (recommandé pour les CDN type Nanobanana). */
    let openAiImageUrl: string | null = null;
    /** Data URL (réduite par sharp si possible) pour uploads / blob. */
    let openAiDataUrl: string | null = null;

    if (hasImageUrl && body.imageUrl) {
      const validated = validateImageUrlForOpenAi(body.imageUrl);
      if (!validated) {
        return NextResponse.json(
          { error: 'IMAGE_URL_INVALID', message: 'URL image invalide ou non autorisée.' },
          { status: 400 }
        );
      }
      openAiImageUrl = validated;
    } else if (hasImage && body.image) {
      const raw = String(body.image).trim();
      const dataUrlIn = raw.startsWith('data:image/') ? raw : `data:image/jpeg;base64,${raw}`;
      const m = dataUrlIn.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!m) {
        return NextResponse.json({ error: 'Format image invalide.' }, { status: 400 });
      }
      try {
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length > MAX_IMAGE_FETCH_BYTES) {
          return NextResponse.json({ error: 'Image trop volumineuse.' }, { status: 400 });
        }
        openAiDataUrl = (await bufferToOpenAiJpegDataUrl(buf)) || dataUrlIn;
      } catch {
        openAiDataUrl = null;
      }
    }

    if (!openAiImageUrl && !openAiDataUrl) {
      return NextResponse.json({ error: 'Image illisible ou corrompue.' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const imagePart = {
      type: 'image_url' as const,
      image_url: {
        url: openAiImageUrl || openAiDataUrl!,
        detail: 'low' as const,
      },
    };

    const runCompletion = () =>
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.25,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: ALT_TEXT_SYSTEM },
          {
            role: 'user',
            content: [{ type: 'text', text: ALT_TEXT_SINGLE_USER }, imagePart],
          },
        ],
      });

    let completion;
    try {
      completion = await runCompletion();
    } catch (openAiErr: unknown) {
      // Fallback : URL refusée par OpenAI → on télécharge et envoie en data URL
      if (openAiImageUrl && hasImageUrl && body.imageUrl) {
        console.warn('[generate-alt-text] OpenAI URL fetch failed, trying server download:', openAiErr);
        const remoteBuf = await fetchImageBufferFromUrl(body.imageUrl);
        const dataFromRemote = remoteBuf ? await bufferToOpenAiJpegDataUrl(remoteBuf) : null;
        if (!dataFromRemote) {
          const msg =
            openAiErr instanceof Error ? openAiErr.message : 'Erreur OpenAI';
          return NextResponse.json(
            {
              error: 'OPENAI_IMAGE_FAILED',
              message:
                "OpenAI n'a pas pu lire l'image. Enregistre l'image sur ton ordi et régénère, ou réessaie.",
              detail: msg,
            },
            { status: 502 }
          );
        }
        imagePart.image_url.url = dataFromRemote;
        completion = await runCompletion();
      } else {
        throw openAiErr;
      }
    }

    const text = completion.choices[0]?.message?.content ?? '{}';
    let altTexts: string[] = [];
    try {
      const parsed = JSON.parse(text) as { altText?: unknown; altTexts?: unknown };
      if (typeof parsed.altText === 'string' && parsed.altText.trim()) {
        const one = sanitizeAltLine(parsed.altText);
        if (one) altTexts = [one];
      }
      if (altTexts.length === 0 && Array.isArray(parsed.altTexts) && parsed.altTexts.length > 0) {
        const first = sanitizeAltLine(String(parsed.altTexts[0]));
        if (first) altTexts = [first];
      }
    } catch {
      altTexts = [];
    }

    if (altTexts.length === 0) {
      return NextResponse.json(
        {
          error: 'GENERATION_INCOMPLETE',
          message: "La génération n'a pas produit d'alt text. Réessaie.",
          altTexts: [],
        },
        { status: 422 }
      );
    }

    const deduct = await incrementAnalysisCount(user.id, ALT_TEXT_CREDITS);
    if (!deduct.success) {
      console.warn('[generate-alt-text] Credit deduction failed after success:', deduct.error);
    }

    return NextResponse.json({
      success: true,
      altTexts,
      creditsCharged: ALT_TEXT_CREDITS,
      remaining: deduct.remaining,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[generate-alt-text]', error);
    return NextResponse.json({ error: 'GENERATION_ERROR', message }, { status: 500 });
  }
}
