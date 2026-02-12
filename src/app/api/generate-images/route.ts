import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Import sharp avec gestion d'erreur pour Netlify
let sharp: any;
try {
  sharp = require('sharp');
} catch (error) {
  console.warn('[IMAGE GENERATION] Sharp not available, will use fallback compression');
  sharp = null;
}

// Configuration pour augmenter la limite de taille du body
export const maxDuration = 120; // 2 minutes max pour la génération
export const runtime = 'nodejs';

interface GenerateImagesRequest {
  sourceImage: string; // base64
  backgroundImage?: string; // base64 - optional custom background image
  customInstructions?: string;
  quantity: number;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  artDirection: 'auto' | 'professional-studio' | 'home-decor' | 'jewelry-accessories' | 'fashion-apparel' | 'print-on-demand';
  skipListingGeneration?: boolean; // ⚠️ DEPRECATED: Image generation is now always independent (0.25 credit). This parameter is ignored.
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * API ROUTE - GÉNÉRATION D'IMAGES AVEC NANONBANANA
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Processus :
 * 1. Nanonbanana utilise l'image uploadée et le prompt pour générer une nouvelle image
 * 2. Le produit reste IDENTIQUE, seul le background est modifié selon le prompt
 * 
 * Configuration requise :
 * - NANONBANANA_API_KEY : Clé API Nanonbanana
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[IMAGE GENERATION] ==========================================');
    console.log('[IMAGE GENERATION] ⚠️ Request received');
    console.log('[IMAGE GENERATION] Timestamp:', new Date().toISOString());
    
