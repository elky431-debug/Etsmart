import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sanitizeEtsyDescriptionPlainText } from '@/lib/etsy-description-plain';

/** Netlify / hébergeurs : laisser assez de marge pour 2 appels OpenAI + vision (évite 504 + chargement infini côté client). */
export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * GÉNÉRATION DU LISTING UNIQUEMENT (titre, description, tags, matériaux)
 * Les images sont générées séparément via /api/generate-images (plus fiable sur Netlify).
 * Coût: 0 crédit ici — les crédits sont déduits côté frontend après les 2 appels.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 }); }

    const { sourceImage, competitorTitle, competitorDescription, competitorHashtags } = body;
    if (!sourceImage) return NextResponse.json({ error: 'MISSING_IMAGE' }, { status: 400 });

    // Credits already deducted by frontend via /api/deduct-credits

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY_MISSING' }, { status: 500 });

    const GEMINI_MODEL = 'gemini-2.5-flash';
    const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    let imageForAnalysis = sourceImage;
    if (!imageForAnalysis.startsWith('data:image/')) imageForAnalysis = `data:image/jpeg;base64,${imageForAnalysis}`;
    const imgMime = imageForAnalysis.startsWith('data:image/') ? imageForAnalysis.split(';')[0].split(':')[1] : 'image/jpeg';
    const imgB64 = imageForAnalysis.includes(',') ? imageForAnalysis.split(',')[1] : imageForAnalysis;

    // STEP 1: Analyse produit via Gemini vision (~2-3s)
    console.log('[LISTING] Analyzing product...');
    const analysisResp = await fetch(GEMINI_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { text: 'Analyze this product image. Describe the product type, materials, colors, design, key features in English. 80-120 words, concise.' },
          { inlineData: { mimeType: imgMime, data: imgB64 } },
        ]}],
        generationConfig: { maxOutputTokens: 300 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!analysisResp.ok) return NextResponse.json({ error: 'IMAGE_ANALYSIS_FAILED' }, { status: 500 });
    const analysisData = await analysisResp.json();
    const productDesc = analysisData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!productDesc) return NextResponse.json({ error: 'IMAGE_ANALYSIS_FAILED' }, { status: 500 });

    // STEP 2: Listing (description + titre) EN PARALLÈLE via Gemini (~3-5s)
    console.log('[LISTING] Generating listing...');
    const [description, titleData] = await Promise.all([
      fetch(GEMINI_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        signal: AbortSignal.timeout(55_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'You are an expert in Etsy SEO and high-converting product descriptions. Write only in natural, premium, persuasive ENGLISH. Never output French. Never use Markdown (no **, *, #, or code fences); Etsy descriptions are plain text only.' }] },
          contents: [{ role: 'user', parts: [{ text:
            `Generate a professional, convincing, SEO-optimized Etsy description ready to publish.

WORKING RULES:
- If a competitor description is provided: write a similar but unique description inspired by tone/structure/marketing, never copy, and adapt to the product in the photos.
- If no competitor description is provided: write the best complete SEO description from product photos only.

LANGUAGE: Final output must be ENGLISH ONLY.

MANDATORY STRUCTURE:
1) SEO-optimized description title (clear strong hook, product + style, emojis allowed only if relevant)
2) Product presentation + branding (immersive, design + ambiance + perceived value, premium reassuring tone)
3) Marketing/value section:
   ✨ Why you'll love it
   - 3 to 5 bullet points max
   - customer benefits focused
   - emojis optional and niche-appropriate
4) Dimensions section ONLY if relevant and clearly available from product context. Never invent dimensions.
5) ALWAYS include this exact shipping/protection block:
🚚 Shipping & Protection Options
Express shipping is available at checkout for customers who wish to receive their order faster.
You may also choose to add package insurance when selecting your shipping method.
Please note: without package insurance, we cannot be held responsible for damage, defects, or issues that may occur during transit. For full peace of mind, adding insurance at checkout is strongly recommended.
6) End with exactly 5 English SEO hashtags related to the product (no generic useless hashtags).

SEO/QUALITY CONSTRAINTS: Natural Etsy SEO, human high-converting copy, no keyword stuffing, NO Markdown.

INPUTS:
- Product visual description: ${productDesc}
- Competitor description (optional): ${competitorDescription && String(competitorDescription).trim() ? String(competitorDescription).trim().substring(0, 2200) : 'NONE'}

Return ONLY the final description text.`
          }]}],
          generationConfig: { maxOutputTokens: 1200, temperature: 0.75 },
        }),
      }).then(async r => {
        if (!r.ok) return '';
        const d = await r.json();
        return d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      }).catch(() => ''),

      fetch(GEMINI_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        signal: AbortSignal.timeout(55_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'You are an Etsy SEO expert. Return valid JSON only.' }] },
          contents: [{ role: 'user', parts: [{ text:
            `Generate an optimized Etsy SEO title and tags.

TITLE RULES: English only. Max 140 characters. No special characters (no |, •, ★, —, emojis). No unnecessary keyword repetition. If competitor title provided: generate similar but unique, never copy.

TAGS RULES: English only. Exactly 13 tags. Return tags separated by commas only. No # symbol. Max 20 characters per tag. No duplicates. Mix: product-specific + style/design + niche + buying-intent tags.

INPUTS:
- Product visual description: ${productDesc}
- Competitor title (optional): ${competitorTitle && String(competitorTitle).trim() ? String(competitorTitle).trim().substring(0, 180) : 'NONE'}
- Competitor hashtags (optional): ${competitorHashtags && String(competitorHashtags).trim() ? String(competitorHashtags).trim().substring(0, 350) : 'NONE'}

Return JSON exactly:
{"title":"optimized etsy title","tags":"tag1,tag2,...,tag13","materials":"mat1,mat2"}`
          }]}],
          generationConfig: { maxOutputTokens: 400, temperature: 0.5, responseMimeType: 'application/json' },
        }),
      }).then(async r => {
        if (!r.ok) return { title: '', tags: [] as string[], materials: '' };
        const d = await r.json();
        const p = JSON.parse(d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}');
        let title = p.title || '';
        // Enforce strict title constraints locally as a safety net
        title = String(title)
          .replace(/[^A-Za-z0-9 ]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 140);
        const normalizeTag = (raw: string) =>
          String(raw)
            .replace(/#/g, '')
            .replace(/[^A-Za-z0-9 ]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        const fromModel = String(p.tags || '')
          .split(',')
          .map((t: string) => normalizeTag(t))
          .filter((t: string) => t.length >= 2 && t.length <= 20);

        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const t of fromModel) {
          if (!seen.has(t)) {
            seen.add(t);
            deduped.push(t);
          }
        }

        const fallbackPool = [
          ...String(productDesc)
            .toLowerCase()
            .replace(/[^a-z0-9 ]+/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 4 && w.length <= 20)
            .slice(0, 40),
          'gift idea',
          'home decor',
          'etsy gift',
          'handmade decor',
          'unique gift',
          'premium decor',
          'modern style',
        ].map(normalizeTag).filter((t) => t.length >= 2 && t.length <= 20);

        for (const t of fallbackPool) {
          if (deduped.length >= 13) break;
          if (!seen.has(t)) {
            seen.add(t);
            deduped.push(t);
          }
        }

        const tags = deduped.slice(0, 13);
        return { title, tags, materials: p.materials || '' };
      }).catch(() => ({ title: '', tags: [] as string[], materials: '' })),
    ]);

    const title = titleData.title || String(productDesc).replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 140);
    const tags = titleData.tags.length > 0 ? titleData.tags : ['handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'];
    const listingDescription = sanitizeEtsyDescriptionPlainText(description || productDesc);

    console.log('[LISTING] Done');

    return NextResponse.json({
      success: true,
      listing: {
        title,
        description: listingDescription,
        tags,
        materials: titleData.materials || 'Various materials',
      },
    });
  } catch (error: any) {
    console.error('[LISTING] Fatal:', error.message);
    return NextResponse.json({ error: 'GENERATION_ERROR', message: error.message }, { status: 500 });
  }
}
