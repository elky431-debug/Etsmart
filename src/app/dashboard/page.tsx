'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  CreditCard,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSubscriptionProtection } from '@/hooks/useSubscriptionProtection';
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
  const isMobile = useIsMobile();
  
  // 🔒 Protect this page - redirect to /pricing if no active subscription
  const { isActive: hasActiveSubscription, isLoading: subscriptionLoading } = useSubscriptionProtection();
  
  const [activeSection, setActiveSection] = useState<DashboardSection>('history');
  const [selectedAnalysis, setSelectedAnalysis] = useState<ProductAnalysis | null>(null);
  const [analyses, setAnalyses] = useState<ProductAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Force sync subscription from Stripe on page load
  useEffect(() => {
    const forceSync = async () => {
      if (!user) return;
      
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          console.log('[Dashboard] Force syncing subscription from Stripe...');
          const response = await fetch('/api/force-sync-subscription', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('[Dashboard] ✅ Force sync result:', data);
          }
        }
      } catch (error) {
        console.error('[Dashboard] Force sync error:', error);
      }
    };
    
    forceSync();
  }, [user]);

  // Check URL parameter to set initial section and show success notification
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const section = params.get('section') as DashboardSection | null;
      
      // Check if coming from successful subscription
      const success = params.get('success');
      if (success === 'true') {
        // Redirect to subscription tab to show the new subscription
        setActiveSection('subscription');
        setShowSuccessNotification(true);
        
        // Auto-hide notification after 8 seconds
        const timer = setTimeout(() => {
          setShowSuccessNotification(false);
        }, 8000);
        
        // Clean up URL parameters
        const newUrl = window.location.pathname + '?section=subscription';
        window.history.replaceState({}, '', newUrl);
        
        return () => clearTimeout(timer);
      } else if (section && ['analyze', 'history', 'analysis', 'profile', 'settings', 'subscription'].includes(section)) {
        setActiveSection(section);
      }
    }
  }, []);

  // Fermer le menu au clic en dehors
  useEffect(() => {
    if (!isMenuOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.mobile-menu-container')) {
        setIsMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

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

  if (loading || isLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff]"></div>
          <p className="mt-4 text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const menuItems: MenuItem[] = [
    { id: 'analyze', label: 'Analyser', icon: BarChart3 },
    { id: 'subscription', label: 'Abonnement', icon: CreditCard },
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Success Notification */}
      <AnimatePresence>
        {showSuccessNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <div className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] rounded-xl shadow-2xl shadow-[#00d4ff]/40 p-4 border-2 border-white/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg mb-1">
                    Abonnement activé avec succès !
                  </h3>
                  <p className="text-white/90 text-sm">
                    Votre abonnement est maintenant actif. Vous pouvez commencer à analyser des produits immédiatement.
                  </p>
                </div>
                <button
                  onClick={() => setShowSuccessNotification(false)}
                  className="text-white/80 hover:text-white transition-colors flex-shrink-0"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <span className="font-medium">Retour à l'accueil</span>
              </Link>
              
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <LogOut size={18} />
                <span className="font-medium">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-slate-200 bg-white">
          {isMobile ? (
            /* Mobile: Menu déroulant */
            <div className="relative mobile-menu-container">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`
                  w-full flex items-center justify-between px-4 py-3 font-medium text-sm transition-all
                  ${activeSection && !selectedAnalysis
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white'
                    : 'text-slate-600 bg-white'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  {(() => {
                    const activeItem = menuItems.find(item => item.id === activeSection);
                    const Icon = activeItem?.icon || Menu;
                    return (
                      <>
                        <Icon size={18} />
                        <span>{activeItem?.label || 'Menu'}</span>
                      </>
                    );
                  })()}
                </div>
                <ChevronDown 
                  size={18} 
                  className={`transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>
              
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50"
                  >
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.id && !selectedAnalysis;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveSection(item.id);
                            setSelectedAnalysis(null);
                            setIsMenuOpen(false);
                          }}
                          className={`
                            w-full flex items-center gap-3 px-4 py-3 font-medium text-sm transition-all border-b border-slate-100 last:border-b-0
                            ${isActive
                              ? 'bg-gradient-to-r from-[#00d4ff]/10 to-[#00c9b7]/10 text-[#00d4ff]'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }
                          `}
                        >
                          <Icon size={18} />
                          <span>{item.label}</span>
                          {isActive && (
                            <div className="ml-auto w-2 h-2 rounded-full bg-[#00d4ff]" />
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* Desktop: Onglets horizontaux */
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
          )}
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
                    Comment fonctionne l'analyse ?
                  </h2>
                  <p className="text-slate-600 text-lg max-w-2xl mx-auto mb-8">
                    Notre IA analyse en profondeur vos produits AliExpress pour vous donner toutes les informations nécessaires à une décision éclairée
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
                    Prêt à découvrir le potentiel de vos produits ?
                  </h3>
                  <p className="text-slate-600 mb-6 max-w-xl mx-auto">
                    Lancez votre première analyse en quelques clics et recevez un rapport complet en moins de 2 minutes
                  </p>
                  <Link href="/app">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold rounded-xl hover:shadow-xl hover:shadow-[#00d4ff]/30 transition-all shadow-lg shadow-[#00d4ff]/20"
                    >
                      <BarChart3 size={20} />
                      <span>Commencer l'analyse</span>
                      <ArrowRight size={18} />
                    </motion.button>
                  </Link>
                </motion.div>

                {/* Process Steps */}
                <div className="mb-12">
                  <h3 className="text-2xl font-bold text-slate-900 mb-6">Le processus en 3 étapes</h3>
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
                      <h4 className="text-lg font-bold text-slate-900 mb-2">1. Analyse visuelle</h4>
                      <p className="text-slate-600 text-sm">
                        Notre IA examine l'image de votre produit pour comprendre ce que c'est, identifier sa niche et estimer sa valeur
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
                      <h4 className="text-lg font-bold text-slate-900 mb-2">2. Analyse du marché</h4>
                      <p className="text-slate-600 text-sm">
                        Recherche de concurrents sur Etsy, analyse de la saturation du marché et estimation du potentiel de ventes
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
                      <h4 className="text-lg font-bold text-slate-900 mb-2">3. Rapport complet</h4>
                      <p className="text-slate-600 text-sm">
                        Vous recevez un verdict clair avec toutes les données nécessaires : prix, marketing, SEO et stratégie
                      </p>
                    </motion.div>
                  </div>
                </div>

                {/* Information Sections */}
                <div className="mb-12">
                  <h3 className="text-2xl font-bold text-slate-900 mb-6">Les informations que vous recevrez</h3>
                  
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
                          <h4 className="text-lg font-bold text-slate-900 mb-2">Verdict final</h4>
                          <p className="text-slate-600 text-sm mb-2">
                            Une recommandation claire : <strong>Lancer rapidement</strong>, <strong>Lancer mais optimiser</strong>, ou <strong>Ne pas lancer</strong>
                          </p>
                          <p className="text-slate-500 text-xs">
                            Basé sur l'analyse des concurrents, la saturation du marché et le potentiel de ventes
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
                          <h4 className="text-lg font-bold text-slate-900 mb-2">Analyse du marché</h4>
                          <ul className="text-slate-600 text-sm space-y-1 mb-2">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Nombre approximatif de concurrents sur Etsy
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Niveau de saturation du marché (peu saturé, compétitif, saturé)
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Prix moyen du marché et fourchette de prix
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
                          <h4 className="text-lg font-bold text-slate-900 mb-2">Stratégie de prix</h4>
                          <ul className="text-slate-600 text-sm space-y-1 mb-2">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Prix fournisseur estimé (coût d'achat)
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Prix de vente recommandé (optimal, min, max)
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Marge estimée et niveau de risque
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
                          <h4 className="text-lg font-bold text-slate-900 mb-2">Simulation de lancement</h4>
                          <ul className="text-slate-600 text-sm space-y-1 mb-2">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Temps estimé avant la première vente (avec et sans publicité)
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Ventes estimées après 3 mois (scénarios conservateur, réaliste, optimiste)
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
                          <h4 className="text-lg font-bold text-slate-900 mb-2">Stratégie marketing complète</h4>
                          <ul className="text-slate-600 text-sm space-y-1 mb-2">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Positionnement stratégique et angles sous-exploités
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Titres viraux (EN) et tags SEO optimisés
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Idées de publicités TikTok/Facebook et prompts pour images pub
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#00c9b7]" />
                              Déclencheurs psychologiques et erreurs des concurrents à éviter
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

