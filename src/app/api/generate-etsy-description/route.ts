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
      strengths,
    } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY_MISSING', message: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const prompt = `You are an expert Etsy copywriter. Generate a product description for Etsy that is optimized for conversion, reassuring, and compliant with Etsy's best practices.

CRITICAL RULES:
- The description must be in ENGLISH ONLY
- Do NOT use the AliExpress supplier title as a source
- Avoid any mention of dropshipping
- Avoid promises of "fast shipping"
- Avoid trademarked brand names
- Keep it generic and legally safe
- No emojis, no excessive capitalization, no aggressive marketing
- Warm, human, natural tone
- The description must be ready to copy-paste directly into Etsy

PRODUCT INFORMATION:
- Product description: ${productVisualDescription}
- Niche: ${niche}
- Positioning: ${positioning || 'Not specified'}
- Recommended price: $${recommendedPrice}
- Strengths: ${strengths?.join(', ') || 'Not specified'}
${psychologicalTriggers ? `- Psychological triggers: ${psychologicalTriggers.map((t: any) => t.trigger).join(', ')}` : ''}
${buyerMirror ? `- Buyer mirror effect: ${buyerMirror}` : ''}

REQUIRED STRUCTURE (follow exactly):

1. EMOTIONAL HOOK (1-2 sentences)
   - Capture attention
   - Speak directly to emotion or main need
   Example: "Looking for a meaningful gift that truly shows how much you care?"

2. CLEAR PRODUCT PRESENTATION
   - Explain immediately what it is
   - No jargon, no exaggerated promises
   - Product type, main usage, key benefit for buyer

3. WHY PEOPLE BUY IT (FOR / BECAUSE)
   - Connect with real purchase motivation
   - Natural, customer-oriented, emotional but credible

4. PRODUCT STRENGTHS (bullet points)
   - Readability, reassurance
   - Examples: "Personalizable with a name", "Thoughtful gift idea", "Durable material", "Suitable for everyday use"
   - NO unnecessary technical features

5. IDEAL FOR... (purchase contexts)
   - Help buyer project themselves
   - Examples: "Birthdays", "Anniversaries", "Gifts for pet lovers", "Special occasions"

6. REASSURING TONE & CONFIDENCE
   - Reduce objections, increase conversion
   - Mention perceived quality, ease of use, attention to detail
   - DO NOT mention "handmade" if it's not true

7. SOFT CALL-TO-ACTION (Etsy-friendly)
   - Encourage purchase without aggressiveness
   - Example: "Add it to your cart and create a meaningful moment today."

OUTPUT FORMAT:
- Return ONLY the final description text
- No explanations, no comments, no meta-text
- Just the ready-to-use description
- Use proper paragraph breaks for readability
- Use bullet points with "-" for the strengths section

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
        max_tokens: 1000,
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

