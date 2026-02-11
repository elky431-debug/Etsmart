import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// Import sharp avec gestion d'erreur pour Netlify (MÊME QUE generate-images)
let sharp: any;
try {
  sharp = require('sharp');
} catch (error) {
  console.warn('[QUICK GENERATE] Sharp not available, will use fallback compression');
  sharp = null;
}

export const maxDuration = 300; // 5 minutes max pour la génération complète (images obligatoires avec retries)
export const runtime = 'nodejs';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * API ROUTE - GÉNÉRATION COMBINÉE LISTING + IMAGES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Cette route génère à la fois le listing Etsy (description, titre, tags, matériaux)
 * et les images de produit en une seule requête.
 * 
 * Coût total : 2.0 crédits (1 pour le listing + 1 pour les images)
 */
export async function POST(request: NextRequest) {
  try {
    // 🔒 SECURITY: Require authentication
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

    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[QUICK GENERATE] Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Invalid request body' },
        { status: 400 }
      );
    }

    const {
      sourceImage,
      quantity = 1,
      aspectRatio = '1:1',
    } = body;

    // Validation
    if (!sourceImage) {
      return NextResponse.json(
        { error: 'MISSING_IMAGE', message: 'Source image is required' },
        { status: 400 }
      );
    }

    // ⚠️ CRITICAL: Check subscription status and quota before allowing generation
    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    
    if (quotaInfo.status !== 'active') {
      return NextResponse.json(
        { error: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required.' },
        { status: 403 }
      );
    }

    // Total credit needed: 2.0 (1 for listing + 1 for images)
    const creditNeeded = 2.0;
    
    if (quotaInfo.remaining < creditNeeded) {
      return NextResponse.json(
        { error: 'QUOTA_EXCEEDED', message: `Insufficient quota. You need ${creditNeeded} credit(s) to generate listing and images.` },
        { status: 403 }
      );
    }

    // Déclarer quotaResult en dehors du try pour éviter les erreurs de référence
    let quotaResult: { success: boolean; used: number; quota: number; remaining: number; error?: string } | null = null;

    console.log('[QUICK GENERATE] Starting combined generation for user:', user.id);

    // ═══════════════════════════════════════════════════════════════════════════════
    // ÉTAPE 1: Analyser l'image pour obtenir la description visuelle
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('[QUICK GENERATE] Step 1: Analyzing image to get visual description...');
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY_MISSING', message: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Préparer l'image pour l'analyse
    let imageForAnalysis = sourceImage;
    if (!imageForAnalysis.startsWith('data:image/')) {
      imageForAnalysis = `data:image/jpeg;base64,${imageForAnalysis}`;
    }

    // Analyser l'image avec GPT-4o Vision pour obtenir la description visuelle
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are an expert product analyst. Analyze the product image and provide a detailed visual description in English that can be used to generate an Etsy listing.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this product image and provide a detailed visual description in English. Describe the product type, materials, colors, design, and key features. This description will be used to generate an Etsy listing.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageForAnalysis,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!analysisResponse.ok) {
      const errorData = await analysisResponse.json().catch(() => ({ error: 'parse_failed' }));
      console.error('[QUICK GENERATE] Image analysis error:', analysisResponse.status, errorData);
      return NextResponse.json(
        { error: 'IMAGE_ANALYSIS_FAILED', message: 'Failed to analyze product image' },
        { status: 500 }
      );
    }

    const analysisData = await analysisResponse.json();
    const productVisualDescription = analysisData.choices[0]?.message?.content?.trim();

    if (!productVisualDescription) {
      return NextResponse.json(
        { error: 'NO_DESCRIPTION_GENERATED', message: 'Failed to generate product description from image' },
        { status: 500 }
      );
    }

    console.log('[QUICK GENERATE] ✅ Image analyzed. Product description:', productVisualDescription.substring(0, 100) + '...');

    // ═══════════════════════════════════════════════════════════════════════════════
    // ÉTAPE 2: ⚠️ GÉNÉRATION PARALLÈLE - Tout doit être généré EN MÊME TEMPS
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('[QUICK GENERATE] ⚠️ ORDRE ABSOLU: Generating EVERYTHING in parallel (description, title/tags/materials, images)...');

    // Utiliser les mêmes prompts que l'API generate-etsy-description
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
- MUST include at least 8-12 emojis strategically placed throughout the description
- Warm, human, natural tone
- The description must be ready to copy-paste directly into Etsy
- Make it LONG and DETAILED - aim for 300-500 words minimum
- Be descriptive, engaging, and comprehensive

REQUIRED STRUCTURE (follow exactly - expand each section with details):

1. EMOTIONAL HOOK (2-3 sentences)
2. CLEAR PRODUCT PRESENTATION (3-4 sentences)
3. DETAILED FEATURES & BENEFITS (4-5 sentences or bullet points)
4. WHY PEOPLE BUY IT (FOR / BECAUSE) (3-4 sentences)
5. IDEAL FOR... (purchase contexts) (2-3 sentences)
6. QUALITY & CRAFTSMANSHIP (2-3 sentences)
7. USAGE & CARE (2-3 sentences)
8. SOFT CALL-TO-ACTION (Etsy-friendly) (1-2 sentences)

OUTPUT FORMAT:
- Return ONLY the final description text
- No explanations, no comments, no meta-text
- Just the ready-to-use description
- Use proper paragraph breaks for readability
- Use bullet points with "-" for features/benefits sections
- Minimum 300 words, aim for 400-500 words
- MUST include at least 8-12 emojis

Generate the description now:`;

    const titleTagsMaterialsPrompt = `You are an expert Etsy SEO and product listing copywriter.

⚠️⚠️⚠️ ORDRE ABSOLU - C'EST UN ORDRE OBLIGATOIRE ⚠️⚠️⚠️
You MUST generate a title, tags, and materials that match EXACTLY the product described in the "PRODUCT VISUAL DESCRIPTION" below.
This is MANDATORY. You CANNOT skip any of these elements.

PRODUCT VISUAL DESCRIPTION (THIS IS YOUR ONLY SOURCE - USE IT EXACTLY):
${productVisualDescription}

⚠️⚠️⚠️ ORDRE ABSOLU - YOU MUST GENERATE ALL THREE ELEMENTS ⚠️⚠️⚠️
1. A SEO optimized title (OBLIGATORY - MINIMUM 100 characters, ideally 120-140 characters, natural and keyword-rich) - YOU MUST GENERATE THIS. If the title is under 100 characters, ADD more relevant keywords.
2. A list of EXACTLY 13 Etsy tags (OBLIGATORY - each maximum 20 characters, separated by commas) - YOU MUST GENERATE EXACTLY 13 TAGS
3. A list of materials used in the product (OBLIGATORY - separated by COMMAS) - YOU MUST GENERATE THIS

⚠️ CRITICAL REQUIREMENTS:
• Title: MUST be at LEAST 100 characters (MINIMUM 100, ideally 120-140). NEVER under 100 characters. If too short, add more SEO keywords.
• Tags: MUST be exactly 13 tags, comma-separated, each max 20 characters
• Materials: MUST be comma-separated material names (2-4 materials minimum)
• All text must be in English
• The style must remain natural and seller-friendly
• YOU CANNOT SKIP ANY ELEMENT - ALL THREE ARE MANDATORY

OUTPUT FORMAT (JSON ONLY - NO OTHER TEXT):
{
  "title": "SEO optimized title (MINIMUM 100 characters, ideally 120-140) - MANDATORY - NEVER under 100 characters",
  "tags": "tag1, tag2, tag3, tag4, tag5, tag6, tag7, tag8, tag9, tag10, tag11, tag12, tag13",
  "materials": "material1, material2, material3"
}

