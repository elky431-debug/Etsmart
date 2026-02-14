import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// ═══════════════════════════════════════════════════════════════════════════════
// ETSMART AI ANALYSIS API - GPT-4o VISION
// ═══════════════════════════════════════════════════════════════════════════════

interface AIAnalysisRequest {
  productTitle: string;
  productPrice: number;
  niche: string;
  productCategory?: string;
  productImageUrl: string;
}

interface ScoringCriterion {
  score: number;
  analysis: string;
}

interface ScoringBreakdownResponse {
  market_demand: ScoringCriterion;
  competition_intensity: ScoringCriterion;
  differentiation_potential: ScoringCriterion;
  profit_margin_potential: ScoringCriterion;
  impulse_buy_potential: ScoringCriterion;
  scalability_potential: ScoringCriterion;
}

interface AIAnalysisResponse {
  decision: string;
  confidenceScore: number;
  scoreJustification?: string;
  launchPotentialScore?: number; // = final_weighted_score (0-10)
  launchPotentialScoreJustification?: string; // = strategic_summary
  classification?: string; // NOT RECOMMENDED / HIGH RISK / MODERATE OPPORTUNITY / STRONG OPPORTUNITY / EXCEPTIONAL OPPORTUNITY
  scoringBreakdown?: ScoringBreakdownResponse; // 6 critères détaillés
  
  // Saturation & Concurrence
  estimatedCompetitors: number;
  competitorEstimationReasoning: string;
  competitorEstimationReliable: boolean;
  saturationLevel: string;
  saturationAnalysis: string;
  
  // Prix moyen du marché
  averageMarketPrice: number;
  marketPriceRange: { min: number; max: number };
  marketPriceReasoning: string;
  
  // Prix fournisseur estimé par l'IA
  estimatedSupplierPrice: number;
  estimatedShippingCost: number;
  supplierPriceReasoning: string;
  
  // Prix de vente recommandé
  supplierPrice: number;
  minimumViablePrice: number;
  recommendedPrice: {
    min: number;
    max: number;
    optimal: number;
  };
  priceRiskLevel: string;
  pricingAnalysis: string;
  
  // Simulation
  launchSimulation: {
    timeToFirstSale: {
      withoutAds: { min: number; max: number };
      withAds: { min: number; max: number };
    };
    salesAfter3Months: {
      prudent: number;
      realiste: number;
      optimise: number;
    };
    simulationNote: string;
  };
  
  // Vision
  productVisualDescription: string;
  etsySearchQuery: string;
  canIdentifyProduct: boolean;
  
  // Correspondance niche/produit
  nicheMatch?: boolean; // true si le produit correspond à la niche, false sinon
  nicheMatchReasoning?: string; // Explication de la correspondance ou non-correspondance
  
  // SEO & Marketing
  viralTitleEN: string;
  seoTags: string[];
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // MARKETING STRATÉGIQUE (OPTIONNEL - supprimé pour vitesse)
  // ═══════════════════════════════════════════════════════════════════════════════
  strategicMarketing?: {
    positioning: {
      mainPositioning: string;
      justification: string;
      competitiveAdvantage: string;
    };
    underexploitedAngles: {
      angle: string;
      whyUnderexploited: string;
      whyItCanWork: string;
      competitionLevel: 'low' | 'medium' | 'high';
    }[];
    competitorMistakes: {
      mistake: string;
      frequency: 'common' | 'frequent' | 'very_frequent';
    }[];
    visualRecommendations: {
      recommendation: string;
      impact: string;
    }[];
    psychologicalTriggers: {
      trigger: string;
      explanation: string;
    }[];
    anglesToAvoid: {
      angle: string;
      risk: string;
    }[];
  };
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // MARKETING ACQUISITION IA (OPTIONNEL - supprimé pour vitesse)
  // ═══════════════════════════════════════════════════════════════════════════════
  acquisitionMarketing?: {
    targetAudience: {
      ageRange: string;
      situation: string;
      buyingBehavior: 'impulsive' | 'reflective';
      description: string;
    };
    acquisitionChannel: {
      primary: 'tiktok' | 'facebook' | 'instagram' | 'pinterest';
      secondary?: 'tiktok' | 'facebook' | 'instagram' | 'pinterest';
      justification: string;
      notSuitableForTikTok?: boolean;
    };
    tiktokIdeas: {
      title: string;
      concept: string;
      whatToShow: string;
      whyViral: string;
    }[];
    facebookIdeas?: {
      title: string;
      concept: string;
      whatToShow: string;
      whyEffective: string;
    }[];
  };
  
  // Analyse
  finalVerdict: string;
  warningIfAny: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERROU GLOBAL POUR EMPÊCHER LES ANALYSES SIMULTANÉES
// ═══════════════════════════════════════════════════════════════════════════════
let isAnalyzing = false;
let currentAnalysisPromise: Promise<any> | null = null;

export async function POST(request: NextRequest) {
  // ⚠️ PROTECTION : Empêcher les analyses simultanées
  if (isAnalyzing) {
    return NextResponse.json({
      success: false,
      error: 'ANALYSIS_IN_PROGRESS',
      message: 'Une analyse est déjà en cours. Veuillez attendre la fin de l\'analyse en cours avant d\'en démarrer une nouvelle.',
      canAnalyze: false,
    }, { status: 429 }); // 429 = Too Many Requests
  }
  
  // Activer le verrou
  isAnalyzing = true;
  
  try {
    // Get user ID from auth token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token || '');
    
    if (authError || !user) {
      isAnalyzing = false;
      return NextResponse.json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required.',
        canAnalyze: false,
      }, { status: 401 });
    }

    // ⚠️ CRITICAL: Check subscription status before allowing analysis
    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    
    if (quotaInfo.status !== 'active') {
      isAnalyzing = false;
      return NextResponse.json({
        success: false,
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'An active subscription is required to analyze products.',
        canAnalyze: false,
        subscriptionStatus: quotaInfo.status,
      }, { status: 403 });
    }

