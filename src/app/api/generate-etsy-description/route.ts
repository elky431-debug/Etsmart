import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

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
      niche,
      positioning,
      psychologicalTriggers,
      buyerMirror,
      recommendedPrice,
      skipCreditDeduction = true, // ⚠️ CHANGÉ: Par défaut true car les crédits sont déjà déduits lors du parsing de l'image
    } = body;

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
      
      if (quotaInfo.status !== 'active') {
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
    
    // ⚠️ PROMPT 1: Description (ancien prompt - celui qui était parfait)
    const descriptionPrompt = `You are an expert Etsy copywriter. Generate a comprehensive, detailed product description for Etsy that is optimized for conversion, reassuring, and compliant with Etsy's best practices.

⚠️⚠️⚠️ CRITICAL RULE - READ THIS FIRST ⚠️⚠️⚠️
You MUST generate a description that matches EXACTLY the product described in the "PRODUCT VISUAL DESCRIPTION" below.
- If the product is a WATCH → describe a WATCH
- If the product is a BABY ITEM → describe a BABY ITEM  
- If the product is JEWELRY → describe JEWELRY
- If the product is a MASK → describe a MASK
- DO NOT invent a different product type
- DO NOT use generic descriptions
- DO NOT ignore the product visual description

PRODUCT VISUAL DESCRIPTION (THIS IS YOUR ONLY SOURCE - USE IT EXACTLY):
${productVisualDescription}

CRITICAL RULES:
- The description must be in ENGLISH ONLY
- You MUST describe EXACTLY what is in the product visual description above
- Do NOT use the AliExpress supplier title as a source
- Do NOT invent features, materials, or characteristics not mentioned in the product visual description
- Avoid any mention of dropshipping
- Avoid promises of "fast shipping"
- Avoid trademarked brand names
- Keep it generic and legally safe
- MUST include at least 12-18 emojis strategically placed throughout the description (use relevant emojis that enhance the message - more emojis make it more engaging and attractive)
- Warm, human, natural tone
- The description must be ready to copy-paste directly into Etsy
- Make it LONG and DETAILED - aim for 300-500 words minimum
- Be descriptive, engaging, and comprehensive
- Do NOT use bullet points, asterisks (*), dashes (-) at the start of lines, or numbered lists (1., 2., 3., etc.). The description must be written as flowing paragraphs only.

PRODUCT INFORMATION:
- Product visual description: ${productVisualDescription}
- Niche: ${niche}
- Positioning: ${positioning || 'Not specified'}
- Recommended price: $${recommendedPrice}
${psychologicalTriggers ? `- Psychological triggers: ${psychologicalTriggers.map((t: any) => t.trigger).join(', ')}` : ''}
${buyerMirror ? `- Buyer mirror effect: ${buyerMirror}` : ''}

⚠️⚠️⚠️ FINAL REMINDER ⚠️⚠️⚠️
Your description MUST describe the EXACT product type mentioned in the product visual description. If the product visual description says "watch", you MUST write about a watch. If it says "baby cradle", you MUST write about a baby cradle. Do NOT write about something else.

REQUIRED STRUCTURE (guideline – expand each idea in flowing paragraphs, NOT in a list):

- Start with an EMOTIONAL HOOK (2-3 sentences) to capture attention.
- Move into a CLEAR PRODUCT PRESENTATION (3-4 sentences) describing appearance, style, usage, and key benefits.
- Naturally weave in DETAILED FEATURES & BENEFITS inside the paragraphs instead of bullet points.
- Explain WHY PEOPLE BUY IT, IDEAL OCCASIONS, and QUALITY & CRAFTSMANSHIP in continuous text.
- End with gentle USAGE/Care notes (if relevant) and a SOFT CALL-TO-ACTION.

OUTPUT FORMAT:
- Return ONLY the final description text
- No explanations, no comments, no meta-text
- Just the ready-to-use description
- Use paragraph breaks for readability, but absolutely no bullet points, asterisks (*), or numbered lists at the start of lines
- Minimum 300 words, aim for 400-500 words
- MUST include at least 12-18 emojis (strategically placed, relevant to content - more emojis make it more engaging and attractive)
- Make it comprehensive, detailed, and engaging

Generate the description now:`;

    // ⚠️ PROMPT 2: Titre, Tags et Matériaux (nouveau prompt)
    const titleTagsMaterialsPrompt = `You are an expert Etsy SEO and product listing copywriter. I have an Etsy dropshipping store specialized in ${niche || '[YOUR NICHE]'}

⚠️⚠️⚠️ CRITICAL RULE - READ THIS FIRST ⚠️⚠️⚠️
You MUST generate a title, tags, and materials that match EXACTLY the product described in the "PRODUCT VISUAL DESCRIPTION" below.
- If the product is a WATCH → generate watch-related title, tags, and materials
- If the product is a BABY ITEM → generate baby-related title, tags, and materials
- If the product is JEWELRY → generate jewelry-related title, tags, and materials
- If the product is a MASK → generate mask-related title, tags, and materials
- DO NOT invent a different product type
- DO NOT use generic content
- DO NOT ignore the product visual description

PRODUCT VISUAL DESCRIPTION (THIS IS YOUR ONLY SOURCE - USE IT EXACTLY):
${productVisualDescription}

⚠️⚠️⚠️ ABSOLUTE REQUIREMENTS:
- You MUST generate content that matches EXACTLY what is described in the product visual description above
- Do NOT add features, materials, or characteristics that are not mentioned
- If the product visual description says "watch", generate watch-related content
- If the product visual description says "baby cradle", generate baby cradle-related content
- If the product visual description says "necklace", generate necklace-related content
- Match the product type, materials, and features described above EXACTLY

Your mission is to generate for me:
1. A SEO optimized title (clearly related to the product described above, without keyword stuffing, but effective for SEO). ⚠️ The title MUST be at LEAST 100 characters long (minimum 100, ideally 120-140). If the title is under 100 characters, ADD more relevant keywords until it reaches at least 100 characters.
2. A list of 13 Etsy tags, each maximum 20 characters, separated by commas, optimized for my Etsy SEO so I can copy-paste them directly.
3. A list of materials used in the product (based ONLY on what is mentioned in the product description above), separated by COMMAS (this is super important for copy-paste functionality). Generate only the materials you can identify from the description, ideally 2-4 materials if possible.

Important rules:
• Always put tags on a single line separated by commas.
• Materials must be in English, separated by COMMAS (example: "stainless steel, wood, leather, ceramic")
• Materials must be simple names, no descriptions, no sentences
• All text must be in English.
• The style must remain natural and seller-friendly, not too "robotic" or keyword-stuffed.
• You MUST match the product type and characteristics described in the product visual description above EXACTLY

PRODUCT INFORMATION:
- Product visual description: ${productVisualDescription}
- Niche: ${niche}
${positioning ? `- Positioning: ${positioning}` : ''}
${recommendedPrice ? `- Recommended price: $${recommendedPrice}` : ''}

⚠️⚠️⚠️ FINAL REMINDER ⚠️⚠️⚠️
Your title, tags, and materials MUST describe the EXACT product type mentioned in the product visual description. If the product visual description says "watch", you MUST generate watch-related content. If it says "baby cradle", you MUST generate baby cradle-related content. Do NOT generate content for a different product.

OUTPUT FORMAT (JSON):
Return a JSON object with this exact structure:
{
  "title": "SEO optimized title (MINIMUM 100 characters, ideally 120-140 characters, natural and keyword-rich - NEVER under 100 characters)",
  "tags": "tag1, tag2, tag3, tag4, tag5, tag6, tag7, tag8, tag9, tag10, tag11, tag12, tag13 (EXACTLY 13 tags required, never less)",
  "materials": "material1, material2, material3, material4"
}

IMPORTANT FOR MATERIALS:
- Materials must be separated by COMMAS (not spaces, not two spaces, exactly COMMAS)
- Example: "stainless steel, wood, leather, ceramic"
- Only material names in English, no descriptions, no sentences
- If materials are not clearly visible, infer from the product description
- Ideal: 2-4 materials if possible, but not mandatory

CRITICAL REQUIREMENTS:
- The title MUST be at LEAST 100 characters long (MINIMUM 100, ideally 120-140 characters). If it is under 100 characters, you MUST add more relevant SEO keywords to make it longer. NEVER generate a title shorter than 100 characters.
- You MUST provide exactly 13 tags, each maximum 20 characters, separated by commas on a single line
- Materials must be provided separately, separated by COMMAS (not spaces, exactly COMMAS) - this is CRITICAL for copy-paste functionality
- All text must be in English
- Keep the style natural and seller-friendly, not robotic or keyword-stuffed

Generate the title, tags and materials now:`;

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
            content: 'You are an expert Etsy copywriter specializing in conversion-optimized product descriptions that comply with Etsy guidelines.',
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
    const description = descriptionData.choices[0]?.message?.content?.trim();

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
            content: 'You are an expert in Etsy SEO and optimized product listing creation.',
          },
          {
            role: 'user',
            content: titleTagsMaterialsPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
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
          
          // Parse tags from comma-separated string
          tags = tagsString
            .split(',')
            .map(t => t.trim())
            .filter(t => t && t.length <= 20)
            .slice(0, 13);
          // Enforce EXACTLY 13 tags
          if (tags.length < 13) {
            const padTags = ['handmade', 'gift idea', 'unique', 'custom', 'etsy', 'artisan', 'quality', 'premium', 'original', 'trendy', 'stylish', 'home decor', 'special', 'creative', 'personalized', 'vintage style', 'boho', 'minimalist', 'aesthetic', 'bestseller'];
            for (const pt of padTags) { if (tags.length >= 13) break; if (!tags.map(t => t.toLowerCase()).includes(pt.toLowerCase())) tags.push(pt); }
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
            const padTags = ['handmade', 'gift idea', 'unique', 'custom', 'etsy', 'artisan', 'quality', 'premium', 'original', 'trendy', 'stylish', 'home decor', 'special', 'creative', 'personalized', 'vintage style', 'boho', 'minimalist', 'aesthetic', 'bestseller'];
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

