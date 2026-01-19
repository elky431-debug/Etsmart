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
    setIsAnalyzing(true);
    const niche = selectedNiche === 'custom' ? customNiche : selectedNiche;

    for (let i = 0; i < products.length; i++) {
      setCurrentIndex(i);
      
      for (let phase = 0; phase < phases.length; phase++) {
        setCurrentPhase(phases[phase].text);
        setProgress(((i * phases.length + phase + 1) / (products.length * phases.length)) * 100);
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      // ⚠️ L'ANALYSE NE PEUT JAMAIS ÉCHOUER - analyzeProduct retourne TOUJOURS un résultat
      // Même en cas d'erreur, le fallback ultime garantit un ProductAnalysis valide
      const analysis = await analyzeProduct(products[i], (niche || 'custom') as Niche);
      addAnalysis(analysis);
      
      // Save to Supabase if user is authenticated
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.warn('Cannot get user for saving analysis:', authError.message);
          // Continue without saving - user might not be logged in
        } else if (user) {
          try {
            // First, save the product to database
            let savedProduct = analysis.product;
            try {
              // Try to find product by URL (more reliable than ID for local products)
              const { data: existingProducts } = await supabase
                .from('products')
                .select('*')
                .eq('user_id', user.id)
                .eq('url', analysis.product.url)
                .limit(1);
              
              if (existingProducts && existingProducts.length > 0) {
                // Product exists, use it
                savedProduct = {
                  ...analysis.product,
                  id: existingProducts[0].id,
                };
                console.log('✅ Product already exists in database');
              } else {
                // Product doesn't exist, create it
                savedProduct = await productDb.createProduct(user.id, analysis.product);
                console.log('✅ Product saved to database');
              }
            } catch (productError: any) {
              console.warn('⚠️ Error saving product to database:', {
                message: productError?.message,
                code: productError?.code,
              });
              // Continue anyway - might be a duplicate or other non-critical error
              // Use original product ID
            }
            
            // Then save the analysis (with the saved product)
            const analysisWithSavedProduct = {
              ...analysis,
              product: savedProduct,
            };
            
            await analysisDb.saveAnalysis(user.id, analysisWithSavedProduct);
            console.log('✅ Analysis saved to database successfully');
          } catch (saveError: any) {
            // Log detailed error information
            console.error('❌ Error saving analysis to database:', {
              message: saveError?.message || 'Unknown error',
              code: saveError?.code,
              details: saveError?.details,
              hint: saveError?.hint,
              error: saveError
            });
            // Don't fail the analysis if DB save fails - it's not critical
          }
        }
      } catch (error: any) {
        console.warn('Error checking authentication for saving analysis:', error?.message || error);
        // Continue without saving - not critical
      }
      
      setCompletedProducts(prev => [...prev, products[i].id]);
    }

    setIsAnalyzing(false);
    setProgress(100);

    // ⚠️ TOUJOURS rediriger vers les résultats - l'analyse ne peut JAMAIS échouer
    // analyzeProduct retourne TOUJOURS un résultat grâce au fallback ultime
    setTimeout(() => {
      setStep(4); // Redirection directe vers les résultats
    }, 1500);
  }, [products, selectedNiche, customNiche, addAnalysis, setStep, phases.length, completedProducts.length]);

  useEffect(() => {
    runAnalysis();
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
