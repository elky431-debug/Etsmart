import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      productVisualDescription,
      niche,
      positioning,
      psychologicalTriggers,
      buyerMirror,
      recommendedPrice,
    } = body;

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

    return NextResponse.json({ description });
  } catch (error: any) {
    console.error('Error generating Etsy description:', error);
    
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
      { error: 'GENERATION_ERROR', message: error.message || 'Failed to generate description' },
      { status: 500 }
    );
  }
}

