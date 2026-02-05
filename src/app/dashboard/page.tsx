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
  Star
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
type DashboardSection = 'analyze' | 'history' | 'analyse-simulation' | 'listing' | 'images' | 'profile' | 'settings' | 'subscription' | 'competitors' | 'prompt-universel' | 'etsy-trends' | 'top-etsy-sellers';

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

  // Composant pour afficher les meilleurs vendeurs Etsy
  const TopEtsySellersSection = () => {
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

            {/* Top Shops Table */}
            <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Top Shops</h2>
                  <div className="flex items-center gap-2">
                    <button className="px-4 py-2 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-medium rounded-lg">
                      Boutiques
                    </button>
                    <button className="px-4 py-2 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 font-medium rounded-lg transition-colors">
                      Listings
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
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

          {activeSection === 'settings' && (
            <DashboardSettings user={user} />
          )}
        </div>
      </main>
    </div>
  );
}

