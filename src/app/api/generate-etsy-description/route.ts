import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sanitizeEtsyDescriptionPlainText } from '@/lib/etsy-description-plain';
import { listingKeywordHintsFromRequestBody, listingKeywordHintsPromptAppendix } from '@/lib/listing-keyword-hints-dev';

export async function POST(request: NextRequest) {
  try {
    // 🔒 SECURITY: Require authentication to prevent abuse
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Parse body first to check if credit deduction should be skipped
    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[DESCRIPTION GENERATION] Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Invalid request body' },
        { status: 400 }
      );
    }

    const {
      productVisualDescription,
      sourceTitle,
      niche,
      positioning,
      psychologicalTriggers,
      buyerMirror,
      recommendedPrice,
      skipCreditDeduction = true,
    } = body;
    const listingKeywordHints = listingKeywordHintsFromRequestBody(body);
    const sourceTitleClean = sourceTitle && typeof sourceTitle === 'string' ? String(sourceTitle).trim().substring(0, 250) : '';

    // ⚠️ CRITICAL VALIDATION: Vérifier que productVisualDescription est présent et non vide
    if (!productVisualDescription || productVisualDescription.trim().length === 0) {
      console.error('[DESCRIPTION GENERATION] ❌ productVisualDescription is missing or empty');
      return NextResponse.json(
        { error: 'MISSING_PRODUCT_DESCRIPTION', message: 'Product visual description is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Log pour déboguer
    console.log('[DESCRIPTION GENERATION] Product visual description received:', productVisualDescription.substring(0, 200) + '...');

    // ⚠️ CRITICAL: Check subscription status and quota before allowing generation
    // (sauf si skipCreditDeduction est true, auquel cas les crédits ont déjà été déduits lors du parsing)
    if (!skipCreditDeduction) {
      const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
      const quotaInfo = await getUserQuotaInfo(user.id);
      
      if (quotaInfo.status !== 'active' && quotaInfo.status !== 'free') {
        return NextResponse.json(
          { error: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required to generate descriptions.' },
          { status: 403 }
        );
      }

      // Check if user has enough quota (1 credit needed)
      if (quotaInfo.remaining < 1.0) {
        return NextResponse.json(
          { error: 'QUOTA_EXCEEDED', message: 'Insufficient quota. You need 1 credit to generate a description.' },
          { status: 403 }
        );
      }
    }

    // ⚠️ CRITICAL: Log the product visual description for debugging
    console.log('[DESCRIPTION GENERATION] Full product visual description:', productVisualDescription);
    console.log('[DESCRIPTION GENERATION] Product visual description length:', productVisualDescription.length);
    
    // ⚠️ PROMPT 1: Description (même template que la génération rapide)
    const descriptionPrompt = `I will provide Etsy product photos (in your place: a product visual description). Your role is to generate a professional, convincing, SEO-optimized Etsy description ready to publish.

WORKING RULES:
- If no competitor description is provided: write the best complete SEO description from the product visual description.

LANGUAGE:
- Final output must be ENGLISH ONLY.
- Do NOT provide any French translation.
- Never mix languages in any paragraph.

MANDATORY STRUCTURE:
1) SEO-optimized description title (clear, strong hook, product + style, emojis allowed only if relevant)
2) Product presentation + branding (immersive, design + ambiance + perceived value, premium reassuring tone)
3) Marketing/value section:
   ✨ Why you'll love it
   - 3 to 5 bullet points max
   - customer benefits focused
   - emojis optional and niche-appropriate
4) Dimensions section ONLY if relevant and clearly available from the product visual description. Never invent dimensions.
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
- Product visual description: ${productVisualDescription}
- Niche: ${niche}
- Positioning: ${positioning || 'Not specified'}
- Recommended price: $${recommendedPrice}

Return ONLY the final description text.`;

    // ⚠️ PROMPT 2: Titre, Tags et Matériaux
    const titleTagsMaterialsPrompt = `You are an Etsy SEO expert. Return valid JSON only.

ROLE: Generate an Etsy-native title, 13 high-quality tags, and materials for a handmade/artisan shop.

TITLE RULES:
- English only.
- Target 13–14 words (aim for 100–130 characters). Max 140 characters.
- No special characters (no |, •, ★, —, emojis, etc.).
- Write in authentic Etsy shop tone — creative, specific, niche-aware.
- NEVER use AliExpress/Amazon/dropshipping-style language (no "high quality", "hot sale", "fashion women", "new arrival", "free shipping", "best price", "wholesale").
- Structure: [product type] + [key descriptors: material/color/style] + [use case or occasion] + [audience or niche keyword].
- No unnecessary keyword repetition.${listingKeywordHints ? '\n- Integrate seller keyword hints into the title where naturally fitting.' : ''}

TAGS RULES (STRICT):
- English only.
- Exactly 13 tags.
- Return tags separated by commas only. No # symbol. No emojis. No explanatory text.
- Max 20 characters per tag.
- NO generic filler tags: never use "handmade", "unique", "quality", "premium", "original", "trendy", "stylish", "etsy", "artisan", "bestseller", "aesthetic", "gift", "custom" alone — these are too vague to rank.
- No duplicates.
- Build a DIVERSE, SPECIFIC mix of:
  1. Exact product type (2–3 tags, e.g. "high waist leggings", "yoga pants")
  2. Material or technique (1–2 tags, e.g. "ribbed fabric", "cotton knit")
  3. Style / aesthetic (1–2 tags, e.g. "minimalist style", "boho chic")
  4. Use case / activity (1–2 tags, e.g. "gym wear", "home workout")
  5. Buyer intent / occasion (2–3 tags, e.g. "gift for her", "birthday gift", "everyday wear")
  6. Target audience / niche (1–2 tags, e.g. "women activewear", "plus size yoga")
- Each tag should be a real Etsy search phrase buyers actually type.
- If an original product title is provided: extract the specific product keywords from it (material, style, type, color) and use them as tags — ignore generic words like "fashion", "women", "high quality", "new".${listingKeywordHints ? '\n- Include seller keyword hints as tags if they fit within 20 chars.' : ''}

INPUTS:
- Product visual description: ${productVisualDescription}${sourceTitleClean ? `\n- Original product title (keyword reference — extract relevant product terms, ignore generic/dropshipping words): ${sourceTitleClean}` : ''}
- Niche: ${niche || 'general'}${listingKeywordHints ? `\n- Seller keyword/style hints: ${listingKeywordHints}` : ''}

MATERIALS RULES:
- Only material names (no sentences). Separated by commas. In English.

Return JSON exactly:
{"title":"optimized etsy title","tags":"tag1,tag2,...,tag13","materials":"mat1,mat2"}`;

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY_MISSING', message: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // ⚠️ APPEL 1: Générer la description avec l'ancien prompt (celui qui était parfait)
    const descriptionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert Etsy copywriter specializing in conversion-optimized product descriptions that comply with Etsy guidelines. Never use Markdown (no **, *, #, or code fences); Etsy descriptions are plain text only.',
          },
          {
            role: 'user',
            content: descriptionPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!descriptionResponse.ok) {
      const errorData = await descriptionResponse.json().catch(() => ({ error: 'parse_failed' }));
      console.error('OpenAI error (description):', descriptionResponse.status, errorData);
      
      let message = 'Error generating description';
      if (descriptionResponse.status === 401) {
        message = 'Invalid OpenAI API key';
      } else if (descriptionResponse.status === 429) {
        message = 'OpenAI API quota exceeded. Please try again later.';
      }
      
      return NextResponse.json(
        { error: 'OPENAI_ERROR', message },
        { status: descriptionResponse.status }
      );
    }

    const descriptionData = await descriptionResponse.json();
    const descriptionRaw = descriptionData.choices[0]?.message?.content?.trim() || '';
    const description = sanitizeEtsyDescriptionPlainText(descriptionRaw);

    if (!description) {
      return NextResponse.json(
        { error: 'NO_DESCRIPTION_GENERATED', message: 'Failed to generate description' },
        { status: 500 }
      );
    }

    // ⚠️ APPEL 2: Générer le titre, les tags et les matériaux avec le nouveau prompt
    const titleTagsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an Etsy SEO expert. Return valid JSON only — no markdown, no code fences, no extra text.',
          },
          {
            role: 'user',
            content: titleTagsMaterialsPrompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!titleTagsResponse.ok) {
      const errorData = await titleTagsResponse.json().catch(() => ({ error: 'parse_failed' }));
      console.error('OpenAI error (title/tags/materials):', titleTagsResponse.status, errorData);
      
      // Si l'erreur est sur le titre/tags/matériaux, on retourne quand même la description
      console.warn('[DESCRIPTION GENERATION] Failed to generate title/tags/materials, but description was generated successfully');
    }

    let title = '';
    let tags: string[] = [];
    let materials: string[] = [];

    if (titleTagsResponse.ok) {
      const titleTagsResponseData = await titleTagsResponse.json();
      const titleTagsContent = titleTagsResponseData.choices[0]?.message?.content?.trim();

      if (titleTagsContent) {
        try {
          // Try to parse as JSON
          const parsedTitleTagsData = JSON.parse(titleTagsContent);
          title = parsedTitleTagsData.title || '';
          const tagsString = parsedTitleTagsData.tags || '';
          const materialsString = parsedTitleTagsData.materials || '';
          
          // Parse + normalize tags
          const normalize = (s: string) => s.replace(/#/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
          const seen = new Set<string>();
          tags = tagsString
            .split(',')
            .map((t: string) => normalize(t))
            .filter((t: string) => { if (t.length < 2 || t.length > 20 || seen.has(t)) return false; seen.add(t); return true; })
            .slice(0, 13);
          if (tags.length < 13) {
            const padTags = ['gift for her', 'birthday gift', 'everyday wear', 'boho style', 'minimalist style', 'made to order', 'gift for women', 'cozy fashion', 'casual style', 'fall fashion', 'spring style', 'women fashion', 'trendy outfit'];
            for (const pt of padTags) { if (tags.length >= 13) break; if (!seen.has(pt)) { seen.add(pt); tags.push(pt); } }
          }

          // Parse materials from comma-separated string
          if (materialsString) {
            materials = materialsString
              .split(',') // Split by commas
              .map(m => m.trim())
              .filter(m => m && m.length > 0);
          }
        } catch (parseError) {
          // If not JSON, try to extract from text format
          console.warn('[DESCRIPTION GENERATION] Title/tags/materials response is not JSON, trying to extract from text...');
          
          const titleMatch = titleTagsContent.match(/title["']?\s*[:=]\s*["']([^"']+)["']/i) || 
                           titleTagsContent.match(/TITLE:\s*(.+?)(?:\n|TAGS|MATERIALS)/i);
          const tagsMatch = titleTagsContent.match(/tags["']?\s*[:=]\s*["']([^"']+)["']/i) || 
                          titleTagsContent.match(/TAGS:\s*(.+?)(?:\n|MATERIALS|$)/i);
          const materialsMatch = titleTagsContent.match(/materials["']?\s*[:=]\s*["']([^"']+)["']/i) || 
                                titleTagsContent.match(/MATERIALS:\s*(.+?)$/i);
          
          title = titleMatch?.[1]?.trim() || '';
          const tagsString = tagsMatch?.[1]?.trim() || '';
          const materialsString = materialsMatch?.[1]?.trim() || '';
          
          tags = tagsString
            .split(',')
            .map(t => t.trim())
            .filter(t => t && t.length <= 20)
            .slice(0, 13);
          // Enforce EXACTLY 13 tags
          if (tags.length < 13) {
            const padTags = ['gift for her', 'birthday gift', 'everyday wear', 'boho style', 'minimalist style', 'made to order', 'gift for women', 'cozy fashion', 'casual style', 'fall fashion', 'spring style', 'women fashion', 'trendy outfit'];
            for (const pt of padTags) { if (tags.length >= 13) break; if (!tags.map(t => t.toLowerCase()).includes(pt.toLowerCase())) tags.push(pt); }
          }

          if (materialsString) {
            materials = materialsString
              .split(',') // Split by commas
              .map(m => m.trim())
              .filter(m => m && m.length > 0);
          }
        }
      }
    }
    
    // ⚠️ VALIDATION TITRE SEO : minimum 100 caractères obligatoire
    if (title && title.length < 100) {
      console.log(`[DESCRIPTION GENERATION] ⚠️ Title too short (${title.length} chars), enriching to reach 100+ chars...`);
      
      // Tentative de régénération avec un prompt encore plus strict
      try {
        const enrichTitleResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are an Etsy SEO title expert. You MUST return a JSON object with a single "title" field. The title MUST be between 100 and 140 characters. Count every character carefully.',
              },
              {
                role: 'user',
                content: `The following Etsy SEO title is TOO SHORT (only ${title.length} characters). You MUST expand it to be between 100 and 140 characters by adding relevant SEO keywords, product features, materials, use cases, or gift occasion keywords. Do NOT change the product type.

CURRENT SHORT TITLE: "${title}"

PRODUCT DESCRIPTION: ${productVisualDescription}
NICHE: ${niche}

RULES:
- The new title MUST be between 100 and 140 characters (count carefully!)
- Keep the original product type and key terms
- Add relevant Etsy SEO keywords like: gift idea, unique, handmade style, home decor, personalized, modern, vintage, etc.
- Make it natural and seller-friendly
- English only

Return JSON: {"title": "your expanded title here (100-140 chars)"}`,
              },
            ],
            temperature: 0.8,
            max_tokens: 300,
            response_format: { type: 'json_object' },
          }),
        });

        if (enrichTitleResponse.ok) {
          const enrichData = await enrichTitleResponse.json();
          const enrichContent = enrichData.choices[0]?.message?.content?.trim();
          if (enrichContent) {
            const enrichParsed = JSON.parse(enrichContent);
            if (enrichParsed.title && enrichParsed.title.length >= 100) {
              console.log(`[DESCRIPTION GENERATION] ✅ Title enriched: ${enrichParsed.title.length} chars (was ${title.length})`);
              title = enrichParsed.title;
            } else if (enrichParsed.title && enrichParsed.title.length > title.length) {
              // Mieux que l'original même si < 100
              console.log(`[DESCRIPTION GENERATION] ⚠️ Title partially enriched: ${enrichParsed.title.length} chars (was ${title.length})`);
              title = enrichParsed.title;
            }
          }
        }
      } catch (enrichError) {
        console.error('[DESCRIPTION GENERATION] ⚠️ Title enrichment failed:', enrichError);
      }

      // Dernier recours : ajouter des mots-clés manuellement si toujours trop court
      if (title.length < 100) {
        const seoSuffixes = [
          ' - Perfect Gift Idea for Any Occasion',
          ' - Unique Handcrafted Home Decor',
          ' - Modern Design Stylish Aesthetic',
          ' - Premium Quality Elegant Finish',
          ' - Trending Bestseller Must Have',
          ' - Great Birthday Christmas Gift',
        ];
        for (const suffix of seoSuffixes) {
          if (title.length + suffix.length <= 140 && title.length < 100) {
            title = title + suffix;
            console.log(`[DESCRIPTION GENERATION] ✅ Title padded with suffix: ${title.length} chars`);
            break;
          }
        }
      }
      
      console.log(`[DESCRIPTION GENERATION] Final title length: ${title.length} chars`);
    }
    
    // Si pas de matériaux générés, inférer depuis la description du produit (optionnel)
    if (materials.length === 0) {
      const productDesc = productVisualDescription?.toLowerCase() || '';
      let inferredMaterials: string[] = [];
      
      if (productDesc.includes('metal') || productDesc.includes('steel') || productDesc.includes('gold') || productDesc.includes('silver') || productDesc.includes('brass') || productDesc.includes('copper')) {
        inferredMaterials.push('metal');
      }
      if (productDesc.includes('wood') || productDesc.includes('wooden') || productDesc.includes('timber')) {
        inferredMaterials.push('wood');
      }
      if (productDesc.includes('leather')) {
        inferredMaterials.push('leather');
      }
      if (productDesc.includes('ceramic') || productDesc.includes('porcelain')) {
        inferredMaterials.push('ceramic');
      }
      if (productDesc.includes('fabric') || productDesc.includes('cotton') || productDesc.includes('textile') || productDesc.includes('cloth')) {
        inferredMaterials.push('fabric');
      }
      if (productDesc.includes('glass')) {
        inferredMaterials.push('glass');
      }
      if (productDesc.includes('plastic') || productDesc.includes('pvc')) {
        inferredMaterials.push('plastic');
      }
      
      materials = inferredMaterials;
      console.log('[DESCRIPTION GENERATION] ⚠️ No materials generated, inferred from product description:', materials);
    }

    if (!description) {
      return NextResponse.json(
        { error: 'NO_DESCRIPTION_GENERATED', message: 'Failed to generate description' },
        { status: 500 }
      );
    }

    // ⚠️ CRITICAL: Increment quota AFTER successful generation
    // Listing generation costs 1 credit (independent from image generation)
    // ⚠️ MANDATORY: Always deduct 1 credit for listing generation (skipCreditDeduction is only for quick generation)
    let quotaResult: { success: boolean; used: number; quota: number; remaining: number; error?: string } | null = null;
    
    if (skipCreditDeduction) {
      console.log('[DESCRIPTION GENERATION] ⚠️ Credit deduction skipped (will be done in quick generation)');
    } else {
      const { incrementAnalysisCount } = await import('@/lib/subscription-quota');
      console.log('[DESCRIPTION GENERATION] ⚠️ MANDATORY: About to decrement 1 credit for listing generation (user:', user.id, ')');
      
      try {
        quotaResult = await incrementAnalysisCount(user.id, 1.0);
        if (!quotaResult.success) {
          console.error('❌ [DESCRIPTION GENERATION] CRITICAL: Failed to decrement quota:', quotaResult.error);
          console.error('[DESCRIPTION GENERATION] Quota result details:', JSON.stringify(quotaResult, null, 2));
          // ⚠️ CRITICAL: If quota deduction fails, throw error to prevent free usage
          throw new Error(`Failed to deduct 1.0 credit: ${quotaResult.error || 'Unknown error'}`);
        } else {
          console.log('✅ [DESCRIPTION GENERATION] Quota decremented successfully:', {
            used: quotaResult.used,
            quota: quotaResult.quota,
            remaining: quotaResult.remaining,
            amount: 1.0,
          });
        }
        
        // ⚠️ CRITICAL: Verify the value was stored correctly by reading it back immediately
        const adminSupabase = createSupabaseAdminClient();
        const { data: verifyUser, error: verifyError } = await adminSupabase
          .from('users')
          .select('analysis_used_this_month')
          .eq('id', user.id)
          .single();
        
        if (!verifyError && verifyUser) {
          const storedValue = typeof verifyUser.analysis_used_this_month === 'number' 
            ? verifyUser.analysis_used_this_month 
            : parseFloat(String(verifyUser.analysis_used_this_month)) || 0;
          console.log('✅ [DESCRIPTION GENERATION] Verified stored value in DB:', storedValue);
          
          if (quotaResult && Math.abs(storedValue - quotaResult.used) > 0.01) {
            console.error('❌ [DESCRIPTION GENERATION] WARNING: Stored value differs from expected:', {
              expected: quotaResult.used,
              stored: storedValue,
            });
          }
        } else {
          console.warn('⚠️ [DESCRIPTION GENERATION] Could not verify stored value:', verifyError);
        }
      } catch (quotaError: any) {
        console.error(`❌ [DESCRIPTION GENERATION] CRITICAL ERROR: Failed to deduct credits:`, quotaError.message);
        console.error(`[DESCRIPTION GENERATION] Error stack:`, quotaError.stack);
        // ⚠️ CRITICAL: Return error if credits cannot be deducted
        return NextResponse.json(
          { 
            error: 'QUOTA_DEDUCTION_FAILED',
            message: `Failed to deduct 1.0 credit after listing generation: ${quotaError.message}. Please contact support.`,
            description: description, // Return description anyway but log the error
          },
          { status: 500 }
        );
      }
    }

    // Return title, description, tags, materials AND updated quota info so client can verify
    return NextResponse.json({ 
      title: title || null,
      description,
      tags: tags.length > 0 ? tags : null,
      materials: materials.length > 0 ? materials.join(', ') : null, // Join with commas and space
      quotaUpdated: !skipCreditDeduction,
      // Include quota info if available
      ...(quotaResult && !skipCreditDeduction && quotaResult.success ? {
        quota: {
          used: quotaResult.used,
          remaining: quotaResult.remaining,
          quota: quotaResult.quota,
        }
      } : {}),
    });
  } catch (error: any) {
    console.error('[DESCRIPTION GENERATION] ❌ Error generating Etsy description:', error);
    console.error('[DESCRIPTION GENERATION] Error stack:', error.stack);
    console.error('[DESCRIPTION GENERATION] Error details:', {
      message: error.message,
      name: error.name,
      response: error.response,
    });
    
    if (error.response?.status === 401) {
      return NextResponse.json(
        { error: 'INVALID_API_KEY', message: 'Invalid OpenAI API key' },
        { status: 500 }
      );
    }
    
    if (error.response?.status === 429) {
      return NextResponse.json(
        { error: 'QUOTA_EXCEEDED', message: 'OpenAI API quota exceeded. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: 'GENERATION_ERROR', 
        message: error.message || 'Failed to generate description',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

