import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * API ROUTE - GÉNÉRATION DU LISTING UNIQUEMENT (rapide, <15s)
 * Les images sont générées séparément par le frontend via /api/generate-images
 * 
 * Coût: 1.0 crédit pour le listing
 */
export async function POST(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 }); }

    const { sourceImage } = body;
    if (!sourceImage) return NextResponse.json({ error: 'MISSING_IMAGE' }, { status: 400 });

    // Quota check - only 1 credit for listing
    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED' }, { status: 403 });
    
    const creditNeeded = 1.0;
    if (quotaInfo.remaining < creditNeeded) return NextResponse.json({ error: 'QUOTA_EXCEEDED' }, { status: 403 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY_MISSING' }, { status: 500 });

    // Préparer l'image pour l'analyse GPT-4o
    let imageForAnalysis = sourceImage;
    if (!imageForAnalysis.startsWith('data:image/')) imageForAnalysis = `data:image/jpeg;base64,${imageForAnalysis}`;

    console.log('[LISTING GEN] Starting for user:', user.id);

    // ═══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 1: Analyse produit avec GPT-4o-mini (rapide)
    // ═══════════════════════════════════════════════════════════════════════════
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this product image. Describe the product type, materials, colors, design, and key features in English. Be concise (100-200 words).' },
            { type: 'image_url', image_url: { url: imageForAnalysis, detail: 'low' } },
          ],
        }],
        max_tokens: 300,
      }),
    });

    if (!analysisResponse.ok) throw new Error(`Analysis failed: ${analysisResponse.status}`);
    const analysisData = await analysisResponse.json();
    const productVisualDescription = analysisData.choices?.[0]?.message?.content?.trim();
    if (!productVisualDescription) throw new Error('No product description from analysis');

    console.log('[LISTING GEN] ✅ Product analyzed:', productVisualDescription.substring(0, 60));

    // ═══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 2: Génération Description + Titre/Tags EN PARALLÈLE
    // ═══════════════════════════════════════════════════════════════════════════
    const [descriptionResult, titleTagsResult] = await Promise.all([
      // Description Etsy
      (async () => {
        try {
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are an expert Etsy copywriter.' },
                { role: 'user', content: `Generate an Etsy product description in ENGLISH based on this product:\n\n${productVisualDescription}\n\nRules: Include 8-12 emojis, warm tone, 300-500 words. Structure: 1) Emotional hook 2) Product presentation 3) Features 4) Why buy 5) Ideal for 6) Quality 7) Care 8) CTA. Return ONLY the description.` },
              ],
              temperature: 0.7, max_tokens: 1500,
            }),
          });
          if (!r.ok) throw new Error(`${r.status}`);
          const d = await r.json();
          return d.choices?.[0]?.message?.content?.trim() || '';
        } catch (e: any) {
          console.error('[LISTING GEN] Description error:', e.message);
          return '';
        }
      })(),

      // Titre + Tags + Matériaux
      (async () => {
        try {
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'Return valid JSON only.' },
                { role: 'user', content: `Product: ${productVisualDescription}\n\nReturn JSON: {"title":"SEO title 100-140 chars","tags":"tag1,tag2,...,tag13","materials":"mat1,mat2"}\nTitle MUST be 100-140 chars. Exactly 13 tags max 20 chars each. English only.` },
              ],
              temperature: 0.7, max_tokens: 400,
              response_format: { type: 'json_object' },
            }),
          });
          if (!r.ok) throw new Error(`${r.status}`);
          const d = await r.json();
          const parsed = JSON.parse(d.choices?.[0]?.message?.content?.trim());
          let title = parsed.title || '';
          const tags = (parsed.tags || '').split(',').map((t: string) => t.trim()).filter((t: string) => t && t.length <= 20).slice(0, 13);
          if (title.length < 100) {
            const suffixes = [' - Perfect Gift Idea', ' - Unique Handcrafted Design', ' - Modern Stylish Decor'];
            for (const s of suffixes) { if (title.length + s.length <= 140) { title += s; break; } }
          }
          return { title, tags, materials: parsed.materials || '' };
        } catch (e: any) {
          console.error('[LISTING GEN] Title/tags error:', e.message);
          return { title: '', tags: [] as string[], materials: '' };
        }
      })(),
    ]);

    const description = descriptionResult || productVisualDescription;
    const title = titleTagsResult.title || productVisualDescription.substring(0, 140);
    const tags = titleTagsResult.tags.length > 0 ? titleTagsResult.tags : ['handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'];
    const materials = titleTagsResult.materials || 'Various materials';

    // Déduire 1 crédit pour le listing
    let quotaResult: any = null;
    try {
      quotaResult = await incrementAnalysisCount(user.id, creditNeeded);
      if (quotaResult?.success) console.log('[LISTING GEN] ✅ Quota:', { used: quotaResult.used, remaining: quotaResult.remaining });
    } catch (e: any) {
      console.error('[LISTING GEN] Quota error:', e.message);
    }

    console.log('[LISTING GEN] ✅ Done | title:', title.length, 'chars | desc:', description.length, 'chars | tags:', tags.length);

    return NextResponse.json({
      success: true,
      listing: { title, description, tags, materials },
      images: [], // Images are now generated separately by the frontend
      quotaUpdated: quotaResult !== null,
      ...(quotaResult?.success ? { quota: { used: quotaResult.used, remaining: quotaResult.remaining, quota: quotaResult.quota } } : {}),
    });
  } catch (error: any) {
    console.error('[LISTING GEN] ❌ Fatal:', error.message);
    return NextResponse.json({ error: 'GENERATION_ERROR', message: error.message }, { status: 500 });
  }
}