    // Check if user has enough quota (2 credits needed for analysis and simulation)
    if (quotaInfo.remaining < 2.0) {
      isAnalyzing = false;
      return NextResponse.json({
        success: false,
        error: 'QUOTA_EXCEEDED',
        message: 'You have reached your monthly analysis limit. Please upgrade your plan.',
        canAnalyze: false,
        used: quotaInfo.used,
        quota: quotaInfo.quota,
        requiresUpgrade: quotaInfo.requiresUpgrade,
      }, { status: 403 });
    }
    
    const body: AIAnalysisRequest = await request.json();
    const { productPrice, niche, productCategory, productImageUrl } = body;

    // Accepter les URLs http/https ET les data URLs (pour les screenshots)
    const isValidImage = productImageUrl && (
      productImageUrl.startsWith('http://') || 
      productImageUrl.startsWith('https://') ||
      productImageUrl.startsWith('data:image/')
    );
    
    if (!isValidImage) {
      return NextResponse.json({
        success: false,
        error: 'IMAGE_REQUIRED',
        message: 'Une image du produit est OBLIGATOIRE (URL ou data URL).',
        canAnalyze: false,
      }, { status: 400 });
    }

    if (!niche) {
      return NextResponse.json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'La niche est requise.',
        canAnalyze: false,
      }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    console.log('🔑 API Key check:', {
      hasKey: !!apiKey,
      keyLength: apiKey?.length,
      keyPrefix: apiKey?.substring(0, 7),
    });
    
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY_MISSING - No API key found in environment variables');
      return NextResponse.json({
        success: false,
        error: 'OPENAI_API_KEY_MISSING',
        message: 'Clé OpenAI non configurée dans Netlify.',
        canAnalyze: false,
        troubleshooting: 'Go to Netlify Dashboard → Site Settings → Environment Variables → Add OPENAI_API_KEY',
      }, { status: 503 });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROMPT OPTIMISÉ - COMPACT POUR RÉPONSE RAPIDE (<15s)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const prompt = `Analyze this product image for Etsy dropshipping viability.
Niche: ${niche}. Supplier price: ${productPrice > 0 ? `$${productPrice}` : 'estimate from image'}.

═══ PART A: PRODUCT IDENTIFICATION ═══
1. Describe the product in 1 sentence from the image.
2. Check if product matches niche "${niche}".
3. Estimate AliExpress supplier cost + shipping cost.
4. Generate 5-8 word English Etsy search query.

═══ PART B: PRODUCT SCORING (MOST IMPORTANT) ═══
Score each criterion from 0 to 10. BE STRICTLY OBJECTIVE AND ANALYTICAL.
DO NOT default to middle scores (5-7). Use the FULL range 0-10.
Each criterion MUST have a 2-4 sentence analytical justification.

⚠️ CRITICAL RULES:
- Products that are GENUINELY good should score 7-10
- Products that are BAD should score 0-3
- Simple generic jewelry (basic bracelets, necklaces, rings, earrings without personalization/unique design/rare materials) MUST score: Competition ≤2, Differentiation ≤2, Market Demand ≤3
- DO NOT be optimistic. DO NOT give every product a 5-7. Be HARSH when needed.

CRITERIA:
1) Market Demand (weight: 25%): Real buyer intent? Problem-solving or strong desire? Evergreen or seasonal?
2) Competition Intensity (weight: 20%): How hard to enter this market? Overcrowded? Big sellers dominating? (HIGH score = LOW competition = GOOD)
3) Differentiation Potential (weight: 15%): Can this be positioned uniquely? Branding opportunity? Visual standout?
4) Profit Margin Potential (weight: 20%): Price vs cost analysis. Room for ads? Long-term viable?
5) Impulse Buy Potential (weight: 10%): Emotionally attractive? Quick purchase decision?
6) Scalability Potential (weight: 10%): Variations? Brand expansion? Repeat purchase?

WEIGHTED SCORE = (Demand×0.25)+(Competition×0.20)+(Differentiation×0.15)+(Margin×0.20)+(Impulse×0.10)+(Scalability×0.10)
CLASSIFICATION: 0-3.9=NOT RECOMMENDED, 4-5.9=HIGH RISK, 6-7.4=MODERATE OPPORTUNITY, 7.5-8.5=STRONG OPPORTUNITY, 8.6-10=EXCEPTIONAL OPPORTUNITY

═══ PART C: MARKET DATA ═══
- Estimate number of Etsy competitors selling similar products
- Estimate average market price range
- Pricing: total cost < $70 → min price = cost×3; cost ≥ $70 → min price = cost×2
- Simulation: days to first sale (with/without ads), 3-month sales projection
- SEO: EXACTLY 13 English tags, max 20 chars each
- Viral title: English, 100-140 chars

STRICT JSON OUTPUT:
{
  "canIdentifyProduct": true,
  "productVisualDescription": "1 sentence",
  "nicheMatch": true/false,
  "nicheMatchReasoning": "1 sentence",
  "etsySearchQuery": "5-8 words",
  "estimatedSupplierPrice": number,
  "estimatedShippingCost": number,
  "supplierPriceReasoning": "justification",
  "scoringBreakdown": {
    "market_demand": {"score": X, "analysis": "2-4 sentences"},
    "competition_intensity": {"score": X, "analysis": "2-4 sentences"},
    "differentiation_potential": {"score": X, "analysis": "2-4 sentences"},
    "profit_margin_potential": {"score": X, "analysis": "2-4 sentences"},
    "impulse_buy_potential": {"score": X, "analysis": "2-4 sentences"},
    "scalability_potential": {"score": X, "analysis": "2-4 sentences"}
  },
  "launchPotentialScore": X.X,
  "classification": "STRING",
  "launchPotentialScoreJustification": "4-6 sentences strategic summary",
  "decision": "LANCER"|"LANCER_CONCURRENTIEL"|"NE_PAS_LANCER",
  "confidenceScore": 30-95,
  "estimatedCompetitors": number,
  "competitorEstimationReasoning": "justification",
  "competitorEstimationReliable": true/false,
  "saturationLevel": "non_sature"|"concurrentiel"|"sature",
  "saturationAnalysis": "1 sentence",
  "averageMarketPrice": number,
  "marketPriceRange": {"min": number, "max": number},
  "marketPriceReasoning": "1 sentence",
  "supplierPrice": number,
  "minimumViablePrice": number,
  "recommendedPrice": {"optimal": number, "min": number, "max": number},
  "priceRiskLevel": "faible"|"moyen"|"eleve",
  "pricingAnalysis": "1 sentence",
  "launchSimulation": {
    "timeToFirstSale": {"withoutAds": {"min": number, "max": number}, "withAds": {"min": number, "max": number}},
    "salesAfter3Months": {"prudent": number, "realiste": number, "optimise": number},
    "simulationNote": "1 sentence"
  },
  "viralTitleEN": "100-140 chars",
  "seoTags": ["exactly 13 tags"],
  "finalVerdict": "1 sentence",
  "warningIfAny": null
}
JSON ONLY.`;

