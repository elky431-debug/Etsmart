'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  History, 
  User, 
  Settings, 
  LogOut,
  Home,
  Sparkles,
  Eye,
  TrendingUp,
  DollarSign,
  Target,
  Megaphone,
  FileText,
  Calculator,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  CreditCard
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/ui/Logo';
import { analysisDb } from '@/lib/db/analyses';
import { useStore } from '@/store/useStore';
import type { ProductAnalysis } from '@/types';
import { DashboardHistory } from '@/components/dashboard/DashboardHistory';
import { DashboardAnalysisDetail } from '@/components/dashboard/DashboardAnalysisDetail';
import { DashboardProfile } from '@/components/dashboard/DashboardProfile';
import { DashboardSettings } from '@/components/dashboard/DashboardSettings';
import { DashboardSubscription } from '@/components/dashboard/DashboardSubscription';
type DashboardSection = 'analyze' | 'history' | 'analysis' | 'profile' | 'settings' | 'subscription';

interface MenuItem {
  id: DashboardSection;
  label: string;
  icon: any;
  href?: string;
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<DashboardSection>('history');
  const [selectedAnalysis, setSelectedAnalysis] = useState<ProductAnalysis | null>(null);
  const [analyses, setAnalyses] = useState<ProductAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check URL parameter to set initial section
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const section = params.get('section') as DashboardSection | null;
      if (section && ['analyze', 'history', 'analysis', 'profile', 'settings', 'subscription'].includes(section)) {
        setActiveSection(section);
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadAnalyses();
    }
  }, [user]);

  // Recharger les analyses quand l'utilisateur revient sur la page (focus)
  useEffect(() => {
    if (!user) return;
    
    const handleFocus = () => {
      loadAnalyses();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  const loadAnalyses = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // 1. Charger les analyses depuis la DB
      const dbAnalyses = await analysisDb.getAnalyses(user.id);
      console.log('📊 Loaded analyses from database:', dbAnalyses.length);
      
      // 2. Synchroniser les analyses du store local vers la DB (si pas déjà présentes)
      const { analyses: localAnalyses } = useStore.getState();
      if (localAnalyses && localAnalyses.length > 0) {
        console.log('🔄 Syncing local analyses to database...', localAnalyses.length);
        for (const localAnalysis of localAnalyses) {
          try {
            // Vérifier si l'analyse existe déjà dans la DB
            const exists = dbAnalyses.some(db => db.product.id === localAnalysis.product.id);
            if (!exists) {
              // Sauvegarder l'analyse locale dans la DB
              await analysisDb.saveAnalysis(user.id, localAnalysis);
              console.log('✅ Synced local analysis to database:', localAnalysis.product.title);
            }
          } catch (syncError: any) {
            console.warn('⚠️ Error syncing local analysis:', syncError?.message);
            // Continue avec les autres analyses
          }
        }
        
        // Recharger les analyses après la synchronisation
        const updatedAnalyses = await analysisDb.getAnalyses(user.id);
        setAnalyses(updatedAnalyses);
      } else {
        setAnalyses(dbAnalyses);
      }
    } catch (error: any) {
      console.error('❌ Error loading analyses:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      // Set empty array on error to avoid breaking the UI
      setAnalyses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalysisClick = (analysis: ProductAnalysis) => {
    setSelectedAnalysis(analysis);
    setActiveSection('analysis');
  };

  const handleBackToHistory = () => {
    setSelectedAnalysis(null);
    setActiveSection('history');
  };

  const handleDeleteAnalysis = async (productId: string) => {
    if (!user) return;
    
    try {
      await analysisDb.deleteAnalysis(productId, user.id);
      setAnalyses(analyses.filter(a => a.product.id !== productId));
      if (selectedAnalysis?.product.id === productId) {
        handleBackToHistory();
      }
    } catch (error) {
      console.error('Error deleting analysis:', error);
      alert('Error deleting analysis');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff]"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const menuItems: MenuItem[] = [
    { id: 'analyze', label: 'Start analyzing', icon: BarChart3 },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header with Logo and Logout */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Logo size="md" showText={true} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <Home size={18} />
                <span className="font-medium">Return to home</span>
              </Link>
              
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <LogOut size={18} />
                <span className="font-medium">Sign out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-slate-200 bg-white">
          <div className="w-full">
            <nav className="flex" aria-label="Tabs">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id && !selectedAnalysis;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      setSelectedAnalysis(null);
                    }}
                    className={`
                      flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-t-lg font-medium text-sm transition-all relative
                      ${isActive
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }
                    `}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeSection === 'analyze' && (
            <div className="p-8 max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Header */}
                <div className="text-center mb-12">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#00d4ff]/30">
                    <BarChart3 className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-4xl font-bold text-slate-900 mb-4">
                    How does the analysis work?
                  </h2>
                  <p className="text-slate-600 text-lg max-w-2xl mx-auto mb-8">
                    Our AI deeply analyzes your AliExpress products to give you all the information needed for an informed decision
                  </p>
                </div>

                {/* CTA - Moved to top */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/10 rounded-2xl p-8 border border-[#00d4ff]/20 mb-12"
                >
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">
                    Ready to discover your products' potential?
                  </h3>
                  <p className="text-slate-600 mb-6 max-w-xl mx-auto">
                    Launch your first analysis in a few clicks and receive a complete report in less than 2 minutes
                  </p>
                  <Link href="/app">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold rounded-xl hover:shadow-xl hover:shadow-[#00d4ff]/30 transition-all shadow-lg shadow-[#00d4ff]/20"
                    >
                      <BarChart3 size={20} />
                      <span>Start analyzing</span>
                      <ArrowRight size={18} />
                    </motion.button>
                  </Link>
                </motion.div>

                {/* Process Steps */}
                <div className="mb-12">
                  <h3 className="text-2xl font-bold text-slate-900 mb-6">The process in 3 steps</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mb-4">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 mb-2">1. Visual analysis</h4>
                      <p className="text-slate-600 text-sm">
                        Our AI examines your product image to understand what it is, identify its niche and estimate its value
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mb-4">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 mb-2">2. Market analysis</h4>
                      <p className="text-slate-600 text-sm">
                        Search for competitors on Etsy, analyze market saturation and estimate sales potential
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 mb-2">3. Complete report</h4>
                      <p className="text-slate-600 text-sm">
                        You receive a clear verdict with all necessary data: pricing, marketing, SEO and strategy
                      </p>
                    </motion.div>
                  </div>
                </div>

                {/* Information Sections */}
                <div className="mb-12">
                  <h3 className="text-2xl font-bold text-slate-900 mb-6">The information you'll receive</h3>
                  
                  <div className="space-y-4">
                    {/* Verdict */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-slate-900 mb-2">Final verdict</h4>
                          <p className="text-slate-600 text-sm mb-2">
                            A clear recommendation: <strong>Launch quickly</strong>, <strong>Launch but optimize</strong>, or <strong>Don't launch</strong>
                          </p>
                          <p className="text-slate-500 text-xs">
                            Based on competitor analysis, market saturation and sales potential
                          </p>
                        </div>
                      </div>
                    </motion.div>

                    {/* Market Analysis */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-slate-900 mb-2">Market analysis</h4>
                          <ul className="text-slate-600 text-sm space-y-1 mb-2">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Approximate number of competitors on Etsy
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Market saturation level (not saturated, competitive, saturated)
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Average market price and price range
                            </li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>

                    {/* Pricing */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                      className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-slate-900 mb-2">Pricing strategy</h4>
                          <ul className="text-slate-600 text-sm space-y-1 mb-2">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Estimated supplier price (purchase cost)
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Recommended selling price (optimal, min, max)
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Estimated margin and risk level
                            </li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>

                    {/* Simulation */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 }}
                      className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Calculator className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-slate-900 mb-2">Launch simulation</h4>
                          <ul className="text-slate-600 text-sm space-y-1 mb-2">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Estimated time before first sale (with and without advertising)
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Estimated sales after 3 months (conservative, realistic, optimistic scenarios)
                            </li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>

                    {/* Marketing */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 }}
                      className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                          <Megaphone className="w-5 h-5 text-pink-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-slate-900 mb-2">Complete marketing strategy</h4>
                          <ul className="text-slate-600 text-sm space-y-1 mb-2">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Strategic positioning and underexploited angles
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Viral titles (EN) and optimized SEO tags
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              TikTok/Facebook ad ideas and prompts for ad images
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Psychological triggers and competitor mistakes to avoid
                            </li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {activeSection === 'history' && !selectedAnalysis && (
            <DashboardHistory
              analyses={analyses}
              onAnalysisClick={handleAnalysisClick}
              onDeleteAnalysis={handleDeleteAnalysis}
              onRefresh={loadAnalyses}
            />
          )}

          {activeSection === 'analysis' && selectedAnalysis && (
            <DashboardAnalysisDetail
              analysis={selectedAnalysis}
              onBack={handleBackToHistory}
              onDelete={() => handleDeleteAnalysis(selectedAnalysis.product.id)}
            />
          )}

          {activeSection === 'subscription' && (
            <DashboardSubscription user={user} />
          )}

          {activeSection === 'profile' && (
            <DashboardProfile user={user} />
          )}

          {activeSection === 'settings' && (
            <DashboardSettings user={user} />
          )}
        </div>
      </main>
    </div>
  );
}

