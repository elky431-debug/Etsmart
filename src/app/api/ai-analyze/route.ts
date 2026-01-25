import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSubscriptionAndQuota } from '@/lib/middleware/subscription';
import { incrementAnalysisCount } from '@/lib/subscription-quota';
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
  
  // Strengths & Risks
  strengths: string[];
  risks: string[];
  
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
    
    // ⚡ PROMPT COMPLET ET DÉTAILLÉ POUR ANALYSE PRÉCISE
    // IMPORTANT: Avec response_format: json_object, le prompt DOIT explicitement demander du JSON
    const prompt = `Tu es un expert e-commerce de niveau international, spécialisé dans l'analyse approfondie de produits pour la plateforme Etsy. Ta mission est d'analyser ce produit avec une précision maximale et de fournir une évaluation complète et détaillée qui aidera un vendeur à prendre une décision éclairée.

═══════════════════════════════════════════════════════════════════════════════
CONTEXTE DE L'ANALYSE
═══════════════════════════════════════════════════════════════════════════════

- Niche du produit: ${niche}
- Prix fournisseur indiqué: ${productPrice > 0 ? `$${productPrice}` : 'non fourni (à estimer)'}
- Image du produit: Analyse l'image fournie pour identifier tous les détails visuels

═══════════════════════════════════════════════════════════════════════════════
INSTRUCTIONS DÉTAILLÉES PAR SECTION
═══════════════════════════════════════════════════════════════════════════════

1. ANALYSE VISUELLE DU PRODUIT (VISION):
   - Examine attentivement l'image du produit
   - Décris le produit que tu vois dans l'image en 1 phrase claire, précise et descriptive
   - Indique clairement si tu peux identifier le produit (canIdentifyProduct: true/false)
   - Sois très spécifique sur les caractéristiques visibles:
     * Couleurs dominantes et accents
     * Forme générale et dimensions apparentes
     * Matériaux visibles (métal, plastique, tissu, bois, etc.)
     * Style et esthétique (moderne, vintage, minimaliste, etc.)
     * Détails distinctifs (textures, motifs, finitions)
   - Si le produit n'est pas clairement identifiable, indique-le mais fournis quand même une description basée sur ce que tu peux voir

2. ESTIMATION DU PRIX FOURNISSEUR:
   - Estime le coût d'achat probable chez le fournisseur (AliExpress/Alibaba) selon la niche:
     * Bijoux et accessoires: $0.5-12 (dépend de la complexité et des matériaux)
     * Décoration et objets d'art: $2-35 (dépend de la taille et de la qualité)
     * Autres catégories: $1-25 (estimation générale)
   - Estime les frais de livraison depuis le fournisseur: $1-20 selon:
     * Le poids apparent du produit
     * La taille et le volume
     * La fragilité (emballage renforcé si nécessaire)
   - Justifie brièvement ton estimation en mentionnant les facteurs pris en compte
   - Le champ "supplierPrice" doit être égal à estimatedSupplierPrice + estimatedShippingCost

3. REQUÊTE DE RECHERCHE ETSY:
   - Génère une requête de recherche Etsy optimale en anglais (4-7 mots exactement)
   - Utilise des mots-clés pertinents qui permettront de trouver des produits similaires sur Etsy
   - Base-toi sur la description visuelle du produit que tu as analysé
   - La requête doit être suffisamment spécifique pour trouver des produits comparables mais pas trop restrictive
   - Exemples de bonnes requêtes: "handmade leather wallet", "vintage brass keychain", "wooden wall art"

4. ANALYSE APPROFONDIE DE LA CONCURRENCE:
   - Estime le nombre de BOUTIQUES Etsy (pas de listings individuels) vendant des produits similaires
   - Cette estimation doit être réaliste et basée sur:
     * La popularité de la niche
     * La spécificité du produit
     * Les tendances du marché Etsy
   - Règles de décision STRICTES basées sur le nombre de concurrents:
     * 0-40 concurrents = LANCER (marché accessible, opportunité claire)
     * 41-90 concurrents = LANCER_CONCURRENTIEL (marché compétitif mais accessible avec optimisation)
     * 91+ concurrents = NE_PAS_LANCER (marché saturé, difficulté d'entrée trop élevée)
   - Estime le prix moyen du marché Etsy pour ce type de produit (averageMarketPrice)
   - Détermine une fourchette de prix crédible (marketPriceRange: min et max)
   - Justifie ton estimation de concurrence en expliquant ton raisonnement
   - Indique si ton estimation est fiable (competitorEstimationReliable: true/false)
   - Détermine le niveau de saturation:
     * "non_sature" si < 40 concurrents
     * "concurrentiel" si 41-90 concurrents
     * "sature" si 91+ concurrents
   - Fournis une analyse de saturation en 1 phrase

5. CALCUL DÉTAILLÉ DU PRIX DE VENTE RECOMMANDÉ:
   - Calcule d'abord le coût total (estimatedSupplierPrice + estimatedShippingCost)
   - Applique les règles de multiplicateur:
     * Si coût total < $70: Multiplicateur × 3 (marge importante nécessaire)
     * Si coût total ≥ $70: Multiplicateur × 2 (marge réduite acceptable)
   - Le prix recommandé optimal doit être supérieur au prix moyen du marché × 1.05 (positionnement premium)
   - Calcule le prix minimum viable (minimumViablePrice) = coût total × multiplicateur
   - Détermine le prix optimal (recommendedPrice.optimal) = max(prix minimum viable, prix moyen marché × 1.05)
   - Définis une fourchette:
     * recommendedPrice.min = prix minimum viable
     * recommendedPrice.max = prix optimal × 1.3 (marge pour promotions)
   - Évalue le niveau de risque (priceRiskLevel):
     * "faible" si le prix recommandé est compétitif et la marge est confortable
     * "moyen" si le prix est dans la moyenne du marché
     * "élevé" si le prix est au-dessus du marché ou la marge est serrée
   - Fournis une analyse de prix détaillée en 1 phrase expliquant ta recommandation

6. SIMULATION COMPLÈTE DE LANCEMENT:
   - Temps estimé avant première vente:
     * Sans publicité (withoutAds): 7-21 jours (estimation min-max réaliste)
     * Avec publicité Etsy Ads (withAds): 3-10 jours (estimation min-max avec budget publicitaire)
   - Ventes projetées après 3 mois:
     * Scénario prudent: estimation conservatrice (conditions défavorables)
     * Scénario réaliste: estimation probable (conditions normales)
     * Scénario optimiste: estimation si tout va bien (conditions favorables)
   - Ajoute une note explicative (simulationNote) qui explique les hypothèses de ta simulation

7. TAGS SEO OPTIMISÉS POUR ETSY:
   - Génère EXACTEMENT 13 tags SEO en anglais (pas plus, pas moins)
   - Maximum 20 caractères par tag (contrainte Etsy)
   - Utilise des mots-clés pertinents et recherchés sur Etsy
   - Inclus des variations: matériaux, couleurs, usages, occasions
   - Évite les doublons et les tags trop génériques
   - Les tags doivent être optimisés pour le référencement Etsy

8. FORCES ET RISQUES DU PRODUIT:
   - Génère 3-5 forces (strengths) du produit sous forme de liste
   - Chaque force doit être une phrase courte et claire
   - Les forces doivent être basées sur l'analyse visuelle, la niche, et le marché
   - Génère 2-4 risques (risks) potentiels du produit sous forme de liste
   - Chaque risque doit être une phrase courte et réaliste
   - Les risques doivent être basés sur la concurrence, le prix, et les défis du marché

9. TITRE VIRAL ET SEO:
   - Génère un titre SEO optimisé en anglais (maximum 140 caractères)
   - Le titre doit être attractif, descriptif et optimisé pour Etsy
   - Inclus les mots-clés principaux
   - Rends-le accrocheur tout en restant professionnel
   - Le titre doit inciter au clic tout en étant informatif

10. VERDICT FINAL ET RECOMMANDATIONS:
   - Fournis un verdict final en 1 phrase qui résume ta recommandation
   - Le verdict doit être clair et actionnable
   - Ajoute un avertissement (warningIfAny) si tu détectes des risques importants, sinon null
   - Le verdict doit refléter la décision (LANCER, LANCER_CONCURRENTIEL, ou NE_PAS_LANCER)

11. SCORE DE CONFIANCE:
    - Attribue un score de confiance entre 30 et 95
    - Le score doit refléter la fiabilité de ton analyse
    - Facteurs à considérer:
      * Clarté de l'image du produit
      * Spécificité de la niche
      * Qualité de tes estimations
      * Cohérence de tes données

═══════════════════════════════════════════════════════════════════════════════
FORMAT DE RÉPONSE STRICT (JSON UNIQUEMENT)
═══════════════════════════════════════════════════════════════════════════════

Tu DOIS répondre UNIQUEMENT en JSON valide avec cette structure exacte:

{
  "canIdentifyProduct": bool,
  "productVisualDescription": "1 phrase descriptive et précise",
  "etsySearchQuery": "4-7 mots anglais exactement",
  "estimatedSupplierPrice": nombre,
  "estimatedShippingCost": nombre,
  "supplierPriceReasoning": "justification courte de l'estimation",
  "decision": "LANCER" | "LANCER_CONCURRENTIEL" | "NE_PAS_LANCER",
  "confidenceScore": nombre entre 30 et 95,
  "estimatedCompetitors": nombre,
  "competitorEstimationReasoning": "justification courte de l'estimation",
  "competitorEstimationReliable": bool,
  "saturationLevel": "non_sature" | "concurrentiel" | "sature",
  "saturationAnalysis": "analyse courte en 1 phrase",
  "averageMarketPrice": nombre,
  "marketPriceRange": {"min": nombre, "max": nombre},
  "marketPriceReasoning": "justification courte du prix marché",
  "supplierPrice": nombre (estimatedSupplierPrice + estimatedShippingCost),
  "minimumViablePrice": nombre,
  "recommendedPrice": {"optimal": nombre, "min": nombre, "max": nombre},
  "priceRiskLevel": "faible" | "moyen" | "élevé",
  "pricingAnalysis": "analyse détaillée en 1 phrase",
  "launchSimulation": {
    "timeToFirstSale": {
      "withoutAds": {"min": nombre, "max": nombre},
      "withAds": {"min": nombre, "max": nombre}
    },
    "salesAfter3Months": {
      "prudent": nombre,
      "realiste": nombre,
      "optimise": nombre
    },
    "simulationNote": "note explicative détaillée"
  },
  "strengths": ["force 1", "force 2", "force 3", ...] (3-5 forces),
  "risks": ["risque 1", "risque 2", ...] (2-4 risques),
  "viralTitleEN": "titre max 140 caractères en anglais",
  "seoTags": ["tag1", "tag2", ..., "tag13"] (EXACTEMENT 13 tags),
  "finalVerdict": "verdict final en 1 phrase",
  "warningIfAny": "avertissement si nécessaire" | null
}

IMPORTANT: Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire, sans explications, sans commentaires. Le JSON doit être valide et complet.`;

    console.log('📤 Calling OpenAI API with OPTIMIZED prompt:', {
      url: productImageUrl?.substring(0, 100),
      isDataUrl: productImageUrl?.startsWith('data:image'),
      isHttpUrl: productImageUrl?.startsWith('http'),
      imageLength: productImageUrl?.length,
      promptLength: prompt.length,
      promptSizeKB: (prompt.length / 1024).toFixed(2),
      niche,
      price: productPrice,
      maxTokens: 1000,
      temperature: 0.1,
      model: 'gpt-4o-mini',
      timeout: '28s',
      retries: 3,
      netlifyLimit: '50s',
    });
    
    const openaiStartTime = Date.now();
    const usedModel = 'gpt-4o-mini'; // ⚡ UTILISER DIRECTEMENT GPT-4O-MINI (le plus rapide)
    
    // ⚡ SOLUTION RADICALE: Retry avec timeout progressif
    // Timeout à 28s par tentative (inférieur à 30s comme demandé)
    // Avec 3 tentatives max, on reste sous la limite Netlify de 50s par requête
    const MAX_RETRIES = 2; // 3 tentatives au total (0, 1, 2)
    const INITIAL_TIMEOUT = 28000; // 28s par tentative (inférieur à 30s)
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
                content: 'Tu es un expert e-commerce Etsy. Réponds UNIQUEMENT en JSON valide. Sois concis et précis.'
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
            temperature: 0.1, // Réduit pour réponse plus rapide et déterministe
            max_tokens: 1500, // Augmenté pour permettre une réponse très détaillée
            response_format: { type: 'json_object' }, // Force JSON - le prompt doit explicitement demander du JSON
            stream: false // Pas de streaming pour réduire la latence
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
      console.log('💪 Has strengths:', !!analysis.strengths, 'Count:', analysis.strengths?.length || 0);
      console.log('⚠️ Has risks:', !!analysis.risks, 'Count:', analysis.risks?.length || 0);
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
            strengths: ['Market opportunity exists', 'Competitive pricing possible', 'Good profit margin potential'],
            risks: ['Moderate competition requires differentiation', 'Need for quality marketing'],
            viralTitleEN: 'Product - Handmade Gift',
            seoTags: ['gift', 'handmade', 'product', 'unique', 'custom', 'etsy', 'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish'],
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
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // VALIDATION : GARANTIR QUE STRENGTHS ET RISKS SONT PRÉSENTS
    // ═══════════════════════════════════════════════════════════════════════════════
    if (!analysis.strengths || !Array.isArray(analysis.strengths) || analysis.strengths.length === 0) {
      console.warn('⚠️ No strengths provided by AI, generating fallback');
      const competitorCount = analysis.estimatedCompetitors || 50;
      const marketPrice = analysis.averageMarketPrice || 25;
      const recommendedPrice = analysis.recommendedPrice?.optimal || marketPrice;
      
      analysis.strengths = [
        competitorCount < 40 ? 'Low competition market opportunity' : 'Moderate competition with differentiation potential',
        `Good profit margin potential (${Math.round((1 - (analysis.estimatedSupplierPrice || 10) / recommendedPrice) * 100)}%)`,
        'Market demand exists based on competitor presence',
        recommendedPrice > marketPrice ? 'Premium positioning possible' : 'Competitive pricing strategy viable',
      ];
    }
    
    if (!analysis.risks || !Array.isArray(analysis.risks) || analysis.risks.length === 0) {
      console.warn('⚠️ No risks provided by AI, generating fallback');
      const competitorCount = analysis.estimatedCompetitors || 50;
      const marketPrice = analysis.averageMarketPrice || 25;
      const recommendedPrice = analysis.recommendedPrice?.optimal || marketPrice;
      const margin = Math.round((1 - (analysis.estimatedSupplierPrice || 10) / recommendedPrice) * 100);
      
      analysis.risks = [
        competitorCount > 90 ? 'High competition requires strong differentiation' : competitorCount > 40 ? 'Moderate competition needs marketing strategy' : 'Market validation required',
        margin < 50 ? 'Tight profit margin requires careful cost management' : 'Standard market risks apply',
        'Need for quality product photography and listing optimization',
      ];
    }
    
    console.log('✅ Strengths & Risks validated:', {
      strengthsCount: analysis.strengths.length,
      risksCount: analysis.risks.length,
    });
    
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

    // ⚠️ INCREMENT QUOTA AFTER SUCCESSFUL ANALYSIS
    const authHeaderForQuota = request.headers.get('authorization');
    if (authHeaderForQuota?.startsWith('Bearer ')) {
      const token = authHeaderForQuota.replace('Bearer ', '');
      const supabase = createSupabaseAdminClient();
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const quotaResult = await incrementAnalysisCount(user.id);
        if (!quotaResult.success) {
          console.warn('⚠️ Failed to increment quota, but analysis completed');
        }
      }
    }
    
    const responseTime = Date.now() - openaiStartTime;
    console.log('✅ Analysis completed successfully:', {
      model: usedModel,
      responseTime: `${responseTime}ms`,
      promptLength: prompt.length,
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
