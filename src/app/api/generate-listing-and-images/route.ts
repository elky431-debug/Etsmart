import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sanitizeEtsyDescriptionPlainText } from '@/lib/etsy-description-plain';
import {
  listingKeywordHintsFromRequestBody,
  listingKeywordHintsPromptAppendix,
} from '@/lib/listing-keyword-hints-dev';

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

    const listingKeywordHints = listingKeywordHintsFromRequestBody(body);
    const hintsAppendix = listingKeywordHintsPromptAppendix(listingKeywordHints);
    const analysisImagePrompt = listingKeywordHints
      ? `Analyze this product image. The seller noted themes or keywords they want reflected in the listing (style, aesthetic, niche — e.g. minimalist, handmade, neutral palette): "${listingKeywordHints.replace(/"/g, "'")}". Mention these in your analysis only where supported by what you see; do not invent. Describe product type, materials, colors, design, key features in English. 80-120 words, concise.`
      : 'Analyze this product image. Describe the product type, materials, colors, design, key features in English. 80-120 words, concise.';

    // Credits already deducted by frontend via /api/deduct-credits

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY_MISSING' }, { status: 500 });

    let imageForAnalysis = sourceImage;
    if (!imageForAnalysis.startsWith('data:image/')) imageForAnalysis = `data:image/jpeg;base64,${imageForAnalysis}`;

    // STEP 1: Analyse produit (~3s)
    console.log('[LISTING] Analyzing product...');
    const analysisResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: [
          { type: 'text', text: analysisImagePrompt },
          { type: 'image_url', image_url: { url: imageForAnalysis, detail: 'low' } },
        ]}],
        max_tokens: 240,
      }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!analysisResp.ok) return NextResponse.json({ error: 'IMAGE_ANALYSIS_FAILED' }, { status: 500 });
    const analysisData = await analysisResp.json();
    const productDesc = analysisData.choices?.[0]?.message?.content?.trim() || '';
    if (!productDesc) return NextResponse.json({ error: 'IMAGE_ANALYSIS_FAILED' }, { status: 500 });

    // STEP 2: Listing (description + titre) EN PARALLÈLE (~3-5s)
    console.log('[LISTING] Generating listing...');
    const [description, titleData] = await Promise.all([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(55_000),
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert in Etsy SEO and high-converting product descriptions. Write only in natural, premium, persuasive ENGLISH. Never output French. Never use Markdown (no **, *, #, or code fences); Etsy descriptions are plain text only.',
            },
            {
              role: 'user',
              content:
                `I will provide Etsy product photos, and sometimes a competitor Etsy description.
Your role is to generate a professional, convincing, SEO-optimized Etsy description ready to publish.

WORKING RULES:
- If a competitor description is provided: write a similar but unique description inspired by tone/structure/marketing, never copy, and adapt to the product in the photos.
- If no competitor description is provided: write the best complete SEO description from product photos only.

LANGUAGE:
- Final output must be ENGLISH ONLY.
- Do NOT provide any French translation.
- Never mix languages in any paragraph.

MANDATORY STRUCTURE:
1) SEO-optimized description title (clear strong hook, product + style, emojis allowed only if relevant)
2) Product presentation + branding (immersive, design + ambiance + perceived value, premium reassuring tone)
3) Marketing/value section:
   ✨ Why you'll love it
   - 3 to 5 bullet points max
   - customer benefits focused
   - emojis optional and niche-appropriate
4) Dimensions section ONLY if relevant and clearly available from product context. Never invent dimensions.
5) ALWAYS include this exact shipping/protection block (keep it in English):
🚚 Shipping & Protection Options
Express shipping is available at checkout for customers who wish to receive their order faster.
You may also choose to add package insurance when selecting your shipping method.

Please note: without package insurance, we cannot be held responsible for damage, defects, or issues that may occur during transit. For full peace of mind, adding insurance at checkout is strongly recommended.
6) End with exactly 5 English SEO hashtags related to the product (no generic useless hashtags).

SEO/QUALITY CONSTRAINTS:
- Natural Etsy SEO optimization
- Human, fluent, high-converting copy
- No keyword stuffing
- Emoji usage must remain controlled and relevant
- NO Markdown: never use ** or __ for bold, * for italic, # headings, backticks, or [text](url). Etsy does not render Markdown — output plain text only. Use a simple "-" at the start of lines for bullets if needed.

INPUTS:
- Product visual description: ${productDesc}
- Competitor description (optional): ${competitorDescription && String(competitorDescription).trim() ? String(competitorDescription).trim().substring(0, 2200) : 'NONE'}${hintsAppendix}

Return ONLY the final description text.`,
            },
          ],
          temperature: 0.75,
          max_tokens: 1000,
        }),
      }).then(async r => {
        if (!r.ok) return '';
        const d = await r.json();
        return d.choices?.[0]?.message?.content?.trim() || '';
      }).catch(() => ''),

      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(55_000),
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are an Etsy SEO expert. Return valid JSON only.',
            },
            {
              role: 'user',
              content: `I will send Etsy product photos, sometimes a high-converting competitor title, and sometimes competitor hashtags.
Your role:
1) Generate an optimized Etsy SEO title for my shop.
2) Generate optimized Etsy tags (hashtags) for my shop.

TITLE RULES:
- If competitor title is provided: generate a similar but unique title, never copy.
- If no competitor title: generate the best SEO title from product visuals only.
- English only.
- Max 140 characters.
- No special characters (no |, •, ★, —, emojis, etc.).
- No unnecessary keyword repetition.

TAGS RULES (STRICT):
- English only.
- Exactly 13 tags.
- Return tags separated by commas only.
- No # symbol.
- No vertical list.
- No explanatory text.
- No emojis.
- Max 20 characters per tag.
- Readable and natural tags.
- Relevant and searched keywords.
- No useless generic tags.
- No duplicates.
- Mix: product-specific + style/design + niche + buying-intent tags.

INPUTS:
- Product visual description: ${productDesc}
- Competitor title (optional): ${competitorTitle && String(competitorTitle).trim() ? String(competitorTitle).trim().substring(0, 180) : 'NONE'}
- Competitor hashtags (optional): ${competitorHashtags && String(competitorHashtags).trim() ? String(competitorHashtags).trim().substring(0, 350) : 'NONE'}${hintsAppendix}

Return JSON exactly:
{"title":"optimized etsy title","tags":"tag1,tag2,...,tag13","materials":"mat1,mat2"}`,
            },
          ],
          temperature: 0.5, max_tokens: 360,
          response_format: { type: 'json_object' },
        }),
      }).then(async r => {
        if (!r.ok) return { title: '', tags: [] as string[], materials: '' };
        const d = await r.json();
        const p = JSON.parse(d.choices?.[0]?.message?.content?.trim());
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
