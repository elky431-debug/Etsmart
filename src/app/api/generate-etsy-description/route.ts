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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY_MISSING', message: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const prompt = `You are an expert Etsy copywriter. Generate a comprehensive, detailed product description for Etsy that is optimized for conversion, reassuring, and compliant with Etsy's best practices.

CRITICAL RULES:
- The description must be in ENGLISH ONLY
- Do NOT use the AliExpress supplier title as a source
- Avoid any mention of dropshipping
- Avoid promises of "fast shipping"
- Avoid trademarked brand names
- Keep it generic and legally safe
- MUST include at least 3 emojis strategically placed throughout the description (use relevant emojis that enhance the message)
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
   - Include 1 emoji here
   - Example: "Looking for a meaningful gift that truly shows how much you care? ✨ This beautiful piece is designed to create lasting memories and bring joy to your loved ones."

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
   - Include 1 emoji in this section

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
   - Include 1 emoji here

7. USAGE & CARE (2-3 sentences)
   - How to use the product
   - Care instructions if relevant
   - Tips for getting the most out of it

8. SOFT CALL-TO-ACTION (Etsy-friendly) (1-2 sentences)
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
- MUST include at least 3 emojis (strategically placed, relevant to content)
- Make it comprehensive, detailed, and engaging

Generate the description now:`;

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY_MISSING', message: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000, // Augmenté pour permettre des descriptions longues et détaillées
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'parse_failed' }));
      console.error('OpenAI error:', response.status, errorData);
      
      let message = 'Error generating description';
      if (response.status === 401) {
        message = 'Invalid OpenAI API key';
      } else if (response.status === 429) {
        message = 'OpenAI API quota exceeded. Please try again later.';
      }
      
      return NextResponse.json(
        { error: 'OPENAI_ERROR', message },
        { status: response.status }
      );
    }

    const data = await response.json();
    const description = data.choices[0]?.message?.content?.trim();

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
        const { supabase } = await import('@/lib/supabase-admin');
        const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
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

    // Return description AND updated quota info so client can verify
    return NextResponse.json({ 
      description,
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

