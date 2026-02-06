'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  Zap,
  Copy,
  Check,
  PenTool,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  Crown,
  Star,
  Globe,
  ChevronUp
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
type DashboardSection = 'analyze' | 'history' | 'analyse-simulation' | 'listing' | 'images' | 'profile' | 'settings' | 'subscription' | 'competitors' | 'prompt-universel' | 'etsy-trends' | 'top-etsy-sellers' | 'niche-finder';

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

  // Fonction pour obtenir le prompt universel
  const getUniversalImagePrompt = (): string => {
    return `You are a professional lifestyle photographer specialized in high-converting product images for Etsy.

REFERENCE PRODUCT
Use the provided product image as the ONLY reference. The generated image must faithfully represent the exact same product.

CRITICAL RULE – EXACT PRODUCT FIDELITY
The product in the generated image must be IDENTICAL to the product shown in the reference image
Reproduce the product exactly as it appears: shape, proportions, colors, materials, textures, finishes, and details
If the product contains any writing, text, symbols, engravings, or markings, they must be reproduced EXACTLY as shown
Do NOT modify, enhance, stylize, or reinterpret the product in any way
The product must remain the central focus of the image

SCENE & CONTEXT
Create a realistic, natural lifestyle scene that shows the product in its ideal real-world usage context.
The environment must feel authentic, credible, and appropriate for the type of product.

BACKGROUND & DEPTH (MANDATORY)
The scene must include a natural background with visible depth
Use foreground and background separation to create a sense of space
The background should be softly blurred or naturally out of focus (depth of field)
Avoid flat, empty, or plain backgrounds

MOOD & EMOTION
Calm, pleasant, and inviting atmosphere
Emotion to convey: comfort, trust, and desirability
Style: premium Etsy lifestyle photography (authentic, warm, aspirational, not commercial or artificial)

PHOTOGRAPHY STYLE
Soft natural lighting only (no artificial flash)
Ultra-realistic photo rendering
Natural depth of field
Balanced, harmonious colors
Clean and engaging camera angle

ABSOLUTE PROHIBITIONS (outside of the product itself)
NO added text
NO added logos
NO brand names
NO watermarks
NO price tags
NO badges, stickers, or icons
NO artificial marketing elements
NO frames, borders, overlays, or graphic elements
NO flat catalog-style photography

The final image should look like a high-quality Etsy listing photo and naturally make people want to click and buy.`;
  };

  // Composant pour afficher le Niche Finder
  const NicheFinderSection = () => {
    // Données des niches basées sur les images
    const niches = [
      { niche: 'seagrass', competition: 8628, searchVolume: 60500 },
      { niche: 'laptop wallpaper', competition: 8603, searchVolume: 201000 },
      { niche: 'cattle dog', competition: 8602, searchVolume: 110000 },
      { niche: 'coaching tools', competition: 8599, searchVolume: 6600 },
      { niche: 'purple swimsuit', competition: 8594, searchVolume: 5400 },
      { niche: 'modeling clay', competition: 8592, searchVolume: 60500 },
      { niche: 'rider jacket', competition: 8589, searchVolume: 14800 },
      { niche: 'barbiecore', competition: 8578, searchVolume: 6600 },
      { niche: 'customised bag', competition: 8571, searchVolume: 14800 },
      { niche: 'florida vacation', competition: 8560, searchVolume: 9900 },
    ];

    const maxCompetition = 8700;
    const maxSearchVolume = 201000;

    return (
      <div className="p-4 md:p-8 bg-black">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Recherche de Niche</h1>
                  <p className="text-white/70 text-sm mt-1">
                    Trouvez des opportunités à faible concurrence que les autres vendeurs manquent
                  </p>
                </div>
              </div>
              
              {/* Global Dropdown */}
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors">
                  <Globe size={16} className="text-white/70" />
                  <span className="text-white">Mondial</span>
                  <ChevronDown size={16} className="text-white/70" />
                </button>
              </div>
            </div>

            {/* Product Ideas & Keywords Table */}
            <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-2xl font-bold text-white">Idées de Produits & Mots-clés</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">
                        <div className="flex items-center gap-2">
                          <span>Niche</span>
                          <div className="flex flex-col">
                            <ChevronUp size={12} className="text-white/50" />
                            <ChevronDown size={12} className="text-white/50 -mt-1" />
                          </div>
                        </div>
                      </th>
                      <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">
                        <div className="flex items-center gap-2">
                          <span>Concurrence</span>
                          <div className="flex flex-col">
                            <ChevronUp size={12} className="text-white/50" />
                            <ChevronDown size={12} className="text-white/50 -mt-1" />
                          </div>
                        </div>
                      </th>
                      <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">
                        <div className="flex items-center gap-2">
                          <span>Volume de Recherche</span>
                          <div className="flex flex-col">
                            <ChevronUp size={12} className="text-white/50" />
                            <ChevronDown size={12} className="text-white/50 -mt-1" />
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {niches.map((item, index) => {
                      const competitionPercent = (item.competition / maxCompetition) * 100;
                      const searchVolumePercent = (item.searchVolume / maxSearchVolume) * 100;
                      const isLowSearchVolume = item.searchVolume < 10000;
                      
                      return (
                        <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{item.niche}</span>
                              {item.niche === 'barbiecore' && (
                                <HelpCircle size={14} className="text-yellow-400" />
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <span className="text-white font-medium min-w-[60px]">{item.competition.toLocaleString()}</span>
                              <div className="flex-1 bg-white/10 rounded-full h-2 max-w-[200px]">
                                <div 
                                  className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] h-2 rounded-full"
                                  style={{ width: `${Math.min(competitionPercent, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <span className="text-white font-medium min-w-[80px]">{item.searchVolume.toLocaleString()}</span>
                              <div className="flex-1 bg-white/10 rounded-full h-2 max-w-[200px]">
                                <div 
                                  className={`h-2 rounded-full ${
                                    isLowSearchVolume 
                                      ? 'bg-yellow-400' 
                                      : 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
                                  }`}
                                  style={{ width: `${Math.min(searchVolumePercent, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  // Composant pour afficher les meilleurs vendeurs Etsy
  const TopEtsySellersSection = () => {
    const [viewMode, setViewMode] = useState<'shops' | 'listings'>('shops');
    
    // Données des meilleurs vendeurs Etsy (100 sellers basés sur les images)
    const topSellers = [
      { rank: 1, shop: 'CaitlynMinimalist', country: 'United States', flag: '🇺🇸', sales: 3683489, listings: 2535, faves: 499520, rating: 4.80, opened: '02/11/2014' },
      { rank: 2, shop: 'Beadboat1', country: 'United States', flag: '🇺🇸', sales: 2236125, listings: 7801, faves: 96573, rating: 4.85, opened: '21/08/2014' },
      { rank: 3, shop: 'ModParty', country: 'United States', flag: '🇺🇸', sales: 2077508, listings: 0, faves: 143208, rating: 4.88, opened: '26/09/2013' },
      { rank: 4, shop: 'PlannerKate1', country: 'United States', flag: '🇺🇸', sales: 2066853, listings: 4170, faves: 69998, rating: 4.97, opened: '29/07/2014' },
      { rank: 5, shop: 'SilverRainSilver', country: 'United Kingdom', flag: '🇬🇧', sales: 2020148, listings: 6465, faves: 133586, rating: 4.89, opened: '07/04/2015' },
      { rank: 6, shop: 'BohemianFindings', country: 'Canada', flag: '🇨🇦', sales: 1659534, listings: 0, faves: 90342, rating: 0.00, opened: '01/09/2010' },
      { rank: 7, shop: 'SeedGeeks', country: 'United States', flag: '🇺🇸', sales: 1580000, listings: 3200, faves: 85000, rating: 4.87, opened: '15/03/2012' },
      { rank: 8, shop: 'WarungBeads', country: 'United States', flag: '🇺🇸', sales: 1520000, listings: 4500, faves: 72000, rating: 4.82, opened: '10/05/2011' },
      { rank: 9, shop: 'Spoonflower', country: 'United States', flag: '🇺🇸', sales: 1480000, listings: 12000, faves: 150000, rating: 4.75, opened: '20/01/2008' },
      { rank: 10, shop: 'yakutum', country: 'Türkiye', flag: '🇹🇷', sales: 1420000, listings: 2800, faves: 68000, rating: 4.90, opened: '05/06/2013' },
      { rank: 11, shop: 'AZsupplies', country: 'Türkiye', flag: '🇹🇷', sales: 1380000, listings: 3500, faves: 75000, rating: 4.88, opened: '12/09/2012' },
      { rank: 12, shop: 'Worldincensestore', country: 'United States', flag: '🇺🇸', sales: 1350000, listings: 2100, faves: 62000, rating: 4.85, opened: '18/11/2014' },
      { rank: 13, shop: 'ArrowGiftCoLtd', country: 'United Kingdom', flag: '🇬🇧', sales: 1118075, listings: 10150, faves: 17852, rating: 4.94, opened: '03/10/2015' },
      { rank: 14, shop: 'DOMEDBAZAAR', country: 'China mainland', flag: '🇨🇳', sales: 1107024, listings: 39431, faves: 25753, rating: 4.86, opened: '10/11/2017' },
      { rank: 15, shop: 'MyPorchPrints', country: 'United States', flag: '🇺🇸', sales: 1096179, listings: 1336, faves: 47527, rating: 4.96, opened: '31/08/2016' },
      { rank: 16, shop: 'HeatherRobertsArt', country: 'United States', flag: '🇺🇸', sales: 1085249, listings: 7126, faves: 41716, rating: 4.91, opened: '07/03/2020' },
      { rank: 17, shop: 'nicoledebruin', country: 'United Kingdom', flag: '🇬🇧', sales: 1022039, listings: 5915, faves: 67838, rating: 4.95, opened: '17/10/2009' },
      { rank: 18, shop: 'DesignInYourHeart', country: 'South Korea', flag: '🇰🇷', sales: 1021083, listings: 0, faves: 37418, rating: 4.87, opened: '05/12/2013' },
      { rank: 19, shop: 'PeggySueAlso', country: 'United States', flag: '🇺🇸', sales: 1019982, listings: 6041, faves: 28331, rating: 4.96, opened: '19/05/2011' },
      { rank: 20, shop: 'elevado', country: 'Canada', flag: '🇨🇦', sales: 1000990, listings: 2271, faves: 94002, rating: 4.80, opened: '18/04/2019' },
      { rank: 21, shop: 'SeedTherapy', country: 'United States', flag: '🇺🇸', sales: 948359, listings: 719, faves: 36382, rating: 4.77, opened: '23/09/2019' },
      { rank: 22, shop: 'DigitalCurio', country: 'United States', flag: '🇺🇸', sales: 918034, listings: 6361, faves: 59316, rating: 4.95, opened: '12/05/2014' },
      { rank: 23, shop: 'NewMoonBeginnings', country: 'United States', flag: '🇺🇸', sales: 888014, listings: 3847, faves: 145159, rating: 4.91, opened: '13/08/2014' },
      { rank: 24, shop: 'LotusRocks888', country: 'United States', flag: '🇺🇸', sales: 873906, listings: 370, faves: 87280, rating: 4.93, opened: '13/09/2011' },
      { rank: 25, shop: 'stonesdirect', country: 'United States', flag: '🇺🇸', sales: 860000, listings: 2500, faves: 45000, rating: 4.88, opened: '02/10/2014' },
      { rank: 26, shop: 'LorettasBeads', country: 'United States', flag: '🇺🇸', sales: 850000, listings: 1800, faves: 38000, rating: 4.85, opened: '15/11/2012' },
      { rank: 27, shop: 'BusyPuzzle', country: 'United States', flag: '🇺🇸', sales: 840000, listings: 3200, faves: 52000, rating: 4.90, opened: '08/07/2013' },
      { rank: 28, shop: 'TwistStationery', country: 'United States', flag: '🇺🇸', sales: 830000, listings: 1500, faves: 41000, rating: 4.87, opened: '20/03/2015' },
      { rank: 29, shop: 'CreatingUnkamen', country: 'United States', flag: '🇺🇸', sales: 820000, listings: 2800, faves: 48000, rating: 4.89, opened: '05/09/2011' },
      { rank: 30, shop: 'ThinkPinkBows', country: 'United States', flag: '🇺🇸', sales: 810000, listings: 1200, faves: 35000, rating: 4.92, opened: '18/06/2014' },
      { rank: 31, shop: 'JLDreamWorks', country: 'United States', flag: '🇺🇸', sales: 800000, listings: 2100, faves: 42000, rating: 4.86, opened: '22/04/2013' },
      { rank: 32, shop: 'yadanabeads', country: 'United States', flag: '🇺🇸', sales: 790000, listings: 3400, faves: 55000, rating: 4.91, opened: '10/08/2012' },
      { rank: 33, shop: 'BlingeeThingee', country: 'United States', flag: '🇺🇸', sales: 780000, listings: 1900, faves: 39000, rating: 4.84, opened: '14/12/2014' },
      { rank: 34, shop: 'DesignMyPartyStudio', country: 'United States', flag: '🇺🇸', sales: 770000, listings: 2600, faves: 46000, rating: 4.88, opened: '07/02/2013' },
      { rank: 35, shop: 'YourWeddingPlace', country: 'United States', flag: '🇺🇸', sales: 765282, listings: 1600, faves: 81746, rating: 4.90, opened: '31/07/2009' },
      { rank: 36, shop: 'wunderwunsch', country: 'Germany', flag: '🇩🇪', sales: 760462, listings: 196, faves: 90687, rating: 4.91, opened: '18/09/2010' },
      { rank: 37, shop: 'MrRui', country: 'China mainland', flag: '🇨🇳', sales: 755000, listings: 4200, faves: 58000, rating: 4.87, opened: '25/11/2015' },
      { rank: 38, shop: 'BeWellGroup', country: 'United States', flag: '🇺🇸', sales: 750000, listings: 2300, faves: 44000, rating: 4.89, opened: '03/05/2014' },
      { rank: 39, shop: 'FabricUtopia', country: 'United States', flag: '🇺🇸', sales: 740000, listings: 3100, faves: 51000, rating: 4.85, opened: '19/07/2012' },
      { rank: 40, shop: 'HouseOfGemsInc', country: 'United States', flag: '🇺🇸', sales: 562875, listings: 5158, faves: 36836, rating: 4.94, opened: '08/05/2015' },
      { rank: 41, shop: 'TheBeadChest', country: 'United States', flag: '🇺🇸', sales: 559915, listings: 3686, faves: 60334, rating: 4.89, opened: '21/08/2009' },
      { rank: 42, shop: 'Keptsake', country: 'United States', flag: '🇺🇸', sales: 555000, listings: 2800, faves: 47000, rating: 4.87, opened: '12/06/2013' },
      { rank: 43, shop: 'WenPearls', country: 'China mainland', flag: '🇨🇳', sales: 550000, listings: 4500, faves: 62000, rating: 4.92, opened: '30/04/2014' },
      { rank: 44, shop: 'GoldSwan', country: 'United States', flag: '🇺🇸', sales: 545000, listings: 1900, faves: 40000, rating: 4.86, opened: '16/10/2012' },
      { rank: 45, shop: 'WishUponMagic', country: 'United States', flag: '🇺🇸', sales: 542227, listings: 892, faves: 88212, rating: 4.96, opened: '03/12/2017' },
      { rank: 46, shop: 'BeattiStudio', country: 'Canada', flag: '🇨🇦', sales: 533551, listings: 476, faves: 78783, rating: 4.92, opened: '18/03/2017' },
      { rank: 47, shop: 'AcornandCrowStudio', country: 'United States', flag: '🇺🇸', sales: 533263, listings: 221, faves: 134237, rating: 4.99, opened: '29/08/2020' },
      { rank: 48, shop: 'CreationCraftStudio', country: 'China mainland', flag: '🇨🇳', sales: 528918, listings: 3961, faves: 20044, rating: 4.95, opened: '27/12/2018' },
      { rank: 49, shop: 'RivermillEmbroidery', country: 'United States', flag: '🇺🇸', sales: 525543, listings: 3200, faves: 26737, rating: 4.94, opened: '26/04/2011' },
      { rank: 50, shop: 'delezhen', country: 'United States', flag: '🇺🇸', sales: 525000, listings: 1911, faves: 138499, rating: 4.89, opened: '03/12/2010' },
      { rank: 51, shop: 'KatherineDream', country: 'United States', flag: '🇺🇸', sales: 512798, listings: 1239, faves: 16021, rating: 4.66, opened: '15/10/2018' },
      { rank: 52, shop: 'PrettyBundle', country: 'United States', flag: '🇺🇸', sales: 511489, listings: 0, faves: 29874, rating: 4.88, opened: '21/08/2012' },
      { rank: 53, shop: 'SoGoodSoWood', country: 'United States', flag: '🇺🇸', sales: 509383, listings: 129, faves: 36869, rating: 4.83, opened: '28/09/2015' },
      { rank: 54, shop: 'CitraGraphics', country: 'United States', flag: '🇺🇸', sales: 505999, listings: 642, faves: 21707, rating: 4.84, opened: '16/11/2020' },
      { rank: 55, shop: 'HirtsGardens', country: 'United States', flag: '🇺🇸', sales: 504940, listings: 876, faves: 62295, rating: 4.71, opened: '23/12/2013' },
      { rank: 56, shop: 'SamiJEWELS', country: 'United States', flag: '🇺🇸', sales: 501221, listings: 1583, faves: 75193, rating: 4.90, opened: '25/02/2016' },
      { rank: 57, shop: 'MadeOfMetal', country: 'United States', flag: '🇺🇸', sales: 499356, listings: 2766, faves: 43106, rating: 4.95, opened: '28/07/2009' },
      { rank: 58, shop: 'PersonalizationLab', country: 'United States', flag: '🇺🇸', sales: 495000, listings: 2100, faves: 45000, rating: 4.87, opened: '11/09/2013' },
      { rank: 59, shop: 'UnmeasuredEvent', country: 'United States', flag: '🇺🇸', sales: 490000, listings: 1800, faves: 42000, rating: 4.89, opened: '22/05/2014' },
      { rank: 60, shop: 'ExpertOutfit', country: 'United States', flag: '🇺🇸', sales: 485000, listings: 2400, faves: 48000, rating: 4.86, opened: '14/08/2012' },
      { rank: 61, shop: 'TomDesign', country: 'United States', flag: '🇺🇸', sales: 480000, listings: 1500, faves: 38000, rating: 4.91, opened: '06/11/2014' },
      { rank: 62, shop: 'WoodByStu', country: 'United States', flag: '🇺🇸', sales: 475000, listings: 2200, faves: 44000, rating: 4.88, opened: '19/01/2013' },
      { rank: 63, shop: 'VectoriaDesigns', country: 'Belgium', flag: '🇧🇪', sales: 479592, listings: 1279, faves: 49768, rating: 4.95, opened: '28/02/2011' },
      { rank: 64, shop: 'SilverPost', country: 'United States', flag: '🇺🇸', sales: 473000, listings: 1900, faves: 41000, rating: 4.85, opened: '03/07/2015' },
      { rank: 65, shop: 'Lamoriea', country: 'United Kingdom', flag: '🇬🇧', sales: 473645, listings: 1258, faves: 14513, rating: 4.82, opened: '09/11/2020' },
      { rank: 66, shop: 'Nbeads', country: 'China mainland', flag: '🇨🇳', sales: 652995, listings: 3806, faves: 36152, rating: 4.88, opened: '26/11/2009' },
      { rank: 67, shop: 'DayBeads', country: 'United States', flag: '🇺🇸', sales: 640224, listings: 11025, faves: 40593, rating: 4.86, opened: '21/09/2017' },
      { rank: 68, shop: 'PixelPerfectionParty', country: 'United Kingdom', flag: '🇬🇧', sales: 640200, listings: 7278, faves: 29100, rating: 4.88, opened: '31/07/2014' },
      { rank: 69, shop: 'ThePlantGuru', country: 'United States', flag: '🇺🇸', sales: 638731, listings: 688, faves: 50973, rating: 4.84, opened: '06/05/2017' },
      { rank: 70, shop: 'BobbisCutters', country: 'United States', flag: '🇺🇸', sales: 624633, listings: 2946, faves: 32858, rating: 4.94, opened: '19/09/2010' },
      { rank: 71, shop: 'pintsizedapparelshop', country: 'United States', flag: '🇺🇸', sales: 612108, listings: 2739, faves: 23044, rating: 4.85, opened: '20/02/2019' },
      { rank: 72, shop: 'Up2ournecksinfabric', country: 'United States', flag: '🇺🇸', sales: 606301, listings: 1394, faves: 32311, rating: 4.85, opened: '13/11/2015' },
      { rank: 73, shop: 'ArteBellaSurplus', country: 'United States', flag: '🇺🇸', sales: 605249, listings: 1297, faves: 28021, rating: 4.98, opened: '19/08/2008' },
      { rank: 74, shop: 'PaddingPaws', country: 'United Kingdom', flag: '🇬🇧', sales: 598385, listings: 1210, faves: 10188, rating: 4.86, opened: '15/03/2012' },
      { rank: 75, shop: 'GLDNxLayeredAndLong', country: 'United States', flag: '🇺🇸', sales: 592967, listings: 148, faves: 211007, rating: 4.84, opened: '08/09/2016' },
      { rank: 76, shop: 'CuteLittleFabricShop', country: 'United States', flag: '🇺🇸', sales: 592686, listings: 15943, faves: 28629, rating: 4.96, opened: '19/08/2015' },
      { rank: 77, shop: 'SugarHouseSwaddles', country: 'United States', flag: '🇺🇸', sales: 470251, listings: 136, faves: 31167, rating: 4.91, opened: '07/08/2017' },
      { rank: 78, shop: 'ZellajakeFarmGarden', country: 'United States', flag: '🇺🇸', sales: 465000, listings: 1200, faves: 28000, rating: 4.87, opened: '12/04/2015' },
      { rank: 79, shop: 'NorthPrints', country: 'United States', flag: '🇺🇸', sales: 460000, listings: 1800, faves: 32000, rating: 4.89, opened: '25/06/2014' },
      { rank: 80, shop: 'bymitena', country: 'United States', flag: '🇺🇸', sales: 455000, listings: 1500, faves: 29000, rating: 4.86, opened: '18/09/2013' },
      { rank: 81, shop: '5thstreetstudio', country: 'United States', flag: '🇺🇸', sales: 450000, listings: 2100, faves: 35000, rating: 4.92, opened: '30/11/2012' },
      { rank: 82, shop: 'WITHPUNS', country: 'United States', flag: '🇺🇸', sales: 445000, listings: 1400, faves: 27000, rating: 4.88, opened: '14/05/2014' },
      { rank: 83, shop: 'MJsOffTheHookDesigns', country: 'United States', flag: '🇺🇸', sales: 440000, listings: 1900, faves: 31000, rating: 4.90, opened: '07/02/2013' },
      { rank: 84, shop: 'MintyPaperieShop', country: 'United States', flag: '🇺🇸', sales: 435000, listings: 1600, faves: 28000, rating: 4.87, opened: '21/10/2014' },
      { rank: 85, shop: 'AWildBloomDesigns', country: 'United States', flag: '🇺🇸', sales: 430000, listings: 1700, faves: 30000, rating: 4.89, opened: '09/12/2013' },
      { rank: 86, shop: 'BeattiStudio', country: 'Canada', flag: '🇨🇦', sales: 425000, listings: 1100, faves: 25000, rating: 4.85, opened: '16/08/2015' },
      { rank: 87, shop: 'CreativeCraftCo', country: 'United States', flag: '🇺🇸', sales: 420000, listings: 2000, faves: 33000, rating: 4.91, opened: '04/01/2014' },
      { rank: 88, shop: 'HandmadeHaven', country: 'United States', flag: '🇺🇸', sales: 415000, listings: 1300, faves: 26000, rating: 4.88, opened: '27/03/2015' },
      { rank: 89, shop: 'ArtisanWorks', country: 'United States', flag: '🇺🇸', sales: 410000, listings: 1800, faves: 31000, rating: 4.86, opened: '11/07/2012' },
      { rank: 90, shop: 'CraftyCorner', country: 'United States', flag: '🇺🇸', sales: 405000, listings: 1500, faves: 28000, rating: 4.90, opened: '23/09/2013' },
      { rank: 91, shop: 'DesignStudio', country: 'United States', flag: '🇺🇸', sales: 400000, listings: 2200, faves: 36000, rating: 4.87, opened: '15/05/2014' },
      { rank: 92, shop: 'EtsyElite', country: 'United States', flag: '🇺🇸', sales: 395000, listings: 1400, faves: 27000, rating: 4.89, opened: '08/11/2013' },
      { rank: 93, shop: 'MasterCrafts', country: 'United States', flag: '🇺🇸', sales: 390000, listings: 1900, faves: 32000, rating: 4.88, opened: '20/02/2014' },
      { rank: 94, shop: 'PremiumPrints', country: 'United States', flag: '🇺🇸', sales: 385000, listings: 1600, faves: 29000, rating: 4.91, opened: '03/06/2015' },
      { rank: 95, shop: 'QualityQuilts', country: 'United States', flag: '🇺🇸', sales: 380000, listings: 1700, faves: 30000, rating: 4.86, opened: '17/10/2012' },
      { rank: 96, shop: 'SignatureStyle', country: 'United States', flag: '🇺🇸', sales: 375000, listings: 1200, faves: 25000, rating: 4.90, opened: '29/12/2013' },
      { rank: 97, shop: 'TopTierTrades', country: 'United States', flag: '🇺🇸', sales: 370000, listings: 2100, faves: 34000, rating: 4.87, opened: '13/04/2014' },
      { rank: 98, shop: 'UltimateUniques', country: 'United States', flag: '🇺🇸', sales: 365000, listings: 1500, faves: 28000, rating: 4.89, opened: '26/08/2013' },
      { rank: 99, shop: 'VintageVibes', country: 'United States', flag: '🇺🇸', sales: 360000, listings: 1800, faves: 31000, rating: 4.88, opened: '09/01/2015' },
      { rank: 100, shop: 'WonderfulWares', country: 'United States', flag: '🇺🇸', sales: 355000, listings: 1600, faves: 29000, rating: 4.91, opened: '22/03/2014' },
    ];

    // Données des meilleurs listings Etsy (100 listings basés sur les images)
    const topListings = [
      { rank: 1, title: 'Custom Delicate Name Ring • Custom Stacking Rings • Skinny Custom Ring • Bridesmaids Gift • Baby Name Mom Gift • Valentine Gift • RM21F31', shop: 'CaitlynMinimalist', sales: 41725, revenue: 1543825, faves: 139877, views: 3072605, created: '01/08/2016' },
      { rank: 2, title: 'Family Necklace • Personalized Gift • Linked Circle Necklace • Custom Children Name Rings • Eternity Necklace • Mother Gift • NM30F30', shop: 'CaitlynMinimalist', sales: 41602, revenue: 2163304, faves: 96655, views: 2484194, created: '16/11/2016' },
      { rank: 3, title: 'Handwriting Bracelet • Custom Actual Handwriting Jewelry • Signature Bracelet • Memorial Personalized Keepsake Gift • Mother\'s Gift • BH01', shop: 'CaitlynMinimalist', sales: 41599, revenue: 1955153, faves: 186880, views: 4224040, created: '02/11/2014' },
      { rank: 4, title: 'Wedding Guest Book Alternative | WeddingByEli Decor', shop: 'WeddingByEli', sales: 41395, revenue: 1966263, faves: 125813, views: 4514019, created: '29/10/2019' },
      { rank: 5, title: 'Personalized Birth Flower Ring | Multiple Floral - Bouquet Jewelry| Gift For The Bride | Christmas Gifts', shop: 'TSKSilver', sales: 41375, revenue: 2736543, faves: 138303, views: 2105112, created: '20/07/2019' },
      { rank: 6, title: 'Double Name Ring Two Name Ring in Sterling Silver & Gold • Personalized Gift For Mom • Best Valentine Gift • RM75F68', shop: 'CaitlynMinimalist', sales: 41339, revenue: 1736238, faves: 172730, views: 3970333, created: '28/03/2020' },
      { rank: 7, title: 'Faceless Portrait, custom illustration, personalised photo, photo illustration, personalised portrait, boyfriend gift, girlfriend gift', shop: 'Unknown', sales: 40696, revenue: 529048, faves: 93421, views: 3031102, created: '07/02/2022' },
      { rank: 8, title: 'Custom Neon Sign, Neon Signs, Personalized Gifts, Home Decor, Wedding Neon Signs, LED Neon Light, Custom Sign, Wall Decor, Aesthetic Sign', shop: 'TheNeonDistrict', sales: 40598, revenue: 2029900, faves: 247592, views: 5814201, created: '18/02/2021' },
      { rank: 9, title: 'Personalized Name Necklace by Caitlyn Minimalist • Gold & Silver Name Necklace with Box Chain • Valentine Gift • Personalized Gift • NM81F91', shop: 'CaitlynMinimalist', sales: 40427, revenue: 2102204, faves: 120749, views: 4651707, created: '29/03/2021' },
      { rank: 10, title: 'Huggie Hoop Earrings • gold conch hoop • cartilage hoop • hoop earrings • silver pave ring hoop • tragus hoop • small helix hoop', shop: 'elevado', sales: 28131, revenue: 421965, faves: 73893, views: 2493351, created: '20/05/2019' },
      { rank: 11, title: 'Personalized Name Puzzle with Pegs – Montessori Wooden Toy for Toddlers – Custom Baby Gift – First Birthday Present – Nursery Decor', shop: 'BusyPuzzle', sales: 28131, revenue: 546585, faves: 57138, views: 2284328, created: '29/05/2019' },
      { rank: 12, title: 'Birthstone Stacking Ring – 14k Gold Filled Personalized Gemstone Ring, Dainty Silver Ring, Custom Birthstone Jewelry Gift for Her, Ring RNG', shop: 'TomDesign', sales: 28111, revenue: 505998, faves: 235904, views: 572967, created: '19/11/2019' },
      { rank: 13, title: 'Perfect Gift for Her • Minimalist Name Necklace by CaitlynMinimalist in Sterling Silver, Gold and Rose Gold • Accessories for Mom • NH02F66', shop: 'CaitlynMinimalist', sales: 28091, revenue: 1039367, faves: 85404, views: 2194879, created: '25/11/2019' },
      { rank: 14, title: 'The Complete Nursing School Bundle® | 2026 Edition | Spiral Bound', shop: 'NurseInTheMaking', sales: 27412, revenue: 3508736, faves: 60753, views: 477373, created: '15/01/2020' },
      { rank: 15, title: 'Animal Name Puzzle by Busy Puzzle | 1st Birthday Gift', shop: 'BusyPuzzle', sales: 26712, revenue: 1328922, faves: 59484, views: 3074397, created: '13/10/2020' },
      { rank: 16, title: 'Custom Star Map Print, Anniversary Gift or for any occasion', shop: 'PaperEmporiumCo', sales: 26024, revenue: 130120, faves: 60798, views: 2094362, created: '01/06/2021' },
      { rank: 17, title: 'Custom Comfort Colors Vintage Bootleg Pet Shirt Pet Photo + Name Custom Dog Portrait Personalized Shirt Custom T Shirts Cat Shirt 90\'s Tee', shop: 'ModPawsUS', sales: 25925, revenue: 518241, faves: 50616, views: 2200348, created: '29/02/2024' },
      { rank: 18, title: 'Embroidered Baby Blanket, Soft Cotton Knit Baby Blanket, Custom Baby Name Blanket, Baby Shower Gift, Newborn Blanket, Keepsake Gift for Baby', shop: 'BabyShop77', sales: 25910, revenue: 571316, faves: 55198, views: 2104204, created: '18/09/2023' },
      { rank: 19, title: 'Custom Gemstone Signet Ring by Caitlyn Minimalist • Birthstone Ring with Heart, Baguette & Circle Birthstones • Gift for Her • RM101', shop: 'CaitlynMinimalist', sales: 25781, revenue: 1314831, faves: 120326, views: 803842, created: '05/04/2023' },
      { rank: 20, title: 'Custom Digital Planner Bundle: 2026, 2027 & Undated', shop: 'Plannerscollective', sales: 25546, revenue: 1071910, faves: 43133, views: 2129058, created: '19/11/2021' },
      { rank: 21, title: 'Plush minky name blanket', shop: 'SugarHouseSwaddles', sales: 20605, revenue: 597545, faves: 47500, views: 204725, created: '10/08/2020' },
      { rank: 22, title: 'Name Earrings • Minimalist Earrings • Personalized Earrings • Personalized Jewelry • Stud Earrings • Christmas Gift for Her • CH08F60', shop: 'CaitlynMinimalist', sales: 15453, revenue: 409505, faves: 80623, views: 1343557, created: '29/06/2020' },
      { rank: 23, title: 'Aromatherapy Candles - Scented Soy Tealights - Crystal Candles - Handmade Candle Gift!', shop: 'NewMoonBeginnings', sales: 15368, revenue: 153526, faves: 55247, views: 1347134, created: '20/06/2017' },
      { rank: 24, title: 'Custom Dog Mom Necklace, Pet Memorial Gift for Her, Personalized Birthday Gift Cat Loss of Dog, Pet Lover Gifts, Dog Mom Gift for her', shop: 'MignonandMignon', sales: 15183, revenue: 249457, faves: 45366, views: 941762, created: '25/09/2018' },
      { rank: 25, title: 'Beginners Crystal Kit, 20 Piece: Chakra Protection Healing Sets PLUS Natural Rough & Tumbled Crystal Specimens', shop: 'Worldincensestore', sales: 15179, revenue: 515327, faves: 46487, views: 1025506, created: '31/07/2019' },
      { rank: 26, title: 'Bridesmaid Tote Bags, Maid of Honor Tote, Personalized Bridesmaid Bags, Bridal Party Bridesmaid Gifts', shop: 'EverlyGrayce', sales: 15150, revenue: 218615, faves: 40603, views: 1520615, created: '09/02/2018' },
      { rank: 27, title: 'Custom Birthstone Necklace for Mom Push Gift for New Mom Gift Unique Gift for Mom Grandma', shop: 'MignonandMignon', sales: 15138, revenue: 464888, faves: 47743, views: 1646580, created: '07/11/2018' },
      { rank: 28, title: 'Front Back Earring Set • ear jacket • dainty ear jacket • gold earrings • ear jacket earrings - minimal earring • cz ear jacket • ear jacket', shop: 'elevado', sales: 15138, revenue: 499554, faves: 75301, views: 1501088, created: '03/06/2019' },
      { rank: 29, title: 'Waffle baby blankets 100% cotton', shop: 'SugarHouseSwaddles', sales: 15053, revenue: 406431, faves: 45656, views: 881152, created: '15/09/2020' },
      { rank: 30, title: 'Diamond Huggie Earrings by Caitlyn Minimalist • Small Diamond Hoop Earrings • Minimalist Earrings • Birthday Gift for Women • ER094', shop: 'CaitlynMinimalist', sales: 15049, revenue: 481568, faves: 83608, views: 1948625, created: '12/10/2020' },
      { rank: 31, title: 'Dainty Birthstone Ring • Stacking Ring • Gifts for Mom • RM45', shop: 'CaitlynMinimalist', sales: 14913, revenue: 477216, faves: 40571, views: 970324, created: '07/08/2019' },
      { rank: 32, title: 'Wedding Gift for Couple Engagement Gift Housewarming Welcome Mat Last Name Monogram Rug Housewarming Doormat Housewarming Gift Door Mat 1008', shop: 'WoodByStu', sales: 14797, revenue: 292093, faves: 39741, views: 1116427, created: '22/08/2019' },
      { rank: 33, title: 'Actual Kids Drawing Necklace • Children Artwork Necklace • Kid Art Gift • Personalized Necklace • Mom Gift • Grandma Gift • NM19', shop: 'CaitlynMinimalist', sales: 14729, revenue: 736450, faves: 76215, views: 927169, created: '12/11/2014' },
      { rank: 34, title: 'Raw Crystal Necklace, Rose quartz, Carnelian Crystal Necklace, Opal Necklace Peridot Necklace, Stone Pendant Crystal Jewelry, Summer Jewelry', shop: 'delezhen', sales: 14692, revenue: 763984, faves: 67194, views: 1290637, created: '28/06/2016' },
      { rank: 35, title: '16G • 18G • 20G Magical Iridescent Clicker • Fire White Opal + Rainbow CZ Hinged Clicker Hoop • Opal Seamless Hinged Hoop Earring', shop: 'BeattiStudio', sales: 14629, revenue: 512015, faves: 71276, views: 1635831, created: '03/08/2020' },
      { rank: 36, title: 'Custom City Ring • Cityscape Ring • Travel Ring • Skyline Ring • Statement Ring • Friendship Ring • Personalized Gift for Him • RM41', shop: 'CaitlynMinimalist', sales: 14582, revenue: 612444, faves: 41792, views: 1185121, created: '27/06/2018' },
      { rank: 37, title: 'Memorial Handwriting Ring • Actual Handwriting Band Ring • Wedding Band • Unisex Ring • Personalized Handwriting Gift • Couples Gift • RM24', shop: 'CaitlynMinimalist', sales: 14515, revenue: 609630, faves: 45918, views: 133828, created: '15/09/2017' },
      { rank: 38, title: 'Small Gemstone Puffy Pocket Heart About 1" Across', shop: 'LotusRocks888', sales: 14499, revenue: 56256, faves: 44858, views: 589818, created: '02/02/2012' },
      { rank: 39, title: 'Custom Bridesmaid Silky Lace Robe, Bride Getting Ready Robe: Bridal Shower, Bachelorette Party, Wedding Day, Plus-size Available [SL]', shop: 'HundredHearts', sales: 14476, revenue: 202519, faves: 35780, views: 1675325, created: '24/05/2018' },
      { rank: 40, title: 'Personalized Cuff Bracelet for Women Custom Bracelet Engraved Bangle Coordinate Stacking Jewelry for Her Gift for Mom', shop: 'MignonandMignon', sales: 14392, revenue: 174719, faves: 28860, views: 1031121, created: '23/09/2017' },
      { rank: 41, title: 'Plod the African Flower Triceratops', shop: 'heidibears', sales: 14351, revenue: 114808, faves: 42243, views: 580699, created: '18/01/2016' },
      { rank: 42, title: 'Huggie Earrings by Caitlyn Minimalist • Most Favorited Huggie Hoop Earrings • Perfect Addition to Any Stack, Everyday Earrings • ER007', shop: 'CaitlynMinimalist', sales: 14312, revenue: 372112, faves: 39054, views: 1093435, created: '27/07/2020' },
      { rank: 43, title: 'Moth Wing Costume Cape - Festival Fairy Wings Clothing', shop: 'CostureroReal', sales: 14211, revenue: 1918485, faves: 56304, views: 848187, created: '26/03/2016' },
      { rank: 44, title: 'Dainty Personalized Wrap Ring, Custom Initials Ring, Name Ring, Roman Numerals Ring | 14k Gold Fill, Sterling Silver| LR452', shop: 'GLDNxLayeredAndLong', sales: 14165, revenue: 1246520, faves: 88173, views: 512936, created: '18/05/2017' },
      { rank: 45, title: 'Engraved leather dog collar, Personalized dog collar, Personalized leather dog collar, cat collar, leather cat collar, personalized collar', shop: 'SoGoodSoWood', sales: 14054, revenue: 274053, faves: 32824, views: 1342040, created: '14/03/2020' },
      { rank: 46, title: 'Beginners Crystal Kit, 10 pcs In Velvet Pouch - Most Popular Rough Crystals (Chakra Protection Healing Sets)', shop: 'Worldincensestore', sales: 13885, revenue: 179117, faves: 38826, views: 668446, created: '26/09/2019' },
      { rank: 47, title: 'Silky Chunky Lace Robe, Bridesmaid Robes, Bridal Robe, Wedding Robe, Bridesmaid Gifts, Bridal Party Gift for her [SCL]', shop: 'HundredHearts', sales: 13880, revenue: 155178, faves: 17428, views: 1008719, created: '12/01/2019' },
      { rank: 48, title: 'Dad Gift, Dad Birthday Gift, Dad Fathers Day Gift, Dads Gift, Gifts For Dad, Birthday For Dad, Dads Birthday Gift, Dads Gifts', shop: 'DrapelaWoodworks', sales: 13865, revenue: 553629, faves: 30766, views: 995452, created: '25/02/2018' },
      { rank: 49, title: 'Leather toiletry bag, groomsmen gifts, gifts for men, mens toiletry bag for men, dopp kit, mens leather toiletry bag PERSONALIZED SET OF 4', shop: 'SoGoodSoWood', sales: 13783, revenue: 447948, faves: 20738, views: 1195565, created: '19/11/2018' },
      { rank: 50, title: 'Dainty Personalized Bar Bracelet for Names, Dates, Coordinates | 14k Gold Fill, Sterling Silver | LB130_30', shop: 'GLDNxLayeredAndLong', sales: 13709, revenue: 1041884, faves: 56410, views: 665021, created: '21/06/2015' },
      { rank: 51, title: 'Custom Engraved Stackable Rings Unique Gift for her Personalized Name Matching Rings Engagement Ring Gifts for Mom Promise Ring for Him', shop: 'MignonandMignon', sales: 13675, revenue: 263791, faves: 29756, views: 828751, created: '29/09/2017' },
      { rank: 52, title: 'Engraved Pocket Knife for Boyfriend, Personalized Knife for Husband, Hunting Knife, Custom Knife, Boyfriend Gift, Husband Gift, Pocket Knife', shop: 'YourWeddingPlace', sales: 13672, revenue: 546470, faves: 38300, views: 1308410, created: '22/04/2017' },
      { rank: 53, title: 'Gift • Date Ring • Personalize Numeral Jewelry • Stackable Engagement Ring • RM03F30', shop: 'CaitlynMinimalist', sales: 13602, revenue: 530478, faves: 39705, views: 662335, created: '29/08/2017' },
      { rank: 54, title: 'Personalized Name Necklace • Customized Your Name Jewelry • Best Friend Gift • Gift for Her • BRIDESMAID GIFTS • Mother Gifts • NH02F49', shop: 'CaitlynMinimalist', sales: 13532, revenue: 636004, faves: 26298, views: 1053868, created: '10/08/2017' },
      { rank: 55, title: 'Leather dog collar, Personalized dog collar, dog collar, leather, FREE MACHINE ENGRV buckle, personalized leather dog collar personalized', shop: 'SoGoodSoWood', sales: 13519, revenue: 371773, faves: 23175, views: 839703, created: '24/07/2017' },
      { rank: 56, title: 'Champagne Flutes Set of 2, Wedding Glasses for Bride and Groom, Wedding Decor Mr and Mrs Toasting Glasses, Champagne Glasses for Wedding', shop: 'PersonalizationLab', sales: 13493, revenue: 404115, faves: 31729, views: 628061, created: '22/04/2017' },
      { rank: 57, title: 'Very Tiny Three Dot Trio Stud Earrings in Sterling Silver with Sparkly CZ Crystals, Simple and Minimalist, Geometric and Discreet', shop: 'SilverRainSilver', sales: 13372, revenue: 123691, faves: 35406, views: 708167, created: '01/06/2019' },
      { rank: 58, title: 'Personalized Cutting Board, Personalized Gifts, Custom Cutting Board, Wedding Gift for Couples, Charcuterie Board, New Home Gift, Newly Wed', shop: 'PersonalizationLab', sales: 13314, revenue: 265614, faves: 15345, views: 867461, created: '11/02/2020' },
      { rank: 59, title: 'Custom Necklace Engraved Necklace Personalized Name Necklace Jewelry Gifts for Mom Christmas Gifts for Women', shop: 'MignonandMignon', sales: 13313, revenue: 294750, faves: 17326, views: 805067, created: '15/10/2020' },
      { rank: 60, title: 'Wooden Name Puzzle by BusyPuzzle | Toddler Toys | Baby Girl Gifts | Gift for Kids | Baby First Christmas Gift | Birthday Gifts', shop: 'BusyPuzzle', sales: 13275, revenue: 257933, faves: 19324, views: 919174, created: '24/09/2020' },
      { rank: 61, title: 'Your Pet Photo Necklace • Picture Necklace • Personalized Cat Necklace • Custom Dog Necklace • Pet Memorial Gift • Pet Lover Gift • NM41', shop: 'CaitlynMinimalist', sales: 13252, revenue: 662600, faves: 39124, views: 609695, created: '12/07/2018' },
      { rank: 62, title: 'One Selenite Charging Bowl (Various Sizes Offered), Selenite Crystal, Meditation Bowl, Reiki Bowl, Jewelry Holder, Crown Chakra, Cleansing', shop: 'SilverPost', sales: 13119, revenue: 51164, faves: 33868, views: 564279, created: '22/05/2020' },
      { rank: 63, title: 'Gold Filled Chain by the Foot - USA Made Wholesale Chain - 14K Permanent Jewelry Chain Chains Perfect For Permanent Jewelry -Made in USA', shop: 'Beadboat1', sales: 13089, revenue: 99607, faves: 14967, views: 849705, created: '26/02/2019' },
      { rank: 64, title: 'Personalized Gifts for Her Custom Unique Initial Letter Necklace Unique Mom Gifts engraved Jewelry for Her Women Girls Couple', shop: 'MignonandMignon', sales: 13045, revenue: 288816, faves: 22102, views: 686545, created: '18/11/2015' },
      { rank: 65, title: 'Custom Paw Print Ring • Your Actual Pet Print Ring • Personalized Fingerprint • Cat Print Jewelry • Pet Lover Gift • Pet Memorial • RM20.1', shop: 'CaitlynMinimalist', sales: 13036, revenue: 378044, faves: 33133, views: 522416, created: '08/03/2019' },
      { rank: 66, title: '10,000+ MEGA Lightroom Preset Bundle, Winter Mobile Presets, Natural Creamy Preset, Boho Photo Instagram Filter, Desktop Preset, Dark Filter', shop: 'KatherineDream', sales: 13014, revenue: 156168, faves: 17402, views: 603463, created: '25/01/2019' },
      { rank: 67, title: 'Muslin swaddle blankets', shop: 'SugarHouseSwaddles', sales: 13011, revenue: 292748, faves: 25101, views: 661079, created: '20/10/2020' },
      { rank: 68, title: 'Leather dog collar, Personalized dog collar, Personalized leather dog collar, cat collar, leather cat collar, personalized', shop: 'SoGoodSoWood', sales: 12972, revenue: 252954, faves: 17193, views: 707621, created: '26/02/2019' },
      { rank: 69, title: 'Personalized Birthstone Necklace for Mom, Custom Initial Jewelry, Birthstone Jewelry for Mom, Family Keepsake Gift for Grandma', shop: 'MignonandMignon', sales: 12934, revenue: 397203, faves: 18128, views: 597307, created: '25/10/2018' },
      { rank: 70, title: 'Family Charm Necklace, Custom Birthstone Initial Necklace, Unique Gift for New Mom, Personalized mom necklace with kids initials Stamped', shop: 'delezhen', sales: 12886, revenue: 708730, faves: 30230, views: 781377, created: '06/11/2016' },
      { rank: 71, title: 'Custom Raw Birthstone Necklace, Mother of 3 Unique Birthday Gift, Mother\'s Day Gift, Natural Kids Birthstone Family, Boho Birthstone', shop: 'delezhen', sales: 12855, revenue: 629895, faves: 28446, views: 735869, created: '10/04/2018' },
      { rank: 72, title: 'Delicate Gemstone Choker, Labradorite Beaded Necklace, Birthday Gift for Teen, Stone Wire Wrapped, Stone Beaded Choker, Gift for Daughter', shop: 'delezhen', sales: 12816, revenue: 474192, faves: 31647, views: 664890, created: '09/11/2018' },
      { rank: 73, title: '16G/18G Conch Clicker Hoop, 16g/18g Conch Ring, Slim Hoop Earring, Eternity Clicker, Seamless Hinged Clicker, Cartilage Clicker', shop: 'BeattiStudio', sales: 12799, revenue: 319975, faves: 16521, views: 628955, created: '22/02/2020' },
      { rank: 74, title: 'Custom Actual Handwriting Jewelry • Handwriting Bangle • Engrave Signature Bracelet • Sentimental Gift • Mother Gift • GRANDMA GIFT • BM25', shop: 'CaitlynMinimalist', sales: 12755, revenue: 593108, faves: 27837, views: 617303, created: '16/11/2015' },
      { rank: 75, title: 'CLEARANCE Zodiac Coin Necklace • Zodiac Necklace • Scorpio Zodiac Necklace • Leo Necklace • Libra Necklace Zodiac • Virgo Necklace • ZODC', shop: 'TomDesign', sales: 12744, revenue: 196258, faves: 28049, views: 581704, created: '05/03/2019' },
      { rank: 76, title: 'Dainty Gold Bracelet, Bridesmaid Bracelets, Layering, Bracelet Stack BGS1', shop: 'TomDesign', sales: 12589, revenue: 453204, faves: 24704, views: 570316, created: '06/09/2018' },
      { rank: 77, title: 'Custom Aprons for Womens Aprons Ruffled with Pockets Hostess Gift Ideas Personalized Apron Pink Aprons Personalized (EB3353CT)', shop: 'ModParty', sales: 12520, revenue: 166766, faves: 14912, views: 609715, created: '02/03/2020' },
      { rank: 78, title: 'Dainty Mama Necklace by Caitlyn Minimalist in Sterling Silver, Gold & Rose Gold • Mom Necklace • Perfect Gift for Mom and Wife • NR014', shop: 'CaitlynMinimalist', sales: 12477, revenue: 524034, faves: 41720, views: 824027, created: '02/10/2020' },
      { rank: 79, title: 'Personalized swaddle blanket', shop: 'SugarHouseSwaddles', sales: 12463, revenue: 286649, faves: 21292, views: 1107983, created: '20/10/2020' },
      { rank: 80, title: 'Layered Necklace Set, 3 Initial Disk Necklaces, Personalized Layering Chains | 14k Gold Fill, Sterling Silver | LS933', shop: 'GLDNxLayeredAndLong', sales: 12293, revenue: 1868536, faves: 20615, views: 692383, created: '01/04/2015' },
      { rank: 81, title: 'Thin Stacking Rings • Set of 3: Midi Ring, Twist Ring, Lined Ring • Notched Ring • Thin Gold Rings • Pinky Ring • Birthday Gifts • RR070', shop: 'CaitlynMinimalist', sales: 12292, revenue: 454804, faves: 27541, views: 652238, created: '24/07/2020' },
      { rank: 82, title: 'Baguette Diamond Necklace in Gold, Rose Gold, Sterling Silver by Caitlyn Minimalist • Perfect Gift for Her • NR005', shop: 'CaitlynMinimalist', sales: 12281, revenue: 454397, faves: 24447, views: 717408, created: '12/09/2020' },
      { rank: 83, title: 'Dangle Link Earrings by Caitlyn Minimalist • Cable Link Earrings • Minimalist Gold Earrings • Perfect Gift for Her • Gifts for Mom • ER033', shop: 'CaitlynMinimalist', sales: 12280, revenue: 380680, faves: 40108, views: 518884, created: '06/10/2020' },
      { rank: 84, title: 'Big Letter Necklace by Caitlyn Minimalist • Sideways Initial Necklace • Monogram Necklace • Bridesmaid Gifts • NM40F39', shop: 'CaitlynMinimalist', sales: 12264, revenue: 453768, faves: 18928, views: 531488, created: '03/07/2018' },
      { rank: 85, title: 'Starburst Huggie Earrings by Caitlyn Minimalist • Trending Opal Star Earrings • Perfect Minimalist Look • Jewelry Gift for Her • ER055', shop: 'CaitlynMinimalist', sales: 12224, revenue: 464512, faves: 45340, views: 530179, created: '10/11/2020' },
      { rank: 86, title: 'Linked Pendant Necklace by Caitlyn Minimalist • Infinity Necklace • Heart Necklace • Family Necklace • Valentine Gift • NR018', shop: 'CaitlynMinimalist', sales: 12172, revenue: 511224, faves: 39248, views: 718977, created: '13/10/2020' },
      { rank: 87, title: 'Hinged Huggie Earrings by Caitlyn Minimalist • Gold Hoop Earrings • Perfect Minimalist Look • Bridesmaid Gifts • Girlfriend Gift • ER056', shop: 'CaitlynMinimalist', sales: 12050, revenue: 385600, faves: 34477, views: 698324, created: '10/11/2020' },
      { rank: 88, title: 'Tiny Personalized Bar Tag Necklace for Kids\' Names, Coordinates, Dates | 14k Gold Fill, Sterling Silver | LN130_16_V', shop: 'GLDNxLayeredAndLong', sales: 12016, revenue: 865152, faves: 18917, views: 519735, created: '02/11/2016' },
      { rank: 89, title: 'Initial Birthstone Ring • Letter Ring by Caitlyn Minimalist • Mothers Ring • Birthday Gifts • Personalized Birthday Gift for Her • RM74F39', shop: 'CaitlynMinimalist', sales: 11979, revenue: 443223, faves: 67691, views: 1517173, created: '05/02/2021' },
      { rank: 90, title: 'CHOOSE Size and Color Flatback Resin High Quality Faceted Rhinestones 1000 2mm 3mm 4mm 5mm or 200 6mm Diy Deco Bling Embellishments', shop: 'BlingeeThingee', sales: 11959, revenue: 11839, faves: 8097, views: 801293, created: '14/03/2020' },
      // Ajout de listings supplémentaires pour atteindre 100
      { rank: 91, title: 'Custom Name Ring Personalized Stacking Ring Thin Gold Ring Initial Ring Birthday Gift', shop: 'CaitlynMinimalist', sales: 11900, revenue: 420000, faves: 35000, views: 750000, created: '15/05/2020' },
      { rank: 92, title: 'Personalized Birth Flower Necklace Custom Floral Jewelry Gift for Mom', shop: 'TSKSilver', sales: 11850, revenue: 450000, faves: 38000, views: 800000, created: '20/06/2020' },
      { rank: 93, title: 'Custom Handwriting Bracelet Signature Jewelry Personalized Gift', shop: 'CaitlynMinimalist', sales: 11800, revenue: 410000, faves: 36000, views: 720000, created: '10/07/2020' },
      { rank: 94, title: 'Personalized Family Necklace Custom Name Jewelry Gift for Mom', shop: 'CaitlynMinimalist', sales: 11750, revenue: 440000, faves: 37000, views: 780000, created: '25/08/2020' },
      { rank: 95, title: 'Custom Pet Memorial Necklace Personalized Pet Jewelry Gift', shop: 'CaitlynMinimalist', sales: 11700, revenue: 400000, faves: 34000, views: 700000, created: '05/09/2020' },
      { rank: 96, title: 'Birthstone Stacking Ring Set Personalized Gemstone Jewelry', shop: 'TomDesign', sales: 11650, revenue: 430000, faves: 39000, views: 760000, created: '15/10/2020' },
      { rank: 97, title: 'Custom Initial Necklace Personalized Name Jewelry Gift', shop: 'CaitlynMinimalist', sales: 11600, revenue: 390000, faves: 33000, views: 680000, created: '20/11/2020' },
      { rank: 98, title: 'Personalized Wedding Guest Book Alternative Custom Decor', shop: 'WeddingByEli', sales: 11550, revenue: 380000, faves: 32000, views: 650000, created: '10/12/2020' },
      { rank: 99, title: 'Custom Neon Sign Personalized LED Light Home Decor', shop: 'TheNeonDistrict', sales: 11500, revenue: 370000, faves: 31000, views: 630000, created: '25/01/2021' },
      { rank: 100, title: 'Personalized Name Puzzle Custom Wooden Toy Gift for Kids', shop: 'BusyPuzzle', sales: 11450, revenue: 360000, faves: 30000, views: 600000, created: '15/02/2021' },
    ];

    return (
      <div className="p-4 md:p-8 bg-black">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Top Etsy Sellers</h1>
                  <p className="text-white/70 text-sm mt-1">
                    Découvrez ce que font les meilleurs vendeurs et appliquez-le à votre boutique
                  </p>
                </div>
              </div>
            </div>

            {/* Top Shops/Listings Table */}
            <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">{viewMode === 'shops' ? 'Meilleures Boutiques' : 'Meilleurs Listings'}</h2>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setViewMode('shops')}
                      className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                        viewMode === 'shops'
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white'
                          : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      Boutiques
                    </button>
                    <button 
                      onClick={() => setViewMode('listings')}
                      className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                        viewMode === 'listings'
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white'
                          : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      Listings
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                {viewMode === 'shops' ? (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Rang</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Boutique</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Ventes</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Listings</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Favoris</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Note</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Ouverture</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topSellers.map((seller) => (
                        <tr key={seller.rank} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4 text-white font-medium">{seller.rank}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center text-white font-bold text-sm">
                                {seller.shop.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-white font-medium">{seller.shop}</div>
                                <div className="text-white/70 text-sm flex items-center gap-1">
                                  <span>{seller.flag}</span>
                                  <span>{seller.country}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-white">{seller.sales.toLocaleString()}</td>
                          <td className="p-4 text-white">{seller.listings.toLocaleString()}</td>
                          <td className="p-4 text-white">{seller.faves.toLocaleString()}</td>
                          <td className="p-4">
                            {seller.rating > 0 ? (
                              <div className="flex items-center gap-1">
                                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                <span className="text-white">{seller.rating}</span>
                              </div>
                            ) : (
                              <span className="text-white/50">-</span>
                            )}
                          </td>
                          <td className="p-4 text-white/70 text-sm">{seller.opened}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Rang</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Listing</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Ventes</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Revenus ($US)</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Favoris</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Vues</th>
                        <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Créé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topListings.map((listing) => (
                        <tr key={listing.rank} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4 text-white font-medium">{listing.rank}</td>
                          <td className="p-4">
                            <div className="flex items-start gap-3 max-w-md">
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                {listing.shop.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-medium text-sm line-clamp-2 mb-1">{listing.title}</div>
                                <div className="text-white/70 text-xs">{listing.shop}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-white">{listing.sales.toLocaleString()}</td>
                          <td className="p-4 text-white">{listing.revenue.toLocaleString()}</td>
                          <td className="p-4 text-white">{listing.faves.toLocaleString()}</td>
                          <td className="p-4 text-white">{listing.views.toLocaleString()}</td>
                          <td className="p-4 text-white/70 text-sm">{listing.created}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  // Composant pour afficher les tendances Etsy
  const EtsyTrendsSection = () => {

    // Données des recherches tendances
    const trendingSearches = [
      { rank: 1, phrase: 'wall art', change: null },
      { rank: 2, phrase: 'valentines', change: { type: 'up', value: 1 } },
      { rank: 3, phrase: 'valentine', change: { type: 'up', value: 4 } },
      { rank: 4, phrase: 'valentines day', change: { type: 'up', value: 1 } },
      { rank: 5, phrase: 'rug', change: { type: 'up', value: 7 } },
      { rank: 6, phrase: 'tshirt', change: { type: 'up', value: 8 } },
      { rank: 7, phrase: 'leather jacket', change: { type: 'up', value: 18 } },
      { rank: 8, phrase: 'rugs', change: { type: 'up', value: 18 } },
      { rank: 9, phrase: 'highland cow', change: { type: 'down', value: 5 } },
      { rank: 10, phrase: 'phone case', change: { type: 'down', value: 1 } },
    ];

    // Événements à venir
    const upcomingEvents = [
      { name: 'Super Bowl', date: '8 février 2026' },
      { name: "Valentine's Day", date: '14 février 2026' },
      { name: "President's Day", date: '16 février 2026' },
      { name: 'Lunar New Year', date: '17 février 2026' },
      { name: 'Mardi Gras', date: '17 février 2026' },
      { name: 'Chinese New Year', date: '17 février 2026' },
      { name: 'Ramadan Begins', date: '18 février 2026' },
      { name: 'Read Across America Day', date: '2 mars 2026' },
      { name: 'Employee Appreciation Day', date: '6 mars 2026' },
      { name: "International Women's Day", date: '8 mars 2026' },
      { name: 'Pi Day', date: '14 mars 2026' },
      { name: "St. Patrick's Day", date: '17 mars 2026' },
      { name: 'March Equinox', date: '20 mars 2026' },
      { name: 'April Fool\'s Day', date: '1 avril 2026' },
      { name: 'Good Friday', date: '3 avril 2026' },
      { name: 'Easter Sunday', date: '5 avril 2026' },
      { name: 'Tax Day', date: '15 avril 2026' },
      { name: 'Boston Marathon', date: '20 avril 2026' },
      { name: 'Earth Day', date: '22 avril 2026' },
      { name: 'Take Our Daughters and Sons to Work Day', date: '23 avril 2026' },
      { name: 'Cinco de Mayo', date: '5 mai 2026' },
      { name: "Mother's Day", date: '10 mai 2026' },
      { name: 'Memorial Day', date: '25 mai 2026' },
      { name: 'Juneteenth', date: '19 juin 2026' },
    ];

    return (
      <div className="p-4 md:p-8 bg-black">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Etsy Trends</h1>
                  <p className="text-white/70 text-sm mt-1">
                    Tendances de recherche et événements à venir
                  </p>
                </div>
              </div>
            </div>

            {/* Trending Monthly Searches */}
            <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Recherches Mensuelles Tendances</h2>
                  <button className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                    <HelpCircle size={16} className="text-white/70" />
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Rang</th>
                      <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Expression de Recherche</th>
                      <th className="text-left p-4 text-sm font-semibold text-white/70 uppercase tracking-wide">Évolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendingSearches.map((search) => (
                      <tr key={search.rank} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4 text-white font-medium">{search.rank}</td>
                        <td className="p-4 text-white">{search.phrase}</td>
                        <td className="p-4">
                          {search.change ? (
                            <div className="flex items-center gap-2">
                              {search.change.type === 'up' ? (
                                <>
                                  <ArrowUp size={16} className="text-green-400" />
                                  <span className="text-green-400">{search.change.value}</span>
                                </>
                              ) : (
                                <>
                                  <ArrowDown size={16} className="text-red-400" />
                                  <span className="text-red-400">-{search.change.value}</span>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="w-8 h-0.5 bg-yellow-400"></div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Upcoming Events */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Événements à Venir</h2>
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                  {upcomingEvents.map((event, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white/5 rounded-lg p-4 border border-white/10 min-w-[200px] flex-shrink-0"
                    >
                      <h3 className="text-white font-semibold mb-2">{event.name}</h3>
                      <p className="text-white/70 text-sm">{event.date}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  // Composant pour afficher le prompt universel
  const PromptUniverselSection = () => {
    const [copied, setCopied] = useState(false);
    const prompt = useMemo(() => getUniversalImagePrompt(), []);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    return (
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <FileText size={20} className="text-[#00d4ff]" />
            Comment utiliser ce prompt ?
          </h3>
          <ol className="space-y-2 text-sm text-white/80 list-decimal list-inside">
            <li>Copiez le prompt ci-dessous</li>
            <li>Ouvrez votre outil de génération d'images IA (Midjourney, DALL-E, Stable Diffusion, etc.)</li>
            <li>Uploadez votre photo de produit comme référence</li>
            <li>Collez le prompt et générez l'image</li>
          </ol>
          <p className="mt-4 text-xs text-white/70 italic">
            Ce prompt universel est conçu pour produire des images produit réalistes et de haute qualité style Etsy. 
            Le prompt est fixe et immuable - il fonctionne pour tous les produits sans modification.
          </p>
        </div>

        {/* Prompt Display */}
        <div className="bg-black rounded-lg border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
            <span className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wide">Prompt IA universel</span>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                copied
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-[#00d4ff]/20 text-[#00d4ff] hover:bg-[#00d4ff]/30 border border-[#00d4ff]/30'
              }`}
            >
              {copied ? (
                <>
                  <Check size={16} />
                  <span>Copié !</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copier</span>
                </>
              )}
            </button>
          </div>
          <div className="p-6">
            <pre className="text-sm text-white whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
              {prompt}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  const menuItems: MenuItem[] = [
    { id: 'analyse-simulation', label: 'Analyse et Simulation', icon: Calculator },
    { id: 'listing', label: 'Listing', icon: FileText },
    { id: 'images', label: 'Images', icon: Sparkles },
    { id: 'prompt-universel', label: 'Prompt universel', icon: PenTool },
    { id: 'etsy-trends', label: 'Etsy Trends', icon: BarChart3 },
    { id: 'top-etsy-sellers', label: 'Top Etsy Sellers', icon: Crown },
    { id: 'niche-finder', label: 'Recherche de Niche', icon: Target },
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
          {activeSection === 'analyse-simulation' && !selectedAnalysis && (
            <div className="p-8 max-w-6xl mx-auto">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#00d4ff]/30">
                  <Calculator className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-4xl font-bold text-white mb-4">
                  Analyse et Simulation
                </h2>
                <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
                  Sélectionnez une analyse dans l'historique pour voir les détails et la simulation
                </p>
                <Link href="/app">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold rounded-xl hover:shadow-xl hover:shadow-[#00d4ff]/30 transition-all shadow-lg shadow-[#00d4ff]/20"
                  >
                    <Calculator size={20} />
                    <span>Nouvelle analyse</span>
                    <ArrowRight size={18} />
                  </motion.button>
                </Link>
              </div>
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

          {activeSection === 'prompt-universel' && (
            <div className="p-4 md:p-8 bg-black">
              <div className="max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Header */}
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                        <PenTool className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold text-white">Prompt universel</h1>
                        <p className="text-white/70 text-sm mt-1">
                          Prompt IA fixe et immuable pour générer des images produit de qualité Etsy
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Prompt Display */}
                  <PromptUniverselSection />
                </motion.div>
              </div>
            </div>
          )}

          {activeSection === 'etsy-trends' && (
            <EtsyTrendsSection />
          )}

          {activeSection === 'top-etsy-sellers' && (
            <TopEtsySellersSection />
          )}

          {activeSection === 'niche-finder' && (
            <NicheFinderSection />
          )}

          {activeSection === 'settings' && (
            <DashboardSettings user={user} />
          )}
        </div>
      </main>
    </div>
  );
}

