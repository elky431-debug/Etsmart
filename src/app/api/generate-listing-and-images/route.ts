import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 25;
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

    const { sourceImage } = body;
    if (!sourceImage) return NextResponse.json({ error: 'MISSING_IMAGE' }, { status: 400 });

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
          { type: 'text', text: 'Analyze this product image. Describe the product type, materials, colors, design, key features in English. 100-200 words.' },
          { type: 'image_url', image_url: { url: imageForAnalysis, detail: 'low' } },
        ]}],
        max_tokens: 300,
      }),
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
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert Etsy copywriter.' },
            { role: 'user', content: `Generate an Etsy product description in ENGLISH:\n\n${productDesc}\n\nRules: 8-12 emojis, warm tone, 300-500 words. Structure: 1)Hook 2)Product 3)Features 4)Why buy 5)Ideal for 6)Quality 7)Care 8)CTA. ONLY the description.` },
          ],
          temperature: 0.7, max_tokens: 1500,
        }),
      }).then(async r => { if (!r.ok) return ''; const d = await r.json(); return d.choices?.[0]?.message?.content?.trim() || ''; }).catch(() => ''),

      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Return valid JSON only.' },
            { role: 'user', content: `Product: ${productDesc}\n\nReturn JSON: {"title":"SEO title 100-140 chars","tags":"tag1,tag2,...,tag13","materials":"mat1,mat2"}\nTitle MUST be 100-140 chars. 13 tags max 20 chars each. English only.` },
          ],
          temperature: 0.7, max_tokens: 400,
          response_format: { type: 'json_object' },
        }),
      }).then(async r => {
        if (!r.ok) return { title: '', tags: [] as string[], materials: '' };
        const d = await r.json();
        const p = JSON.parse(d.choices?.[0]?.message?.content?.trim());
        let title = p.title || '';
        const tags = (p.tags || '').split(',').map((t: string) => t.trim()).filter((t: string) => t && t.length <= 20).slice(0, 13);
        if (title.length < 100) {
          for (const s of [' - Perfect Gift Idea', ' - Unique Handcrafted Design', ' - Modern Stylish Decor']) {
            if (title.length + s.length <= 140) { title += s; break; }
          }
        }
        return { title, tags, materials: p.materials || '' };
      }).catch(() => ({ title: '', tags: [] as string[], materials: '' })),
    ]);

    const title = titleData.title || productDesc.substring(0, 140);
    const tags = titleData.tags.length > 0 ? titleData.tags : ['handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'];

    console.log('[LISTING] Done');

    return NextResponse.json({
      success: true,
      listing: {
        title,
        description: description || productDesc,
        tags,
        materials: titleData.materials || 'Various materials',
      },
    });
  } catch (error: any) {
    console.error('[LISTING] Fatal:', error.message);
    return NextResponse.json({ error: 'GENERATION_ERROR', message: error.message }, { status: 500 });
  }
}