    // Vérifier l'authentification
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[IMAGE GENERATION] ❌ No authorization header');
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[IMAGE GENERATION] ❌ Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentification invalide' },
        { status: 401 }
      );
    }

    console.log('[IMAGE GENERATION] ✅ User authenticated:', user.id);
    
    // ⚠️ CRITICAL: Check subscription status and quota before allowing generation
    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    
    if (quotaInfo.status !== 'active') {
      console.error('[IMAGE GENERATION] ❌ Subscription not active');
      return NextResponse.json(
        { error: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required to generate images.' },
        { status: 403 }
      );
    }

    // Parse request body first to check if listing generation should be skipped
    let body: GenerateImagesRequest;
    try {
      body = await request.json();
      console.log('[IMAGE GENERATION] ✅ Request body parsed');
    } catch (parseError: any) {
      console.error('[IMAGE GENERATION] ❌ JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Format de requête invalide' },
        { status: 400 }
      );
    }

    // ⚠️ CRITICAL: Image generation is now INDEPENDENT from listing
    // We ALWAYS generate only the image (1 credit), regardless of skipListingGeneration value
    // The listing must be generated separately in the "Listing" tab
    // This allows users to generate images without needing a listing first
    const creditNeeded = 1.0; // Always 1 credit for image generation only
    
    // Check if user has enough quota
    if (quotaInfo.remaining < creditNeeded) {
      console.error(`[IMAGE GENERATION] ❌ Insufficient quota. Need ${creditNeeded} credit(s) for image generation`);
      return NextResponse.json(
        { error: 'QUOTA_EXCEEDED', message: `Insufficient quota. You need ${creditNeeded} credit(s) to generate images.` },
        { status: 403 }
      );
    }

    // Validation
    if (!body.sourceImage) {
      return NextResponse.json(
        { error: 'Image source requise' },
        { status: 400 }
      );
    }
    
    // Vérifier le format de l'image (doit commencer par data:image/)
    if (!body.sourceImage.startsWith('data:image/')) {
      console.warn('[IMAGE GENERATION] Image format may be invalid, adding data URL prefix');
      // Essayer de corriger si c'est juste du base64
      if (!body.sourceImage.includes('base64')) {
        return NextResponse.json(
          { error: 'Format d\'image invalide. Utilisez JPG ou PNG.' },
          { status: 400 }
        );
      }
    }

    if (body.quantity < 1 || body.quantity > 10) {
      return NextResponse.json(
        { error: 'La quantité doit être entre 1 et 10' },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // INTÉGRATION NANONBANANA
    // ═══════════════════════════════════════════════════════════════════════════════
    
    const NANONBANANA_API_KEY = process.env.NANONBANANA_API_KEY || '758a24cfaef8c64eed9164858b941ecc';
    
    if (!NANONBANANA_API_KEY) {
      console.error('[IMAGE GENERATION] NANONBANANA_API_KEY not configured');
      return NextResponse.json(
        { error: 'NANONBANANA_API_KEY non configurée. Configurez-la dans votre .env.local.' },
        { status: 500 }
      );
    }
    
    console.log('[IMAGE GENERATION] Nanonbanana API key configured:', NANONBANANA_API_KEY.substring(0, 10) + '...');

    // Taille par défaut
    const size = '1024x1024';
    
    console.log('[IMAGE GENERATION] Nanonbanana size:', size);
    
    // ⚠️ PRÉPARER L'IMAGE UPLOADÉE (pour référence future si nécessaire)
    let imageInput: string;
    
    try {
      // Convertir l'image en format data URL si nécessaire
      if (body.sourceImage.startsWith('data:image/')) {
        imageInput = body.sourceImage;
        console.log('[IMAGE GENERATION] ✅ Image déjà en format data URL');
      } else if (body.sourceImage.startsWith('http://') || body.sourceImage.startsWith('https://')) {
        imageInput = body.sourceImage;
        console.log('[IMAGE GENERATION] ✅ Image en format URL HTTP');
      } else {
        // Sinon, on assume que c'est du base64 et on le convertit en data URL
        imageInput = body.sourceImage.includes('base64') 
          ? body.sourceImage 
          : `data:image/jpeg;base64,${body.sourceImage}`;
        console.log('[IMAGE GENERATION] ✅ Image convertie en data URL');
      }
      
      // Vérifier que l'image n'est pas vide
      if (!imageInput || imageInput.length < 100) {
        console.error('[IMAGE GENERATION] ❌ Image trop petite ou vide');
        return NextResponse.json(
          { error: 'Image invalide ou trop petite' },
          { status: 400 }
        );
      }
      
      console.log('[IMAGE GENERATION] ✅ Image uploadée préparée (length):', imageInput.length);
    } catch (imageError: any) {
      console.error('[IMAGE GENERATION] ❌ Erreur lors de la préparation de l\'image:', imageError);
      return NextResponse.json(
        { error: `Erreur lors de la préparation de l'image: ${imageError.message || 'Erreur inconnue'}` },
        { status: 400 }
      );
    }
    
    // ⚠️ CONSTRUIRE LE PROMPT
    console.log('[IMAGE GENERATION] ⚠️ Construction du prompt');
    
    // Si un fond personnalisé est fourni, utiliser GPT-4o Vision pour le DÉCRIRE
    let backgroundDescription: string | null = null;
    if (body.backgroundImage) {
      try {
        console.log('[IMAGE GENERATION] 🎨 Describing custom background with GPT-4o Vision...');
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
          let bgDataUrl = body.backgroundImage;
          if (!bgDataUrl.startsWith('data:image/')) {
            bgDataUrl = `data:image/jpeg;base64,${bgDataUrl}`;
          }
          
          const bgDescResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Describe this background/scene image in detail for an AI image generator. Focus on: colors, textures, surfaces, materials, lighting, atmosphere, environment type (indoor/outdoor), and any distinctive elements. Be very specific and descriptive in 2-3 sentences. Only describe the scene/background, not any products.',
                    },
                    {
                      type: 'image_url',
                      image_url: { url: bgDataUrl, detail: 'low' },
                    },
                  ],
                },
              ],
              max_tokens: 200,
              temperature: 0.3,
            }),
          });
          
          if (bgDescResponse.ok) {
            const bgDescData = await bgDescResponse.json();
            backgroundDescription = bgDescData.choices?.[0]?.message?.content?.trim() || null;
            console.log('[IMAGE GENERATION] ✅ Background described:', backgroundDescription);
          } else {
            console.error('[IMAGE GENERATION] ⚠️ Background description failed:', bgDescResponse.status);
          }
        }
      } catch (bgError: any) {
        console.error('[IMAGE GENERATION] ⚠️ Background description error:', bgError.message);
      }
    }
    
    // Construire le prompt avec la description du fond si disponible
    let enhancedPrompt: string;
    
    if (backgroundDescription) {
      enhancedPrompt = `Professional Etsy lifestyle product photography.

MANDATORY BACKGROUND: Create a background that matches this exact description:
"${backgroundDescription}"
The background MUST look like the described scene. Do NOT use a different background.

Rules:
- Keep the product EXACTLY IDENTICAL (shape, colors, textures, details, text/engravings).
- The background MUST match the description above.
- Place product naturally in that scene with matching lighting and shadows.
- Soft natural lighting, realistic depth of field, warm Etsy lifestyle feel.
- NO text, logos, watermarks, badges, borders, or marketing elements.
- Ultra-realistic professional product photography.`;
      console.log('[IMAGE GENERATION] ✅ Custom background mode via description');
    } else {
      enhancedPrompt = `Professional Etsy lifestyle product photography.

Rules:
- Keep the product EXACTLY IDENTICAL (shape, colors, textures, details, text/engravings).
- Create a NEW, DIFFERENT cozy lifestyle background (NOT the same as the source image).
- Realistic natural scene appropriate for the product type.
- Soft natural lighting, depth of field, warm and inviting atmosphere.
- NO text, logos, watermarks, badges, borders, or marketing elements.
- Ultra-realistic premium product photography that makes people want to buy.`;
    }

    // Ajouter les instructions personnalisées si présentes (optionnel)
    if (body.customInstructions && body.customInstructions.trim()) {
      enhancedPrompt = `${enhancedPrompt}

ADDITIONAL INSTRUCTIONS: ${body.customInstructions.trim()}`;
    }
    
    console.log('[IMAGE GENERATION] ✅ Prompt construit');
    console.log('[IMAGE GENERATION] Background description:', !!backgroundDescription);
    console.log('[IMAGE GENERATION] ✅ Prompt length:', enhancedPrompt.length);
    console.log('[IMAGE GENERATION] ✅ Prompt preview:', enhancedPrompt.substring(0, 200) + '...');
    
    // ⚠️ GÉNÉRER LES IMAGES avec NANONBANANA
    // ═══════════════════════════════════════════════════════════════════════════════
    // Nanonbanana utilise l'image uploadée et le prompt pour générer
    // ═══════════════════════════════════════════════════════════════════════════════
    
    console.log('[IMAGE GENERATION] ⚠️ Génération avec Nanonbanana');
    
    // ⚠️ COMPRESSER L'IMAGE pour éviter l'erreur 413 (Request Entity Too Large)
    // L'image doit être < 1MB pour éviter les problèmes avec nginx
    // ═══════════════════════════════════════════════════════════════════════════════
    let imageForAPI: string;
    try {
      console.log('[IMAGE GENERATION] Compressing image to avoid 413 error...');
      
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
        console.log('[IMAGE GENERATION] Original image size:', (imageBuffer.length / 1024).toFixed(2), 'KB');
      } catch (bufferError: any) {
        console.error('[IMAGE GENERATION] Error creating buffer:', bufferError);
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
          
          console.log('[IMAGE GENERATION] First compression (512x512, 70%):', (compressedBuffer.length / 1024).toFixed(2), 'KB');
          
          // Si toujours > 500KB, compresser encore plus
          if (compressedBuffer.length > 500 * 1024) {
            console.warn('[IMAGE GENERATION] ⚠️ Image still > 500KB, applying more aggressive compression...');
            compressedBuffer = await sharp(imageBuffer)
              .resize(400, 400, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality: 60, mozjpeg: true })
              .toBuffer();
            console.log('[IMAGE GENERATION] Second compression (400x400, 60%):', (compressedBuffer.length / 1024).toFixed(2), 'KB');
          }
          
          // Si toujours > 500KB, dernière compression très agressive
          if (compressedBuffer.length > 500 * 1024) {
            console.warn('[IMAGE GENERATION] ⚠️ Image still > 500KB, applying maximum compression...');
            compressedBuffer = await sharp(imageBuffer)
              .resize(300, 300, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality: 50, mozjpeg: true })
              .toBuffer();
            console.log('[IMAGE GENERATION] Maximum compression (300x300, 50%):', (compressedBuffer.length / 1024).toFixed(2), 'KB');
          }
          
          // Convertir en base64
          imageForAPI = compressedBuffer.toString('base64');
          
          console.log('[IMAGE GENERATION] ✅ Final compressed image size:', (compressedBuffer.length / 1024).toFixed(2), 'KB');
          console.log('[IMAGE GENERATION] Compression ratio:', ((1 - compressedBuffer.length / imageBuffer.length) * 100).toFixed(1), '%');
          
          // Avertir si l'image est encore trop grande
          if (compressedBuffer.length > 500 * 1024) {
            console.error('[IMAGE GENERATION] ⚠️ WARNING: Image is still > 500KB after compression!');
          }
        } catch (sharpError: any) {
          console.error('[IMAGE GENERATION] Sharp compression failed, using original base64:', sharpError.message);
          // Fallback : utiliser l'image originale si la compression échoue
          imageForAPI = base64Data;
        }
      } else {
        console.warn('[IMAGE GENERATION] ⚠️ Sharp not available, using original image without compression');
        // Fallback : utiliser l'image originale si sharp n'est pas disponible
        imageForAPI = base64Data;
      }
    } catch (error: any) {
      console.error('[IMAGE GENERATION] Error processing image, using fallback:', error);
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
        console.error('[IMAGE GENERATION] ❌ Cannot recover image data');
        return NextResponse.json(
          { error: 'Erreur lors de la préparation de l\'image. Veuillez réessayer avec une autre image.' },
          { status: 400 }
        );
      }
    }
    
    // Vérifier que enhancedPrompt est défini
    if (!enhancedPrompt) {
      console.error('[IMAGE GENERATION] ❌ enhancedPrompt is not defined');
      return NextResponse.json(
        { error: 'Erreur lors de la construction du prompt' },
        { status: 500 }
      );
    }
    
    // Vérifier que imageForAPI est défini
    if (!imageForAPI || imageForAPI.length < 100) {
      console.error('[IMAGE GENERATION] ❌ imageForAPI is not defined or too small');
      return NextResponse.json(
        { error: 'Erreur lors de la préparation de l\'image' },
        { status: 500 }
      );
    }
    
    const generationPromises = Array.from({ length: body.quantity }, async (_, index) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout pour Nanonbanana
      
      try {
        console.log(`[IMAGE GENERATION] Generating image ${index + 1}/${body.quantity} with Nanonbanana...`);
        
        // Créer un prompt concis avec angle de caméra unique par image
        const VIEWPOINTS = [
          'frontal eye-level view',
          '45-degree left angle',
          '45-degree right angle',
          'top-down overhead view',
          'low angle looking up',
          'close-up macro detail',
          'wide environmental shot',
          'three-quarter rear view',
        ];
        
        const viewpoint = VIEWPOINTS[index % VIEWPOINTS.length];
        
        // Prompt = angle + instructions principales (gardé court !)
        let imageSpecificPrompt = `CAMERA ANGLE: ${viewpoint}.\n\n${enhancedPrompt}`;
        
        // ⚠️ HARD LIMIT: Tronquer à 1800 chars max pour éviter les erreurs 500 Nanonbanana
        if (imageSpecificPrompt.length > 1800) {
          imageSpecificPrompt = imageSpecificPrompt.substring(0, 1800);
        }
        
        console.log(`[IMAGE GENERATION] Prompt length: ${imageSpecificPrompt.length} chars`);
        console.log(`[IMAGE GENERATION] Image length: ${imageForAPI.length} chars`);
        console.log(`[IMAGE GENERATION] API Key: ${NANONBANANA_API_KEY.substring(0, 10)}...`);
        
        // Utiliser Nanonbanana API pour image-to-image
        // Format selon la documentation officielle : https://docs.nanobananaapi.ai
        // ⚠️ Le paramètre "type" doit être "IMAGETOIAMGE" (en majuscules)
        // ⚠️ Pour image-to-image, utiliser "imageUrls" (tableau d'URLs) au lieu de "image" (base64)
        // ⚠️ "callBackUrl" est OBLIGATOIRE selon la documentation
        
        const imageDataUrl = `data:image/jpeg;base64,${imageForAPI}`;
        
        // Prompt déjà tronqué à 1800 chars ci-dessus
        const finalPrompt = imageSpecificPrompt;
        
        // ⚠️ Toujours 1 seule image (le produit). Le fond est décrit dans le prompt.
        const imageUrlsForRequest = [imageDataUrl];
        
        const requestBody: any = {
          type: 'IMAGETOIAMGE',
          prompt: finalPrompt,
          imageUrls: imageUrlsForRequest,
          image_size: body.aspectRatio === '1:1' ? '1:1' : body.aspectRatio === '16:9' ? '16:9' : body.aspectRatio === '9:16' ? '9:16' : '1:1',
          numImages: 1,
          callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
        };
        
        console.log('[IMAGE GENERATION] imageUrls count:', imageUrlsForRequest.length, '(product only, background in prompt)');
        
        console.log('[IMAGE GENERATION] Request body prepared (without image):', JSON.stringify({ ...requestBody, prompt: '[PROMPT]', imageUrls: '[IMAGE_URLS]' }));
        console.log('[IMAGE GENERATION] Image length:', imageForAPI.length, 'chars');
        console.log('[IMAGE GENERATION] Prompt length:', imageSpecificPrompt.length, 'chars');
        console.log('[IMAGE GENERATION] Prompt preview:', imageSpecificPrompt.substring(0, 300) + '...');
        
        // Endpoints selon la documentation officielle : https://docs.nanobananaapi.ai
        // L'endpoint officiel est : /api/v1/nanobanana/generate
        const possibleEndpoints = [
          'https://api.nanobananaapi.ai/api/v1/nanobanana/generate', // Endpoint officiel selon docs
          'https://api.nanobanana.com/api/v1/nanobanana/generate', // Variante du domaine
          'https://api.nanobananaapi.ai/v1/nanobanana/generate', // Sans /api
          'https://api.nanobanana.com/v1/nanobanana/generate', // Variante sans /api
        ];
        
        let nanonbananaResponse;
        let lastError: any = null;
        
        // Essayer chaque endpoint jusqu'à ce qu'un fonctionne
        for (const endpoint of possibleEndpoints) {
          try {
            console.log(`[IMAGE GENERATION] Trying endpoint: ${endpoint}`);
            
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
                console.log(`[IMAGE GENERATION] Trying auth format: ${Object.keys(headers).join(', ')}`);
                
                nanonbananaResponse = await fetch(endpoint, {
                  method: 'POST',
                  headers: headers as HeadersInit,
                  body: JSON.stringify(requestBody),
                  signal: controller.signal,
                });
                
                // Si on obtient une réponse autre que 403, on arrête
                if (nanonbananaResponse.status !== 403) {
                  console.log(`[IMAGE GENERATION] ✅ Auth format works (status: ${nanonbananaResponse.status})`);
                  break;
                } else {
                  console.log(`[IMAGE GENERATION] ❌ Auth format failed (403), trying next...`);
                  lastAuthError = { status: 403, message: 'Forbidden' };
                }
              } catch (fetchError: any) {
                console.log(`[IMAGE GENERATION] ❌ Auth format error: ${fetchError.message}`);
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
              console.log(`[IMAGE GENERATION] ✅ Endpoint found: ${endpoint} (status: ${nanonbananaResponse.status})`);
              break;
            }
          } catch (fetchError: any) {
            console.log(`[IMAGE GENERATION] ❌ Endpoint failed: ${endpoint} - ${fetchError.message}`);
            lastError = fetchError;
            continue;
          }
        }
        
        if (!nanonbananaResponse) {
          console.error('[IMAGE GENERATION] All endpoints failed');
          throw new Error(`Erreur de connexion à Nanonbanana: ${lastError?.message || 'Aucun endpoint valide trouvé. Vérifiez l\'URL de l\'API.'}`);
        }
        
        console.log(`[IMAGE GENERATION] Nanonbanana API response status: ${nanonbananaResponse.status}`);
        
        if (!nanonbananaResponse.ok) {
          let errorData: any = {};
          try {
            const text = await nanonbananaResponse.text();
            console.error('[IMAGE GENERATION] Error response text:', text);
            try {
              errorData = JSON.parse(text);
            } catch {
              errorData = { error: { message: text || `HTTP ${nanonbananaResponse.status}` } };
            }
          } catch (parseError) {
            errorData = { error: { message: `HTTP ${nanonbananaResponse.status}: ${nanonbananaResponse.statusText}` } };
          }
          
          console.error('[IMAGE GENERATION] Nanonbanana API error:', JSON.stringify(errorData));
          
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
          console.log('[IMAGE GENERATION] Nanonbanana raw response:', responseText.substring(0, 1000));
          
          try {
            nanonbananaData = JSON.parse(responseText);
          } catch (parseError) {
            console.error('[IMAGE GENERATION] Failed to parse JSON response:', parseError);
            throw new Error(`Invalid JSON response from Nanonbanana: ${responseText.substring(0, 200)}`);
          }
        } catch (responseError: any) {
          console.error('[IMAGE GENERATION] Error reading response:', responseError);
          throw new Error(`Failed to read Nanonbanana response: ${responseError.message}`);
        }
        
        console.log('[IMAGE GENERATION] Nanonbanana parsed response:', JSON.stringify(nanonbananaData).substring(0, 500));
        
        // ⚠️ GESTION DU FORMAT {code, msg, data} de Nanonbanana
        // ═══════════════════════════════════════════════════════════════════════════════
        
        // Vérifier si la réponse a la structure {code, msg, data}
        if (nanonbananaData.code !== undefined) {
          console.log('[IMAGE GENERATION] Response has code structure. Code:', nanonbananaData.code);
          
          // Vérifier si le code indique une erreur
          if (nanonbananaData.code !== 200 && nanonbananaData.code !== 0 && nanonbananaData.code !== 'success') {
            const errorMsg = nanonbananaData.msg || nanonbananaData.message || `API returned error code: ${nanonbananaData.code}`;
            console.error('[IMAGE GENERATION] Nanonbanana API error:', errorMsg);
            throw new Error(`Nanonbanana API error (code ${nanonbananaData.code}): ${errorMsg}`);
          }
          
          // Si succès, chercher l'URL dans data
          if (nanonbananaData.data) {
            console.log('[IMAGE GENERATION] Looking for URL in data object. Data keys:', Object.keys(nanonbananaData.data).join(', '));
            
            // Vérifier si c'est un task_id (génération asynchrone)
            if (nanonbananaData.data.task_id || nanonbananaData.data.taskId || nanonbananaData.data.id) {
              const taskId = nanonbananaData.data.task_id || nanonbananaData.data.taskId || nanonbananaData.data.id;
              console.log('[IMAGE GENERATION] ⚠️ Task ID received, need to poll for result. Task ID:', taskId);
              console.log('[IMAGE GENERATION] ⚠️ Callback URL configured:', requestBody.callBackUrl);
              console.log('[IMAGE GENERATION] ⚠️ Note: Results will also be sent to callback URL. Polling is a fallback.');
              
              // Polling pour récupérer le résultat
              const maxPollingAttempts = 30; // 30 tentatives max
              const pollingInterval = 2000; // 2 secondes entre chaque tentative
              let pollingAttempt = 0;
              let finalImageUrl: string | null = null;
              
              while (pollingAttempt < maxPollingAttempts && !finalImageUrl) {
                await new Promise(resolve => setTimeout(resolve, pollingInterval));
                pollingAttempt++;
                
                try {
                  console.log(`[IMAGE GENERATION] Polling attempt ${pollingAttempt}/${maxPollingAttempts} for task ${taskId}...`);
                  
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
                      
                      console.log(`[IMAGE GENERATION] Trying endpoint: ${endpoint.method} ${endpoint.url}`);
                      const statusResponse = await fetch(endpoint.url, fetchOptions);
                      
                      if (statusResponse.ok) {
                        const statusData = await statusResponse.json();
                        console.log('[IMAGE GENERATION] Status response (full):', JSON.stringify(statusData, null, 2));
                        
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
                            console.log('[IMAGE GENERATION] ✅ Image URL found via polling:', url.substring(0, 50) + '...');
                            break;
                          } else {
                            // Vérifier le statut de la tâche
                            const taskStatus = statusData.data?.status || statusData.data?.state || statusData.status;
                            console.log('[IMAGE GENERATION] Task status:', taskStatus, 'Available keys:', Object.keys(statusData.data || {}).join(', '));
                            
                            // Si la tâche est en cours, continuer le polling
                            if (taskStatus === 'processing' || taskStatus === 'pending' || taskStatus === 'in_progress') {
                              console.log('[IMAGE GENERATION] Task still processing, continuing polling...');
                              continue;
                            }
                            
                            // Si la tâche est terminée mais pas d'URL, c'est une erreur
                            if (taskStatus === 'completed' || taskStatus === 'done' || taskStatus === 'success') {
                              console.error('[IMAGE GENERATION] Task completed but no URL found. Full response:', JSON.stringify(statusData, null, 2));
                            }
                          }
                        } else {
                          console.log('[IMAGE GENERATION] Status response indicates error:', statusData.code, statusData.msg);
                        }
                      } else {
                        console.log('[IMAGE GENERATION] Status response not OK:', statusResponse.status, statusResponse.statusText);
                      }
                    } catch (pollError) {
                      continue; // Essayer le prochain endpoint
                    }
                  }
                } catch (pollError: any) {
                  console.log(`[IMAGE GENERATION] Polling error (attempt ${pollingAttempt}):`, pollError.message);
                }
              }
              
              if (finalImageUrl) {
                nanonbananaData.url = finalImageUrl;
              } else {
                // Si le polling échoue, on attend un peu plus longtemps (la génération peut prendre du temps)
                // et on essaie une dernière fois avec un délai plus long
                console.warn(`[IMAGE GENERATION] ⚠️ Polling failed after ${maxPollingAttempts} attempts. Task ID: ${taskId}`);
                console.warn(`[IMAGE GENERATION] ⚠️ Trying one more time...`);
                
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
                    console.log('[IMAGE GENERATION] Last attempt response:', JSON.stringify(lastData, null, 2));
                    
                    const lastUrl = lastData.data?.response?.resultImageUrl
                      || lastData.data?.response?.originImageUrl
                      || lastData.data?.url 
                      || lastData.data?.image_url 
                      || lastData.data?.imageUrl
                      || lastData.data?.images?.[0]?.url
                      || lastData.url 
                      || lastData.image_url;
                    
                    if (lastUrl) {
                      finalImageUrl = lastUrl;
                      console.log('[IMAGE GENERATION] ✅ Image URL found on last attempt:', lastUrl.substring(0, 50) + '...');
                    }
                  }
                } catch (lastError) {
                  console.error('[IMAGE GENERATION] Last attempt also failed:', lastError);
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
                console.log('[IMAGE GENERATION] ✅ Image URL found in data:', imageUrl.substring(0, 50) + '...');
                // Continuer avec imageUrl (sera utilisé plus bas)
                nanonbananaData.url = imageUrl;
              } else {
                console.error('[IMAGE GENERATION] No image URL found in data. Data structure:', JSON.stringify(nanonbananaData.data, null, 2));
                throw new Error(`No image URL found in Nanonbanana response data. Available keys: ${Object.keys(nanonbananaData.data).join(', ')}`);
              }
            }
          } else {
            console.error('[IMAGE GENERATION] Response has code but no data field');
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
          console.error('[IMAGE GENERATION] No image URL found in response. Full response:', JSON.stringify(nanonbananaData, null, 2));
          throw new Error(`No image URL returned from Nanonbanana. Response structure: ${Object.keys(nanonbananaData).join(', ')}`);
        }
        
        console.log(`[IMAGE GENERATION] ✅ Image ${index + 1} generated successfully with Nanonbanana: ${imageUrl.substring(0, 50)}...`);
        
        return {
          id: `img-${Date.now()}-${index}`,
          url: imageUrl,
        };
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error(`[IMAGE GENERATION] Error generating image ${index + 1}:`, error);
        
        const isTimeout = error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('Timeout');
        const errorMessage = isTimeout 
          ? 'Timeout: La génération a pris plus de 120 secondes'
          : error.message || 'Erreur inconnue';
        
        return {
          id: `img-error-${Date.now()}-${index}`,
          url: '',
          error: errorMessage,
        };
      }
    });

    // Attendre toutes les générations en parallèle
    console.log('[IMAGE GENERATION] ⚠️ Attente de', body.quantity, 'génération(s)...');
    let generatedImages: any[] = [];
    
    try {
      generatedImages = await Promise.all(generationPromises);
      console.log('[IMAGE GENERATION] ✅ Toutes les générations terminées');
    } catch (promiseError: any) {
      console.error('[IMAGE GENERATION] ❌ Erreur Promise.all:', promiseError);
      // Si Promise.all échoue, essayer de récupérer les résultats partiels
      generatedImages = await Promise.allSettled(generationPromises).then(results => 
        results.map((result, index) => 
          result.status === 'fulfilled' 
            ? result.value 
            : { id: `img-error-${Date.now()}-${index}`, url: '', error: result.reason?.message || 'Erreur inconnue' }
        )
      );
    }

    // Filtrer les images avec erreur (optionnel - on peut les garder pour debug)
    const successfulImages = generatedImages.filter(img => !img.error);
    const failedImages = generatedImages.filter(img => img.error);
    
    console.log('[IMAGE GENERATION] ✅ Images réussies:', successfulImages.length);
    console.log('[IMAGE GENERATION] ❌ Images échouées:', failedImages.length);

    // Logs internes (pour debug)
    console.log('[IMAGE GENERATION]', {
      userId: user.id,
      quantity: body.quantity,
      aspectRatio: body.aspectRatio,
      artDirection: body.artDirection,
      successful: successfulImages.length,
      failed: failedImages.length,
      timestamp: new Date().toISOString(),
    });

    // Si toutes les images ont échoué, retourner une erreur avec message clair
    if (successfulImages.length === 0) {
      const errorMessages = failedImages.map(img => img.error).filter(Boolean);
      const mainError = errorMessages[0] || 'Toutes les générations ont échoué';
      
      // Message d'erreur plus clair
      let userFriendlyError = mainError;
      
      return NextResponse.json(
        { 
          error: userFriendlyError,
          details: errorMessages,
        },
        { status: 500 }
      );
    }

    // ⚠️ CRITICAL: Increment quota AFTER successful generation
    // Image generation is INDEPENDENT - always 1 credit for image only
    // Listing must be generated separately in the "Listing" tab
    // ⚠️ MANDATORY: Deduct 1 credit if at least one image was generated successfully
    if (successfulImages.length > 0) {
      const creditAmount = 1.0; // Always 1 credit for image generation only
      console.log(`[IMAGE GENERATION] ⚠️ MANDATORY: About to decrement ${creditAmount} credit(s) for user:`, user.id, `(${successfulImages.length} image(s) generated successfully)`);
      
      try {
        const quotaResult = await incrementAnalysisCount(user.id, creditAmount);
        if (!quotaResult.success) {
          console.error(`❌ [IMAGE GENERATION] CRITICAL: Failed to decrement quota (${creditAmount} credit):`, quotaResult.error);
          console.error(`[IMAGE GENERATION] Quota result details:`, JSON.stringify(quotaResult, null, 2));
          // ⚠️ CRITICAL: If quota deduction fails, throw error to prevent free usage
          throw new Error(`Failed to deduct credits: ${quotaResult.error || 'Unknown error'}`);
        } else {
          console.log(`✅ [IMAGE GENERATION] Quota decremented successfully (${creditAmount} credit):`, {
            used: quotaResult.used,
            quota: quotaResult.quota,
            remaining: quotaResult.remaining,
            amount: creditAmount,
            breakdown: 'image only (1 credit) - independent from listing',
          });
          
          // ⚠️ CRITICAL: Verify the value was stored correctly by reading it back immediately
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
            console.log('✅ [IMAGE GENERATION] Verified stored value in DB:', storedValue);
            
            if (Math.abs(storedValue - quotaResult.used) > 0.01) {
              console.error('❌ [IMAGE GENERATION] WARNING: Stored value differs from expected:', {
                expected: quotaResult.used,
                stored: storedValue,
              });
            }
          } else {
            console.warn('⚠️ [IMAGE GENERATION] Could not verify stored value:', verifyError);
          }
        }
      } catch (quotaError: any) {
        console.error(`❌ [IMAGE GENERATION] CRITICAL ERROR: Failed to deduct credits:`, quotaError.message);
        console.error(`[IMAGE GENERATION] Error stack:`, quotaError.stack);
        // ⚠️ CRITICAL: Return error if credits cannot be deducted
        return NextResponse.json(
          { 
            error: 'QUOTA_DEDUCTION_FAILED',
            message: `Failed to deduct 1.0 credit after image generation: ${quotaError.message}. Please contact support.`,
            images: successfulImages, // Return images anyway but log the error
          },
          { status: 500 }
        );
      }
    } else {
      console.error(`[IMAGE GENERATION] ❌ CRITICAL: No successful images generated - cannot deduct credits`);
    }

    return NextResponse.json({
      success: true,
      images: successfulImages,
      ...(failedImages.length > 0 && {
        warnings: failedImages.map(img => ({
          index: img.id,
          error: img.error,
        })),
      }),
    });

  } catch (error: any) {
    console.error('[IMAGE GENERATION ERROR] ==========================================');
    console.error('[IMAGE GENERATION ERROR] Type:', typeof error);
    console.error('[IMAGE GENERATION ERROR] Message:', error?.message);
    console.error('[IMAGE GENERATION ERROR] Name:', error?.name);
    console.error('[IMAGE GENERATION ERROR] Stack:', error?.stack);
    
    // Essayer de logger l'erreur complète
    try {
      console.error('[IMAGE GENERATION ERROR] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } catch (stringifyError) {
      console.error('[IMAGE GENERATION ERROR] Could not stringify error:', stringifyError);
      console.error('[IMAGE GENERATION ERROR] Error toString:', String(error));
    }
    console.error('[IMAGE GENERATION ERROR] ==========================================');
    
    // Message d'erreur plus détaillé pour le debug
    let errorMessage = error?.message || error?.toString() || 'Erreur lors de la génération des images';
    
    // Messages d'erreur plus clairs pour les cas courants
    if (errorMessage.includes('invalid_api_key') || errorMessage.includes('Invalid API') || errorMessage.includes('Unauthorized')) {
      errorMessage = 'Clé API Nanonbanana invalide. Vérifie NANONBANANA_API_KEY dans .env.local';
    } else if (errorMessage.includes('rate_limit') || errorMessage.includes('rate limit')) {
      errorMessage = 'Trop de requêtes. Attends quelques minutes avant de réessayer.';
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        ...(process.env.NODE_ENV === 'development' && {
          details: {
            name: error?.name,
            message: error?.message,
            stack: error?.stack?.split('\n').slice(0, 10).join('\n'), // Premières 10 lignes pour debug
          }
        }),
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Obtenir les dimensions pour un aspect ratio donné
 * Stable Diffusion supporte tous les ratios et résolutions
 */
function getDimensionsForAspectRatio(aspectRatio: string): string {
  const dimensions: Record<string, string> = {
    '1:1': '1024x1024',      // Carré
    '16:9': '1344x768',      // Landscape
    '9:16': '768x1344',      // Portrait
    '4:3': '1024x768',       // Landscape 4:3
    '3:4': '768x1024',       // Portrait 3:4
  };
  return dimensions[aspectRatio] || '1024x1024';
}

