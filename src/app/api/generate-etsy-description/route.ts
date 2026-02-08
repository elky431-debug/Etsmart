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

      // Check if user has enough quota (0.5 credit needed)
      if (quotaInfo.remaining < 0.5) {
        return NextResponse.json(
          { error: 'QUOTA_EXCEEDED', message: 'Insufficient quota. You need 0.5 credit to generate a description.' },
          { status: 403 }
        );
      }
    }

    // ⚠️ PROMPT 1: Description (ancien prompt - celui qui était parfait)
    const descriptionPrompt = `You are an expert Etsy copywriter. Generate a comprehensive, detailed product description for Etsy that is optimized for conversion, reassuring, and compliant with Etsy's best practices.

CRITICAL RULES:
- The description must be in ENGLISH ONLY
- Do NOT use the AliExpress supplier title as a source
- Avoid any mention of dropshipping
- Avoid promises of "fast shipping"
- Avoid trademarked brand names
- Keep it generic and legally safe
- MUST include at least 8-12 emojis strategically placed throughout the description (use relevant emojis that enhance the message - more emojis make it more engaging and attractive)
- Warm, human, natural tone
- The description must be ready to copy-paste directly into Etsy
- Make it LONG and DETAILED - aim for 300-500 words minimum
- Be descriptive, engaging, and comprehensive

PRODUCT INFORMATION:
- Product description: ${productVisualDescription}
- Niche: ${niche}
- Positioning: ${positioning || 'Not specified'}
- Recommended price: $${recommendedPrice}
${psychologicalTriggers ? `- Psychological triggers: ${psychologicalTriggers.map((t: any) => t.trigger).join(', ')}` : ''}
${buyerMirror ? `- Buyer mirror effect: ${buyerMirror}` : ''}

REQUIRED STRUCTURE (follow exactly - expand each section with details):

1. EMOTIONAL HOOK (2-3 sentences)
   - Capture attention immediately
   - Speak directly to emotion or main need
   - Use vivid, engaging language
   - Include 2-3 emojis here
   - Example: "Looking for a meaningful gift that truly shows how much you care? ✨ This beautiful piece is designed to create lasting memories and bring joy to your loved ones. 💝"

2. CLEAR PRODUCT PRESENTATION (3-4 sentences)
   - Explain in detail what it is
   - Describe its appearance, style, and design
   - Mention materials, colors, dimensions if relevant
   - Product type, main usage, key benefits for buyer
   - Be specific and descriptive

3. DETAILED FEATURES & BENEFITS (4-5 sentences or bullet points)
   - List key features with explanations
   - Explain why each feature matters to the buyer
   - Connect features to real-world benefits
   - Use bullet points with "-" for clarity
   - Include 2-3 emojis in this section

4. WHY PEOPLE BUY IT (FOR / BECAUSE) (3-4 sentences)
   - Connect with real purchase motivation
   - Natural, customer-oriented, emotional but credible
   - Explain the emotional and practical reasons to buy
   - Paint a picture of how it improves their life

5. IDEAL FOR... (purchase contexts) (2-3 sentences)
   - Help buyer project themselves
   - List multiple use cases and occasions
   - Examples: "Birthdays", "Anniversaries", "Gifts for pet lovers", "Special occasions", "Home decoration", "Personal use"
   - Make it relatable and specific

6. QUALITY & CRAFTSMANSHIP (2-3 sentences)
   - Reassuring tone & confidence
   - Reduce objections, increase conversion
   - Mention perceived quality, ease of use, attention to detail
   - Describe durability, finish, and overall quality
   - DO NOT mention "handmade" if it's not true
   - Include 2-3 emojis here

8. USAGE & CARE (2-3 sentences)
   - How to use the product
   - Care instructions if relevant
   - Tips for getting the most out of it

9. SOFT CALL-TO-ACTION (Etsy-friendly) (1-2 sentences)
   - Encourage purchase without aggressiveness
   - Create urgency in a gentle way
   - Example: "Add it to your cart and create a meaningful moment today. Perfect for yourself or as a thoughtful gift that will be cherished for years to come."

OUTPUT FORMAT:
- Return ONLY the final description text
- No explanations, no comments, no meta-text
- Just the ready-to-use description
- Use proper paragraph breaks for readability
- Use bullet points with "-" for features/benefits sections
- Minimum 300 words, aim for 400-500 words
- MUST include at least 8-12 emojis (strategically placed, relevant to content - more emojis make it more engaging and attractive)
- Make it comprehensive, detailed, and engaging

Generate the description now:`;

    // ⚠️ PROMPT 2: Titre, Tags et Matériaux (nouveau prompt)
    const titleTagsMaterialsPrompt = `Tu es un expert en SEO Etsy et en rédaction de fiches produits optimisées. J'ai une boutique Etsy en dropshipping spécialisée dans ${niche || '[TA NICHE]'}

À chaque fois que je te donnerai :
• Un nom de produit AliExpress
• Sa description
• Et éventuellement des mots-clés pertinents ou une fiche concurrent

Ta mission est de générer pour moi :
1. Un titre optimisé SEO (clairement en rapport avec les mots-clés, sans spam, mais efficace pour le référencement).
2. Une liste de 13 tags Etsy, chacun de maximum 20 caractères, séparés par des virgules, optimisés pour mon SEO Etsy afin que je puisse les copier-coller directement.
3. Une liste de matériaux utilisés dans le produit, séparés par DES VIRGULES (c'est super important pour pouvoir tout copier-coller d'un coup). Génère les matériaux que tu peux identifier, idéalement 2-4 matériaux si possible.

Règles importantes :
• Mets toujours les tags sur une seule ligne séparés par des virgules.
• Les matériaux doivent être en anglais, séparés par DES VIRGULES (exemple: "stainless steel, wood, leather, ceramic")
• Les matériaux doivent être des noms simples, pas de descriptions, pas de phrases
• Le texte doit être en anglais.
• Le style doit rester naturel et vendeur, pas trop "robotique" ni bourré de mots-clés.

PRODUCT INFORMATION:
- Product name/description: ${productVisualDescription}
- Niche: ${niche}
${positioning ? `- Positioning: ${positioning}` : ''}
${recommendedPrice ? `- Recommended price: $${recommendedPrice}` : ''}

OUTPUT FORMAT (JSON):
Return a JSON object with this exact structure:
{
  "title": "SEO optimized title (130-140 characters, natural and keyword-rich - make it as LONG as possible)",
  "tags": "tag1, tag2, tag3, tag4, tag5, tag6, tag7, tag8, tag9, tag10, tag11, tag12, tag13",
  "materials": "material1, material2, material3, material4"
}

IMPORTANT FOR MATERIALS:
- Materials must be separated by COMMAS (not spaces, not two spaces, exactly COMMAS)
- Example: "stainless steel, wood, leather, ceramic"
- Only material names in English, no descriptions, no sentences
- If materials are not clearly visible, infer from the product description
- Ideal: 2-4 materials if possible, but not mandatory

CRITICAL REQUIREMENTS:
- The title must be 130-140 characters (as LONG as possible, close to the 140 character limit), SEO optimized, natural and keyword-rich
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
            .slice(0, 13); // Ensure max 13 tags

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

          if (materialsString) {
            materials = materialsString
              .split(',') // Split by commas
              .map(m => m.trim())
              .filter(m => m && m.length > 0);
          }
        }
      }
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
    // Listing generation costs 0.5 credit (independent from image generation)
    // Sauf si skipCreditDeduction est true (les crédits seront déduits dans generate-images)
    let quotaResult: { success: boolean; used: number; quota: number; remaining: number; error?: string } | null = null;
    
    if (!skipCreditDeduction) {
      const { incrementAnalysisCount } = await import('@/lib/subscription-quota');
      console.log('[DESCRIPTION GENERATION] ⚠️ About to decrement 0.5 credit for listing generation (user:', user.id, ')');
      quotaResult = await incrementAnalysisCount(user.id, 0.5);
      if (!quotaResult.success) {
        console.error('❌ [DESCRIPTION GENERATION] Failed to decrement quota:', quotaResult.error);
        // Generation already completed, but quota wasn't incremented
        // This is logged but doesn't block the response
      } else {
        console.log('✅ [DESCRIPTION GENERATION] Quota decremented successfully:', {
          used: quotaResult.used,
          quota: quotaResult.quota,
          remaining: quotaResult.remaining,
          amount: 0.5,
        });
        
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
          
          if (Math.abs(storedValue - quotaResult.used) > 0.01) {
            console.error('❌ [DESCRIPTION GENERATION] WARNING: Stored value differs from expected:', {
              expected: quotaResult.used,
              stored: storedValue,
            });
          }
        } else {
          console.warn('⚠️ [DESCRIPTION GENERATION] Could not verify stored value:', verifyError);
        }
      }
    } else {
      console.log('[DESCRIPTION GENERATION] ⚠️ Credit deduction skipped (will be done in image generation)');
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

