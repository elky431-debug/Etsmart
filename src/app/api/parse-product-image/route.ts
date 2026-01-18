import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════
// API PARSING PRODUIT DEPUIS SCREENSHOT - OPENAI VISION
// ═══════════════════════════════════════════════════════════════════════════

interface ProductImageData {
  title: string;
  price: number;
  currency: string;
  images: string[];
  description?: string;
  rating?: number;
  reviews?: number;
  url?: string;
  source: 'aliexpress' | 'alibaba';
}

export async function POST(request: NextRequest) {
  try {
    // Vérifier le Content-Type pour gérer FormData ou JSON
    const contentType = request.headers.get('content-type') || '';
    
    let imageFile: File | null = null;
    let imageUrl: string | null = null;
    let imageBase64: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      // Gérer FormData (upload de fichier)
      const formData = await request.formData();
      imageFile = formData.get('image') as File | null;
      imageUrl = formData.get('imageUrl') as string | null;
      
      // Convertir l'image en base64 si c'est un fichier
      if (imageFile) {
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imageBase64 = buffer.toString('base64');
      }
    } else {
      // Gérer JSON (URL d'image)
      const body = await request.json();
      imageUrl = body.imageUrl || null;
    }

    // Vérifier qu'on a une image (fichier ou URL)
    if (!imageFile && !imageUrl && !imageBase64) {
      return NextResponse.json(
        { error: 'Missing required field: image or imageUrl' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'OPENAI_API_KEY_MISSING',
          message: 'Clé OpenAI non configurée. Configurez OPENAI_API_KEY dans Netlify.' 
        },
        { status: 503 }
      );
    }

    // Utiliser l'URL directement si fournie, sinon base64
    const imageToAnalyze = imageUrl || (imageBase64 ? `data:${imageFile?.type || 'image/png'};base64,${imageBase64}` : null);

    if (!imageToAnalyze) {
      return NextResponse.json(
        { error: 'Could not process image' },
        { status: 400 }
      );
    }

    console.log('🔍 Analyzing product screenshot with OpenAI Vision...');

    // ═══════════════════════════════════════════════════════════════════════════
    // PROMPT POUR EXTRACTION DES DONNÉES PRODUIT
    // ═══════════════════════════════════════════════════════════════════════════
    
    const prompt = `You are analyzing a screenshot of an AliExpress or Alibaba product page.

Your task is to EXTRACT ALL PRODUCT INFORMATION visible in the image.

Look for and extract:

1. **PRODUCT TITLE** (obligatoire)
   - The full product name/title displayed on the page
   - Usually at the top or in the product details section
   - Extract EXACTLY as written, don't summarize

2. **PRICE** (obligatoire)
   - The current/sale price displayed
   - Look for price in format like "$12.99", "US $12.99", "€12.99", etc.
   - Extract the NUMBER ONLY (12.99), not the currency symbol
   - If there's a crossed-out original price, extract the SALE price (not the original)

3. **CURRENCY** (obligatoire)
   - The currency symbol used ($, €, £, etc.)
   - Default to "USD" if unclear

4. **PRODUCT IMAGES** (optionnel mais recommandé)
   - The main product image URL if visible
   - Or describe the product image clearly so we can search for similar

5. **DESCRIPTION** (optionnel)
   - Key product features/description visible
   - Or summarize what you see

6. **RATING** (optionnel)
   - Star rating if visible (e.g., 4.5, 4.8)
   - Number of reviews if visible

7. **PRODUCT URL** (optionnel)
   - If a URL is visible in the screenshot, extract it

8. **SOURCE** (déterminer automatiquement)
   - "aliexpress" if AliExpress logo/branding is visible
   - "alibaba" if Alibaba logo/branding is visible

CRITICAL RULES:
- Extract ACCURATELY - don't invent or guess
- If price is not clearly visible, return 0 and indicate in description
- If title is not clearly visible, describe what you see
- Be PRECISE with numbers
- Preserve original text formatting when possible

Return the data in this EXACT JSON format:
{
  "title": "Exact product title as shown",
  "price": 12.99,
  "currency": "USD",
  "images": ["URL if visible, or empty array"],
  "description": "Product description or what you see",
  "rating": 4.5,
  "reviews": 123,
  "url": "Product URL if visible",
  "source": "aliexpress" or "alibaba"
}`;

    // ═══════════════════════════════════════════════════════════════════════════
    // APPEL OPENAI VISION API
    // ═══════════════════════════════════════════════════════════════════════════

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // GPT-4o avec vision
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageToAnalyze,
                  detail: 'high', // Haute résolution pour mieux lire les détails
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1, // Bas pour plus de précision
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error('OpenAI Vision error:', openaiResponse.status, errorData);
      
      let message = 'Erreur lors de l\'analyse de l\'image';
      if (openaiResponse.status === 401) {
        message = 'Clé API OpenAI invalide';
      } else if (openaiResponse.status === 429) {
        message = 'Quota OpenAI dépassé - vérifiez vos crédits';
      } else if (openaiResponse.status === 400) {
        message = 'Image invalide ou trop grande';
      }
      
      return NextResponse.json(
        {
          error: 'OPENAI_VISION_ERROR',
          message,
        },
        { status: openaiResponse.status === 429 ? 429 : 500 }
      );
    }

    const openaiData = await openaiResponse.json();
    const aiContent = openaiData.choices[0]?.message?.content;

    if (!aiContent) {
      return NextResponse.json(
        { error: 'No response from OpenAI Vision' },
        { status: 500 }
      );
    }

    console.log('✅ OpenAI Vision response received');

    // ═══════════════════════════════════════════════════════════════════════════
    // PARSER LA RÉPONSE JSON
    // ═══════════════════════════════════════════════════════════════════════════

    let productData: ProductImageData;
    
    try {
      // Extraire le JSON de la réponse (peut être dans un code block)
      let jsonText = aiContent.trim();
      
      // Enlever les code blocks markdown si présents
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Essayer de trouver un objet JSON dans le texte
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
      
      productData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw response:', aiContent);
      
      // Fallback: essayer d'extraire manuellement les infos clés
      const titleMatch = aiContent.match(/["']title["']:\s*["']([^"']+)["']/i);
      const priceMatch = aiContent.match(/["']price["']:\s*([\d.]+)/i);
      
      if (!titleMatch) {
        return NextResponse.json(
          { 
            error: 'Could not extract product information from image',
            details: 'OpenAI response could not be parsed',
            rawResponse: aiContent.substring(0, 500),
          },
          { status: 422 }
        );
      }
      
      productData = {
        title: titleMatch[1],
        price: priceMatch ? parseFloat(priceMatch[1]) : 0,
        currency: 'USD',
        images: [],
        description: aiContent.substring(0, 200),
        source: aiContent.toLowerCase().includes('alibaba') ? 'alibaba' : 'aliexpress',
      };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATION ET FORMATAGE
    // ═══════════════════════════════════════════════════════════════════════════

    if (!productData.title || productData.title.trim().length < 5) {
      return NextResponse.json(
        { 
          error: 'Product title not found or too short',
          extracted: productData,
        },
        { status: 422 }
      );
    }

    // Formater le produit pour correspondre à SupplierProduct
    const product = {
      id: `screenshot-${Date.now()}`,
      url: productData.url || 'https://www.aliexpress.com',
      source: productData.source,
      title: productData.title.trim().substring(0, 200),
      description: productData.description || productData.title,
      images: productData.images && productData.images.length > 0 
        ? productData.images 
        : [],
      price: productData.price || 0,
      currency: productData.currency || 'USD',
      variants: [{ 
        id: 'v1', 
        name: 'Standard', 
        price: productData.price || 0 
      }],
      category: 'General',
      shippingTime: '15-30 days',
      minOrderQuantity: 1,
      supplierRating: productData.rating || 4.5,
      createdAt: new Date().toISOString(),
    };

    console.log(`✅ Product extracted: ${product.title} - Price: $${product.price}`);

    return NextResponse.json({
      success: true,
      product,
      warning: product.price === 0 
        ? 'Le prix n\'a pas pu être extrait. Vous pourrez l\'entrer manuellement.' 
        : undefined,
    });

  } catch (error: any) {
    console.error('Parse product image error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

