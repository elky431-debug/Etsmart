'use client';

import { useState, useEffect, useCallback } from 'react';
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

export function AnalysisStep() {
  const { products, selectedNiche, customNiche, addAnalysis, setStep } = useStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [currentPhase, setCurrentPhase] = useState('Initialisation...');
  const [completedProducts, setCompletedProducts] = useState<string[]>([]);

  const phases = [
    { text: 'Product image analysis', icon: Eye },
    { text: 'Etsy market evaluation', icon: BarChart3 },
    { text: 'Competitor analysis', icon: TrendingUp },
    { text: 'Génération des recommandations IA', icon: Sparkles },
  ];

  const runAnalysis = useCallback(async () => {
    console.log('🚀 Analysis started');
    setIsAnalyzing(true);
    setProgress(5); // Démarrage immédiat
    setCurrentPhase('Starting analysis...');
    
    const niche = selectedNiche === 'custom' ? customNiche : selectedNiche;

    // Timeout global pour éviter que ça bloque indéfiniment
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Analysis timeout after 5 minutes')), 300000)
    );

    try {
      // ⚡ ANALYSE SÉQUENTIELLE (plus fiable que parallèle) avec timeout
    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        console.log(`📦 Analyzing product ${i + 1}/${products.length}:`, product.title?.substring(0, 50));
        
      setCurrentIndex(i);
        setCurrentPhase('AI Vision Analysis');
        setProgress((i / products.length) * 50 + 10); // 10-60% pendant l'analyse
        
        try {
          // ⚠️ L'ANALYSE NE PEUT JAMAIS ÉCHOUER - analyzeProduct retourne TOUJOURS un résultat
          // Même en cas d'erreur, le fallback ultime garantit un ProductAnalysis valide
          // Ajouter un timeout individuel pour chaque produit (2 minutes max)
          const analysisPromise = analyzeProduct(product, (niche || 'custom') as Niche);
          const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Product ${i + 1} timeout`)), 120000)
          );
          
          const analysis = await Promise.race([analysisPromise, timeout]) as any;
          
          console.log(`✅ Analysis ${i + 1} completed`);
          
          // Mettre à jour la progression
          setProgress(((i + 1) / products.length) * 80 + 10); // 10-90%
          
          // Ajouter l'analyse au store immédiatement
          addAnalysis(analysis);
          setCompletedProducts(prev => [...prev, product.id]);
          
          // Sauvegarde DB en arrière-plan (non-bloquante)
          (async () => {
            try {
              const { data: { user }, error: authError } = await supabase.auth.getUser();
              
              if (authError || !user) {
                return; // Pas connecté, on skip
              }
              
            try {
              // First, save the product to database
              let savedProduct = analysis.product;
              try {
                const { data: existingProducts } = await supabase
                  .from('products')
                  .select('*')
                  .eq('user_id', user.id)
                  .eq('url', analysis.product.url)
                  .limit(1);
                
                if (existingProducts && existingProducts.length > 0) {
                  savedProduct = {
                    ...analysis.product,
                    id: existingProducts[0].id,
                  };
                } else {
                  savedProduct = await productDb.createProduct(user.id, analysis.product);
                }
              } catch (productError: any) {
                  console.warn('⚠️ Error saving product to database:', productError?.message);
                  // Continue anyway
                }
                
                // Then save the analysis
              const analysisWithSavedProduct = {
                ...analysis,
                product: savedProduct,
              };
              
              await analysisDb.saveAnalysis(user.id, analysisWithSavedProduct);
            } catch (saveError: any) {
                console.warn('⚠️ Error saving analysis to database:', saveError?.message);
                // Non-critique, on continue
              }
            } catch (error: any) {
              // Silently fail - not critical
            }
          })();
        } catch (error: any) {
          console.error(`❌ Error analyzing product ${i + 1}:`, error);
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
              strengths: ['Product'],
              risks: ['Market'],
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
        }
      }
      
      console.log('✅ All analyses completed');
      setIsAnalyzing(false);
      setProgress(100);
    } catch (error: any) {
      console.error('❌ Analysis failed:', error);
      // Même en cas d'erreur globale, on termine
    setIsAnalyzing(false);
    setProgress(100);
    }
  }, [products, selectedNiche, customNiche, addAnalysis]);

  // ⚠️ REDIRECTION AUTOMATIQUE - Dès que l'analyse est terminée, rediriger immédiatement
  useEffect(() => {
    if (!isAnalyzing && completedProducts.length > 0) {
      // Redirection immédiate vers les résultats
      const timer = setTimeout(() => {
      setStep(4);
      }, 300); // Juste un petit délai pour l'animation
      return () => clearTimeout(timer);
      }
  }, [isAnalyzing, completedProducts.length, setStep]);

  useEffect(() => {
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentProduct = products[currentIndex];

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
        className="relative z-10 w-full max-w-7xl mx-auto px-6 py-16"
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
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/80 backdrop-blur-xl border-2 border-[#00d4ff]/20 shadow-lg mb-8"
          >
            <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
            <span className="text-sm font-bold text-[#00d4ff]">STEP 3 OF 3</span>
            <Zap size={16} className="text-[#00c9b7]" />
          </motion.div>
          
          <motion.h1 
            className="text-6xl md:text-7xl font-black mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {isAnalyzing ? (
              <>
                <span className="text-slate-900">Analysis</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
                  in progress
                </span>
              </>
            ) : (
            <>
                <span className="text-slate-900">Analysis</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
                  completed
                </span>
            </>
          )}
          </motion.h1>
          
          <motion.p 
            className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {isAnalyzing 
              ? `AI analysis of ${products.length} product${products.length > 1 ? 's' : ''}`
                : `${completedProducts.length} product${completedProducts.length > 1 ? 's' : ''} analyzed successfully`
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
            <div className="p-8 rounded-3xl bg-white/90 backdrop-blur-xl border-2 border-slate-200 shadow-2xl">
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
                    Product {currentIndex + 1}/{products.length}
                  </p>
                  <p className="text-xl font-bold text-slate-900 truncate">{currentProduct.title}</p>
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
          <div className="p-8 rounded-3xl bg-white/90 backdrop-blur-xl border-2 border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-bold text-slate-700">Global progress</span>
              <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden border-2 border-slate-200">
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
                        ? 'bg-gradient-to-br from-[#00d4ff]/20 via-[#00c9b7]/10 to-white border-[#00d4ff] shadow-xl shadow-[#00d4ff]/20' 
                        : isPast 
                          ? 'bg-gradient-to-br from-[#00d4ff]/10 to-white border-[#00d4ff]/30' 
                          : 'bg-white border-slate-200'
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
              <h3 className="text-4xl font-black text-slate-900 mb-4">Analysis completed!</h3>
              <p className="text-lg text-slate-600 mb-8">
                Redirecting to results...
              </p>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold shadow-lg"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading results
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
            Back to products
          </motion.button>
        </motion.div>
    </motion.div>
    </div>
  );
}
