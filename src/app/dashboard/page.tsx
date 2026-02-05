'use client';

import { useState, useEffect, useRef } from 'react';
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
  X,
  Zap
} from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSubscriptionProtection } from '@/hooks/useSubscriptionProtection';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/ui/Logo';
import { analysisDb } from '@/lib/db/analyses';
import { useStore } from '@/store/useStore';
import type { ProductAnalysis } from '@/types';
import { DashboardHistory } from '@/components/dashboard/DashboardHistory';
import { DashboardAnalysisDetail } from '@/components/dashboard/DashboardAnalysisDetail';
import { DashboardAnalysisSimulation } from '@/components/dashboard/DashboardAnalysisSimulation';
import { DashboardListing } from '@/components/dashboard/DashboardListing';
import { DashboardImage } from '@/components/dashboard/DashboardImage';
import { ListingImagesScreen } from '@/components/dashboard/ListingImagesScreen';
import { DashboardProfile } from '@/components/dashboard/DashboardProfile';
import { DashboardSettings } from '@/components/dashboard/DashboardSettings';
import { DashboardSubscription } from '@/components/dashboard/DashboardSubscription';
import { CompetitorFinder } from '@/components/CompetitorFinder';
import { Paywall } from '@/components/paywall/Paywall';
type DashboardSection = 'analyze' | 'history' | 'analyse-simulation' | 'listing' | 'images' | 'profile' | 'settings' | 'subscription' | 'competitors';

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
  
  // 🔒 Protect this page - redirects blocked (no pricing page)
  const subscriptionProtection = useSubscriptionProtection();
  // ⚠️ CRITICAL: Utiliser useSubscription pour obtenir le statut RÉEL de l'abonnement
  // useSubscriptionProtection assume parfois un abonnement actif pour éviter les bugs, donc on utilise useSubscription
  const { subscription, loading: subscriptionLoadingFromHook, hasActiveSubscription: realHasActiveSubscription } = useSubscription();
  const hasActiveSubscription = subscriptionProtection.isActive;
  const subscriptionLoading = subscriptionProtection.isLoading || subscriptionLoadingFromHook;
  
  // Cache pour éviter les rechargements inutiles
  const lastLoadTimeRef = useRef<number>(0);
  const CACHE_DURATION = 60000; // 1 minute
  const CACHE_KEY = 'etsmart-analyses-cache';
  
  const [activeSection, setActiveSection] = useState<DashboardSection>(() => {
    // Récupérer la dernière section visitée depuis localStorage, sinon utiliser 'analyse-simulation' par défaut
    // ⚠️ CRITICAL: Ne JAMAIS utiliser 'history' comme section par défaut, même si c'est la dernière section visitée
    if (typeof window !== 'undefined') {
      try {
        const lastSection = localStorage.getItem('etsmart-last-dashboard-section') as DashboardSection | null;
        // Ne jamais utiliser 'history' comme section par défaut au refresh
        if (lastSection && lastSection !== 'history' && ['analyze', 'analysis', 'analyse-simulation', 'listing', 'images', 'profile', 'settings', 'subscription', 'competitors'].includes(lastSection)) {
          return lastSection;
        }
      } catch (e) {
        console.warn('⚠️ Error reading last dashboard section:', e);
      }
    }
    return 'analyse-simulation'; // Par défaut, aller sur "Analyse et Simulation" au lieu de "history"
  });
  const [selectedAnalysis, setSelectedAnalysis] = useState<ProductAnalysis | null>(null);
  // Sous-onglet actif dans la section "analyse-simulation" : 'analyse' ou 'simulation'
  const [activeSubTab, setActiveSubTab] = useState<'analyse' | 'simulation'>('analyse');
  // Initialiser avec les données du cache localStorage si disponibles
  const [analyses, setAnalyses] = useState<ProductAnalysis[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { analyses: cachedAnalyses, timestamp } = JSON.parse(cached);
        const now = Date.now();
        if (cachedAnalyses && cachedAnalyses.length > 0 && (now - timestamp) < CACHE_DURATION) {
          console.log('📊 Initializing with localStorage cache:', cachedAnalyses.length);
          lastLoadTimeRef.current = timestamp;
          return cachedAnalyses;
        }
      }
    } catch (e) {
      console.warn('⚠️ Error initializing from localStorage:', e);
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false); // Commencer à false
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
          try {
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
            } else {
              console.warn('[Dashboard] Sync failed, continuing anyway');
            }
          } catch (error) {
            console.error('[Dashboard] Sync error (non-critical):', error);
            // Continue even if sync fails
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
      } else if (section && ['analyze', 'history', 'analysis', 'analyse-simulation', 'listing', 'images', 'profile', 'settings', 'subscription', 'competitors'].includes(section)) {
        setActiveSection(section as DashboardSection);
      } else {
        // Récupérer la dernière section visitée depuis localStorage
        // ⚠️ CRITICAL: Ne JAMAIS utiliser 'history' comme section par défaut
        try {
          const lastSection = localStorage.getItem('etsmart-last-dashboard-section') as DashboardSection | null;
          // Ne jamais utiliser 'history' comme section par défaut au refresh
          if (lastSection && lastSection !== 'history' && ['analyze', 'analysis', 'analyse-simulation', 'listing', 'images', 'profile', 'settings', 'subscription', 'competitors'].includes(lastSection)) {
            setActiveSection(lastSection);
          } else {
            // Par défaut, rediriger vers "Analyse et Simulation" si aucune section n'est spécifiée
            setActiveSection('analyse-simulation');
          }
        } catch (e) {
          // En cas d'erreur, utiliser la section par défaut
          setActiveSection('analyse-simulation');
        }
      }
    }
  }, []);

  // ⚠️ CRITICAL: Rediriger vers 'analyse-simulation' si on est sur la page d'historique vide après rafraîchissement
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    
    // Si on est sur la section 'history' et qu'il n'y a pas d'analyses, rediriger vers 'analyse-simulation'
    if (activeSection === 'history' && analyses.length === 0 && !isLoading) {
      console.log('[Dashboard] No analyses found on history page, redirecting to analyse-simulation section');
      setActiveSection('analyse-simulation');
      // Nettoyer localStorage pour éviter de revenir sur 'history' au prochain refresh
      try {
        localStorage.setItem('etsmart-last-dashboard-section', 'analyse-simulation');
      } catch (e) {
        console.warn('⚠️ Error updating last dashboard section:', e);
      }
    }
  }, [activeSection, analyses.length, isLoading, user]);

  // Sauvegarder la dernière section visitée dans localStorage
  // ⚠️ CRITICAL: Ne JAMAIS sauvegarder 'history' comme dernière section si elle est vide
  useEffect(() => {
    if (typeof window !== 'undefined' && activeSection) {
      try {
        // Ne sauvegarder 'history' que si on a des analyses, sinon sauvegarder 'analyse-simulation'
        if (activeSection === 'history' && analyses.length === 0) {
          console.log('[Dashboard] History section is empty, saving analyse-simulation instead');
          localStorage.setItem('etsmart-last-dashboard-section', 'analyse-simulation');
        } else {
          localStorage.setItem('etsmart-last-dashboard-section', activeSection);
        }
      } catch (e) {
        console.warn('⚠️ Error saving last dashboard section:', e);
      }
    }
  }, [activeSection, analyses.length]);

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
      // Si on a déjà des analyses dans le state (depuis localStorage), vérifier si on doit recharger
      const now = Date.now();
      if (analyses.length > 0 && (now - lastLoadTimeRef.current) < CACHE_DURATION) {
        console.log('📊 Using existing analyses from cache, no reload needed');
        return;
      }
      
      // Vérifier le store
      const { analyses: storeAnalyses } = useStore.getState();
      if (storeAnalyses && storeAnalyses.length > 0 && analyses.length === 0) {
        // Utiliser les données du store temporairement pendant le chargement
        setAnalyses(storeAnalyses);
        lastLoadTimeRef.current = Date.now();
      }
      // Charger les données depuis la DB (avec cache)
      loadAnalyses();
    }
  }, [user]);

  // Recharger les analyses quand l'utilisateur revient sur la page (focus) - seulement si le cache est expiré
  useEffect(() => {
    if (!user) return;
    
    const handleFocus = () => {
      const now = Date.now();
      // Ne recharger que si le cache est expiré (plus de 1 minute)
      if ((now - lastLoadTimeRef.current) >= CACHE_DURATION) {
        loadAnalyses(true);
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  const loadAnalyses = async (force = false) => {
    if (!user) return;
    
    // Vérifier le cache (localStorage + state)
    const now = Date.now();
    if (!force) {
      // Vérifier d'abord le state
      if (analyses.length > 0 && (now - lastLoadTimeRef.current) < CACHE_DURATION) {
        console.log('📊 Using cached analyses from state');
        return;
      }
      
      // Vérifier localStorage
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { analyses: cachedAnalyses, timestamp } = JSON.parse(cached);
          if (cachedAnalyses && cachedAnalyses.length > 0 && (now - timestamp) < CACHE_DURATION) {
            console.log('📊 Using cached analyses from localStorage:', cachedAnalyses.length);
            setAnalyses(cachedAnalyses);
            lastLoadTimeRef.current = timestamp;
            return;
          }
        }
      } catch (e) {
        console.warn('⚠️ Error checking localStorage cache:', e);
      }
    }
    
    try {
      setIsLoading(true);
      
      // Conserver les analyses existantes pendant le chargement
      const currentAnalyses = analyses.length > 0 ? analyses : [];
      
      // 1. Charger les analyses depuis la DB
      const dbAnalyses = await analysisDb.getAnalyses(user.id);
      console.log('📊 Loaded analyses from database:', dbAnalyses.length, dbAnalyses.map(a => a.product.title?.substring(0, 30)));
      
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
        console.log('📊 Reloaded analyses after sync:', updatedAnalyses.length, updatedAnalyses.map(a => a.product.title?.substring(0, 30)));
        
        // Fusionner avec les analyses locales et existantes pour ne rien perdre
        const mergedAnalyses = [...updatedAnalyses];
        
        // Ajouter les analyses locales qui ne sont pas dans la DB
        for (const localAnalysis of localAnalyses) {
          const exists = mergedAnalyses.some(db => db.product.id === localAnalysis.product.id);
          if (!exists) {
            console.log('➕ Adding local analysis to merged list:', localAnalysis.product.title);
            mergedAnalyses.push(localAnalysis);
          }
        }
        
        // Ajouter les analyses existantes qui ne sont ni dans la DB ni dans le store local
        for (const currentAnalysis of currentAnalyses) {
          const existsInDb = mergedAnalyses.some(db => db.product.id === currentAnalysis.product.id);
          const existsInLocal = localAnalyses.some(local => local.product.id === currentAnalysis.product.id);
          if (!existsInDb && !existsInLocal) {
            console.log('➕ Adding current analysis to merged list:', currentAnalysis.product.title);
            mergedAnalyses.push(currentAnalysis);
          }
        }
        
        setAnalyses(mergedAnalyses);
        console.log('📊 Final merged analyses count:', mergedAnalyses.length);
        
        // Sauvegarder dans localStorage
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            analyses: mergedAnalyses,
            timestamp: now
          }));
        } catch (e) {
          console.warn('⚠️ Error saving to localStorage:', e);
        }
      } else {
        // Fusionner avec les analyses existantes
        const mergedAnalyses = [...dbAnalyses];
        for (const currentAnalysis of currentAnalyses) {
          const exists = mergedAnalyses.some(db => db.product.id === currentAnalysis.product.id);
          if (!exists) {
            console.log('➕ Adding current analysis to merged list:', currentAnalysis.product.title);
            mergedAnalyses.push(currentAnalysis);
          }
        }
        setAnalyses(mergedAnalyses);
        console.log('📊 Final merged analyses count (no local):', mergedAnalyses.length);
        
        // Sauvegarder dans localStorage
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            analyses: mergedAnalyses,
            timestamp: now
          }));
        } catch (e) {
          console.warn('⚠️ Error saving to localStorage:', e);
        }
      }
      
      // Mettre à jour le timestamp du cache
      lastLoadTimeRef.current = now;
    } catch (error: any) {
      console.error('❌ Error loading analyses:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      // Ne pas vider les analyses existantes en cas d'erreur
      if (analyses.length === 0) {
        setAnalyses([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalysisClick = (analysis: ProductAnalysis) => {
    setSelectedAnalysis(analysis);
    // Réinitialiser le sous-onglet à 'analyse' par défaut
    setActiveSubTab('analyse');
    // L'utilisateur peut choisir quelle section afficher via le menu
    // Par défaut, on reste sur la section actuelle ou on va sur "analyse-simulation"
    if (activeSection !== 'analyse-simulation' && activeSection !== 'listing' && activeSection !== 'images') {
      setActiveSection('analyse-simulation');
    }
  };

  const handleBackToHistory = () => {
    setSelectedAnalysis(null);
    setActiveSection('history');
  };

  const handleDeleteAnalysis = async (productId: string) => {
    if (!user) return;
    
    try {
      await analysisDb.deleteAnalysis(productId, user.id);
      const updatedAnalyses = analyses.filter(a => a.product.id !== productId);
      setAnalyses(updatedAnalyses);
      
      // Mettre à jour le cache localStorage
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          analyses: updatedAnalyses,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('⚠️ Error updating localStorage cache:', e);
      }
      
      if (selectedAnalysis?.product.id === productId) {
        handleBackToHistory();
      }
    } catch (error) {
      console.error('Error deleting analysis:', error);
      alert('Error deleting analysis');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Nettoyer le localStorage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      // Rediriger vers la page d'accueil
      router.push('/');
      // Forcer le rechargement pour s'assurer que tout est nettoyé
      window.location.href = '/';
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // Même en cas d'erreur, rediriger vers la page d'accueil
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
      }
    }
  };

  // ⚠️ CRITICAL: Toujours afficher le contenu pour éviter l'espace noir au rafraîchissement
  // Ne retourner null que si on est sûr qu'il n'y a pas d'utilisateur ET que le chargement est terminé
  if (!user && !loading && !subscriptionLoading) {
    return null;
  }

  // ⚠️ CRITICAL: Bloquer l'accès au dashboard si l'utilisateur n'a pas d'abonnement actif
  // Cette vérification s'applique à TOUS les utilisateurs : nouveaux ET existants sans abonnement
  // Utiliser useSubscription pour obtenir le statut RÉEL (pas useSubscriptionProtection qui assume parfois un abonnement)
  if (user && !loading && !subscriptionLoading) {
    // Vérifier le statut réel depuis useSubscription
    // Si pas d'abonnement OU abonnement non actif, afficher le paywall
    const subscriptionStatus = subscription?.status;
    const periodEnd = subscription?.periodEnd;
    const now = new Date();
    const isPeriodValid = periodEnd ? periodEnd > now : false;
    const isSubscriptionActive = subscriptionStatus === 'active' || (subscription && isPeriodValid);
    
    // Si pas d'abonnement OU abonnement non actif, afficher le paywall
    if (!subscription || !isSubscriptionActive) {
      console.log('[Dashboard] 🚧 PAYWALL - Pas d\'abonnement actif (user:', user?.id, ')');
      console.log('[Dashboard] 📊 Subscription:', subscription, 'isSubscriptionActive:', isSubscriptionActive, 'realHasActiveSubscription:', realHasActiveSubscription);
      return (
        <div className="min-h-screen w-full relative overflow-hidden bg-black">
          <Paywall 
            hasActiveSubscription={false}
            title="Débloquer l'analyse de produits"
            message="Choisissez votre plan et commencez à analyser des produits avec l'IA"
          />
        </div>
      );
    }
  }

  const menuItems: MenuItem[] = [
    { id: 'analyse-simulation', label: 'Analyse et Simulation', icon: Calculator },
    { id: 'listing', label: 'Listing', icon: FileText },
    { id: 'images', label: 'Images', icon: Sparkles },
    { id: 'competitors', label: 'Boutiques concurrents', icon: Target },
    { id: 'subscription', label: 'Abonnement', icon: CreditCard },
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="h-screen bg-black flex overflow-hidden">
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
            <div className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] rounded-lg shadow-2xl shadow-[#00d4ff]/40 p-4 border-2 border-white/20">
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

      {/* Sidebar */}
      <aside className="group fixed left-0 top-0 h-screen z-40 flex">
        {/* Sidebar Container */}
        <div className="relative bg-black border-r border-black/20 w-16 group-hover:w-64 transition-all duration-300 ease-in-out overflow-hidden">
          {/* Logo */}
          <div className="p-4 border-b border-black/30">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Logo size="sm" showText={false} />
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden text-white font-bold text-lg">
                Etsmart
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col p-2 space-y-1">
            {/* Menu principal (affiché quand aucune analyse n'est sélectionnée) */}
            {!selectedAnalysis && menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    // ⚠️ CRITICAL: Si on clique sur 'history' et qu'il n'y a pas d'analyses, rediriger vers 'analyse-simulation'
                    if (item.id === 'history' && analyses.length === 0) {
                      console.log('[Dashboard] History clicked but no analyses, redirecting to analyse-simulation');
                      setActiveSection('analyse-simulation');
                      try {
                        localStorage.setItem('etsmart-last-dashboard-section', 'analyse-simulation');
                      } catch (e) {
                        console.warn('⚠️ Error saving last dashboard section:', e);
                      }
                    } else {
                      setActiveSection(item.id);
                    }
                    setSelectedAnalysis(null);
                  }}
                  className={`
                    relative flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all group/item
                    ${isActive
                      ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-black/30 space-y-1">
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-all group/item"
            >
              <Home size={20} className="flex-shrink-0" />
              <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Retour à l'accueil
              </span>
            </Link>
            
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-all group/item"
            >
              <LogOut size={20} className="flex-shrink-0" />
              <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Déconnexion
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/5 border-b border-white/10 lg:hidden">
          <div className="flex items-center justify-between p-4">
            <Logo size="sm" showText={true} />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
          
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-white/10 bg-black/50 backdrop-blur-sm"
              >
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id && !selectedAnalysis;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        // ⚠️ CRITICAL: Si on clique sur 'history' et qu'il n'y a pas d'analyses, rediriger vers 'analyse-simulation'
                        if (item.id === 'history' && analyses.length === 0) {
                          console.log('[Dashboard] History clicked but no analyses, redirecting to analyse-simulation');
                          setActiveSection('analyse-simulation');
                          try {
                            localStorage.setItem('etsmart-last-dashboard-section', 'analyse-simulation');
                          } catch (e) {
                            console.warn('⚠️ Error saving last dashboard section:', e);
                          }
                        } else {
                          setActiveSection(item.id);
                          // Sauvegarder la section dans localStorage
                          if (typeof window !== 'undefined') {
                            try {
                              localStorage.setItem('etsmart-last-dashboard-section', item.id);
                            } catch (e) {
                              console.warn('⚠️ Error saving last dashboard section:', e);
                            }
                          }
                        }
                        setSelectedAnalysis(null);
                        setIsMenuOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 font-medium text-sm transition-all
                        ${isActive
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white'
                          : 'text-white/70 hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 ml-16 lg:ml-16 pt-16 lg:pt-0 bg-black">

        {/* Content */}
        <div className="flex-1 overflow-auto bg-black">
          {activeSection === 'analyse-simulation' && (
            <div className="p-8 max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Header */}
                <div className="text-center mb-12">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#00d4ff]/30">
                    <Calculator className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-4xl font-bold text-white mb-4">
                    Analyse et Simulation
                  </h2>
                  <p className="text-white/70 text-lg max-w-2xl mx-auto mb-4">
                    Analysez vos produits AliExpress et simulez leur potentiel de vente avec notre IA
                  </p>
                  <div className="flex items-center justify-center gap-2 text-[#00d4ff] mb-8">
                    <Zap size={18} />
                    <span className="text-sm font-medium">0.5 crédit par analyse</span>
                  </div>
                </div>

                {/* CTA - Moved to top */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center bg-white/5 rounded-lg p-8 border border-white/10 mb-12"
                >
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Prêt à analyser vos produits ?
                  </h3>
                  <p className="text-white/70 mb-6 max-w-xl mx-auto">
                    Lancez une analyse complète et recevez un rapport détaillé avec simulation de lancement en moins de 2 minutes
                  </p>
                  <Link href="/app">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold rounded-xl hover:shadow-xl hover:shadow-[#00d4ff]/30 transition-all shadow-lg shadow-[#00d4ff]/20"
                    >
                      <Calculator size={20} />
                      <span>Commencer l'analyse</span>
                      <ArrowRight size={18} />
                    </motion.button>
                  </Link>
                </motion.div>

                {/* Process Steps */}
                <div className="mb-12">
                  <h3 className="text-2xl font-bold text-white mb-6">Le processus en 3 étapes</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-white/5 rounded-lg p-6 border border-white/10"
                    >
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mb-4">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                      <h4 className="text-lg font-bold text-white mb-2">1. Analyse visuelle</h4>
                      <p className="text-white/70 text-sm">
                        Notre IA examine l'image de votre produit pour comprendre ce que c'est, identifier sa niche et estimer sa valeur
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-white/5 rounded-lg p-6 border border-white/10"
                    >
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mb-4">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <h4 className="text-lg font-bold text-white mb-2">2. Analyse du marché</h4>
                      <p className="text-white/70 text-sm">
                        Recherche de concurrents sur Etsy, analyse de la saturation du marché et estimation du potentiel de ventes
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-white/5 rounded-lg p-6 border border-white/10"
                    >
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <h4 className="text-lg font-bold text-white mb-2">3. Rapport complet</h4>
                      <p className="text-white/70 text-sm">
                        Vous recevez un verdict clair avec toutes les données nécessaires : prix, marketing, SEO et stratégie
                      </p>
                    </motion.div>
                  </div>
                </div>

                {/* Information Sections */}
                <div className="mb-12">
                  <h3 className="text-2xl font-bold text-white mb-6">Les informations que vous recevrez</h3>
                  
                  <div className="space-y-4">
                    {/* Verdict */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="bg-white/5 rounded-lg p-6 border border-white/10"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-white mb-2">Verdict final</h4>
                          <p className="text-white/70 text-sm mb-2">
                            Une recommandation claire : <strong>Lancer rapidement</strong>, <strong>Lancer mais optimiser</strong>, ou <strong>Ne pas lancer</strong>
                          </p>
                          <p className="text-white/50 text-xs">
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
                      className="bg-white/5 rounded-lg p-6 border border-white/10"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-white mb-2">Analyse du marché</h4>
                          <ul className="text-white/70 text-sm space-y-1 mb-2">
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
                      className="bg-white/5 rounded-lg p-6 border border-white/10"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-white mb-2">Stratégie de prix</h4>
                          <ul className="text-white/70 text-sm space-y-1 mb-2">
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
                      className="bg-white/5 rounded-lg p-6 border border-white/10"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <Calculator className="w-5 h-5 text-orange-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-white mb-2">Simulation de lancement</h4>
                          <ul className="text-white/70 text-sm space-y-1 mb-2">
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

                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {activeSection === 'listing' && selectedAnalysis && (
            <DashboardListing analysis={selectedAnalysis} />
          )}

          {activeSection === 'listing' && !selectedAnalysis && (
            <ListingImagesScreen
              initialAnalysis={null}
              mode="listing"
              onAnalysisSelect={(analysis) => {
                setSelectedAnalysis(analysis);
                // Garder la section 'listing' active
              }}
              onBack={() => {
                setSelectedAnalysis(null);
              }}
            />
          )}

          {activeSection === 'images' && selectedAnalysis && (
            <DashboardImage analysis={selectedAnalysis} />
          )}

          {activeSection === 'images' && !selectedAnalysis && (
            <ListingImagesScreen
              initialAnalysis={null}
              mode="images"
              onAnalysisSelect={(analysis) => {
                setSelectedAnalysis(analysis);
                // Garder la section 'images' active
              }}
              onBack={() => {
                setSelectedAnalysis(null);
              }}
            />
          )}

          {activeSection === 'history' && !selectedAnalysis && (
            <>
              {isLoading ? (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-white/10 rounded w-1/4"></div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-white/10 rounded-lg"></div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <DashboardHistory
                  analyses={analyses}
                  onAnalysisClick={handleAnalysisClick}
                  onDeleteAnalysis={handleDeleteAnalysis}
                  onRefresh={loadAnalyses}
                />
              )}
            </>
          )}

          {activeSection === 'analyse-simulation' && selectedAnalysis && (
            <div className="p-4 md:p-8 bg-black">
              <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                  <button
                    onClick={handleBackToHistory}
                    className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/10"
                  >
                    <ArrowRight size={20} className="rotate-180" />
                    <span>Retour à l'historique</span>
                  </button>
                </div>

                {/* Sous-onglets Analyse / Simulation */}
                <div className="mb-8 flex items-center gap-4 border-b border-white/10">
                  <button
                    onClick={() => setActiveSubTab('analyse')}
                    className={`px-6 py-3 font-semibold text-base transition-all relative ${
                      activeSubTab === 'analyse'
                        ? 'text-white'
                        : 'text-white/60 hover:text-white/80'
                    }`}
                  >
                    Analyse
                    {activeSubTab === 'analyse' && (
                      <motion.div
                        layoutId="activeSubTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveSubTab('simulation')}
                    className={`px-6 py-3 font-semibold text-base transition-all relative ${
                      activeSubTab === 'simulation'
                        ? 'text-white'
                        : 'text-white/60 hover:text-white/80'
                    }`}
                  >
                    Simulation
                    {activeSubTab === 'simulation' && (
                      <motion.div
                        layoutId="activeSubTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </button>
                </div>

                {/* Contenu des sous-onglets */}
                <AnimatePresence mode="wait">
                  {activeSubTab === 'analyse' ? (
                    <motion.div
                      key="analyse"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <DashboardAnalysisDetail
                        analysis={selectedAnalysis}
                        onBack={handleBackToHistory}
                        onDelete={() => handleDeleteAnalysis(selectedAnalysis.product.id)}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="simulation"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <DashboardAnalysisSimulation analysis={selectedAnalysis} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}


          {activeSection === 'competitors' && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <CompetitorFinder />
            </div>
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

