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
    
    const prompt = `Analyze this screenshot of an AliExpress or Alibaba product page and extract product information.

EXTRACT THE FOLLOWING:

1. TITLE - The product title/name (REQUIRED - must be at least 5 characters)
   - Find the main product title on the page
   - Copy EXACTLY as shown, don't summarize
   - If unclear, describe what you see in detail

2. PRICE - The current sale price (REQUIRED - return 0 if not visible)
   - Look for price like "$12.99", "US $12.99", "€12.99", "£12.99"
   - Extract ONLY the number (12.99), not the currency symbol
   - Use the SALE/DISCOUNTED price, not the crossed-out original price

3. CURRENCY - Currency code (REQUIRED)
   - "USD" for $, "EUR" for €, "GBP" for £
   - Default to "USD" if uncertain

4. IMAGES - Product image URLs (optional, can be empty array)
   - If URL visible, extract it
   - Otherwise use empty array []

5. DESCRIPTION - Product description (optional)
   - Key features visible on page
   - Or brief description of what you see

6. RATING - Star rating (optional, number 0-5)
7. REVIEWS - Number of reviews (optional, number)
8. URL - Product page URL if visible (optional)
9. SOURCE - "aliexpress" or "alibaba" based on branding visible

CRITICAL:
- You MUST return ONLY valid JSON, no other text before or after
- Title MUST be at least 5 characters (use description if title unclear)
- Price MUST be a number (0 if not visible)
- Be accurate - don't guess if something isn't visible
- If you can't identify the product clearly, still return the JSON with your best guess

Return ONLY this JSON (no markdown, no code blocks, no explanations):
{
  "title": "Product title here",
  "price": 12.99,
  "currency": "USD",
  "images": [],
  "description": "Description here",
  "rating": 4.5,
  "reviews": 0,
  "url": "",
  "source": "aliexpress"
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
            role: 'system',
            content: 'You are a product data extraction expert. Always return ONLY valid JSON, no explanations, no markdown code blocks. Extract product information accurately from screenshots.',
          },
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
        max_tokens: 1500,
        temperature: 0.1, // Bas pour plus de précision
        response_format: { type: 'json_object' }, // Force JSON mode
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
    // PARSER LA RÉPONSE JSON - VERSION ROBUSTE
    // ═══════════════════════════════════════════════════════════════════════════

    let productData: ProductImageData;
    
    try {
      // Nettoyer la réponse
      let jsonText = aiContent.trim();
      
      // Enlever les code blocks markdown si présents
      jsonText = jsonText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      
      // Trouver le JSON dans le texte (même s'il y a du texte avant/après)
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
      
      // Parser le JSON
      productData = JSON.parse(jsonText);
      
      // Valider que les champs requis existent
      if (!productData.title) {
        throw new Error('Title missing in response');
      }
      
      // S'assurer que les types sont corrects
      productData.price = typeof productData.price === 'number' ? productData.price : (parseFloat(String(productData.price || 0)) || 0);
      productData.currency = productData.currency || 'USD';
      productData.images = Array.isArray(productData.images) ? productData.images : [];
      productData.source = (productData.source === 'alibaba' || productData.source === 'aliexpress') ? productData.source : 'aliexpress';
      
    } catch (parseError: any) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw response (first 1000 chars):', aiContent.substring(0, 1000));
      
      // Fallback robuste: extraire manuellement avec regex multiples
      const titleMatches = [
        aiContent.match(/["']title["']\s*:\s*["']([^"']{5,})["']/i),
        aiContent.match(/title["']?\s*[:=]\s*["']([^"']{5,})["']/i),
        aiContent.match(/"title"\s*:\s*"([^"]{5,})"/i),
        aiContent.match(/title:\s*"([^"]{5,})"/i),
      ];
      
      const priceMatches = [
        aiContent.match(/["']price["']\s*:\s*([\d.]+)/i),
        aiContent.match(/price["']?\s*[:=]\s*([\d.]+)/i),
        aiContent.match(/"price"\s*:\s*([\d.]+)/i),
      ];
      
      const currencyMatches = [
        aiContent.match(/["']currency["']\s*:\s*["']([^"']+)["']/i),
        aiContent.match(/currency["']?\s*[:=]\s*["']([^"']+)["']/i),
      ];
      
      const titleMatch = titleMatches.find(m => m && m[1] && m[1].length >= 5);
      const priceMatch = priceMatches.find(m => m && m[1]);
      const currencyMatch = currencyMatches.find(m => m && m[1]);
      
      if (!titleMatch) {
        // Dernière tentative: chercher un titre dans le texte libre
        const lines = aiContent.split('\n').filter(line => line.length > 10 && line.length < 200);
        const potentialTitle = lines[0] || 'Produit AliExpress';
        
        productData = {
          title: potentialTitle.substring(0, 200),
          price: priceMatch ? parseFloat(priceMatch[1]) : 0,
          currency: (currencyMatch?.[1] || 'USD').toUpperCase(),
          images: [],
          description: aiContent.substring(0, 300),
          source: aiContent.toLowerCase().includes('alibaba') ? 'alibaba' : 'aliexpress',
        };
      } else {
        productData = {
          title: titleMatch[1].trim(),
          price: priceMatch ? parseFloat(priceMatch[1]) : 0,
          currency: (currencyMatch?.[1] || 'USD').toUpperCase(),
          images: [],
          description: aiContent.substring(0, 300),
          source: aiContent.toLowerCase().includes('alibaba') ? 'alibaba' : 'aliexpress',
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATION ET FORMATAGE
    // ═══════════════════════════════════════════════════════════════════════════

    // Normaliser le titre
    const cleanTitle = productData.title ? productData.title.trim() : '';
    
    // Si le titre est trop court, utiliser la description ou créer un titre par défaut
    if (cleanTitle.length < 5) {
      if (productData.description && productData.description.length >= 5) {
        productData.title = productData.description.substring(0, 200);
      } else {
        productData.title = 'Produit AliExpress - Détails non disponibles';
      }
    }
    
    // S'assurer que le prix est valide
    if (isNaN(productData.price) || productData.price < 0) {
      productData.price = 0;
    }
    
    // Normaliser la devise
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    if (!validCurrencies.includes(productData.currency?.toUpperCase())) {
      productData.currency = 'USD';
    } else {
      productData.currency = productData.currency.toUpperCase();
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