⚠️⚠️⚠️ FINAL REMINDER - THIS IS AN ORDER ⚠️⚠️⚠️
You MUST return valid JSON with ALL THREE elements: title, tags, and materials.
Do not add any text before or after the JSON.
Generate the title, tags and materials now:`;

    console.log('[QUICK GENERATE] ✅ Image analyzed. Product description:', productVisualDescription.substring(0, 100) + '...');

    // ═══════════════════════════════════════════════════════════════════════════════
    // ⚠️ GÉNÉRATION PARALLÈLE OBLIGATOIRE - Tout doit être généré EN MÊME TEMPS
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('[QUICK GENERATE] ⚠️ ORDRE ABSOLU: Generating EVERYTHING in parallel (description, title/tags/materials, images)...');

    // ⚠️ PRÉPARER L'IMAGE UPLOADÉE pour Nanonbanana (MÊME LOGIQUE QUE L'ONGLET IMAGE)
    let imageInput: string;
    try {
      // Convertir l'image en format data URL si nécessaire (même logique que generate-images)
      if (sourceImage.startsWith('data:image/')) {
        imageInput = sourceImage;
        console.log('[QUICK GENERATE] ✅ Image déjà en format data URL');
      } else if (sourceImage.startsWith('http://') || sourceImage.startsWith('https://')) {
        imageInput = sourceImage;
        console.log('[QUICK GENERATE] ✅ Image en format URL HTTP');
      } else {
        // Sinon, on assume que c'est du base64 et on le convertit en data URL
        imageInput = sourceImage.includes('base64') 
          ? sourceImage 
          : `data:image/jpeg;base64,${sourceImage}`;
        console.log('[QUICK GENERATE] ✅ Image convertie en data URL');
      }
      
      // Vérifier que l'image n'est pas vide
      if (!imageInput || imageInput.length < 100) {
        throw new Error('Image invalide ou trop petite');
      }
      
      console.log('[QUICK GENERATE] ✅ Image uploadée préparée (length):', imageInput.length);
    } catch (imageError: any) {
      console.error('[QUICK GENERATE] ❌ Erreur lors de la préparation de l\'image:', imageError);
      return NextResponse.json(
        { error: `Erreur lors de la préparation de l'image: ${imageError.message || 'Erreur inconnue'}` },
        { status: 400 }
      );
    }
    
    // ⚠️ COMPRESSER L'IMAGE pour éviter l'erreur 413 (Request Entity Too Large)
    // L'image doit être < 1MB pour éviter les problèmes avec nginx
    // ═══════════════════════════════════════════════════════════════════════════════
    // MÊME LOGIQUE QUE generate-images
    let imageForAPI: string;
    try {
      console.log('[QUICK GENERATE] Compressing image to avoid 413 error...');
      
      // Extraire le base64 de l'image
      let base64Data = imageInput;
      if (base64Data.startsWith('data:image/')) {
        const parts = base64Data.split(',');
        if (parts.length > 1) {
          base64Data = parts[1];
        }
      }
      
      // Vérifier que base64Data existe
      if (!base64Data || base64Data.length < 100) {
        throw new Error('Image data is too small or invalid');
      }
      
      // Convertir base64 en Buffer
      let imageBuffer: Buffer;
      try {
        imageBuffer = Buffer.from(base64Data, 'base64');
        console.log('[QUICK GENERATE] Original image size:', (imageBuffer.length / 1024).toFixed(2), 'KB');
      } catch (bufferError: any) {
        console.error('[QUICK GENERATE] Error creating buffer:', bufferError);
        throw new Error(`Invalid base64 image data: ${bufferError.message}`);
      }
      
      // ⚠️ COMPRESSION AGRESSIVE pour éviter l'erreur 413
      // Objectif : < 500KB pour éviter les problèmes avec nginx
      // ═══════════════════════════════════════════════════════════════════════════════
      
      if (sharp) {
        try {
          // Essayer d'abord avec 512x512 et qualité 70%
          let compressedBuffer = await sharp(imageBuffer)
            .resize(512, 512, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: 70, mozjpeg: true })
            .toBuffer();
          
          console.log('[QUICK GENERATE] First compression (512x512, 70%):', (compressedBuffer.length / 1024).toFixed(2), 'KB');
          
          // Si toujours > 500KB, compresser encore plus
          if (compressedBuffer.length > 500 * 1024) {
            console.warn('[QUICK GENERATE] ⚠️ Image still > 500KB, applying more aggressive compression...');
            compressedBuffer = await sharp(imageBuffer)
              .resize(400, 400, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality: 60, mozjpeg: true })
              .toBuffer();
            console.log('[QUICK GENERATE] Second compression (400x400, 60%):', (compressedBuffer.length / 1024).toFixed(2), 'KB');
          }
          
          // Si toujours > 500KB, dernière compression très agressive
          if (compressedBuffer.length > 500 * 1024) {
            console.warn('[QUICK GENERATE] ⚠️ Image still > 500KB, applying maximum compression...');
            compressedBuffer = await sharp(imageBuffer)
              .resize(300, 300, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality: 50, mozjpeg: true })
              .toBuffer();
            console.log('[QUICK GENERATE] Maximum compression (300x300, 50%):', (compressedBuffer.length / 1024).toFixed(2), 'KB');
          }
          
          // Convertir en base64
          imageForAPI = compressedBuffer.toString('base64');
          
          console.log('[QUICK GENERATE] ✅ Final compressed image size:', (compressedBuffer.length / 1024).toFixed(2), 'KB');
          console.log('[QUICK GENERATE] Compression ratio:', ((1 - compressedBuffer.length / imageBuffer.length) * 100).toFixed(1), '%');
          
          // Avertir si l'image est encore trop grande
          if (compressedBuffer.length > 500 * 1024) {
            console.error('[QUICK GENERATE] ⚠️ WARNING: Image is still > 500KB after compression!');
          }
        } catch (sharpError: any) {
          console.error('[QUICK GENERATE] Sharp compression failed, using original base64:', sharpError.message);
          // Fallback : utiliser l'image originale si la compression échoue
          imageForAPI = base64Data;
        }
      } else {
        console.warn('[QUICK GENERATE] ⚠️ Sharp not available, using original image without compression');
        // Fallback : utiliser l'image originale si sharp n'est pas disponible
        imageForAPI = base64Data;
      }
    } catch (error: any) {
      console.error('[QUICK GENERATE] Error processing image, using fallback:', error);
      // Fallback final : utiliser l'image originale si tout échoue
      if (imageInput && imageInput.startsWith('data:image/')) {
        const parts = imageInput.split(',');
        if (parts.length > 1) {
          imageForAPI = parts[1];
        } else {
          imageForAPI = imageInput;
        }
      } else {
        imageForAPI = imageInput || '';
      }
      
      if (!imageForAPI || imageForAPI.length < 100) {
        console.error('[QUICK GENERATE] ❌ Cannot recover image data');
        return NextResponse.json(
          { error: 'Erreur lors de la préparation de l\'image. Veuillez réessayer avec une autre image.' },
          { status: 400 }
        );
      }
    }

    // Prompt fixe pour Nanonbanana
    const FIXED_PROMPT = `You are a professional lifestyle photographer specialized in high-converting product images for Etsy.

REFERENCE PRODUCT
Use the provided product image as the ONLY reference. The generated image must faithfully represent the exact same product.

CRITICAL RULE – EXACT PRODUCT FIDELITY
The product in the generated image must be IDENTICAL to the product shown in the reference image
Reproduce the product exactly as it appears: shape, proportions, colors, materials, textures, finishes, and details
If the product contains any writing, text, symbols, engravings, or markings, they must be reproduced EXACTLY as shown
Do NOT modify, enhance, stylize, or reinterpret the product in any way
The product must remain the central focus of the image

SCENE & CONTEXT
Create a realistic, natural lifestyle scene that shows the product in its ideal real-world usage context.
The environment must feel authentic, credible, and appropriate for the type of product.

BACKGROUND & DEPTH (MANDATORY)
The scene must include a natural background with visible depth
Use foreground and background separation to create a sense of space
The background should be softly blurred or naturally out of focus (depth of field)
Avoid flat, empty, or plain backgrounds

MOOD & EMOTION
Calm, pleasant, and inviting atmosphere
Emotion to convey: comfort, trust, and desirability
Style: premium Etsy lifestyle photography (authentic, warm, aspirational, not commercial or artificial)

PHOTOGRAPHY STYLE
Soft natural lighting only (no artificial flash)
Ultra-realistic photo rendering
Natural depth of field
Balanced, harmonious colors
Clean and engaging camera angle

ABSOLUTE PROHIBITIONS (outside of the product itself)
NO added text
NO added logos
NO brand names
NO watermarks
NO price tags
NO badges, stickers, or icons
NO artificial marketing elements
NO frames, borders, overlays, or graphic elements
NO flat catalog-style photography

The final image should look like a high-quality Etsy listing photo and naturally make people want to click and buy.`;

    let enhancedPrompt = `⚠️⚠️⚠️ CRITICAL INSTRUCTION - YOU MUST MODIFY THE BACKGROUND ⚠️⚠️⚠️

The generated image MUST be DIFFERENT from the source image. The background and decor MUST be completely changed.
- Keep the product EXACTLY IDENTICAL (shape, colors, details, everything)
- But COMPLETELY REPLACE the background and decor with a new, different lifestyle scene
- DO NOT return the same image - the background MUST be different
- If the background looks the same as the source, this is a FAILURE

${FIXED_PROMPT}

⚠️⚠️⚠️ FINAL REMINDER - CRITICAL REQUIREMENT ⚠️⚠️⚠️
- The product stays IDENTICAL (do not touch it)
- The background MUST be DIFFERENT from the source image
- Create a NEW, DIFFERENT lifestyle background that is cozy and realistic
- DO NOT copy the original background - MODIFY IT COMPLETELY`;

    const NANONBANANA_API_KEY = process.env.NANONBANANA_API_KEY || '758a24cfaef8c64eed9164858b941ecc';
    
    // ⚠️ IMPORTANT: Utiliser l'image uploadée exactement comme dans l'onglet image
    // Format exact : data:image/jpeg;base64,{base64Data}
    const imageDataUrl = `data:image/jpeg;base64,${imageForAPI}`;
    
    console.log('[QUICK GENERATE] ✅ Image prepared for Nanonbanana:', {
      imageInputLength: imageInput.length,
      imageForAPILength: imageForAPI.length,
      imageDataUrlLength: imageDataUrl.length,
      imageDataUrlPreview: imageDataUrl.substring(0, 50) + '...',
    });
    
    // Ne pas tronquer le prompt - utiliser le prompt complet comme dans l'onglet image
    const finalPrompt = enhancedPrompt;
    
    console.log('[QUICK GENERATE] ✅ Prompt prepared:', {
      promptLength: finalPrompt.length,
      promptPreview: finalPrompt.substring(0, 200) + '...',
    });

    // ⚠️ GÉNÉRATION PARALLÈLE : Tout en même temps avec Promise.all()
    const [descriptionResult, titleTagsResult, imagesResult] = await Promise.all([
      // 1. Générer la description
      (async () => {
        try {
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
                  content: 'You are an expert Etsy copywriter specializing in conversion-optimized product descriptions.',
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
            console.error('[QUICK GENERATE] Description generation error:', descriptionResponse.status, errorData);
            throw new Error('DESCRIPTION_GENERATION_FAILED');
          }

          const descriptionData = await descriptionResponse.json();
          const description = descriptionData.choices[0]?.message?.content?.trim();

          if (!description) {
            throw new Error('DESCRIPTION_GENERATION_FAILED');
          }

          console.log('[QUICK GENERATE] ✅ Description generated, length:', description.length);
          return { success: true, description };
        } catch (error: any) {
          console.error('[QUICK GENERATE] ❌ Description generation failed:', error.message);
          return { success: false, error: error.message, description: '' };
        }
      })(),

      // 2. Générer titre, tags et matériaux
      (async () => {
        try {
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
                  content: 'You are an expert in Etsy SEO and optimized product listing creation. You MUST return valid JSON with title, tags, and materials.',
                },
                {
                  role: 'user',
                  content: titleTagsMaterialsPrompt + '\n\n⚠️⚠️⚠️ CRITICAL: You MUST return valid JSON. Do not add any text before or after the JSON. The JSON must contain: title (string), tags (comma-separated string), materials (comma-separated string).',
                },
              ],
              temperature: 0.7,
              max_tokens: 500,
              response_format: { type: 'json_object' },
            }),
          });

          if (!titleTagsResponse.ok) {
            const errorData = await titleTagsResponse.json().catch(() => ({ error: 'parse_failed' }));
            console.error('[QUICK GENERATE] Title/tags/materials generation error:', titleTagsResponse.status, errorData);
            throw new Error('TITLE_TAGS_MATERIALS_GENERATION_FAILED');
          }

          const titleTagsData = await titleTagsResponse.json();
          const titleTagsContent = titleTagsData.choices[0]?.message?.content?.trim();

          if (!titleTagsContent) {
            throw new Error('TITLE_TAGS_MATERIALS_GENERATION_FAILED');
          }

          // Parser le JSON
          const jsonMatch = titleTagsContent.match(/\{[\s\S]*\}/);
          const jsonString = jsonMatch ? jsonMatch[0] : titleTagsContent;
          const parsed = JSON.parse(jsonString);

          const title = parsed.title || '';
          const tagsString = parsed.tags || '';
          const tags = tagsString.split(',').map((t: string) => t.trim()).filter((t: string) => t && t.length <= 20).slice(0, 13);
          const materials = parsed.materials || '';

          console.log('[QUICK GENERATE] ✅ Title/tags/materials generated:', {
            titleLength: title.length,
            tagsCount: tags.length,
            materialsLength: materials.length,
          });

          // ⚠️ VALIDATION TITRE SEO : minimum 100 caractères obligatoire
          let finalTitle = title;
          if (finalTitle && finalTitle.length < 100) {
            console.log(`[QUICK GENERATE] ⚠️ Title too short (${finalTitle.length} chars), enriching to reach 100+ chars...`);
            
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
                      content: `The following Etsy SEO title is TOO SHORT (only ${finalTitle.length} characters). You MUST expand it to be between 100 and 140 characters by adding relevant SEO keywords, product features, materials, use cases, or gift occasion keywords. Do NOT change the product type.

CURRENT SHORT TITLE: "${finalTitle}"

PRODUCT DESCRIPTION: ${productVisualDescription}

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
                    console.log(`[QUICK GENERATE] ✅ Title enriched: ${enrichParsed.title.length} chars (was ${finalTitle.length})`);
                    finalTitle = enrichParsed.title;
                  } else if (enrichParsed.title && enrichParsed.title.length > finalTitle.length) {
                    console.log(`[QUICK GENERATE] ⚠️ Title partially enriched: ${enrichParsed.title.length} chars (was ${finalTitle.length})`);
                    finalTitle = enrichParsed.title;
                  }
                }
              }
            } catch (enrichError) {
              console.error('[QUICK GENERATE] ⚠️ Title enrichment failed:', enrichError);
            }

            // Dernier recours : ajouter des mots-clés manuellement si toujours trop court
            if (finalTitle.length < 100) {
              const seoSuffixes = [
                ' - Perfect Gift Idea for Any Occasion',
                ' - Unique Handcrafted Home Decor',
                ' - Modern Design Stylish Aesthetic',
                ' - Premium Quality Elegant Finish',
                ' - Trending Bestseller Must Have',
                ' - Great Birthday Christmas Gift',
              ];
              for (const suffix of seoSuffixes) {
                if (finalTitle.length + suffix.length <= 140 && finalTitle.length < 100) {
                  finalTitle = finalTitle + suffix;
                  console.log(`[QUICK GENERATE] ✅ Title padded with suffix: ${finalTitle.length} chars`);
                  break;
                }
              }
            }
            
            console.log(`[QUICK GENERATE] Final title length: ${finalTitle.length} chars`);
          }

          return { success: true, title: finalTitle, tags, materials };
        } catch (error: any) {
          console.error('[QUICK GENERATE] ❌ Title/tags/materials generation failed:', error.message);
          return { success: false, error: error.message, title: '', tags: [], materials: '' };
        }
      })(),

      // 3. ⚠️ OBLIGATION ABSOLUE - Générer les images avec Nanonbanana (MANDATORY)
      (async () => {
        console.log('[QUICK GENERATE] ⚠️ Starting image generation with Nanonbanana...');
        console.log('[QUICK GENERATE] Variables check:', {
          hasNanonbananaKey: !!NANONBANANA_API_KEY,
          nanonbananaKeyPreview: NANONBANANA_API_KEY ? NANONBANANA_API_KEY.substring(0, 10) + '...' : 'MISSING',
          hasImageDataUrl: !!imageDataUrl,
          imageDataUrlLength: imageDataUrl?.length || 0,
          hasFinalPrompt: !!finalPrompt,
          finalPromptLength: finalPrompt?.length || 0,
          quantity: quantity,
          aspectRatio: aspectRatio,
        });
        
        if (!NANONBANANA_API_KEY) {
          throw new Error('NANONBANANA_API_KEY not configured - image generation is MANDATORY');
        }
        
        if (!imageDataUrl || imageDataUrl.length < 100) {
          throw new Error(`Invalid imageDataUrl: ${imageDataUrl ? `length=${imageDataUrl.length}` : 'undefined'}`);
        }
        
        if (!finalPrompt || finalPrompt.length < 100) {
          throw new Error(`Invalid finalPrompt: ${finalPrompt ? `length=${finalPrompt.length}` : 'undefined'}`);
        }

        // ⚠️ RETRY LOOP GLOBAL : Réessayer jusqu'à obtenir au moins une image
        let allImages: any[] = [];
        let globalAttempts = 0;
        const maxGlobalAttempts = 3; // 3 tentatives globales

        while (allImages.length === 0 && globalAttempts < maxGlobalAttempts) {
          globalAttempts++;
          console.log(`[QUICK GENERATE] ⚠️ GLOBAL ATTEMPT ${globalAttempts}/${maxGlobalAttempts} to generate images (MANDATORY)...`);

          try {
            // Générer les images en parallèle (MÊME LOGIQUE QUE generate-images)
            const generationPromises = Array.from({ length: quantity }, async (_, index) => {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout pour Nanonbanana (MÊME QUE generate-images)
              
              try {
                console.log(`[QUICK GENERATE] Generating image ${index + 1}/${quantity} with Nanonbanana...`);
                
                // ⚠️ CRITICAL: Créer un prompt unique pour chaque image avec un point de vue différent (MÊME QUE generate-images)
                let imageSpecificPrompt = finalPrompt || '';
                
                if (quantity > 1) {
                  // Ajouter des instructions spécifiques selon l'index pour varier le point de vue
                  const viewpointInstructions = [
                    // Image 1 (index 0) : Vue de face / angle frontal
                    `⚠️ VIEWPOINT INSTRUCTION FOR IMAGE ${index + 1}/${quantity}:
- Use a FRONTAL or STRAIGHT-ON camera angle
- Show the product from a direct, eye-level perspective
- The camera should be positioned directly in front of the product
- Create a balanced, centered composition`,
                    
                    // Image 2 (index 1) : Vue de côté / angle latéral
                    `⚠️ VIEWPOINT INSTRUCTION FOR IMAGE ${index + 1}/${quantity}:
- Use a SIDE or ANGULAR camera angle (45-degree angle or side view)
- Show the product from a different perspective than the first image
- The camera should be positioned at an angle (left or right side)
- Create a dynamic, slightly off-center composition with depth
- Show the product from a different angle to highlight different features`,
                  ];
                  
                  // Ajouter l'instruction de point de vue spécifique
                  if (index < viewpointInstructions.length) {
                    imageSpecificPrompt = `${finalPrompt}

${viewpointInstructions[index]}

⚠️ CRITICAL: This image MUST be visually DIFFERENT from the other generated images:
- Different camera angle and perspective
- Different background composition and layout
- Different lighting direction if possible
- Different depth of field or focus point
- The product remains IDENTICAL, but everything else should vary`;
                  } else {
                    // Pour plus de 2 images, varier avec d'autres angles
                    const additionalAngles = [
                      `- Use a TOP-DOWN or OVERHEAD camera angle`,
                      `- Use a LOW ANGLE looking up at the product`,
                      `- Use a CLOSE-UP or MACRO perspective`,
                      `- Use a WIDE ANGLE showing more context`,
                    ];
                    const angleIndex = index % additionalAngles.length;
                    imageSpecificPrompt = `${finalPrompt}

⚠️ VIEWPOINT INSTRUCTION FOR IMAGE ${index + 1}/${quantity}:
${additionalAngles[angleIndex]}

⚠️ CRITICAL: This image MUST be visually DIFFERENT from all other generated images`;
                  }
                }
                
                console.log(`[QUICK GENERATE] Prompt length: ${imageSpecificPrompt.length} chars`);
                console.log(`[QUICK GENERATE] Image length: ${imageForAPI.length} chars`);
                console.log(`[QUICK GENERATE] API Key: ${NANONBANANA_API_KEY.substring(0, 10)}...`);
              
                const requestBody: any = {
                  type: 'IMAGETOIAMGE', // Type obligatoire : "TEXTTOIAMGE" ou "IMAGETOIAMGE" (MAJUSCULES)
                  prompt: imageSpecificPrompt, // Prompt unique pour chaque image avec point de vue différent
                  imageUrls: [imageDataUrl], // Tableau d'URLs d'images (ou data URLs en base64)
                  image_size: aspectRatio === '1:1' ? '1:1' : aspectRatio === '16:9' ? '16:9' : aspectRatio === '9:16' ? '9:16' : '1:1', // Format selon la documentation
                  numImages: 1, // Toujours 1 image par requête (on fait plusieurs requêtes si quantity > 1)
                  callBackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://etsmart.app'}/api/nanonbanana-callback`, // URL de callback obligatoire
                };
                
                console.log('[QUICK GENERATE] Request body prepared (without image):', JSON.stringify({ ...requestBody, prompt: '[PROMPT]', imageUrls: '[IMAGE_URLS]' }));
                console.log('[QUICK GENERATE] Image length:', imageForAPI.length, 'chars');
                console.log('[QUICK GENERATE] Prompt length:', imageSpecificPrompt.length, 'chars');
                console.log('[QUICK GENERATE] Prompt preview:', imageSpecificPrompt.substring(0, 300) + '...');

                // Endpoints selon la documentation officielle : https://docs.nanobananaapi.ai
                // L'endpoint officiel est : /api/v1/nanobanana/generate
                const possibleEndpoints = [
                  'https://api.nanobananaapi.ai/api/v1/nanobanana/generate', // Endpoint officiel selon docs
                  'https://api.nanobanana.com/api/v1/nanobanana/generate', // Variante du domaine
                  'https://api.nanobananaapi.ai/v1/nanobanana/generate', // Sans /api
                  'https://api.nanobanana.com/v1/nanobanana/generate', // Variante sans /api
                ];
                
                let nanonbananaResponse: Response | undefined;
                let lastError: any = null;
                
                // Essayer chaque endpoint jusqu'à ce qu'un fonctionne
                for (const endpoint of possibleEndpoints) {
                  try {
                    console.log(`[QUICK GENERATE] Trying endpoint: ${endpoint}`);
                    
                    // Essayer différents formats d'authentification
                    const authHeaders: Record<string, string>[] = [
                      {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${NANONBANANA_API_KEY}`,
                      },
                      {
                        'Content-Type': 'application/json',
                        'X-API-Key': NANONBANANA_API_KEY,
                      },
                      {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${NANONBANANA_API_KEY}`,
                        'X-API-Key': NANONBANANA_API_KEY,
                      },
                      {
                        'Content-Type': 'application/json',
                        'api-key': NANONBANANA_API_KEY,
                      },
                    ];
                    
                    let lastAuthError: any = null;
                    
                    // Essayer chaque format d'authentification
                    for (const headers of authHeaders) {
                      try {
                        console.log(`[QUICK GENERATE] Trying auth format: ${Object.keys(headers).join(', ')}`);
                        
                        nanonbananaResponse = await fetch(endpoint, {
                          method: 'POST',
                          headers: headers as HeadersInit,
                          body: JSON.stringify(requestBody),
                          signal: controller.signal,
                        });
                        
                        // Si on obtient une réponse autre que 403, on arrête
                        if (nanonbananaResponse.status !== 403) {
                          console.log(`[QUICK GENERATE] ✅ Auth format works (status: ${nanonbananaResponse.status})`);
                          break;
                        } else {
                          console.log(`[QUICK GENERATE] ❌ Auth format failed (403), trying next...`);
                          lastAuthError = { status: 403, message: 'Forbidden' };
                        }
                      } catch (fetchError: any) {
                        console.log(`[QUICK GENERATE] ❌ Auth format error: ${fetchError.message}`);
                        lastAuthError = fetchError;
                        continue;
                      }
                    }
                    
                    // Si toutes les tentatives d'auth ont échoué avec 403
                    if (nanonbananaResponse && nanonbananaResponse.status === 403) {
                      throw new Error(`HTTP 403: Clé API Nanonbanana invalide ou permissions insuffisantes. Vérifiez que votre clé API (${NANONBANANA_API_KEY.substring(0, 10)}...) est correcte, active, et que votre IP est whitelistée sur nanobananaapi.ai.`);
                    }
                    
                    // Si on obtient une réponse (même si c'est une erreur), on arrête de chercher
                    if (nanonbananaResponse && nanonbananaResponse.status !== 404) {
                      console.log(`[QUICK GENERATE] ✅ Endpoint found: ${endpoint} (status: ${nanonbananaResponse.status})`);
                      break;
                    }
                  } catch (fetchError: any) {
                    console.log(`[QUICK GENERATE] ❌ Endpoint failed: ${endpoint} - ${fetchError.message}`);
                    lastError = fetchError;
                    continue;
                  }
                }
                
                if (!nanonbananaResponse) {
                  console.error('[QUICK GENERATE] All endpoints failed');
                  throw new Error(`Erreur de connexion à Nanonbanana: ${lastError?.message || 'Aucun endpoint valide trouvé. Vérifiez l\'URL de l\'API.'}`);
                }
                
                console.log(`[QUICK GENERATE] Nanonbanana API response status: ${nanonbananaResponse.status}`);
                
                if (!nanonbananaResponse.ok) {
                  let errorData: any = {};
                  try {
                    const text = await nanonbananaResponse.text();
                    console.error('[QUICK GENERATE] Error response text:', text);
                    try {
                      errorData = JSON.parse(text);
                    } catch {
                      errorData = { error: { message: text || `HTTP ${nanonbananaResponse.status}` } };
                    }
                  } catch (parseError) {
                    errorData = { error: { message: `HTTP ${nanonbananaResponse.status}: ${nanonbananaResponse.statusText}` } };
                  }
                  
                  console.error('[QUICK GENERATE] Nanonbanana API error:', JSON.stringify(errorData));
                  
                  let errorMsg = errorData.error?.message || errorData.error?.code || errorData.message || `Nanonbanana API error: ${nanonbananaResponse.status}`;
                  
                  // Messages d'erreur spécifiques selon le code HTTP
                  if (nanonbananaResponse.status === 403) {
                    errorMsg = `HTTP 403: Clé API Nanonbanana invalide ou permissions insuffisantes. Vérifiez que votre clé API (${NANONBANANA_API_KEY.substring(0, 10)}...) est correcte, active, et que votre IP est whitelistée sur nanobananaapi.ai.`;
                  } else if (nanonbananaResponse.status === 401) {
                    errorMsg = `HTTP 401: Authentification échouée. Vérifiez votre clé API Nanonbanana.`;
                  } else if (nanonbananaResponse.status === 404) {
                    errorMsg = `Endpoint Nanonbanana incorrect (404). Vérifiez l'URL de l'API.`;
                  } else if (nanonbananaResponse.status === 413) {
                    errorMsg = `HTTP 413: Image trop volumineuse. L'image a été compressée mais reste trop grande. Réduisez la taille de l'image source.`;
                  } else if (nanonbananaResponse.status === 500) {
                    // Extraire le message d'erreur de Nanonbanana si disponible
                    const serverError = errorData.error?.message || errorData.message || errorData.msg || 'Server exception';
                    errorMsg = `Nanonbanana API error (code 500): ${serverError}, please try again later or contact customer service`;
                  }
                  
                  throw new Error(errorMsg);
                }
                
                let nanonbananaData: any;
                try {
                  const responseText = await nanonbananaResponse.text();
                  console.log('[QUICK GENERATE] Nanonbanana raw response:', responseText.substring(0, 1000));
                  
                  try {
                    nanonbananaData = JSON.parse(responseText);
                  } catch (parseError) {
                    console.error('[QUICK GENERATE] Failed to parse JSON response:', parseError);
                    throw new Error(`Invalid JSON response from Nanonbanana: ${responseText.substring(0, 200)}`);
                  }
                } catch (responseError: any) {
                  console.error('[QUICK GENERATE] Error reading response:', responseError);
                  throw new Error(`Failed to read Nanonbanana response: ${responseError.message}`);
                }
                
                console.log('[QUICK GENERATE] Nanonbanana parsed response:', JSON.stringify(nanonbananaData).substring(0, 500));
              
                // ⚠️ GESTION DU FORMAT {code, msg, data} de Nanonbanana
                // ═══════════════════════════════════════════════════════════════════════════════
                
                // Vérifier si la réponse a la structure {code, msg, data}
                if (nanonbananaData.code !== undefined) {
                  console.log('[QUICK GENERATE] Response has code structure. Code:', nanonbananaData.code);
                  
                  // Vérifier si le code indique une erreur
                  if (nanonbananaData.code !== 200 && nanonbananaData.code !== 0 && nanonbananaData.code !== 'success') {
                    const errorMsg = nanonbananaData.msg || nanonbananaData.message || `API returned error code: ${nanonbananaData.code}`;
                    console.error('[QUICK GENERATE] Nanonbanana API error:', errorMsg);
                    throw new Error(`Nanonbanana API error (code ${nanonbananaData.code}): ${errorMsg}`);
                  }
                  
                  // Si succès, chercher l'URL dans data
                  if (nanonbananaData.data) {
                    console.log('[QUICK GENERATE] Looking for URL in data object. Data keys:', Object.keys(nanonbananaData.data).join(', '));
                    
                    // Vérifier si c'est un task_id (génération asynchrone)
                    if (nanonbananaData.data.task_id || nanonbananaData.data.taskId || nanonbananaData.data.id) {
                      const taskId = nanonbananaData.data.task_id || nanonbananaData.data.taskId || nanonbananaData.data.id;
                      console.log('[QUICK GENERATE] ⚠️ Task ID received, need to poll for result. Task ID:', taskId);
                      console.log('[QUICK GENERATE] ⚠️ Callback URL configured:', requestBody.callBackUrl);
                      console.log('[QUICK GENERATE] ⚠️ Note: Results will also be sent to callback URL. Polling is a fallback.');
                      
                      // Polling pour récupérer le résultat
                      const maxPollingAttempts = 30; // 30 tentatives max (MÊME QUE generate-images)
                      const pollingInterval = 2000; // 2 secondes entre chaque tentative (MÊME QUE generate-images)
                      let pollingAttempt = 0;
                      let finalImageUrl: string | null = null;
                      
                      while (pollingAttempt < maxPollingAttempts && !finalImageUrl) {
                        await new Promise(resolve => setTimeout(resolve, pollingInterval));
                        pollingAttempt++;
                        
                        try {
                          console.log(`[QUICK GENERATE] Polling attempt ${pollingAttempt}/${maxPollingAttempts} for task ${taskId}...`);
                          
                          // Essayer l'endpoint de statut/task
                          // ⚠️ IMPORTANT : L'API utilise "taskId" (camelCase) et non "task_id" (snake_case) !
                          const statusEndpoints = [
                            {
                              url: `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId=${taskId}`,
                              method: 'GET',
                            },
                            {
                              url: `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?task_id=${taskId}`,
                              method: 'GET',
                            },
                            {
                              url: `https://api.nanobananaapi.ai/api/v1/nanobanana/task/${taskId}`,
                              method: 'GET',
                            },
                          ];
                          
                          for (const endpoint of statusEndpoints) {
                            try {
                              const fetchOptions: RequestInit = {
                                method: endpoint.method,
                                headers: {
                                  'Authorization': `Bearer ${NANONBANANA_API_KEY}`,
                                  'Content-Type': 'application/json',
                                },
                              };
                              
                              console.log(`[QUICK GENERATE] Trying endpoint: ${endpoint.method} ${endpoint.url}`);
                              const statusResponse = await fetch(endpoint.url, fetchOptions);
                              
                              if (statusResponse.ok) {
                                const statusData = await statusResponse.json();
                                console.log('[QUICK GENERATE] Status response (full):', JSON.stringify(statusData, null, 2));
                                
                                // Vérifier le code de réponse
                                if (statusData.code === 200 || statusData.code === 0 || statusData.msg === 'success') {
                                // Chercher l'URL dans la réponse de statut (formats multiples)
                                // Format réel de Nanonbanana : data.response.resultImageUrl
                                const url = statusData.data?.response?.resultImageUrl
                                  || statusData.data?.response?.originImageUrl
                                  || statusData.data?.url 
                                  || statusData.data?.image_url 
                                  || statusData.data?.imageUrl
                                  || statusData.data?.images?.[0]?.url
                                  || statusData.data?.images?.[0]?.image_url
                                  || statusData.data?.result?.url
                                  || statusData.data?.result?.image_url
                                  || statusData.url 
                                  || statusData.image_url
                                  || statusData.data?.output?.url
                                  || statusData.data?.output?.image_url;
                                
                                  if (url) {
                                    finalImageUrl = url;
                                    console.log('[QUICK GENERATE] ✅ Image URL found via polling:', url.substring(0, 50) + '...');
                                    break;
                                  } else {
                                    // Vérifier le statut de la tâche
                                    const taskStatus = statusData.data?.status || statusData.data?.state || statusData.status;
                                    console.log('[QUICK GENERATE] Task status:', taskStatus, 'Available keys:', Object.keys(statusData.data || {}).join(', '));
                                    
                                    // Si la tâche est en cours, continuer le polling
                                    if (taskStatus === 'processing' || taskStatus === 'pending' || taskStatus === 'in_progress') {
                                      console.log('[QUICK GENERATE] Task still processing, continuing polling...');
                                      continue;
                                    }
                                    
                                    // Si la tâche est terminée mais pas d'URL, c'est une erreur
                                    if (taskStatus === 'completed' || taskStatus === 'done' || taskStatus === 'success') {
                                      console.error('[QUICK GENERATE] Task completed but no URL found. Full response:', JSON.stringify(statusData, null, 2));
                                    }
                                  }
                                } else {
                                  console.log('[QUICK GENERATE] Status response indicates error:', statusData.code, statusData.msg);
                                }
                              } else {
                                console.log('[QUICK GENERATE] Status response not OK:', statusResponse.status, statusResponse.statusText);
                              }
                            } catch (pollError) {
                              continue; // Essayer le prochain endpoint
                            }
                          }
                        } catch (pollError: any) {
                          console.log(`[QUICK GENERATE] Polling error (attempt ${pollingAttempt}):`, pollError.message);
                        }
                      }
                      
                      if (finalImageUrl) {
                        nanonbananaData.url = finalImageUrl;
                      } else {
                        // Si le polling échoue, on attend un peu plus longtemps (la génération peut prendre du temps)
                        // et on essaie une dernière fois avec un délai plus long
                        console.warn(`[QUICK GENERATE] ⚠️ Polling failed after ${maxPollingAttempts} attempts. Task ID: ${taskId}`);
                        console.warn(`[QUICK GENERATE] ⚠️ Waiting additional 10 seconds and trying one more time...`);
                        
                        await new Promise(resolve => setTimeout(resolve, 10000)); // Attendre 10 secondes de plus
                        
                        // Dernière tentative avec l'endpoint principal
                        try {
                          const lastAttempt = await fetch(
                            `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?task_id=${taskId}`,
                            {
                              method: 'GET',
                              headers: {
                                'Authorization': `Bearer ${NANONBANANA_API_KEY}`,
                                'Content-Type': 'application/json',
                              },
                            }
                          );
                          
                          if (lastAttempt.ok) {
                            const lastData = await lastAttempt.json();
                            console.log('[QUICK GENERATE] Last attempt response:', JSON.stringify(lastData, null, 2));
                            
                            const lastUrl = lastData.data?.url 
                              || lastData.data?.image_url 
                              || lastData.url 
                              || lastData.image_url;
                            
                            if (lastUrl) {
                              finalImageUrl = lastUrl;
                              console.log('[QUICK GENERATE] ✅ Image URL found on last attempt:', lastUrl.substring(0, 50) + '...');
                            }
                          }
                        } catch (lastError) {
                          console.error('[QUICK GENERATE] Last attempt also failed:', lastError);
                        }
                        
                        if (!finalImageUrl) {
                          // Si ça ne fonctionne toujours pas, on retourne une erreur mais avec le taskId
                          // Le callback recevra les résultats
                          throw new Error(`Génération en cours. Task ID: ${taskId}. Les résultats seront envoyés au callback: ${requestBody.callBackUrl}. Le polling a échoué.`);
                        }
                      }
                    } else {
                      // Formats possibles dans data : { url }, { image_url }, { images: [{ url }] }, { result: { url } }
                      const imageUrl = nanonbananaData.data.url 
                        || nanonbananaData.data.image_url 
                        || nanonbananaData.data.images?.[0]?.url
                        || nanonbananaData.data.result?.url
                        || nanonbananaData.data.imageUrl
                        || nanonbananaData.data.output?.url
                        || nanonbananaData.data.image
                        || nanonbananaData.data.output;
                      
                      if (imageUrl) {
                        console.log('[QUICK GENERATE] ✅ Image URL found in data:', imageUrl.substring(0, 50) + '...');
                        // Continuer avec imageUrl (sera utilisé plus bas)
                        nanonbananaData.url = imageUrl;
                      } else {
                        console.error('[QUICK GENERATE] No image URL found in data. Data structure:', JSON.stringify(nanonbananaData.data, null, 2));
                        throw new Error(`No image URL found in Nanonbanana response data. Available keys: ${Object.keys(nanonbananaData.data).join(', ')}`);
                      }
                    }
                  } else {
                    console.error('[QUICK GENERATE] Response has code but no data field');
                    throw new Error(`Nanonbanana response has code ${nanonbananaData.code} but no data field. Message: ${nanonbananaData.msg || 'No message'}`);
                  }
                }
                
                // Adapter selon le format de réponse de Nanonbanana (format standard ou après extraction depuis data)
                // Formats possibles : { url }, { data: { url } }, { image_url }, { images: [{ url }] }, { result: { url } }
                const imageUrl = nanonbananaData.url 
                  || nanonbananaData.data?.url 
                  || nanonbananaData.image_url 
                  || nanonbananaData.images?.[0]?.url
                  || nanonbananaData.result?.url
                  || nanonbananaData.imageUrl
                  || nanonbananaData.output?.url;
                
                if (!imageUrl) {
                  console.error('[QUICK GENERATE] No image URL found in response. Full response:', JSON.stringify(nanonbananaData, null, 2));
                  throw new Error(`No image URL returned from Nanonbanana. Response structure: ${Object.keys(nanonbananaData).join(', ')}`);
                }
                
                console.log(`[QUICK GENERATE] ✅ Image ${index + 1} generated successfully with Nanonbanana: ${imageUrl.substring(0, 50)}...`);
                
                return {
                  id: `img-${Date.now()}-${index}`,
                  url: imageUrl,
                };
              } catch (error: any) {
                clearTimeout(timeoutId);
                console.error(`[QUICK GENERATE] Error generating image ${index + 1}:`, error);
                
                const isTimeout = error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('Timeout');
                const errorMessage = isTimeout 
                  ? 'Timeout: La génération a pris plus de 120 secondes'
                  : error.message || 'Erreur inconnue';
                
                return {
                  id: `img-error-${Date.now()}-${index}`,
                  url: '',
                  error: errorMessage,
                };
              } finally {
                clearTimeout(timeoutId);
              }
            });

            // Utiliser Promise.allSettled pour gérer les erreurs comme dans generate-images (MÊME QUE generate-images)
            const settledResults = await Promise.allSettled(generationPromises);
            const generatedImages = settledResults.map((result: any, idx: number) => {
              if (result.status === 'fulfilled') {
                return result.value;
              } else {
                console.error(`[QUICK GENERATE] Image ${idx + 1} promise rejected:`, result.reason);
                console.error(`[QUICK GENERATE] Rejection details:`, {
                  message: result.reason?.message,
                  name: result.reason?.name,
                  stack: result.reason?.stack,
                });
                return { 
                  id: `img-error-${Date.now()}-${idx}`, 
                  url: '', 
                  error: result.reason?.message || 'Erreur inconnue' 
                };
              }
            });
            
            console.log(`[QUICK GENERATE] Attempt ${globalAttempts}: Promise.allSettled completed. ${generatedImages.length} results.`);
            
            // Filtrer les images valides (même logique que generate-images)
            const validImages = generatedImages
              .filter((img: any) => img && !img.error && img.url && img.url.trim() !== '' && img.url.startsWith('http') && !img.url.includes('data:image'))
              .map((img: any) => img);
            
            const failedImages = generatedImages.filter((img: any) => 
              !img || img.error || !img.url || !img.url.startsWith('http') || img.url.includes('data:image')
            );
            
            console.log(`[QUICK GENERATE] Attempt ${globalAttempts}: Generated ${validImages.length} valid images out of ${quantity}`);
            if (failedImages.length > 0) {
              console.warn(`[QUICK GENERATE] Attempt ${globalAttempts}: ${failedImages.length} images failed:`, 
                failedImages.map((img: any) => ({ 
                  hasError: !!img.error, 
                  error: img.error?.substring(0, 100), 
                  hasUrl: !!img.url,
                  urlPreview: img.url?.substring(0, 50)
                }))
              );
            }
            
            if (validImages.length > 0) {
              allImages = validImages;
              console.log(`[QUICK GENERATE] ✅ SUCCESS: Got ${allImages.length} image(s) on attempt ${globalAttempts}`);
              break; // Sortir de la boucle globale si on a au moins une image
            } else {
              console.warn(`[QUICK GENERATE] ⚠️ Attempt ${globalAttempts}: No valid images, retrying...`);
              if (globalAttempts < maxGlobalAttempts) {
                await new Promise(resolve => setTimeout(resolve, 3000)); // Attendre 3 secondes avant retry
              }
            }
          } catch (error: any) {
            console.error(`[QUICK GENERATE] ❌ Attempt ${globalAttempts} error:`, error.message);
            console.error(`[QUICK GENERATE] ❌ Error stack:`, error.stack);
            console.error(`[QUICK GENERATE] ❌ Error details:`, {
              name: error.name,
              message: error.message,
              cause: error.cause,
            });
            if (globalAttempts < maxGlobalAttempts) {
              console.log(`[QUICK GENERATE] ⚠️ Retrying in 2 seconds... (attempt ${globalAttempts}/${maxGlobalAttempts})`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
            console.error(`[QUICK GENERATE] ❌ All ${maxGlobalAttempts} attempts failed. Throwing error.`);
            throw error;
          }
        }

        // ⚠️ VÉRIFICATION FINALE OBLIGATOIRE - Les images Nanonbanana sont MANDATORY
        if (allImages.length === 0) {
          console.error('[QUICK GENERATE] ❌ CRITICAL: No images generated after all attempts - THIS IS NOT ACCEPTABLE');
          throw new Error('Image generation failed after all retry attempts. Nanonbanana images are MANDATORY - cannot use source image.');
        }

        // ⚠️ VÉRIFIER que les images ne sont PAS l'image source
        const sourceImageUrls = allImages.filter(img => 
          img.url === imageDataUrl || 
          img.url === imageInput || 
          img.isSourceImage === true ||
          (img.url && img.url.includes(sourceImage.substring(0, 100)))
        );
        
        if (sourceImageUrls.length > 0) {
          console.error('[QUICK GENERATE] ❌ CRITICAL: Some images are source images, not generated by Nanonbanana!');
          throw new Error('Generated images must come from Nanonbanana, not source image. This is MANDATORY.');
        }

        console.log('[QUICK GENERATE] ✅ FINAL: Images generation complete:', allImages.length, 'image(s) from Nanonbanana');
        return { success: true, images: allImages };
      })().catch((error: any) => {
        // ⚠️ NE JAMAIS retourner l'image source - retourner un objet avec success: false
        console.error('[QUICK GENERATE] ❌ Images generation completely failed:', error.message);
        console.error('[QUICK GENERATE] ❌ Error stack:', error.stack);
        console.error('[QUICK GENERATE] ❌ Error details:', {
          name: error.name,
          message: error.message,
          cause: error.cause,
          stack: error.stack,
        });
        return { 
          success: false, 
          error: error.message || 'Nanonbanana image generation failed',
          images: [],
          errorDetails: {
            name: error.name,
            message: error.message,
            cause: error.cause,
          }
        };
      }),
    ]);

    // Extraire les résultats
    let description = descriptionResult.success ? descriptionResult.description : '';
    let title = titleTagsResult.success ? titleTagsResult.title : '';
    let tags = titleTagsResult.success ? titleTagsResult.tags : [];
    let materials = titleTagsResult.success ? titleTagsResult.materials : '';
    const images = imagesResult.success ? imagesResult.images : [];
    
    // ⚠️ VÉRIFIER si la génération d'images a échoué
    if (!imagesResult.success) {
      console.error('[QUICK GENERATE] ❌ Images generation failed:', imagesResult.error);
      // Ne pas retourner d'erreur 500 immédiatement, continuer pour voir ce qui s'est passé
    }

    // ⚠️ VÉRIFICATION FINALE : S'assurer que tout est présent
    if (!description) {
      console.warn('[QUICK GENERATE] ⚠️ Description generation failed, using fallback');
      description = productVisualDescription || 'Product description';
    }
    if (!title || tags.length === 0 || !materials) {
      console.warn('[QUICK GENERATE] ⚠️ Title/tags/materials generation failed, using fallbacks');
      if (!title) {
        title = productVisualDescription.substring(0, 140) || 'Product Title';
      }
      if (tags.length === 0) {
        tags = ['handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'];
      }
      if (!materials) {
        materials = 'Various materials';
      }
    }
    if (images.length === 0) {
      console.warn('[QUICK GENERATE] ⚠️ Images generation failed');
    }

    console.log('[QUICK GENERATE] ✅ All generations complete:', {
      hasTitle: !!title,
      titleLength: title.length,
      hasDescription: !!description,
      descriptionLength: description.length,
      tagsCount: tags.length,
      hasMaterials: !!materials,
      materialsLength: materials.length,
      imagesCount: images.length,
      willUseFinalImages: images.length === 0 ? 'fallback' : 'generated',
    });

    // ⚠️ VÉRIFICATION FINALE OBLIGATOIRE : Les images doivent venir de Nanonbanana
    let finalImages = images;
    
    // Si la génération d'images a échoué, essayer une dernière fois
    if (finalImages.length === 0 && !imagesResult.success) {
      console.error('[QUICK GENERATE] ❌ CRITICAL: No images from Nanonbanana - Retrying one more time...');
      console.error('[QUICK GENERATE] Error details:', imagesResult.error);
      
      // Dernière tentative urgente avec Nanonbanana
      try {
        const urgentResponse = await fetch('https://api.nanobananaapi.ai/api/v1/nanobanana/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NANONBANANA_API_KEY}`,
          },
          body: JSON.stringify({
            type: 'IMAGETOIAMGE',
            prompt: finalPrompt,
            imageUrls: [imageDataUrl],
            image_size: aspectRatio === '1:1' ? '1:1' : aspectRatio === '16:9' ? '16:9' : aspectRatio === '9:16' ? '9:16' : '1:1',
            numImages: 1,
          }),
        });

        if (urgentResponse.ok) {
          const urgentData = await urgentResponse.json();
          const urgentUrl = urgentData.data?.url || urgentData.data?.image_url || urgentData.url;
          if (urgentUrl && !urgentUrl.includes('data:image')) {
            console.log('[QUICK GENERATE] ✅ Urgent retry succeeded');
            finalImages = [{
              id: `img-urgent-${Date.now()}`,
              url: urgentUrl,
            }];
          }
        }
      } catch (urgentError: any) {
        console.error('[QUICK GENERATE] ❌ Urgent retry also failed:', urgentError.message);
      }
    }
    
    // ⚠️ Si les images ont échoué mais le listing est OK, retourner le listing avec un warning
    // Ne plus bloquer avec une erreur 500 - le listing a de la valeur même sans images
    if (finalImages.length === 0) {
      console.warn('[QUICK GENERATE] ⚠️ No images from Nanonbanana - returning listing only with warning');
      
      // Déduire seulement 1 crédit (listing seul) au lieu de 2
      const listingOnlyCreditNeeded = 1.0;
      try {
        const listingQuotaResult = await incrementAnalysisCount(user.id, listingOnlyCreditNeeded);
        if (listingQuotaResult.success) {
          console.log(`✅ [QUICK GENERATE] Quota decremented for listing only (${listingOnlyCreditNeeded} credit)`);
        }
      } catch (quotaError: any) {
        console.error('[QUICK GENERATE] Failed to deduct listing-only credits:', quotaError.message);
      }
      
      // Refresh subscription
      return NextResponse.json({
        success: true,
        warning: 'La génération d\'images a échoué. Le listing a été généré avec succès. Vous pouvez réessayer la génération d\'images depuis l\'onglet Images.',
        listing: {
          title: title || '',
          description: description || '',
          tags: tags || [],
          materials: materials || '',
        },
        images: [],
        imagesError: imagesResult.error || 'Image generation failed',
      });
    }
    
    // ⚠️ VÉRIFIER que les images ne sont PAS l'image source
    const sourceImageCheck = finalImages.filter(img => 
      img.isSourceImage === true ||
      (img.url && (img.url === imageInput || img.url === imageDataUrl || (sourceImage && img.url.includes(sourceImage.substring(0, 100)))))
    );
    
    if (sourceImageCheck.length > 0) {
      console.warn('[QUICK GENERATE] ⚠️ Some images are source images, filtering them out');
      // Filtrer les images source au lieu de bloquer complètement
      finalImages = finalImages.filter(img => 
        !img.isSourceImage &&
        !(img.url && (img.url === imageInput || img.url === imageDataUrl || (sourceImage && img.url.includes(sourceImage.substring(0, 100)))))
      );
    }
    
    console.log('[QUICK GENERATE] ✅ Images ready from Nanonbanana:', finalImages.length, 'image(s)');

    // ⚠️ CRITICAL: Increment quota AFTER successful generation
    // Total: 2.0 credits (1 for listing + 1 for images)
    console.log(`[QUICK GENERATE] ⚠️ About to decrement ${creditNeeded} credit(s) for user:`, user.id);
    
    try {
      const quotaResult = await incrementAnalysisCount(user.id, creditNeeded);
      if (!quotaResult.success) {
        console.error(`❌ [QUICK GENERATE] Failed to decrement quota (${creditNeeded} credit):`, quotaResult.error);
        console.error(`[QUICK GENERATE] Quota result details:`, JSON.stringify(quotaResult, null, 2));
        // ⚠️ CRITICAL: If quota deduction fails, throw error to prevent free usage
        throw new Error(`Failed to deduct credits: ${quotaResult.error || 'Unknown error'}`);
      } else {
        console.log(`✅ [QUICK GENERATE] Quota decremented successfully (${creditNeeded} credit):`, {
          used: quotaResult.used,
          quota: quotaResult.quota,
          remaining: quotaResult.remaining,
          amount: creditNeeded,
        });
      }
    } catch (quotaError: any) {
      console.error(`❌ [QUICK GENERATE] CRITICAL ERROR: Failed to deduct credits:`, quotaError.message);
      console.error(`[QUICK GENERATE] Error stack:`, quotaError.stack);
      // ⚠️ CRITICAL: Return error if credits cannot be deducted
      return NextResponse.json(
        { 
          error: 'QUOTA_DEDUCTION_FAILED',
          message: `Failed to deduct credits: ${quotaError.message}. Please contact support.`,
          listing: {
            title: title || '',
            description: description || '',
            tags: tags || [],
            materials: materials || '',
          },
          images: finalImages || [],
        },
        { status: 500 }
      );
    }

    // Return combined results
    console.log('[QUICK GENERATE] ✅ Final results:', {
      listing: {
        hasTitle: !!title,
        titleLength: title.length,
        hasDescription: !!description,
        descriptionLength: description.length,
        tagsCount: tags.length,
        hasMaterials: !!materials,
        materialsLength: materials.length,
      },
      imagesCount: finalImages.length,
    });

    // Même si les images n'ont pas été générées, retourner le listing
    return NextResponse.json({
      success: true,
      listing: {
        title: title || '',
        description: description || '',
        tags: tags || [],
        materials: materials || '',
      },
      images: finalImages || [],
      quotaUpdated: quotaResult !== null,
      ...(quotaResult && quotaResult.success ? {
        quota: {
          used: quotaResult.used,
          remaining: quotaResult.remaining,
          quota: quotaResult.quota,
        }
      } : {}),
    });

  } catch (error: any) {
    console.error('[QUICK GENERATE] ❌ Error:', error);
    console.error('[QUICK GENERATE] Error stack:', error.stack);
    console.error('[QUICK GENERATE] Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause,
    });
    
    // ⚠️ NE JAMAIS retourner l'image source - toujours retourner une erreur si Nanonbanana échoue
    console.error('[QUICK GENERATE] ❌ CRITICAL ERROR: Cannot return source image - Nanonbanana generation is MANDATORY');
    
    // Retourner un message d'erreur plus détaillé pour le débogage
    const errorMessage = error.message || 'Unknown error';
    const errorDetails = process.env.NODE_ENV === 'development' ? {
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    } : undefined;
    
    return NextResponse.json(
      { 
        error: 'GENERATION_ERROR', 
        message: `Failed to generate listing and images: ${errorMessage}`,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}

