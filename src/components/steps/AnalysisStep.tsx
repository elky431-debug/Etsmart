'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  ChevronRight,
  Sparkles,
  BarChart3,
  TrendingUp,
  Package,
  Eye,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useStore } from '@/store/useStore';
import type { Niche } from '@/types';
import { analyzeProduct } from '@/lib/mockAnalysis';
import { supabase } from '@/lib/supabase';
import { analysisDb } from '@/lib/db/analyses';
import { productDb } from '@/lib/db/products';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Paywall } from '@/components/paywall/Paywall';
import { QuotaExceeded } from '@/components/paywall/QuotaExceeded';

export function AnalysisStep() {
  const { currentStep, products, analyses, selectedNiche, customNiche, addAnalysis, setStep, isAnalyzing: globalIsAnalyzing, setIsAnalyzing: setGlobalIsAnalyzing } = useStore();
  const { user } = useAuth();
  const { subscription, loading: subscriptionLoading, canAnalyze, hasActiveSubscription, hasQuota, refreshSubscription } = useSubscription();
  const quotaReached = subscription ? subscription.remaining === 0 && subscription.status === 'active' : false;
  const [showQuotaExceeded, setShowQuotaExceeded] = useState(false);
  // Refs pour éviter les boucles infinies
  const analysisStartedRef = useRef(false);
  const transitionDoneRef = useRef(false);
  // Restaurer l'état depuis localStorage si disponible
  const getStoredAnalysisState = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('analysis-state');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Vérifier que l'état n'est pas trop vieux (max 1 heure)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
          return parsed;
        }
      }
    } catch (e) {
      console.log('[AnalysisStep] Erreur lecture localStorage:', e);
    }
    return null;
  }, []);

  const storedState = useMemo(() => getStoredAnalysisState(), [getStoredAnalysisState]);
  
  const [currentIndex, setCurrentIndex] = useState(storedState?.currentIndex || 0);
  const [progress, setProgress] = useState(storedState?.progress || 0);
  const [isAnalyzing, setIsAnalyzing] = useState(storedState?.isAnalyzing ?? globalIsAnalyzing ?? false);
  const [currentPhase, setCurrentPhase] = useState(storedState?.currentPhase || 'Initialisation...');
  const [completedProducts, setCompletedProducts] = useState<string[]>(storedState?.completedProducts || []);
  const [analysisComplete, setAnalysisComplete] = useState(storedState?.analysisComplete || false);
  // Utiliser useRef pour startTime pour qu'il ne soit pas réinitialisé à chaque re-render
  const startTimeRef = useRef<number>(storedState?.startTime || Date.now());
  const [showPaywall, setShowPaywall] = useState(false);
  const MINIMUM_DURATION = 20000; // 20 secondes minimum (réduit pour accélérer)

  // Sauvegarder l'état dans localStorage à chaque changement
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('analysis-state', JSON.stringify({
        currentIndex,
        progress,
        isAnalyzing,
        currentPhase,
        completedProducts,
        analysisComplete,
        startTime: startTimeRef.current,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.log('[AnalysisStep] Erreur sauvegarde localStorage:', e);
    }
  }, [currentIndex, progress, isAnalyzing, currentPhase, completedProducts, analysisComplete]);

  // Nettoyer localStorage quand l'analyse est terminée
  useEffect(() => {
    if (!isAnalyzing && analysisComplete) {
      setTimeout(() => {
        localStorage.removeItem('analysis-state');
      }, 1000);
    }
  }, [isAnalyzing, analysisComplete]);

  // ⚠️ CRITICAL: Check subscription before allowing analysis
  useEffect(() => {
    // Si on a déjà des analyses en cours d'affichage, ne pas bloquer
    if (currentStep === 3 && analyses.length > 0) {
      return;
    }

    if (subscriptionLoading) return; // Wait for subscription to load

    if (!user) {
      // User not authenticated - redirect to login
      setStep(2); // Go back to import step
      return;
    }

    if (!canAnalyze) {
      // Check if it's a quota issue (has subscription but no quota)
      if (hasActiveSubscription && !hasQuota) {
        // Show the beautiful QuotaExceeded modal
        setShowQuotaExceeded(true);
        setIsAnalyzing(false);
        setGlobalIsAnalyzing(false);
        return;
      }
      // No active subscription - show paywall
      setShowPaywall(true);
      setIsAnalyzing(false);
      setGlobalIsAnalyzing(false);
      return;
    }

    if (currentStep !== 3) {
      analysisStartedRef.current = false;
      transitionDoneRef.current = false;
      return;
    }

    if (
      products.length > 0 &&
      !analysisComplete &&
      analyses.length === 0 &&
      !globalIsAnalyzing &&
      !isAnalyzing &&
      !analysisStartedRef.current
    ) {
      analysisStartedRef.current = true;
      runAnalysis();
    }
  }, [
    subscriptionLoading,
    canAnalyze,
    hasActiveSubscription,
    hasQuota,
    user,
    currentStep,
    products.length,
    analysisComplete,
    analyses.length,
    globalIsAnalyzing,
    isAnalyzing,
    showPaywall,
    showQuotaExceeded,
    setStep,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSITION: passer à l'étape 4 quand l'analyse est terminée
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (transitionDoneRef.current) return;
    if (currentStep !== 3) return;

    const hasAnalyses = analyses.length > 0;
    if ((analysisComplete || hasAnalyses) && progress >= 100) {
      transitionDoneRef.current = true;
      setIsAnalyzing(false);
      setGlobalIsAnalyzing(false);
      setTimeout(() => {
        setStep(4);
      }, 300);
    }
  }, [analysisComplete, analyses.length, progress, currentStep, setStep, setGlobalIsAnalyzing]);

  

  // ═══════════════════════════════════════════════════════════════════════════
  // FONCTION HELPER: Sauvegarde fiable de l'analyse dans la DB
  // ═══════════════════════════════════════════════════════════════════════════
  const saveAnalysisToDatabase = async (analysis: any): Promise<boolean> => {
    console.log('💾 [SAVE] Starting analysis save to database...');
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log('ℹ️ [SAVE] User not authenticated, skipping DB save');
        return false;
      }
      
      console.log('👤 [SAVE] User authenticated:', user.id);
      
      // STEP 1: Create or find product in database
      let productId: string | null = null;
      const productUrl = analysis.product.url || `local-${Date.now()}`;
      
      // Try to find existing product by URL
      const { data: existingProducts, error: findError } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', user.id)
        .eq('url', productUrl)
        .limit(1);
      
      if (findError) {
        console.error('❌ [SAVE] Error finding product:', findError.message);
      }
      
      if (existingProducts && existingProducts.length > 0) {
        productId = existingProducts[0].id;
        console.log('✅ [SAVE] Found existing product:', productId);
      } else {
        // Create new product
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            user_id: user.id,
            url: productUrl,
            source: analysis.product.source || 'aliexpress',
            title: analysis.product.title || 'Untitled Product',
            description: analysis.product.description || '',
            images: analysis.product.images || [],
            price: analysis.product.price || 0,
            currency: analysis.product.currency || 'USD',
            category: analysis.niche || 'custom',
            niche: analysis.niche || 'custom',
            shipping_time: analysis.product.shippingTime || '',
            min_order_quantity: analysis.product.minOrderQuantity || 1,
            supplier_rating: analysis.product.supplierRating || 0,
          })
          .select('id')
          .single();
        
        if (createError) {
          console.error('❌ [SAVE] Error creating product:', {
            message: createError.message,
            details: createError.details,
            code: createError.code,
          });
          return false;
        }
        
        if (newProduct) {
          productId = newProduct.id;
          console.log('✅ [SAVE] Created new product:', productId);
        }
      }
      
      if (!productId) {
        console.error('❌ [SAVE] No product ID available');
        return false;
      }
      
      // STEP 2: Save analysis with product_id
      const { error: analysisError } = await supabase
        .from('product_analyses')
        .upsert({
          product_id: productId,
          user_id: user.id,
          verdict: analysis.verdict?.verdict || 'test',
          confidence_score: analysis.verdict?.confidenceScore || 50,
          summary: analysis.verdict?.summary || '',
          ai_comment: analysis.verdict?.aiComment || '',
          total_competitors: analysis.competitors?.totalCompetitors || 0,
          average_market_price: analysis.competitors?.averageMarketPrice || 0,
          recommended_price: analysis.pricing?.recommendedPrice || 0,
          saturation_phase: analysis.saturation?.phase || 'launch',
          saturation_probability: analysis.saturation?.saturationProbability || 0,
          viral_title_en: analysis.verdict?.viralTitleEN || '',
          seo_tags: analysis.verdict?.seoTags || [],
          etsy_search_query: analysis.verdict?.etsySearchQuery || '',
          launch_simulation: analysis.launchSimulation || null,
          full_analysis_data: analysis,
        }, {
          onConflict: 'product_id,user_id',
        });
      
      if (analysisError) {
        console.error('❌ [SAVE] Error saving analysis:', {
          message: analysisError.message,
          details: analysisError.details,
          code: analysisError.code,
        });
        return false;
      }
      
      console.log('✅ [SAVE] Analysis saved successfully to database!');
      return true;
      
    } catch (error: any) {
      console.error('❌ [SAVE] Exception during save:', error?.message || error);
      return false;
    }
  };

  const phases = [
    { text: 'Analyse de l\'image du produit', icon: Eye },
    { text: 'Évaluation du marché Etsy', icon: BarChart3 },
    { text: 'Analyse des concurrents', icon: TrendingUp },
    { text: 'Génération des recommandations IA', icon: Sparkles },
  ];

  const runAnalysis = useCallback(async () => {
    // ⚠️ PROTECTION : Empêcher les analyses simultanées
    if (globalIsAnalyzing) {
      console.warn('⚠️ Une analyse est déjà en cours, impossible de démarrer une nouvelle analyse');
      return;
    }
    
    console.log('🚀 Analysis started');
    console.log('[AnalysisStep] État avant démarrage:', {
      productsCount: products.length,
      currentStep: useStore.getState().currentStep,
      storeIsAnalyzing: globalIsAnalyzing
    });
    
    setIsAnalyzing(true);
    setGlobalIsAnalyzing(true); // Verrou global
    // Réinitialiser startTime seulement au début d'une nouvelle analyse
    startTimeRef.current = Date.now();
    setProgress(5); // Démarrage immédiat
    setCurrentPhase('Démarrage de l\'analyse...');
    
    const niche = selectedNiche === 'custom' ? customNiche : selectedNiche;

    try {
      // ⚡ ANALYSE D'UN SEUL PRODUIT (limitation à 1 produit)
      if (products.length === 0) {
        console.error('❌ No product to analyze');
        setIsAnalyzing(false);
        setGlobalIsAnalyzing(false);
        return;
      }
      
      const product = products[0]; // Un seul produit
      console.log(`📦 Analyzing product:`, product.title?.substring(0, 50));
      
      setCurrentIndex(0);
      setCurrentPhase('Analyse de l\'image du produit');
      setProgress(10); // 10% au début
        
      try {
        // ⚠️ L'ANALYSE NE PEUT JAMAIS ÉCHOUER - analyzeProduct retourne TOUJOURS un résultat
        // Même en cas d'erreur, le fallback ultime garantit un ProductAnalysis valide
        // Timeout de 60 secondes max (pour permettre les retries côté serveur: 2 tentatives × 40s = 80s max)
        // Le serveur a un timeout de 40s par tentative avec 1 retry, donc on attend 60s côté client
        const analysisPromise = analyzeProduct(product, (niche || 'custom') as Niche);
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Product timeout')), 60000) // 60s pour permettre les retries (2 × 40s)
        );
        
        const analysis = await Promise.race([analysisPromise, timeout]) as any;
        
        console.log(`✅ Analysis completed`);
        
        // Marquer l'analyse comme terminée (mais ne pas changer la progression ici)
        // La progression sera gérée par l'animation de 30 secondes
        setAnalysisComplete(true);
        
        // Ajouter l'analyse au store temporairement (pour l'affichage)
        addAnalysis(analysis);
        setCompletedProducts(prev => [...prev, product.id]);
        
        // Sauvegarde DB - IMPORTANT pour l'historique
        saveAnalysisToDatabase(analysis).then(success => {
          if (success) {
            console.log('✅ [HISTORY] Analysis saved for product:', product.title?.substring(0, 30));
          } else {
            console.warn('⚠️ [HISTORY] Failed to save analysis, will retry in ResultsStep');
          }
        });
      } catch (error: any) {
          console.error(`❌ Error analyzing product:`, error);
          
          // Même si ça échoue, on continue - le fallback dans analyzeProduct devrait gérer ça
          // Mais on crée une analyse minimale pour ne pas bloquer
          const fallbackAnalysis = {
            id: `analysis-${product.id}-${Date.now()}`,
            product,
            niche: (niche || 'custom') as Niche,
            competitors: {
              totalCompetitors: 50,
              competitorEstimationReliable: false,
              competitorEstimationReasoning: 'Estimation par défaut',
              competitors: [],
              marketStructure: 'open' as const,
              dominantSellers: 3,
              avgPrice: product.price * 3,
              priceRange: { min: product.price * 2.5, max: product.price * 3.5 },
              avgReviews: 100,
              avgRating: 4.5,
              averageMarketPrice: product.price * 3,
              marketPriceRange: { min: product.price * 2.5, max: product.price * 3.5 },
              marketPriceReasoning: 'Estimation par défaut',
            },
            saturation: {
              phase: 'launch' as const,
              phasePercentage: 20,
              newSellersRate: 5,
              listingGrowthRate: 10,
              saturationProbability: 20,
              declineRisk: 'low' as const,
              seasonality: {
                isSeasonalProduct: false,
                peakMonths: [],
                lowMonths: [],
                currentSeasonImpact: 'neutral' as const,
              },
            },
            launchSimulation: {
              timeToFirstSale: {
                withoutAds: { min: 7, max: 21, expected: 14 },
                withAds: { min: 3, max: 10, expected: 6 },
              },
              threeMonthProjection: {
                conservative: {
                  estimatedSales: 5,
                  estimatedRevenue: product.price * 3 * 5,
                  estimatedProfit: (product.price * 3 - product.price * 1.4) * 5,
                  marginPercentage: 60,
                },
                realistic: {
                  estimatedSales: 15,
                  estimatedRevenue: product.price * 3 * 15,
                  estimatedProfit: (product.price * 3 - product.price * 1.4) * 15,
                  marginPercentage: 60,
                },
                optimistic: {
                  estimatedSales: 30,
                  estimatedRevenue: product.price * 3 * 30,
                  estimatedProfit: (product.price * 3 - product.price * 1.4) * 30,
                  marginPercentage: 60,
                },
              },
              successProbability: 60,
              keyFactors: ['Product quality', 'Market timing'],
            },
            pricing: {
              recommendedPrice: Math.max(14.99, product.price * 3),
              aggressivePrice: Math.max(14.99, product.price * 2.5),
              premiumPrice: Math.max(14.99, product.price * 3.5),
              currency: 'USD',
              justification: 'Prix recommandé basé sur une marge de 300%',
              competitorPriceAnalysis: {
                below25: Math.max(14.99, product.price * 2.5),
                median: Math.max(14.99, product.price * 3),
                above75: Math.max(14.99, product.price * 3.5),
              },
              priceStrategy: {
                launch: Math.max(14.99, product.price * 2.5),
                stable: Math.max(14.99, product.price * 3),
                premium: Math.max(14.99, product.price * 3.5),
              },
              marginAnalysis: {
                atRecommendedPrice: 60,
                atAggressivePrice: 50,
                atPremiumPrice: 65,
              },
            },
            marketing: {
              angles: [{
                id: 'fallback-1',
                title: 'Quality Product',
                description: 'High-quality product',
                whyItWorks: 'Quality-focused',
                competitionLevel: 'medium' as const,
                emotionalTriggers: ['quality'],
                suggestedKeywords: ['handmade', 'quality', 'product'],
                targetAudience: 'General',
              }],
              topKeywords: ['handmade', 'quality', 'product'],
              emotionalHooks: ['Quality', 'Value'],
              occasions: ['Gift'],
            },
            verdict: {
              verdict: 'test' as const,
              confidenceScore: 30,
              improvements: [],
              summary: 'Analysis completed with minimal data',
              aiComment: 'Fallback analysis',
              difficultyAnalysis: '50 estimated competitors',
              competitionComment: '50 competitors',
              competitorEstimationReasoning: 'Default estimation',
              productVisualDescription: product.title || 'Product',
              etsySearchQuery: 'handmade product gift',
              estimatedSupplierPrice: product.price * 0.7,
              estimatedShippingCost: 5,
              supplierPriceReasoning: 'Estimated',
            },
            analyzedAt: new Date(),
            analysisVersion: '1.0-Fallback',
            dataSource: 'estimated' as const,
          } as any;
          
          addAnalysis(fallbackAnalysis);
          setCompletedProducts(prev => [...prev, product.id]);
          setAnalysisComplete(true);
          
          // Sauvegarder aussi le fallback analysis dans la DB
          saveAnalysisToDatabase(fallbackAnalysis).then(success => {
            if (!success) {
              console.warn('⚠️ [HISTORY] Failed to save fallback analysis');
            }
          });
        }
      
      console.log('✅ All analyses completed');
      // Ne pas mettre setIsAnalyzing à false ici - on attendra les 30 secondes minimum
    } catch (error: any) {
      console.error('❌ Analysis failed:', error);
      // Même en cas d'erreur globale, marquer comme terminé
      setAnalysisComplete(true);
    }
  }, [products, selectedNiche, customNiche, addAnalysis, globalIsAnalyzing, setGlobalIsAnalyzing]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION DE LA BARRE DE PROGRESSION SUR 30 SECONDES MINIMUM
  // La barre monte de 0 à 100% sur exactement 30 secondes, indépendamment de l'analyse
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isAnalyzing) return; // Ne pas animer si déjà terminé
    
    // Si on a restauré depuis localStorage, ajuster le startTime pour continuer la progression
    if (storedState && storedState.startTime && storedState.progress > 0) {
      // Calculer le temps écoulé depuis la sauvegarde
      const timeSinceSave = Date.now() - storedState.timestamp;
      // Ajuster startTime pour que la progression continue naturellement
      startTimeRef.current = Date.now() - (storedState.progress / 100 * MINIMUM_DURATION);
    } else if (!startTimeRef.current || progress === 0) {
      // Initialiser startTime seulement si pas déjà défini ou si l'analyse vient de commencer
      startTimeRef.current = Date.now();
    }
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const progressPercent = Math.min(100, (elapsed / MINIMUM_DURATION) * 100);
      setProgress(progressPercent);
    }, 50); // Mise à jour toutes les 50ms pour une animation fluide
    
    return () => clearInterval(interval);
  }, [isAnalyzing, progress, storedState]);

  // ═══════════════════════════════════════════════════════════════════════════
  // VÉRIFICATION FINALE : Transition automatique quand l'analyse est terminée
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Vérifier si on a des analyses dans le store (signe que l'analyse est terminée)
    const hasAnalyses = useStore.getState().analyses.length > 0;
    
    // Si on a des analyses ET que la progression est à 100%, passer à l'étape 4
    if (hasAnalyses && progress >= 100 && !isAnalyzing) {
      console.log('✅ Analyse terminée (analyses présentes) - passage à l\'étape 4');
      setIsAnalyzing(false);
      setGlobalIsAnalyzing(false);
      setTimeout(() => {
        setStep(4);
      }, 500);
      return;
    }
    
    // Sinon, vérifier avec le système de timing
    if (!startTimeRef.current) return;
    
    const checkCompletion = () => {
      if (!startTimeRef.current) return;
      
      const elapsed = Date.now() - startTimeRef.current;
      const hasMinimumTime = elapsed >= MINIMUM_DURATION;
      
      // On redirige si :
      // 1. Les 20 secondes minimum sont écoulées
      // 2. L'analyse est terminée OU on a des analyses
      // 3. La progression est à 100%
      const hasAnalysesCheck = useStore.getState().analyses.length > 0;
      if (hasMinimumTime && (analysisComplete || hasAnalysesCheck) && progress >= 100) {
        console.log('✅ Analyse terminée - passage à l\'étape 4');
        setIsAnalyzing(false);
        setGlobalIsAnalyzing(false);
        setTimeout(() => {
          setStep(4);
        }, 500);
      }
    };
    
    // Vérifier toutes les 100ms
    const interval = setInterval(checkCompletion, 100);
    
    // ⚠️ FALLBACK: Forcer la transition après 30 secondes si on a des analyses
    const forceTransitionTimeout = setTimeout(() => {
      const hasAnalysesCheck = useStore.getState().analyses.length > 0;
      if (progress >= 100 && hasAnalysesCheck) {
        console.warn('⚠️ Force transition après 30s - l\'analyse est terminée');
        setIsAnalyzing(false);
        setGlobalIsAnalyzing(false);
        setStep(4);
      }
    }, 30000); // 30 secondes maximum
    
    return () => {
      clearInterval(interval);
      clearTimeout(forceTransitionTimeout);
    };
  }, [analysisComplete, progress, setStep, setGlobalIsAnalyzing, isAnalyzing]);

  // Removed duplicate useEffect - analysis is now triggered by subscription check useEffect

  const currentProduct = products[currentIndex];

  // Show QuotaExceeded modal if user has subscription but no quota
  if (showQuotaExceeded && subscription) {
    return (
      <div className="min-h-screen w-full relative overflow-hidden bg-slate-50">
        <QuotaExceeded
          currentPlan={subscription.plan}
          used={subscription.used}
          quota={subscription.quota}
          resetDate={subscription.periodEnd}
          onClose={() => setStep(2)}
        />
      </div>
    );
  }

  // Show paywall if no subscription
  if (showPaywall) {
    return (
      <div className="min-h-screen w-full relative overflow-hidden">
        <Paywall
          title="Débloquer l'analyse de produits"
          message="Pour analyser des produits et accéder aux résultats complets, vous avez besoin d'un abonnement actif."
          currentPlan={subscription?.plan || 'FREE'}
          quotaReached={quotaReached}
          used={subscription?.used}
          quota={subscription?.quota}
          requiresUpgrade={subscription?.requiresUpgrade}
        />
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <Button
            onClick={() => setStep(2)}
            variant="secondary"
            className="bg-slate-900/80 text-white border border-white/20 hover:bg-slate-800"
          >
            Retour à l'importation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00d4ff]/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#00c9b7]/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16"
      >
        {/* Header Section */}
    <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
    >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-lg mb-4 sm:mb-8 text-xs sm:text-sm"
        >
            <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
            <span className="text-sm font-bold text-[#00d4ff]">ÉTAPE 3 SUR 3</span>
            <Zap size={16} className="text-[#00c9b7]" />
          </motion.div>
          
          <motion.h1 
            className="text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-3 sm:mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {isAnalyzing ? (
              <>
                <span className="text-slate-900">Analyse</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
                  en cours
                </span>
              </>
            ) : (
            <>
                <span className="text-slate-900">Analyse</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
                  terminée
                </span>
            </>
          )}
          </motion.h1>
          
          <motion.p 
            className="text-sm sm:text-base md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed px-2 sm:px-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {isAnalyzing 
              ? `Analyse IA en cours`
                : `Analyse terminée avec succès`
            }
          </motion.p>
        </motion.div>

        {/* Current Product Card */}
        {isAnalyzing && currentProduct && (
            <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto mb-12"
          >
            <div className="p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 border-2 border-slate-200 shadow-lg">
                  {currentProduct.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentProduct.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-slate-400" />
                    </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#00d4ff] mb-2 uppercase tracking-wide">
                    Analyse du produit
                  </p>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-white truncate">{currentProduct.title}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Progress Bar */}
        <motion.div 
          className="max-w-2xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-bold text-white">Progression globale</span>
              <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <motion.div
                className="h-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] rounded-full shadow-lg"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </motion.div>

        {/* Phases */}
        {isAnalyzing && (
          <motion.div 
            className="max-w-2xl mx-auto mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="space-y-4">
              {phases.map((phase, index) => {
                const PhaseIcon = phase.icon;
                const isActive = currentPhase === phase.text;
                const isPast = phases.findIndex(p => p.text === currentPhase) > index;

                          return (
                            <motion.div
                    key={phase.text}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ 
                      delay: index * 0.1,
                      type: 'spring',
                      stiffness: 100
                    }}
                              className={`
                      relative p-6 rounded-3xl transition-all duration-500 border-2 overflow-hidden
                      ${isActive 
                        ? 'bg-gradient-to-br from-[#00d4ff]/20 via-[#00c9b7]/10 to-slate-900 border-[#00d4ff] shadow-xl shadow-[#00d4ff]/20' 
                        : isPast 
                          ? 'bg-gradient-to-br from-[#00d4ff]/10 to-slate-900 border-[#00d4ff]/30' 
                          : 'bg-slate-900/70 border-slate-800'
                      }
                    `}
                  >
                    {/* Shine effect when active */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 opacity-0"
                        style={{
                          background: 'linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
                        }}
                        animate={{
                          x: ['-100%', '200%'],
                        }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                      />
                    )}

                    <div className="relative z-10 flex items-center gap-6">
                      <div className={`
                        relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
                        ${isActive 
                          ? 'bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] shadow-lg shadow-[#00d4ff]/30' 
                          : isPast 
                            ? 'bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/20' 
                            : 'bg-slate-100'
                        }
                      `}>
                        {isActive ? (
                          <Loader2 className="w-8 h-8 text-white animate-spin" />
                        ) : isPast ? (
                          <CheckCircle2 className="w-8 h-8 text-[#00d4ff]" />
                        ) : (
                          <PhaseIcon className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <span className={`
                        text-lg font-bold transition-colors
                        ${isActive 
                          ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]' 
                          : isPast 
                            ? 'text-[#00d4ff]' 
                            : 'text-slate-400'
                        }
                      `}>
                        {phase.text}
                      </span>
                    </div>
            </motion.div>
          );
        })}
      </div>
          </motion.div>
        )}

        {/* Success State - TOUJOURS affiché car l'analyse ne peut jamais échouer */}
        {!isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto mb-12"
          >
            <div className="p-12 rounded-3xl bg-gradient-to-br from-[#00d4ff]/10 via-[#00c9b7]/5 to-white border-2 border-[#00d4ff]/30 shadow-2xl text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-32 h-32 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[#00d4ff]/30"
              >
                <CheckCircle2 className="w-16 h-16 text-white" />
              </motion.div>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 mb-3 sm:mb-4">Analyse terminée !</h3>
              <p className="text-sm sm:text-base md:text-lg text-slate-600 mb-6 sm:mb-8 px-2 sm:px-0">
                Redirection vers les résultats...
              </p>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold shadow-lg"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                Chargement des résultats
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Back Button */}
        <motion.div 
          className="flex justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <motion.button
            onClick={() => setStep(2)}
            disabled={isAnalyzing}
            whileHover={!isAnalyzing ? { scale: 1.02, x: -2 } : {}}
            whileTap={!isAnalyzing ? { scale: 0.98 } : {}}
            className={`
              flex items-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm
              ${isAnalyzing
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 hover:shadow-md'
              }
            `}
          >
            <ArrowLeft size={20} />
            Retour aux produits
          </motion.button>
        </motion.div>
    </motion.div>
    </div>
  );
}
