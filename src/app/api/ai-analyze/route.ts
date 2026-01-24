import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSubscriptionAndQuota } from '@/lib/middleware/subscription';
import { incrementAnalysisCount } from '@/lib/subscription-quota';

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

interface AIAnalysisResponse {
  decision: string;
  confidenceScore: number;
  
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
  
  // SEO & Marketing
  viralTitleEN: string;
  viralTitleFR: string;
  seoTags: string[];
  marketingAngles: {
    angle: string;
    why: string;
    targetAudience: string;
  }[];
  
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
  strengths: string[];
  risks: string[];
  finalVerdict: string;
  warningIfAny: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERROU GLOBAL POUR EMPÊCHER LES ANALYSES SIMULTANÉES
// ═══════════════════════════════════════════════════════════════════════════════
let isAnalyzing = false;
let currentAnalysisPromise: Promise<any> | null = null;

export async function POST(request: NextRequest) {
  // ⚠️ PAYWALL PROTECTION : Vérifier l'abonnement et le quota
  const paywallCheck = await requireActiveSubscriptionAndQuota(request);
  if (paywallCheck) {
    return paywallCheck; // Retourne l'erreur de paywall
  }
  
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
    // PROMPT AVEC ESTIMATION DU PRIX FOURNISSEUR
    // ═══════════════════════════════════════════════════════════════════════════
    
    // ⚡ PROMPT OPTIMISÉ POUR RÉPONSE RAPIDE (<45s)
    // Version condensée qui garde toutes les fonctionnalités essentielles
    const prompt = `Etsmart VISION EXPERT - Analyse e-commerce rapide.

📸 1. VISION: Identifie le produit (type, matériaux, complexité). Description 1-2 phrases.

💰 2. PRIX FOURNISSEUR: ${productPrice > 0 ? `Prix utilisateur: $${productPrice}` : 'Prix non fourni'}
Estime prix AliExpress/Alibaba selon:
- Bijoux simples: $0.50-3 | Personnalisés: $2-8 | Colliers: $3-12
- Déco simple: $2-15 | Déco 3D: $8-35 | Lampes: $10-50
- Accessoires animaux: $1-25 | Vêtements: $3-15 | Tech: $2-15
- Stickers: $0.50-5 | Cuisine: $2-15 | Sacs: $3-20
Livraison: Léger (<100g): $1-3 | Moyen (100-500g): $3-8 | Lourd (>500g): $8-20

🎯 3. REQUÊTE ETSY: 4-7 mots anglais, comme un acheteur chercherait. Pas de mots marketing.

📊 4. CONCURRENTS: Estime le nombre de BOUTIQUES (pas listings) sur Etsy.
RÈGLES: Chaque produit est unique - varie tes estimations (ex: bracelet personnalisé 15-40, mug 80-150, t-shirt 200-400).
Méthode: 1 requête Etsy → observe premières pages → regroupe par boutique → estime précisément.
DÉCISION: 0-40 boutiques="non_sature"→LANCER | 41-90="concurrentiel"→LANCER_CONCURRENTIEL | 91+="sature"→NE_PAS_LANCER
PRIX MARCHÉ: Analyse listings comparables, exclut prix anormaux, fournis fourchette crédible.

💵 5. PRIX VENTE OPTIMAL (RÈGLES STRICTES OBLIGATOIRES):
Niche=${niche} | Profil=NOUVELLE BOUTIQUE

RÈGLES ABSOLUES À RESPECTER:
❌ JAMAIS: prix recommandé ≤ coût fournisseur total (produit + livraison)
✅ MULTIPLICATEURS MINIMUM OBLIGATOIRES:
   - Produits < 70€: prix recommandé ≥ coût fournisseur × 3
   - Produits ≥ 70€: prix recommandé ≥ coût fournisseur × 2
✅ POSITIONNEMENT: Par défaut, prix recommandé > prix moyen Etsy (coefficient 1.05-1.30)

CALCUL EN 3 ÉTAPES:
1. Prix minimum = max(coût × multiplicateur, coût × 1.20)
2. Prix marché = prix moyen Etsy × coefficient_positionnement (1.05-1.30)
3. Prix recommandé = max(prix minimum, prix marché)

JUSTIFICATION REQUISE: Explique clairement le calcul (coût fournisseur, multiplicateur appliqué, positionnement marché, marge).

🏷️ 6. TAGS SEO ETSY (OBLIGATOIRE):
EXACTEMENT 13 tags (pas moins, pas plus). Chaque tag max 20 caractères.
Tags pertinents pour le produit, la niche, et le marché Etsy.

📋 JSON REQUIS (MARKETING SUPPRIMÉ POUR VITESSE):
{"canIdentifyProduct":bool,"productVisualDescription":"description 1-2 phrases","etsySearchQuery":"4-7 mots anglais",
"estimatedSupplierPrice":nb,"estimatedShippingCost":nb,"supplierPriceReasoning":"1-2 phrases",
"decision":"LANCER|LANCER_CONCURRENTIEL|NE_PAS_LANCER","confidenceScore":30-95,
"estimatedCompetitors":nb VARIÉ (niche:5-30, modéré:31-80, populaire:81-130, très populaire:131-250, saturé:250+),
"competitorEstimationReasoning":"méthodologie","competitorEstimationReliable":bool,
"saturationLevel":"non_sature|concurrentiel|sature","saturationAnalysis":"2 phrases",
"averageMarketPrice":nb,"marketPriceRange":{"min":nb,"max":nb},"marketPriceReasoning":"explication",
"supplierPrice":nb,"minimumViablePrice":nb (DOIT être > coût fournisseur total),"recommendedPrice":{"optimal":nb (DOIT être > prix moyen Etsy et > minimumViablePrice),"min":nb (prix minimum autorisé),"max":nb},
"priceRiskLevel":"faible|moyen|eleve","pricingAnalysis":"2-3 phrases",
"launchSimulation":{"timeToFirstSale":{"withoutAds":{"min":jours,"max":jours},"withAds":{"min":jours,"max":jours}},
"salesAfter3Months":{"prudent":nb,"realiste":nb,"optimise":nb},"simulationNote":"2 phrases"},
"viralTitleEN":"max 140 chars","viralTitleFR":"version FR","seoTags":["EXACTEMENT 13 tags OBLIGATOIRES (pas moins), max 20 chars chacun, séparés par des virgules"],
"marketingAngles":[{"angle":"nom","why":"pourquoi","targetAudience":"cible"}],
"strengths":["force1","force2","force3"],"risks":["risque1","risque2","risque3"],
"finalVerdict":"2-3 phrases","warningIfAny":"avertissement ou null"}`;

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
      temperature: 0.2,
      model: 'gpt-4o-mini',
      timeout: '30s',
      netlifyLimit: '50s',
    });
    
    const openaiStartTime = Date.now();
    let openaiResponse: Response;
    const usedModel = 'gpt-4o-mini'; // ⚡ UTILISER DIRECTEMENT GPT-4O-MINI (le plus rapide)
    
    // ⚡ SOLUTION RADICALE: Utiliser directement GPT-4o-mini (le plus rapide)
    // Timeout à 30s pour éviter les timeouts prématurés (sous la limite Netlify de 50s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏱️ GPT-4o-mini timeout après 30s');
      controller.abort();
    }, 30000); // 30 secondes max (GPT-4o-mini répond généralement en 15-25s)
    
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // ⚡ Modèle le plus rapide directement
          messages: [
            {
              role: 'system',
              content: 'Expert e-commerce. Réponds UNIQUEMENT en JSON valide.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: productImageUrl,
                    detail: 'low' // 'low' pour vitesse maximale
                  }
                },
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }
          ],
          temperature: 0.2,
          max_tokens: 1000, // ⚡ RÉDUIT à 1000 (marketing supprimé = réponse plus courte)
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const openaiDuration = Date.now() - openaiStartTime;
      console.log('✅ GPT-4o-mini responded successfully after', openaiDuration, 'ms');
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const elapsedTime = Date.now() - openaiStartTime;
      
      // Gestion des erreurs de réseau/timeout
      console.error('❌ Fetch error caught:', {
        name: fetchError?.name,
        message: fetchError?.message,
        model: usedModel,
        elapsedTime: `${elapsedTime}ms`,
        stack: fetchError?.stack?.substring(0, 300),
      });
      
      if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
        console.error('⏱️ TIMEOUT - GPT-4o-mini timeout:', {
          elapsedTime: `${elapsedTime}ms`,
          timeoutLimit: '30s',
          netlifyLimit: '50s',
          reason: 'GPT-4o-mini n\'a pas répondu dans les 30s. Vérifiez les logs Netlify.',
        });
        return NextResponse.json({
          success: false,
          error: 'TIMEOUT',
          message: `GPT-4o-mini a timeout après ${Math.round(elapsedTime / 1000)} secondes. Normalement il répond en 15-25s.`,
          troubleshooting: 'Vérifiez les logs Netlify. L\'API OpenAI peut être surchargée ou votre connexion lente.',
          elapsedTime: elapsedTime,
          timeoutLimit: 30000,
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
            viralTitleFR: 'Produit - Cadeau Fait Main',
            seoTags: ['gift', 'handmade', 'product', 'unique', 'custom', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'],
            marketingAngles: [{
              angle: 'Gift',
              why: 'Ideal gift',
              targetAudience: 'Gift buyers',
            }],
            strategicMarketing: {
              positioning: {
                mainPositioning: 'Gift product',
                justification: 'Based on market analysis',
                competitiveAdvantage: 'Quality',
              },
              underexploitedAngles: [],
              competitorMistakes: [],
              visualRecommendations: [],
              psychologicalTriggers: [],
              anglesToAvoid: [],
            },
            acquisitionMarketing: {
              targetAudience: {
                ageRange: '25-45',
                situation: 'General',
                buyingBehavior: 'reflective',
                description: 'General audience',
              },
              acquisitionChannel: {
                primary: 'facebook',
                justification: 'Suitable for Facebook',
                notSuitableForTikTok: false,
              },
              tiktokIdeas: [],
              facebookIdeas: [],
            },
            strengths: ['Product quality'],
            risks: ['Market competition'],
            finalVerdict: 'Product can be launched with proper optimization',
            warningIfAny: null,
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
    
    // Valider et corriger les tags SEO
    if (!analysis.seoTags || analysis.seoTags.length !== 13) {
      console.warn(`⚠️ Tags SEO invalides (${analysis.seoTags?.length || 0} au lieu de 13), correction appliquée`);
      analysis.seoTags = ensure13Tags(
        analysis.seoTags || [],
        body.productTitle || '',
        niche || ''
      );
    }

    const responseTime = Date.now() - openaiStartTime;
    console.log('✅ Analysis completed successfully:', {
      model: usedModel,
      responseTime: `${responseTime}ms`,
      promptLength: prompt.length,
    });
    
    // ⚠️ PAYWALL : Incrémenter le compteur d'analyses (côté serveur uniquement)
    try {
      const incrementResult = await incrementAnalysisCount(user.id);
      if (!incrementResult.success) {
        console.error('⚠️ Failed to increment analysis count:', incrementResult.error);
        // On continue quand même - l'analyse est déjà faite
      } else {
        console.log('✅ Analysis count incremented:', {
          used: incrementResult.used,
          quota: incrementResult.quota,
          remaining: incrementResult.remaining,
        });
      }
    } catch (quotaError: any) {
      console.error('⚠️ Error incrementing quota:', quotaError);
      // On continue quand même - l'analyse est déjà faite
    }
    
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