    console.log('📤 Calling OpenAI API with OPTIMIZED prompt:', {
      url: productImageUrl?.substring(0, 100),
      isDataUrl: productImageUrl?.startsWith('data:image'),
      isHttpUrl: productImageUrl?.startsWith('http'),
      imageLength: productImageUrl?.length,
      promptLength: prompt.length,
      promptSizeKB: (prompt.length / 1024).toFixed(2),
      niche,
      price: productPrice,
      maxTokens: 1500,
      temperature: 0.7,
      model: 'gpt-4o-mini',
      timeout: '22s',
      retries: 0,
      netlifyLimit: '26s',
    });
    
    const openaiStartTime = Date.now();
    const usedModel = 'gpt-4o-mini'; // ⚡ UTILISER DIRECTEMENT GPT-4O-MINI (le plus rapide)
    
    // ⚡ OPTIMISATION NETLIFY: UNE SEULE tentative avec timeout strict
    // Netlify Pro = 26s max. On utilise 22s pour laisser une marge de sécurité.
    // PAS DE RETRY - une seule tentative rapide pour rester dans la limite Netlify
    const MAX_RETRIES = 0; // ⚠️ UNE SEULE tentative - pas de retry
    const INITIAL_TIMEOUT = 22000; // 22s max (Netlify coupe à ~26s)
    let lastError: any = null;
    let openaiResponse: Response | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(`⏱️ GPT-4o-mini timeout après ${INITIAL_TIMEOUT}ms (tentative ${attempt + 1}/${MAX_RETRIES + 1})`);
        controller.abort();
      }, INITIAL_TIMEOUT);
      
      try {
        console.log(`🔄 Tentative ${attempt + 1}/${MAX_RETRIES + 1} - Appel OpenAI API`);
        
        // Optimiser l'image si c'est une data URL trop grande
        let optimizedImageUrl = productImageUrl;
        if (productImageUrl.startsWith('data:image/')) {
          // Si l'image est trop grande, on peut la réduire côté client avant l'envoi
          // Pour l'instant, on utilise 'low' detail qui réduit déjà le temps de traitement
          const imageSizeKB = productImageUrl.length / 1024;
          if (imageSizeKB > 500) {
            console.log(`📷 Image data URL détectée (${imageSizeKB.toFixed(0)}KB), utilisation de detail: low pour optimisation`);
          } else {
            console.log(`📷 Image data URL détectée (${imageSizeKB.toFixed(0)}KB), taille acceptable`);
          }
        }
        
        openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini', // ⚡ Modèle le plus rapide
            messages: [
              {
                role: 'system',
                content: 'You are a senior ecommerce product analyst specialized in Etsy and dropshipping market validation. Respond ONLY in valid JSON. CRITICAL: Be strictly objective. Use the FULL scoring range 0-10. Do NOT default every product to 5-7. Bad products MUST score low (0-3). Good products should score high (8-10). Simple generic jewelry MUST score very low. Each product MUST get a unique score based on real market analysis.'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: optimizedImageUrl,
                      detail: 'low' // ⚡ CRITIQUE: 'low' réduit drastiquement le temps de traitement
                    }
                  },
                  {
                    type: 'text',
                    text: prompt
                  }
                ]
              }
            ],
            temperature: 0.7, // ⚠️ 0.7 = bon équilibre entre cohérence et différenciation entre produits
            max_tokens: 3500, // Augmenté pour les 6 critères détaillés + autres champs
            response_format: { type: 'json_object' },
            stream: false
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // Si la réponse est OK, sortir de la boucle
        if (openaiResponse.ok) {
          const openaiDuration = Date.now() - openaiStartTime;
          console.log(`✅ GPT-4o-mini responded successfully after ${openaiDuration}ms (tentative ${attempt + 1})`);
          break;
        }
        
        // Si erreur 429 (rate limit), attendre avant de retry
        if (openaiResponse.status === 429 && attempt < MAX_RETRIES) {
          const retryAfter = parseInt(openaiResponse.headers.get('retry-after') || '2');
          console.log(`⏳ Rate limit hit, waiting ${retryAfter}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        
        // Autre erreur, sortir de la boucle
        break;
        
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        lastError = fetchError;
        const elapsedTime = Date.now() - openaiStartTime;
        
        // Si c'est un timeout et qu'on peut retry
        if ((fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') && attempt < MAX_RETRIES) {
          console.warn(`⚠️ Timeout sur tentative ${attempt + 1}, retry dans 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2s avant retry
          continue;
        }
        
        // Si c'est une erreur réseau et qu'on peut retry
        if ((fetchError.message?.includes('fetch failed') || fetchError.message?.includes('network')) && attempt < MAX_RETRIES) {
          console.warn(`⚠️ Erreur réseau sur tentative ${attempt + 1}, retry dans 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // Sinon, gérer l'erreur normalement
        console.error('❌ Fetch error caught:', {
          name: fetchError?.name,
          message: fetchError?.message,
          attempt: attempt + 1,
          elapsedTime: `${elapsedTime}ms`,
        });
        
        if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
          console.error('⏱️ TIMEOUT - GPT-4o-mini timeout:', {
            elapsedTime: `${elapsedTime}ms`,
            timeoutLimit: `${INITIAL_TIMEOUT}ms`,
            attempts: attempt + 1,
            netlifyLimit: '50s',
          });
          return NextResponse.json({
            success: false,
            error: 'TIMEOUT',
            message: `GPT-4o-mini a timeout après ${Math.round(elapsedTime / 1000)} secondes (${attempt + 1} tentatives).`,
            troubleshooting: 'L\'API OpenAI peut être surchargée. Réessayez dans quelques instants.',
            elapsedTime: elapsedTime,
            timeoutLimit: INITIAL_TIMEOUT,
            attempts: attempt + 1,
            model: 'gpt-4o-mini',
          }, { status: 503 });
        }
        
        if (fetchError.message?.includes('fetch failed') || fetchError.message?.includes('network')) {
          console.error('🌐 NETWORK ERROR - Cannot reach OpenAI');
          return NextResponse.json({
            success: false,
            error: 'NETWORK_ERROR',
            message: 'Erreur de connexion au service OpenAI.',
            troubleshooting: 'Vérifiez votre connexion internet et réessayez.',
            attempts: attempt + 1,
          }, { status: 503 });
        }
        
        // Autre erreur de fetch
        console.error('❌ UNKNOWN FETCH ERROR');
        return NextResponse.json({
          success: false,
          error: 'FETCH_ERROR',
          message: 'Impossible de contacter le service OpenAI.',
          details: fetchError.message,
          troubleshooting: 'Vérifiez les logs Netlify pour plus de détails.',
          attempts: attempt + 1,
        }, { status: 503 });
      }
    }
    
    // Si on arrive ici sans réponse, c'est qu'on a épuisé les tentatives
    if (!openaiResponse) {
      const elapsedTime = Date.now() - openaiStartTime;
      return NextResponse.json({
        success: false,
        error: 'TIMEOUT',
        message: `GPT-4o-mini n'a pas répondu après ${MAX_RETRIES + 1} tentatives (${Math.round(elapsedTime / 1000)}s total).`,
        troubleshooting: 'L\'API OpenAI est peut-être surchargée. Réessayez dans quelques instants.',
        elapsedTime: elapsedTime,
        attempts: MAX_RETRIES + 1,
        model: 'gpt-4o-mini',
      }, { status: 503 });
    }

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({ error: 'parse_failed' }));
      console.error('❌ OpenAI API error response:', {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        errorData: JSON.stringify(errorData).substring(0, 500),
      });
      
      let message = 'Erreur API OpenAI';
      let errorCode = 'OPENAI_ERROR';
      
      if (openaiResponse.status === 401) {
        message = 'Clé API OpenAI invalide ou expirée. Vérifiez OPENAI_API_KEY dans Netlify.';
        errorCode = 'INVALID_API_KEY';
        console.error('🔑 INVALID API KEY - Check OPENAI_API_KEY in Netlify environment variables');
      }
      if (openaiResponse.status === 429) {
        message = 'Quota OpenAI dépassé - vérifiez vos crédits sur platform.openai.com';
        errorCode = 'QUOTA_EXCEEDED';
        console.error('💰 QUOTA EXCEEDED - Check OpenAI credits');
      }
      if (openaiResponse.status === 400) {
        message = errorData?.error?.message || 'Image inaccessible ou requête invalide';
        errorCode = 'BAD_REQUEST';
        console.error('📷 BAD REQUEST - Image or request format issue');
      }
      if (openaiResponse.status === 404) {
        message = 'Modèle GPT-4o non disponible sur ce compte. Vérifiez vos crédits OpenAI.';
        errorCode = 'MODEL_NOT_AVAILABLE';
        console.error('🤖 MODEL NOT AVAILABLE - GPT-4o not accessible');
      }
      
      return NextResponse.json({
        success: false,
        error: errorCode,
        message,
        status: openaiResponse.status,
        details: errorData?.error || errorData,
        troubleshooting: errorCode === 'INVALID_API_KEY' 
          ? 'Go to Netlify Dashboard → Site Settings → Environment Variables → Add OPENAI_API_KEY'
          : errorCode === 'QUOTA_EXCEEDED'
          ? 'Go to platform.openai.com → Billing → Add credits'
          : 'Check Netlify function logs for more details',
      }, { status: 500 });
    }

    let openaiData: any;
    try {
      openaiData = await openaiResponse.json();
      console.log('📥 OpenAI response structure:', {
        hasChoices: !!openaiData.choices,
        choicesLength: openaiData.choices?.length,
        hasContent: !!openaiData.choices?.[0]?.message?.content,
        contentLength: openaiData.choices?.[0]?.message?.content?.length,
      });
    } catch (jsonError: any) {
      console.error('❌ Failed to parse OpenAI JSON response:', jsonError);
      return NextResponse.json({
        success: false,
        error: 'PARSE_OPENAI_RESPONSE_ERROR',
        message: 'Impossible de parser la réponse OpenAI.',
        details: jsonError.message,
      }, { status: 500 });
    }
    
    const aiContent = openaiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error('❌ NO AI CONTENT in response:', {
        responseStructure: JSON.stringify(openaiData).substring(0, 500),
      });
      return NextResponse.json({
        success: false,
        error: 'NO_AI_RESPONSE',
        message: 'L\'IA n\'a pas fourni de contenu dans sa réponse.',
        troubleshooting: 'Vérifiez que GPT-4o est disponible et que vous avez des crédits.',
      }, { status: 500 });
    }
    
    console.log('✅ AI Content received, length:', aiContent.length, 'chars');

    let analysis: AIAnalysisResponse;
    try {
      // Nettoyer le contenu
      let cleanedContent = aiContent
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // Extraire le JSON même s'il y a du texte avant/après
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }
      
      analysis = JSON.parse(cleanedContent);
      
      console.log('✅ JSON parsed successfully');
      console.log('📊 Parsed analysis keys:', Object.keys(analysis));
      console.log('👁️ Has productVisualDescription:', !!analysis.productVisualDescription);
      console.log('🔍 Has etsySearchQuery:', !!analysis.etsySearchQuery);
      console.log('📈 Has estimatedCompetitors:', !!analysis.estimatedCompetitors);
    } catch (parseError: any) {
      console.error('❌ Parse error:', parseError);
      console.error('Raw response (first 1000 chars):', aiContent.substring(0, 1000));
      
      // Dernière tentative: extraire manuellement les champs essentiels
      try {
        const titleMatch = aiContent.match(/"productVisualDescription"\s*:\s*"([^"]+)"/i) ||
                          aiContent.match(/productVisualDescription["']?\s*[:=]\s*["']([^"']+)/i);
        const queryMatch = aiContent.match(/"etsySearchQuery"\s*:\s*"([^"]+)"/i) ||
                          aiContent.match(/etsySearchQuery["']?\s*[:=]\s*["']([^"']+)/i);
        const competitorMatch = aiContent.match(/"estimatedCompetitors"\s*:\s*(\d+)/i) ||
                               aiContent.match(/estimatedCompetitors["']?\s*[:=]\s*(\d+)/i);
        
        if (titleMatch || queryMatch) {
          console.warn('⚠️ Using fallback extraction from parse error');
          analysis = {
            canIdentifyProduct: true,
            productVisualDescription: titleMatch?.[1] || 'Product from image',
            etsySearchQuery: queryMatch?.[1] || 'product gift handmade',
            estimatedSupplierPrice: 10,
            estimatedShippingCost: 5,
            supplierPriceReasoning: 'Default estimation',
            decision: 'LANCER_CONCURRENTIEL',
            confidenceScore: 50,
            scoringBreakdown: {
              market_demand: { score: 5, analysis: 'Default estimation - unable to parse AI response.' },
              competition_intensity: { score: 5, analysis: 'Default estimation - unable to parse AI response.' },
              differentiation_potential: { score: 5, analysis: 'Default estimation - unable to parse AI response.' },
              profit_margin_potential: { score: 5, analysis: 'Default estimation - unable to parse AI response.' },
              impulse_buy_potential: { score: 5, analysis: 'Default estimation - unable to parse AI response.' },
              scalability_potential: { score: 5, analysis: 'Default estimation - unable to parse AI response.' },
            },
            launchPotentialScore: 5.0,
            classification: 'HIGH RISK',
            launchPotentialScoreJustification: 'Score par défaut - l\'analyse IA n\'a pas pu être complètement parsée.',
            estimatedCompetitors: competitorMatch ? parseInt(competitorMatch[1]) : 50,
            competitorEstimationReasoning: 'Estimation par défaut',
            competitorEstimationReliable: false,
            saturationLevel: 'concurrentiel',
            saturationAnalysis: 'Marché concurrentiel',
            averageMarketPrice: 25,
            marketPriceRange: { min: 15, max: 35 },
            marketPriceReasoning: 'Estimation basée sur le marché',
            supplierPrice: 10,
            minimumViablePrice: 14.99,
            recommendedPrice: {
              optimal: 29.99,
              min: 19.99,
              max: 39.99,
            },
            priceRiskLevel: 'moyen',
            pricingAnalysis: 'Prix recommandé basé sur les estimations',
            launchSimulation: {
              timeToFirstSale: {
                withoutAds: { min: 7, max: 21 },
                withAds: { min: 3, max: 10 },
              },
              salesAfter3Months: {
                prudent: 5,
                realiste: 15,
                optimise: 30,
              },
              simulationNote: 'Estimation basée sur le marché',
            },
            viralTitleEN: 'Product - Handmade Gift',
            seoTags: ['gift', 'handmade', 'product', 'unique', 'custom', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'],
            finalVerdict: 'Product can be launched with proper optimization',
            warningIfAny: null,
            nicheMatch: true,
            nicheMatchReasoning: 'Correspondance assumée par défaut (fallback API).',
          } as AIAnalysisResponse;
          
          console.log('✅ Using fallback analysis data');
        } else {
          throw parseError; // Re-throw si on ne peut pas extraire
        }
      } catch (fallbackError) {
        return NextResponse.json({
          success: false,
          error: 'PARSE_ERROR',
          message: 'Impossible de parser la réponse de l\'IA',
          details: parseError.message,
          rawResponse: aiContent.substring(0, 500),
        }, { status: 500 });
      }
    }

    // Validation avec fallback généreux - ne bloquer que si vraiment impossible
    if (!analysis.canIdentifyProduct) {
      console.warn('⚠️ AI could not identify product, but continuing with fallback');
      // Ne pas bloquer - utiliser la description comme fallback
      if (!analysis.productVisualDescription) {
        analysis.productVisualDescription = 'Produit non clairement identifiable - analyse basée sur les estimations';
      }
      // Forcer à true pour continuer l'analyse
      analysis.canIdentifyProduct = true;
    }

    // Si pas de requête Etsy, en générer une depuis la description
    if (!analysis.etsySearchQuery || analysis.etsySearchQuery.trim() === '') {
      console.warn('⚠️ No Etsy query generated, creating fallback from description');
      
      // Extraire des mots-clés de la description visuelle
      const description = analysis.productVisualDescription || '';
      const words = description
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 3 && !['the', 'and', 'for', 'with', 'this', 'that', 'product', 'item'].includes(w))
        .slice(0, 5);
      
      analysis.etsySearchQuery = words.length > 0 
        ? words.join(' ') 
        : 'product gift handmade';
      
      console.log('✅ Generated fallback Etsy query:', analysis.etsySearchQuery);
    }
    
    // Validation finale des champs critiques avec valeurs par défaut
    if (!analysis.estimatedCompetitors || analysis.estimatedCompetitors <= 0) {
      console.warn('⚠️ No competitor estimate, using default');
      analysis.estimatedCompetitors = 50; // Valeur par défaut
      analysis.competitorEstimationReliable = false;
      analysis.competitorEstimationReasoning = 'Estimation par défaut - données limitées';
    }
    
    if (!analysis.decision) {
      console.warn('⚠️ No decision provided, using default');
      analysis.decision = 'LANCER_CONCURRENTIEL';
      analysis.confidenceScore = 50;
    }
    
    if (!analysis.saturationLevel) {
      analysis.saturationLevel = analysis.estimatedCompetitors <= 100 ? 'non_sature' : 
                                  analysis.estimatedCompetitors <= 130 ? 'concurrentiel' : 'sature';
    }
    
    // Validation de la correspondance niche/produit avec valeurs par défaut
    if (analysis.nicheMatch === undefined) {
      console.warn('⚠️ nicheMatch non défini, utilisation de la valeur par défaut (true)');
      analysis.nicheMatch = true; // Par défaut, on assume que le produit correspond (rétrocompatibilité)
      analysis.nicheMatchReasoning = 'Correspondance assumée par défaut (champ non fourni par l\'IA).';
    } else if (!analysis.nicheMatchReasoning) {
      // Si nicheMatch est défini mais pas le raisonnement, ajouter un raisonnement par défaut
      analysis.nicheMatchReasoning = analysis.nicheMatch 
        ? 'Le produit correspond à la niche sélectionnée.'
        : 'Le produit ne correspond pas à la niche sélectionnée.';
    }
    
    // S'assurer que les prix recommandés existent (avec règles strictes)
    if (!analysis.recommendedPrice) {
      const supplierPrice = analysis.estimatedSupplierPrice || 10;
      const shippingCost = analysis.estimatedShippingCost || 5;
      const totalCost = supplierPrice + shippingCost;
      const avgMarketPrice = analysis.averageMarketPrice || totalCost * 3.5;
      
      // Appliquer les règles strictes du cahier des charges
      const MULTIPLIER_THRESHOLD = 70;
      const requiredMultiplier = totalCost < MULTIPLIER_THRESHOLD ? 3 : 2;
      const minimumPrice = Math.max(14.99, totalCost * requiredMultiplier);
      
      // Positionnement au-dessus du prix moyen (coefficient 1.10 par défaut)
      const marketBasedPrice = avgMarketPrice * 1.10;
      const recommendedPrice = Math.max(minimumPrice, marketBasedPrice);
      
      // Vérification finale de non-perte
      if (recommendedPrice <= totalCost) {
        // Forcer au minimum le multiplicateur si le marché est trop bas
        const finalPrice = totalCost * requiredMultiplier * 1.1;
        analysis.recommendedPrice = {
          optimal: finalPrice,
          min: minimumPrice,
          max: finalPrice * 1.3,
        };
      } else {
        analysis.recommendedPrice = {
          optimal: recommendedPrice,
          min: minimumPrice,
          max: recommendedPrice * 1.3,
        };
      }
    }
    
    // Validation finale : s'assurer que le prix recommandé respecte les règles strictes
    if (analysis.recommendedPrice && analysis.estimatedSupplierPrice && analysis.estimatedShippingCost) {
      const totalCost = analysis.estimatedSupplierPrice + analysis.estimatedShippingCost;
      const MULTIPLIER_THRESHOLD = 70;
      const requiredMultiplier = totalCost < MULTIPLIER_THRESHOLD ? 3 : 2;
      const absoluteMinimum = totalCost * requiredMultiplier;
      
      // Vérifier si le prix recommandé respecte le multiplicateur minimum
      if (analysis.recommendedPrice.optimal <= totalCost || analysis.recommendedPrice.optimal < absoluteMinimum) {
        console.warn('⚠️ Prix recommandé invalide, correction appliquée pour respecter le multiplicateur minimum');
        const correctedPrice = Math.max(absoluteMinimum, totalCost * requiredMultiplier * 1.1);
        analysis.recommendedPrice.optimal = Math.max(correctedPrice, 14.99);
        analysis.recommendedPrice.min = Math.max(absoluteMinimum, 14.99);
      }
      
      // Vérifier aussi le prix minimum
      if (analysis.recommendedPrice.min < absoluteMinimum) {
        analysis.recommendedPrice.min = Math.max(absoluteMinimum, 14.99);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // VALIDATION : GARANTIR EXACTEMENT 13 TAGS SEO (OBLIGATOIRE)
    // ═══════════════════════════════════════════════════════════════════════════════
    const ensure13Tags = (tags: string[] | undefined, productTitle?: string, niche?: string): string[] => {
      const REQUIRED_TAG_COUNT = 13;
      
      if (!tags || tags.length === 0) {
        tags = [];
      }
      
      // Nettoyer et normaliser les tags existants
      let cleanTags = tags
        .filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0)
        .map(tag => tag.trim().toLowerCase().substring(0, 20)) // Max 20 chars
        .filter((tag, index, self) => self.indexOf(tag) === index) // Supprimer les doublons
        .slice(0, REQUIRED_TAG_COUNT);
      
      // Tags génériques pour compléter si nécessaire
      const genericTags = [
        'handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan',
        'quality', 'premium', 'special', 'original', 'trendy', 'stylish', 'modern',
        'vintage', 'elegant', 'beautiful', 'perfect', 'lovely', 'charming', 'cute',
        'minimalist', 'bohemian', 'rustic', 'contemporary', 'classic', 'sustainable',
      ];
      
      // Extraire des mots-clés du titre du produit si disponible
      const productKeywords: string[] = [];
      if (productTitle) {
        const words = productTitle.toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 3 && w.length < 20)
          .slice(0, 5);
        productKeywords.push(...words);
      }
      
      // Ajouter le nom de la niche si disponible
      if (niche) {
        const nicheWords = niche.toLowerCase().split(/[-_\s]+/).filter(w => w.length > 2);
        productKeywords.push(...nicheWords);
      }
      
      // Combiner tous les tags possibles
      const allPossibleTags = [
        ...cleanTags,
        ...productKeywords.filter(t => !cleanTags.includes(t)),
        ...genericTags.filter(t => !cleanTags.includes(t) && !productKeywords.includes(t)),
      ];
      
      // Prendre exactement 13 tags
      let finalTags = allPossibleTags.slice(0, REQUIRED_TAG_COUNT);
      
      // Si on n'a toujours pas 13 tags, compléter avec des tags numérotés
      while (finalTags.length < REQUIRED_TAG_COUNT) {
        finalTags.push(`tag${finalTags.length + 1}`);
      }
      
      return finalTags.slice(0, REQUIRED_TAG_COUNT);
    };
    
    // ⚠️ CRITICAL: Valider et corriger le titre viral - TOUJOURS garantir minimum 100 caractères
    if (analysis.viralTitleEN) {
      const titleLength = analysis.viralTitleEN.length;
      if (titleLength < 100) {
        console.warn(`⚠️ Titre viral trop court (${titleLength} caractères au lieu de minimum 100), extension appliquée`);
        // Étendre le titre avec des mots-clés viraux supplémentaires
        const viralKeywords = [
          'Premium Quality', 'Handcrafted', 'Exquisite', 'Stunning', 'Beautiful',
          'Perfect Gift', 'Thoughtful Present', 'Memorable Keepsake', 'Luxury',
          'Custom Made', 'Personalized', 'Unique Design', 'Artisan Made'
        ];
        let extendedTitle = analysis.viralTitleEN;
        for (const keyword of viralKeywords) {
          if (extendedTitle.length >= 140) break;
          if (!extendedTitle.toLowerCase().includes(keyword.toLowerCase())) {
            extendedTitle += ` ${keyword}`;
            if (extendedTitle.length >= 100 && extendedTitle.length <= 140) break;
          }
        }
        // Si toujours trop court, ajouter des contextes d'usage
        if (extendedTitle.length < 100) {
          const usageContexts = [
            'for Her', 'for Him', 'Home Decor', 'Office Decor', 'Gift Idea',
            'Birthday Gift', 'Anniversary Present', 'Wedding Favor', 'Housewarming Gift'
          ];
          for (const context of usageContexts) {
            if (extendedTitle.length >= 140) break;
            if (!extendedTitle.toLowerCase().includes(context.toLowerCase())) {
              extendedTitle += ` ${context}`;
              if (extendedTitle.length >= 100 && extendedTitle.length <= 140) break;
            }
          }
        }
        // Si toujours trop court après tous les ajouts, compléter avec des mots-clés génériques
        if (extendedTitle.length < 100) {
          const genericKeywords = ['Premium Quality', 'Handcrafted', 'Unique Design', 'Perfect Gift', 'Thoughtful Present'];
          for (const keyword of genericKeywords) {
            if (extendedTitle.length >= 140) break;
            if (!extendedTitle.toLowerCase().includes(keyword.toLowerCase())) {
              extendedTitle += ` ${keyword}`;
              if (extendedTitle.length >= 100 && extendedTitle.length <= 140) break;
            }
          }
        }
        // Limiter à 140 caractères maximum
        if (extendedTitle.length > 140) {
          extendedTitle = extendedTitle.substring(0, 137) + '...';
        }
        // Vérification finale - garantir au minimum 100 caractères
        if (extendedTitle.length < 100) {
          extendedTitle += ' Premium Quality Handcrafted Gift Unique Design Perfect Present';
          if (extendedTitle.length > 140) {
            extendedTitle = extendedTitle.substring(0, 137) + '...';
          }
        }
        analysis.viralTitleEN = extendedTitle;
        console.log(`✅ Titre viral étendu: ${analysis.viralTitleEN.length} caractères (minimum 100 requis)`);
      } else if (titleLength > 140) {
        console.warn(`⚠️ Titre viral trop long (${titleLength} caractères), tronqué à 140`);
        analysis.viralTitleEN = analysis.viralTitleEN.substring(0, 137) + '...';
      }
    }
    
    // ⚠️ CRITICAL: Valider et corriger les tags SEO - TOUJOURS garantir 13 tags
    // Cette vérification est OBLIGATOIRE même si l'IA génère moins de 13 tags
    if (!analysis.seoTags || analysis.seoTags.length !== 13) {
      console.warn(`⚠️ Tags SEO invalides (${analysis.seoTags?.length || 0} au lieu de 13), correction appliquée`);
      analysis.seoTags = ensure13Tags(
        analysis.seoTags || [],
        body.productTitle || '',
        niche || ''
      );
      // Vérification finale - si on n'a toujours pas 13 tags, c'est une erreur critique
      if (analysis.seoTags.length !== 13) {
        console.error(`❌ ERREUR CRITIQUE: Impossible de générer 13 tags (${analysis.seoTags.length} tags générés)`);
        // Forcer 13 tags en complétant avec des tags génériques
        const genericFallback = ['handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'];
        analysis.seoTags = [...analysis.seoTags, ...genericFallback].slice(0, 13);
      }
    }
    
    // Vérification finale absolue - garantir 13 tags
    if (analysis.seoTags.length < 13) {
      console.error(`❌ ERREUR CRITIQUE: Moins de 13 tags après correction (${analysis.seoTags.length}), complétion forcée`);
      const additionalTags = ['handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'];
      while (analysis.seoTags.length < 13) {
        const tagToAdd = additionalTags[analysis.seoTags.length % additionalTags.length];
        if (!analysis.seoTags.includes(tagToAdd)) {
          analysis.seoTags.push(tagToAdd);
        } else {
          analysis.seoTags.push(`${tagToAdd}${analysis.seoTags.length}`);
        }
      }
      analysis.seoTags = analysis.seoTags.slice(0, 13);
    }

    // ⚠️ CRITICAL: Increment quota AFTER successful analysis (2 credits)
    // Quota was already checked before analysis started, now we increment it
    console.log(`[AI ANALYZE] ⚠️ About to decrement 2 credits for analysis and simulation (user: ${user.id})`);
    
    try {
      const quotaResult = await incrementAnalysisCount(user.id, 2.0);
      if (!quotaResult.success) {
        console.error('❌ [AI ANALYZE] Failed to increment quota after analysis:', quotaResult.error);
        console.error('[AI ANALYZE] Quota result details:', JSON.stringify(quotaResult, null, 2));
        // ⚠️ CRITICAL: If quota deduction fails, throw error to prevent free usage
        throw new Error(`Failed to deduct credits: ${quotaResult.error || 'Unknown error'}`);
      } else {
        console.log('✅ [AI ANALYZE] Quota incremented successfully after analysis:', {
          used: quotaResult.used,
          quota: quotaResult.quota,
          remaining: quotaResult.remaining,
          amount: 2.0,
        });
      }
    } catch (quotaError: any) {
      console.error(`❌ [AI ANALYZE] CRITICAL ERROR: Failed to deduct credits:`, quotaError.message);
      console.error(`[AI ANALYZE] Error stack:`, quotaError.stack);
      // ⚠️ CRITICAL: Return error if credits cannot be deducted
      return NextResponse.json({
        success: false,
        error: 'QUOTA_DEDUCTION_FAILED',
        message: `Failed to deduct credits: ${quotaError.message}. Please contact support.`,
        analysis: analysis, // Return analysis anyway but log the error
      }, { status: 500 });
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATION DU SCORE: 6-criteria weighted scoring system
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Assurer que confidenceScore reste dans les bornes
    if (!analysis.confidenceScore) analysis.confidenceScore = 50;
    if (analysis.confidenceScore < 30) analysis.confidenceScore = 30;
    if (analysis.confidenceScore > 95) analysis.confidenceScore = 95;
    
    // If the AI returned the new format with top-level criteria (from the new prompt), map to scoringBreakdown
    if (!analysis.scoringBreakdown) {
      const rawAny = analysis as any;
      if (rawAny.market_demand && rawAny.competition_intensity) {
        analysis.scoringBreakdown = {
          market_demand: rawAny.market_demand,
          competition_intensity: rawAny.competition_intensity,
          differentiation_potential: rawAny.differentiation_potential,
          profit_margin_potential: rawAny.profit_margin_potential,
          impulse_buy_potential: rawAny.impulse_buy_potential,
          scalability_potential: rawAny.scalability_potential,
        };
        if (rawAny.final_weighted_score) {
          analysis.launchPotentialScore = rawAny.final_weighted_score;
        }
        if (rawAny.strategic_summary) {
          analysis.launchPotentialScoreJustification = rawAny.strategic_summary;
        }
        if (rawAny.classification) {
          analysis.classification = rawAny.classification;
        }
        console.log('✅ Mapped top-level scoring fields to scoringBreakdown');
      }
    }
    
    // Si scoringBreakdown existe, recalculer le score pondéré pour vérification
    if (analysis.scoringBreakdown) {
      const sb = analysis.scoringBreakdown;
      // Clamp each criterion score to 0-10
      const criteria = ['market_demand', 'competition_intensity', 'differentiation_potential', 'profit_margin_potential', 'impulse_buy_potential', 'scalability_potential'] as const;
      for (const key of criteria) {
        if (sb[key]) {
          sb[key].score = Math.max(0, Math.min(10, sb[key].score));
        }
      }
      // Recalculate weighted score to ensure consistency
      const recalculated = (
        (sb.market_demand?.score || 0) * 0.25 +
        (sb.competition_intensity?.score || 0) * 0.20 +
        (sb.differentiation_potential?.score || 0) * 0.15 +
        (sb.profit_margin_potential?.score || 0) * 0.20 +
        (sb.impulse_buy_potential?.score || 0) * 0.10 +
        (sb.scalability_potential?.score || 0) * 0.10
      );
      analysis.launchPotentialScore = Math.round(recalculated * 10) / 10;
      
      console.log('📊 Scoring breakdown:', {
        market_demand: sb.market_demand?.score,
        competition_intensity: sb.competition_intensity?.score,
        differentiation_potential: sb.differentiation_potential?.score,
        profit_margin_potential: sb.profit_margin_potential?.score,
        impulse_buy_potential: sb.impulse_buy_potential?.score,
        scalability_potential: sb.scalability_potential?.score,
        recalculated_weighted: analysis.launchPotentialScore,
      });
    }
    
    // Assurer que launchPotentialScore reste dans les bornes
    if (analysis.launchPotentialScore !== undefined) {
      if (analysis.launchPotentialScore < 0) analysis.launchPotentialScore = 0;
      if (analysis.launchPotentialScore > 10) analysis.launchPotentialScore = 10;
      analysis.launchPotentialScore = Math.round(analysis.launchPotentialScore * 10) / 10;
    }
    
    // Déterminer la classification si pas fournie
    if (!analysis.classification && analysis.launchPotentialScore !== undefined) {
      const s = analysis.launchPotentialScore;
      if (s < 4) analysis.classification = 'NOT RECOMMENDED';
      else if (s < 6) analysis.classification = 'HIGH RISK';
      else if (s < 7.5) analysis.classification = 'MODERATE OPPORTUNITY';
      else if (s <= 8.5) analysis.classification = 'STRONG OPPORTUNITY';
      else analysis.classification = 'EXCEPTIONAL OPPORTUNITY';
    }
    
    console.log('📊 AI scores:', {
      launchPotentialScore: analysis.launchPotentialScore,
      classification: analysis.classification,
      confidenceScore: analysis.confidenceScore,
      hasScoringBreakdown: !!analysis.scoringBreakdown,
      launchPotentialScoreJustification: analysis.launchPotentialScoreJustification?.substring(0, 100),
    });
    
    const responseTime = Date.now() - openaiStartTime;
    console.log('✅ Analysis completed successfully:', {
      model: usedModel,
      responseTime: `${responseTime}ms`,
      promptLength: prompt.length,
      finalConfidenceScore: analysis.confidenceScore,
    });
    
    return NextResponse.json({
      success: true,
      analysis,
      model: usedModel,
      usedVision: true,
      analyzedAt: new Date().toISOString(),
      responseTime: responseTime,
    });

  } catch (error) {
    console.error('AI Analysis error:', error);
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erreur interne',
      details: String(error),
    }, { status: 500 });
  } finally {
    // ⚠️ Libérer le verrou dans tous les cas (succès ou échec)
    isAnalyzing = false;
    currentAnalysisPromise = null;
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Etsmart AI Vision Analysis',
    version: '3.1.0',
    model: 'gpt-4o-mini', // ⚡ Modèle ultra-rapide
    features: ['Vision AI', 'Price Estimation', 'Competitor Analysis'],
    status: process.env.OPENAI_API_KEY ? 'ready' : 'missing_api_key',
    expectedResponseTime: '<20s',
  });
}
