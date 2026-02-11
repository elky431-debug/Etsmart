'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Store, 
  ArrowLeft, 
  ExternalLink, 
  TrendingUp, 
  DollarSign,
  Star,
  Calendar,
  MapPin,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Target,
  Zap,
  Lightbulb,
  BarChart3,
  Tag,
  Image as ImageIcon,
  Video,
  FileText,
  Package,
  Coins
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { supabase } from '@/lib/supabase';

interface ShopListing {
  title: string;
  url: string;
  price: number;
  sales?: number;
  reviews?: number;
  rating?: number;
  images?: string[];
}

interface ShopAnalysisData {
  success: boolean;
  shop: {
    name: string;
    url: string;
  };
  analysis: {
    shopName: string;
    shopUrl: string;
    overview: string;
    metrics: {
      totalSales: number;
      totalRevenue: number;
      monthlyRevenue: number;
      rating: number;
      reviewCount: number;
      shopAge: string;
      listingsCount: number;
    };
    listingsAnalysis: {
      bestSellers: string[];
      pricingStrategy: string;
      patterns: string[];
      opportunities: string[];
    };
    strengths: string[];
    weaknesses: string[];
    strategies: string[];
    insights: string;
  };
  rawData: {
    shopName: string;
    shopUrl: string;
    salesCount?: number;
    rating?: number;
    reviewCount?: number;
    shopAge?: string;
    location?: string;
    listings: ShopListing[];
    totalRevenue?: number;
    monthlyRevenue?: number;
    description?: string;
  };
}

export default function ShopAnalyzeClient() {
  const searchParams = useSearchParams();
  const [analysisData, setAnalysisData] = useState<ShopAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingProgress, setAnalyzingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'listings'>('overview');
  
  // ⚠️ CRITICAL: Read URL params ONCE at mount and store in ref
  const initialParamsRef = useRef({
    shopUrl: searchParams.get('shop') || '',
    analyzing: searchParams.get('analyzing'),
    importDone: searchParams.get('import'),
  });
  const dataLoadedRef = useRef(false);
  const creditsDeductedRef = useRef(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const shopUrl = analysisData?.shop?.url || initialParamsRef.current.shopUrl;

  // 💰 Deduct 2 credits when analysis data is received
  const deductCredits = useCallback(async () => {
    if (creditsDeductedRef.current) return;
    creditsDeductedRef.current = true;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.warn('[Shop Analyze] No auth token, skipping credit deduction');
        return;
      }
      
      console.log('[Shop Analyze] Déduction de 2 crédits...');
      const response = await fetch('/api/deduct-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: 2,
          reason: 'shop_analysis',
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('[Shop Analyze] ❌ Erreur déduction crédits:', result);
        if (result.error === 'QUOTA_EXCEEDED') {
          setCreditsError('Vous n\'avez pas assez de crédits pour cette analyse. Veuillez upgrader votre plan.');
        }
        return;
      }
      
      console.log(`[Shop Analyze] ✅ 2 crédits déduits. Utilisés: ${result.used}/${result.quota}`);
    } catch (err) {
      console.error('[Shop Analyze] Erreur lors de la déduction des crédits:', err);
    }
  }, []);

  useEffect(() => {
    const { shopUrl: initialShopUrl, analyzing: analyzingParam, importDone: importParam } = initialParamsRef.current;
    
    // ════════════════════════════════════════════════════════════════
    // CASE 1: import=done → Load data from storage
    // ════════════════════════════════════════════════════════════════
    if (importParam === 'done') {
      const checkForData = (attempt = 0) => {
        if (dataLoadedRef.current) return;
        const stored = localStorage.getItem('shopAnalysis') || sessionStorage.getItem('shopAnalysis');
        if (stored) {
          try {
            const data = JSON.parse(stored);
            dataLoadedRef.current = true;
            setAnalysisData(data);
            setAnalyzing(false);
            setLoading(false);
            return;
          } catch (err) {
            console.error('[Shop Analyze] Erreur parsing:', err);
          }
        }
        if (attempt < 5) {
          setTimeout(() => checkForData(attempt + 1), 500 + attempt * 200);
        } else {
          setError('Les données d\'analyse n\'ont pas été trouvées.');
          setLoading(false);
        }
      };
      checkForData();
      return; // ⚠️ Stop here
    }

    // ════════════════════════════════════════════════════════════════
    // CASE 2: analyzing=true → Wait for analysis completion
    // ════════════════════════════════════════════════════════════════
    if (analyzingParam === 'true') {
      try {
        sessionStorage.removeItem('shopAnalysis');
        localStorage.removeItem('shopAnalysis');
      } catch (err) {
        console.log('[Shop Analyze] Erreur nettoyage storage:', err);
      }
      setAnalyzing(true);
      setLoading(false);
      
      const handleAnalysisReady = (event: CustomEvent) => {
        if (dataLoadedRef.current) return;
        const data = event.detail;
        console.log('[Shop Analyze] ✅ Événement shopAnalysisReady reçu');
        dataLoadedRef.current = true;
        setAnalysisData(data);
        sessionStorage.setItem('shopAnalysis', JSON.stringify(data));
        localStorage.setItem('shopAnalysis', JSON.stringify(data));
        setAnalyzing(false);
        setLoading(false);
      };
      window.addEventListener('shopAnalysisReady', handleAnalysisReady as EventListener);

      // Check if data already exists
      const stored = localStorage.getItem('shopAnalysis') || sessionStorage.getItem('shopAnalysis');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          if (data.shop?.url === initialShopUrl || data.analysis?.shopUrl === initialShopUrl) {
            dataLoadedRef.current = true;
            setAnalysisData(data);
            sessionStorage.setItem('shopAnalysis', stored);
            setAnalyzing(false);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('[Shop Analyze] Erreur parsing localStorage:', err);
        }
      }

      // Poll localStorage as backup
      const pollInterval = setInterval(() => {
        if (dataLoadedRef.current) { clearInterval(pollInterval); return; }
        const polled = localStorage.getItem('shopAnalysis') || sessionStorage.getItem('shopAnalysis');
        if (polled) {
          try {
            const data = JSON.parse(polled);
            dataLoadedRef.current = true;
            setAnalysisData(data);
            setAnalyzing(false);
            setLoading(false);
            clearInterval(pollInterval);
          } catch (err) { /* ignore */ }
        }
      }, 2000);

      const timeout = setTimeout(() => {
        if (!dataLoadedRef.current) {
          setError('L\'analyse prend plus de temps que prévu. Vérifiez les logs du serveur et réessayez.');
          setAnalyzing(false);
          setLoading(false);
        }
      }, 120000);

      return () => {
        clearTimeout(timeout);
        clearInterval(pollInterval);
        window.removeEventListener('shopAnalysisReady', handleAnalysisReady as EventListener);
      };
    }

    // ════════════════════════════════════════════════════════════════
    // CASE 3: No special params → Load existing data
    // ════════════════════════════════════════════════════════════════
    const storedData = sessionStorage.getItem('shopAnalysis') || localStorage.getItem('shopAnalysis');
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        dataLoadedRef.current = true;
        setAnalysisData(data);
        setLoading(false);
        return;
      } catch (err) {
        setError('Erreur lors du chargement des données');
        setLoading(false);
        return;
      }
    }
    
    // Check for error params
    const errorParam = searchParams.get('import');
    if (errorParam === 'error') {
      let errorMessage = searchParams.get('message') || 'Erreur lors de l\'import';
      try {
        const decoded = decodeURIComponent(errorMessage);
        if (decoded.startsWith('{')) {
          const errorObj = JSON.parse(decoded);
          errorMessage = errorObj.message || errorObj.error || errorMessage;
        } else {
          errorMessage = decoded;
        }
      } catch (e) {
        errorMessage = decodeURIComponent(errorMessage);
      }
      setError(errorMessage);
      setLoading(false);
      return;
    }

    // No data at all
    const timeoutId = setTimeout(() => {
      if (dataLoadedRef.current) return;
      const lastCheck = sessionStorage.getItem('shopAnalysis') || localStorage.getItem('shopAnalysis');
      if (lastCheck) {
        try {
          const data = JSON.parse(lastCheck);
          dataLoadedRef.current = true;
          setAnalysisData(data);
          setLoading(false);
        } catch (e) {
          setError('Aucune analyse disponible. Veuillez lancer une nouvelle analyse.');
          setLoading(false);
        }
      } else {
        setError('Aucune analyse disponible. Veuillez lancer une nouvelle analyse.');
        setLoading(false);
      }
    }, 3000);

    const handleAnalysisReady = (event: CustomEvent) => {
      if (dataLoadedRef.current) return;
      const data = event.detail;
      dataLoadedRef.current = true;
      setAnalysisData(data);
      sessionStorage.setItem('shopAnalysis', JSON.stringify(data));
      setLoading(false);
    };
    window.addEventListener('shopAnalysisReady', handleAnalysisReady as EventListener);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('shopAnalysisReady', handleAnalysisReady as EventListener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ⚠️ Run ONCE on mount

  // 💰 Deduct 2 credits when analysis data is first received
  useEffect(() => {
    if (analysisData && !creditsDeductedRef.current) {
      deductCredits();
    }
  }, [analysisData, deductCredits]);

  useEffect(() => {
    if (!analyzing) return;
    setAnalyzingProgress(0);
    let progress = 0;
    const startTime = Date.now();
    const expectedDuration = 25000; // 25 secondes total
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const timeRatio = elapsed / expectedDuration;
      
      // Progression plus lente : reste longtemps à 95%
      if (timeRatio < 0.2) {
        // 0-20% du temps : monte rapidement à 30%
        progress = Math.min(30, progress + Math.random() * 4 + 2);
      } else if (timeRatio < 0.6) {
        // 20-60% du temps : monte lentement à 70%
        progress = Math.min(70, progress + Math.random() * 2 + 1);
      } else if (timeRatio < 0.95) {
        // 60-95% du temps : monte très lentement à 95%
        progress = Math.min(95, progress + Math.random() * 0.8 + 0.3);
      } else {
        // Derniers 5% : reste à 95% jusqu'à la fin
        progress = 95;
      }
      
      setAnalyzingProgress(Math.min(95, progress));
    }, 400); // Vérifie toutes les 400ms
    
    return () => clearInterval(interval);
  }, [analyzing]);

  // Extraire les tags optimisés pour le type de boutique
  const getMostUsedTags = () => {
    // Utiliser les tags optimisés depuis l'analyse AI si disponibles
    if (analysisData?.analysis?.optimizedTags && analysisData.analysis.optimizedTags.length > 0) {
      return analysisData.analysis.optimizedTags.map((tag: string, idx: number) => ({
        tag: tag.charAt(0).toUpperCase() + tag.slice(1),
        count: 1,
        percentage: 100 - (idx * 5) // Décroissant de 100% à ...
      }));
    }

    // Sinon, générer des tags basés sur le type de boutique détecté
    const shopName = (analysisData?.rawData?.shopName || analysisData?.shop?.name || '').toLowerCase();
    const listings = analysisData?.rawData?.listings || [];
    const titles = listings.map(l => l.title.toLowerCase()).join(' ');
    
    // Détecter le type de boutique
    let nicheTags: string[] = [];
    
    if (shopName.includes('suncatcher') || titles.includes('suncatcher')) {
      nicheTags = ['Acrylic Suncatcher', 'Window Hanging', 'Stained Glass Style', 'Home Decor', 'Gift', 'Personalized', 'Custom', 'Handmade', 'Window Decor', 'Wall Hanging'];
    } else if (shopName.includes('jewelry') || shopName.includes('bijou') || titles.includes('jewelry') || titles.includes('necklace') || titles.includes('bracelet')) {
      nicheTags = ['Handmade Jewelry', 'Unique Design', 'Gift', 'Custom', 'Personalized', 'Artisan', 'Quality', 'Fashion', 'Accessories', 'Trendy'];
    } else if (shopName.includes('art') || shopName.includes('print') || titles.includes('print') || titles.includes('art')) {
      nicheTags = ['Art Print', 'Wall Art', 'Home Decor', 'Gift', 'Unique', 'Handmade', 'Custom', 'Personalized', 'Modern', 'Decorative'];
    } else if (shopName.includes('home') || shopName.includes('decor') || titles.includes('home decor')) {
      nicheTags = ['Home Decor', 'Interior Design', 'Gift', 'Unique', 'Handmade', 'Custom', 'Modern', 'Stylish', 'Decorative', 'Wall Decor'];
    } else if (shopName.includes('gift') || titles.includes('gift')) {
      nicheTags = ['Gift', 'Unique', 'Handmade', 'Custom', 'Personalized', 'Special', 'Thoughtful', 'Memorable', 'Quality', 'Premium'];
    } else {
      // Tags génériques Etsy
      nicheTags = ['Handmade', 'Unique', 'Gift', 'Custom', 'Personalized', 'Quality', 'Artisan', 'Special', 'Original', 'Premium'];
    }

    // Ajouter des tags spécifiques depuis les patterns de l'analyse
    if (analysisData?.analysis?.listingsAnalysis?.patterns) {
      analysisData.analysis.listingsAnalysis.patterns.slice(0, 5).forEach(pattern => {
        const words = pattern.split(/\s+/).filter(w => w.length >= 4 && w.length <= 15);
        words.forEach(word => {
          const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
          if (!nicheTags.some(t => t.toLowerCase() === word.toLowerCase())) {
            nicheTags.push(capitalized);
          }
        });
      });
    }

    return nicheTags.slice(0, 15).map((tag, idx) => ({
      tag,
      count: 1,
      percentage: Math.max(20, 100 - (idx * 6))
    }));
  };

  // Calculer le prix moyen depuis les listings scrapés
  const calculateAveragePrice = () => {
    const rawData = analysisData?.rawData;
    
    // Calculer le prix moyen depuis les listings réels scrapés (uniquement ceux avec prix > 0)
    if (rawData?.listings && rawData.listings.length > 0) {
      const prices = rawData.listings
        .map((l: any) => l.price)
        .filter((p: number) => p > 0 && p < 10000); // Filtrer les prix valides (entre 0 et 10000€)
      
      if (prices.length > 0) {
        const avgPrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;
        console.log(`[Shop Analyze] Prix moyen calculé depuis ${prices.length} listings: ${avgPrice.toFixed(2)}€`);
        return avgPrice;
      } else {
        console.log(`[Shop Analyze] Aucun prix valide trouvé dans les ${rawData.listings.length} listings scrapés`);
      }
    }
    
    // Si pas de prix depuis les listings, estimer selon la niche
    const shopName = (rawData?.shopName || analysisData?.shop?.name || '').toLowerCase();
    const titles = (rawData?.listings || []).map((l: any) => l.title?.toLowerCase() || '').join(' ');
    
    if (shopName.includes('suncatcher') || titles.includes('suncatcher')) {
      return 18;
    } else if (shopName.includes('jewelry') || shopName.includes('bijou') || titles.includes('jewelry')) {
      return 28;
    } else if (shopName.includes('night light') || shopName.includes('lamp') || titles.includes('night light') || titles.includes('lamp')) {
      return 25; // Night lights / lamps
    } else if (shopName.includes('art') || shopName.includes('print') || titles.includes('print')) {
      return 15;
    } else if (shopName.includes('home') || shopName.includes('decor')) {
      return 22;
    } else {
      return 20; // Général Etsy
    }
  };

  // Calculer le revenu total réaliste : prix moyen × ventes totales
  const calculateTotalRevenue = () => {
    const rawData = analysisData?.rawData;
    const metrics = analysisData?.analysis?.metrics;
    const totalSales = metrics?.totalSales || rawData?.salesCount || 0;
    
    if (totalSales === 0) {
      console.log('[Shop Analyze] Pas de ventes totales disponibles');
      return 0;
    }

    const avgPrice = calculateAveragePrice();
    
    if (avgPrice === 0) {
      console.warn('[Shop Analyze] Prix moyen = 0, impossible de calculer le revenu total');
      return 0;
    }
    
    // Revenu total = prix moyen × ventes totales
    const totalRevenue = totalSales * avgPrice;
    console.log(`[Shop Analyze] Revenu total calculé: ${totalSales} ventes × ${avgPrice.toFixed(2)}€ = ${totalRevenue.toFixed(2)}€`);
    
    return totalRevenue;
  };

  // Estimer les ventes mensuelles et revenus de manière réaliste
  const estimateMonthlyMetrics = () => {
    const rawData = analysisData?.rawData;
    const metrics = analysisData?.analysis?.metrics;
    const totalSales = metrics?.totalSales || rawData?.salesCount || 0;
    
    if (totalSales === 0) {
      return { monthlySales: 0, monthlyRevenue: 0 };
    }

    const avgPrice = calculateAveragePrice();

    // Estimation basée sur l'âge de la boutique
    let monthsActive = 12;
    if (rawData?.shopAge) {
      const currentYear = new Date().getFullYear();
      const shopYear = parseInt(rawData.shopAge);
      if (!isNaN(shopYear) && shopYear > 2000 && shopYear <= currentYear) {
        const yearsActive = Math.max(1, currentYear - shopYear);
        monthsActive = yearsActive * 12;
      } else {
        // Si l'âge est en format "7 months" ou similaire
        const ageText = rawData.shopAge.toLowerCase();
        const monthsMatch = ageText.match(/(\d+)\s*month/i);
        if (monthsMatch) {
          monthsActive = parseInt(monthsMatch[1]);
        }
      }
    }

    // Calculer les ventes mensuelles de manière plus réaliste
    let monthlySales = 0;
    
    // Si la boutique est très récente (< 6 mois), la plupart des ventes sont récentes
    if (monthsActive <= 6) {
      monthlySales = Math.round(totalSales / Math.max(1, monthsActive));
    } 
    // Si la boutique est récente (6-12 mois), 60% des ventes sont récentes
    else if (monthsActive <= 12) {
      monthlySales = Math.round(totalSales * 0.6 / monthsActive);
    }
    // Si la boutique est moyenne (1-2 ans), 45% des ventes sont récentes
    else if (monthsActive <= 24) {
      monthlySales = Math.round(totalSales * 0.45 / 12);
    }
    // Si la boutique est ancienne (> 2 ans), moyenne pondérée avec accent sur les ventes récentes
    else {
      // Calculer la moyenne mensuelle de base
      const baseMonthly = totalSales / monthsActive;
      // Appliquer un facteur de croissance (les boutiques anciennes ont souvent plus de ventes récentes)
      monthlySales = Math.round(baseMonthly * 1.5);
    }
    
    // Ajustement selon le volume de ventes (plus de ventes = meilleure performance récente)
    if (totalSales > 1000) {
      // Boutique performante : augmenter l'estimation mensuelle
      monthlySales = Math.round(monthlySales * 1.2);
    } else if (totalSales > 500) {
      monthlySales = Math.round(monthlySales * 1.1);
    }

    // Calculer le revenu mensuel : ventes mensuelles × prix moyen
    const monthlyRevenue = monthlySales * avgPrice;

    return {
      monthlySales: Math.max(0, monthlySales),
      monthlyRevenue: Math.max(0, monthlyRevenue)
    };
  };

  // Calculer les scores pour chaque listing avec conseils
  const calculateListingScores = (listing: ShopListing, index: number) => {
    const scores = {
      title: 0,
      tags: 0,
      images: 0,
      video: 0,
      materials: 0,
      description: 0
    };

    const feedback = {
      title: [] as string[],
      tags: [] as string[],
      images: [] as string[],
      video: [] as string[],
      materials: [] as string[],
      description: [] as string[]
    };

    // Score Title (basé sur la longueur, mots-clés, structure)
    const titleLength = listing.title.length;
    const wordCount = listing.title.split(/\s+/).length;
    const hasNumbers = /\d/.test(listing.title);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(listing.title);
    
    if (titleLength >= 50 && titleLength <= 140 && wordCount >= 8) {
      scores.title = 100;
      feedback.title.push('Titre de longueur optimale pour le SEO');
      feedback.title.push('Nombre de mots-clés parfait pour la recherche');
    } else if (titleLength >= 40 && titleLength < 50 && wordCount >= 6) {
      scores.title = 90;
      feedback.title.push('Titre bien optimisé mais pourrait être plus long');
      if (wordCount < 8) feedback.title.push('Ajoutez 2-3 mots-clés supplémentaires');
    } else if (titleLength >= 30 && titleLength < 40) {
      scores.title = 75;
      feedback.title.push('Titre trop court pour le SEO Etsy');
      feedback.title.push('Ajoutez 10-20 caractères avec des mots-clés pertinents');
    } else if (titleLength < 30) {
      scores.title = 60;
      feedback.title.push('Titre beaucoup trop court');
      feedback.title.push('Minimum 40 caractères recommandé pour Etsy');
    } else if (titleLength > 140) {
      scores.title = 85;
      feedback.title.push('Titre trop long, risque d\'être tronqué');
      feedback.title.push('Réduisez à 140 caractères maximum');
    }

    if (!hasNumbers && listing.price > 0) {
      feedback.title.push('Considérez ajouter le prix ou des dimensions dans le titre');
    }
    if (hasSpecialChars) {
      feedback.title.push('Évitez les caractères spéciaux dans le titre');
    }

    // Score Tags (basé sur la diversité des mots-clés dans le titre)
    const uniqueWords = new Set(listing.title.toLowerCase().split(/\s+/).filter(w => w.length >= 4));
    if (uniqueWords.size >= 10) {
      scores.tags = 95;
      feedback.tags.push('Excellent nombre de mots-clés uniques');
    } else if (uniqueWords.size >= 8) {
      scores.tags = 85;
      feedback.tags.push('Bon nombre de mots-clés, ajoutez 2-3 tags supplémentaires');
    } else if (uniqueWords.size >= 6) {
      scores.tags = 75;
      feedback.tags.push('Nombre de mots-clés moyen');
      feedback.tags.push('Ajoutez 4-5 tags pour améliorer la visibilité');
    } else {
      scores.tags = 60;
      feedback.tags.push('Pas assez de mots-clés dans le titre');
      feedback.tags.push('Ajoutez des tags spécifiques à votre niche');
    }

    // Score Images
    if (listing.images && listing.images.length >= 10) {
      scores.images = 100;
      feedback.images.push('Excellent nombre d\'images (10+)');
      feedback.images.push('Les clients aiment voir le produit sous tous les angles');
    } else if (listing.images && listing.images.length >= 5) {
      scores.images = 90;
      feedback.images.push('Bon nombre d\'images');
      feedback.images.push('Ajoutez 2-3 images supplémentaires pour montrer les détails');
    } else if (listing.images && listing.images.length >= 3) {
      scores.images = 75;
      feedback.images.push('Nombre d\'images correct mais peut être amélioré');
      feedback.images.push('Minimum 5 images recommandé pour Etsy');
    } else if (listing.images && listing.images.length >= 1) {
      scores.images = 60;
      feedback.images.push('Pas assez d\'images');
      feedback.images.push('Ajoutez au minimum 3-5 images de qualité');
    } else {
      scores.images = 40;
      feedback.images.push('Aucune image détectée');
      feedback.images.push('CRITIQUE: Ajoutez immédiatement des images de qualité');
    }

    // Score Video (estimation basée sur les performances)
    if (listing.sales && listing.sales > 50) {
      scores.video = 90;
      feedback.video.push('Probablement une vidéo présente (ventes élevées)');
    } else if (listing.sales && listing.sales > 20) {
      scores.video = 75;
      feedback.video.push('Vidéo recommandée pour augmenter les conversions');
    } else {
      scores.video = 60;
      feedback.video.push('Ajoutez une vidéo produit pour augmenter les ventes de 30%+');
      feedback.video.push('Les listings avec vidéo se vendent mieux sur Etsy');
    }

    // Score Materials (estimation)
    if (listing.title.toLowerCase().includes('handmade') || listing.title.toLowerCase().includes('handcrafted')) {
      scores.materials = 85;
      feedback.materials.push('Mention "handmade" détectée (bon pour Etsy)');
    } else {
      scores.materials = 70;
      feedback.materials.push('Considérez mentionner les matériaux dans le titre');
      feedback.materials.push('Les clients aiment savoir ce dont est fait le produit');
    }

    // Score Description (estimation basée sur les performances)
    if (listing.sales && listing.sales > 30 && listing.reviews && listing.reviews > 5) {
      scores.description = 90;
      feedback.description.push('Description probablement bien optimisée (bonnes ventes)');
    } else if (listing.sales && listing.sales > 10) {
      scores.description = 75;
      feedback.description.push('Description correcte mais peut être améliorée');
    } else {
      scores.description = 65;
      feedback.description.push('Améliorez la description avec des détails produits');
      feedback.description.push('Ajoutez des informations sur l\'utilisation, les dimensions, etc.');
    }

    const totalScore = (scores.title + scores.tags + scores.images + scores.video + scores.materials + scores.description) / 6;
    
    // Déterminer la note (A+, A, A-, B+, B, etc.)
    let grade = 'C';
    if (totalScore >= 95) grade = 'A+';
    else if (totalScore >= 90) grade = 'A';
    else if (totalScore >= 85) grade = 'A-';
    else if (totalScore >= 80) grade = 'B+';
    else if (totalScore >= 75) grade = 'B';
    else if (totalScore >= 70) grade = 'B-';
    else if (totalScore >= 65) grade = 'C+';
    else if (totalScore >= 60) grade = 'C';
    else grade = 'D';

    // Conseils généraux basés sur les performances
    const generalTips: string[] = [];
    if (listing.sales && listing.sales > 50) {
      generalTips.push('⭐ Best-seller: Ce listing fonctionne très bien, analysez pourquoi');
    } else if (listing.sales && listing.sales > 20) {
      generalTips.push('✅ Bonnes performances: Ce listing a du potentiel');
    } else if (listing.sales && listing.sales > 5) {
      generalTips.push('⚠️ Performances moyennes: Améliorations possibles');
    } else {
      generalTips.push('🔴 Faibles ventes: Ce listing a besoin d\'optimisation urgente');
    }

    if (listing.rating && listing.rating >= 4.5) {
      generalTips.push('👍 Excellente note client, continuez dans cette direction');
    } else if (listing.rating && listing.rating < 4) {
      generalTips.push('⚠️ Note basse, vérifiez les retours clients');
    }

    return { ...scores, total: Math.round(totalScore), grade, feedback, generalTips };
  };

  if (analyzing) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-3">Analyse en cours</h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-sm font-medium mb-3">
            <Coins size={14} />
            2 crédits
          </div>
          <p className="text-white/70 mb-2">
            Analyse de la boutique : <span className="font-semibold text-[#00d4ff]">{shopUrl.split('/shop/')[1]?.split('?')[0] || 'Etsy'}</span>
          </p>
          <p className="text-sm text-white/50">
            GPT-4o analyse la boutique en détail...
          </p>
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-white/50 mb-2">
              <span>Progression</span>
              <span>{Math.round(analyzingProgress)}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] transition-all duration-500"
                style={{ width: `${analyzingProgress}%` }}
              />
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-white/50">
              <div className="w-2 h-2 bg-[#00d4ff] rounded-full animate-pulse"></div>
              <span>Récupération des données Etsy</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-white/50">
              <div className="w-2 h-2 bg-[#00d4ff] rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <span>Analyse par intelligence artificielle</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-white/50">
              <div className="w-2 h-2 bg-[#00d4ff] rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              <span>Génération des insights stratégiques</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff] mx-auto mb-4"></div>
          <p className="text-white/70">Chargement de l'analyse...</p>
        </div>
      </div>
    );
  }

  if (error || !analysisData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl shadow-lg p-8 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Erreur</h2>
          <p className="text-white/70 mb-6">{error || 'Aucune analyse disponible'}</p>
          <Link href="/dashboard">
            <button className="px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-full">
              Retour au tableau de bord
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const shop = analysisData.analysis || analysisData.rawData;
  // Utiliser le nombre réel de listings depuis les données
  // Si listingsCount n'est pas disponible ou semble incorrect, ne pas l'afficher
  const realListingsCount = analysisData.rawData?.listingsCount || 
                           analysisData.analysis?.metrics?.listingsCount;
  
  // Vérifier si le nombre de listings est fiable (doit être > 0 et cohérent)
  const hasReliableListingsCount = realListingsCount && realListingsCount > 0;
  
  const metrics = analysisData.analysis?.metrics || {
    totalSales: analysisData.rawData?.salesCount || 0,
    totalRevenue: calculateTotalRevenue(),
    monthlyRevenue: estimateMonthlyMetrics().monthlyRevenue,
    rating: analysisData.rawData?.rating || 0,
    reviewCount: analysisData.rawData?.reviewCount || 0,
    shopAge: analysisData.rawData?.shopAge || 'Inconnu',
    listingsCount: realListingsCount,
    averagePrice: analysisData.rawData?.listings && analysisData.rawData.listings.length > 0
      ? analysisData.rawData.listings.reduce((sum: number, l: any) => sum + (l.price || 0), 0) / analysisData.rawData.listings.filter((l: any) => l.price > 0).length
      : 0
  };

  const mostUsedTags = getMostUsedTags();
  const listings = analysisData.rawData?.listings || [];

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <button className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white transition-colors">
                  <ArrowLeft size={18} />
                  <span className="hidden sm:inline">Retour</span>
                </button>
            </Link>
              <Logo size="md" showText={true} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Credits warning */}
        {creditsError && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm text-center">
            ⚠️ {creditsError}
          </div>
        )}

        {/* Shop Header */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center text-white font-bold text-xl">
                  {shop.shopName?.charAt(0).toUpperCase() || 'S'}
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                    {shop.shopName || analysisData.shop.name}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-white/70">
                    {metrics.rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span>{metrics.rating.toFixed(1)} ({metrics.reviewCount.toLocaleString()})</span>
                      </div>
                    )}
                    {metrics.shopAge && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Depuis {metrics.shopAge}</span>
                      </div>
                    )}
                    {analysisData.rawData?.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{analysisData.rawData.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <a
              href={shop.shopUrl || analysisData.shop.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              Voir sur Etsy
              <ExternalLink size={16} />
            </a>
          </div>
          </div>

            {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'text-white border-b-2 border-[#00d4ff]'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Overview
          </button>
          {listings.length > 0 && (
            <button
              onClick={() => setActiveTab('listings')}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === 'listings'
                  ? 'text-white border-b-2 border-[#00d4ff]'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Listings ({listings.length})
            </button>
          )}
        </div>

        {activeTab === 'overview' ? (
          <>
            {/* Key Metrics */}
            {(() => {
              const estimated = estimateMonthlyMetrics();
              const avgPrice = calculateAveragePrice();
              
              // Vérifier si on a des données fiables
              const hasReliablePrice = avgPrice > 0;
              const hasListings = listings.length > 0;
              const pricesFromListings = listings.filter((l: any) => l.price > 0 && l.price < 10000).map((l: any) => l.price);
              const hasValidPrices = pricesFromListings.length > 0;
              
              // Afficher un avertissement si les données ne sont pas fiables
              if (!hasValidPrices && hasListings) {
                console.warn(`[Shop Analyze] ${listings.length} listings scrapés mais aucun prix valide trouvé`);
              }
              
              const monthlySales = estimated.monthlySales;
              const monthlyRevenue = estimated.monthlyRevenue;
              
              // Calculer le percentile de ventes
              let salesPercentile = '20%+';
              if (metrics.totalSales > 5000) salesPercentile = '60%+';
              else if (metrics.totalSales > 2000) salesPercentile = '50%+';
              else if (metrics.totalSales > 1000) salesPercentile = '40%+';
              else if (metrics.totalSales > 500) salesPercentile = '30%+';
              
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-[#00d4ff]" />
                      <span className="text-sm text-white/70">Ventes Mensuelles</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {monthlySales.toLocaleString()}
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      {(monthlySales / 30).toFixed(1)} par jour
                    </div>
                    {!hasValidPrices && hasListings && (
                      <div className="text-xs text-amber-400 mt-1">⚠ Estimation (prix non scrapés)</div>
                    )}
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-[#00c9b7]" />
                      <span className="text-sm text-white/70">Revenu Mensuel Estimé</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {monthlyRevenue > 0 ? `${monthlyRevenue.toFixed(2)} €` : '0 €'}
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      {monthlyRevenue > 0 ? `${(monthlyRevenue / 30).toFixed(2)} € par jour` : 'Données insuffisantes'}
                    </div>
                    {!hasValidPrices && hasListings && (
                      <div className="text-xs text-amber-400 mt-1">⚠ Estimation (prix non scrapés)</div>
                    )}
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-5 h-5 text-purple-400" />
                      <span className="text-sm text-white/70">Plus de ventes que</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {salesPercentile}
                    </div>
                    <div className="text-xs text-white/50 mt-1">des boutiques Etsy</div>
                  </div>
                </div>
              );
            })()}

            {/* Most Used Tags */}
            {mostUsedTags.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#00d4ff]" />
                  Tags les Plus Utilisés
                </h2>
                <div className="flex flex-wrap gap-2">
                  {mostUsedTags.map((tag, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm"
                    >
                      <span className="text-white">{tag.tag}</span>
                      <span className="text-white/50 ml-2">{tag.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shop Stats */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#00d4ff]" />
                Statistiques de la Boutique
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-white/70 mb-1">Ventes Totales</div>
                  <div className="text-lg font-bold text-white">{metrics.totalSales.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-white/70 mb-1">Revenu Total Estimé</div>
                  <div className="text-lg font-bold text-white">
                    {(() => {
                      const totalRevenue = calculateTotalRevenue();
                      return totalRevenue > 0 ? `${totalRevenue.toFixed(2)} €` : 'N/A';
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-white/70 mb-1">Prix Moyen du Panier</div>
                  <div className="text-lg font-bold text-white">
                    {(() => {
                      const avgPrice = calculateAveragePrice();
                      const pricesFromListings = listings.filter((l: any) => l.price > 0 && l.price < 10000).map((l: any) => l.price);
                      if (pricesFromListings.length > 0) {
                        return `${avgPrice.toFixed(2)} €`;
                      }
                      return 'N/A';
                    })()}
                  </div>
                  {(() => {
                    const pricesFromListings = listings.filter((l: any) => l.price > 0 && l.price < 10000);
                    if (pricesFromListings.length > 0) {
                      return (
                        <div className="text-xs text-white/50 mt-1">
                          Basé sur {pricesFromListings.length} listings
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>

            {/* Analysis Sections */}
            {analysisData.analysis && (
              <>
                {/* Overview */}
                {analysisData.analysis.overview && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-[#00d4ff]" />
                      Vue d'Ensemble
                    </h2>
                    <p className="text-white/70 leading-relaxed">{analysisData.analysis.overview}</p>
                  </div>
                )}

                {/* Ce qui marche / Ce qui ne marche pas - Analyse globale */}
                {(() => {
                  // Analyse basée sur les données globales disponibles
                  const totalSales = metrics.totalSales || 0;
                  const listingsCount = metrics.listingsCount || listings.length || 1;
                  const salesPerListing = totalSales / listingsCount;
                  const avgPrice = listings.length > 0 
                    ? listings.reduce((sum, l) => sum + l.price, 0) / listings.length 
                    : 18; // Estimation par défaut
                  
                  const bestListings = listings
                    .filter(l => l.sales && l.sales > 10)
                    .sort((a, b) => (b.sales || 0) - (a.sales || 0))
                    .slice(0, 5);
                  
                  const worstListings = listings
                    .filter(l => !l.sales || l.sales <= 5)
                    .slice(0, 5);

                  const whatWorks: string[] = [];
                  const whatDoesntWork: string[] = [];
                  const recommendations: string[] = [];

                  // Analyser ce qui marche
                  if (salesPerListing > 50) {
                    whatWorks.push(`Excellent ratio ventes/listings (${salesPerListing.toFixed(1)} ventes par listing)`);
                    whatWorks.push('La boutique a des produits qui se vendent bien');
                  } else if (salesPerListing > 30) {
                    whatWorks.push(`Bon ratio ventes/listings (${salesPerListing.toFixed(1)} ventes par listing)`);
                  }

                  if (metrics.rating && metrics.rating >= 4.5) {
                    whatWorks.push(`Excellente note client (${metrics.rating.toFixed(1)}/5)`);
                    whatWorks.push('Satisfaction client élevée = meilleure visibilité Etsy');
                  } else if (metrics.rating && metrics.rating >= 4.0) {
                    whatWorks.push(`Bonne note client (${metrics.rating.toFixed(1)}/5)`);
                  }

                  if (listingsCount >= 20) {
                    whatWorks.push(`Large gamme de produits (${listingsCount} listings)`);
                    whatWorks.push('Plus de choix = plus de chances de ventes');
                  } else if (listingsCount >= 10) {
                    whatWorks.push(`Gamme de produits correcte (${listingsCount} listings)`);
                  }

                  if (totalSales > 1000) {
                    whatWorks.push(`Volume de ventes élevé (${totalSales.toLocaleString()} ventes totales)`);
                    whatWorks.push('Preuve sociale importante pour les nouveaux clients');
                  } else if (totalSales > 500) {
                    whatWorks.push(`Volume de ventes correct (${totalSales.toLocaleString()} ventes)`);
                  }

                  // Analyser ce qui ne marche pas
                  if (salesPerListing < 20 && totalSales > 0) {
                    whatDoesntWork.push(`Ratio ventes/listings faible (${salesPerListing.toFixed(1)} ventes par listing)`);
                    whatDoesntWork.push('Certains listings ne se vendent pas assez');
                    recommendations.push('Optimisez les listings peu performants ou retirez-les');
                  }

                  if (metrics.rating && metrics.rating < 4.0) {
                    whatDoesntWork.push(`Note client à améliorer (${metrics.rating.toFixed(1)}/5)`);
                    whatDoesntWork.push('Les notes basses réduisent la visibilité sur Etsy');
                    recommendations.push('Améliorez la qualité des produits et le service client');
                  }

                  if (listingsCount < 10) {
                    whatDoesntWork.push(`Gamme de produits limitée (${listingsCount} listings)`);
                    whatDoesntWork.push('Moins de chances d\'être trouvé par les clients');
                    recommendations.push('Ajoutez 10-15 listings supplémentaires pour augmenter la visibilité');
                  }

                  if (totalSales === 0) {
                    whatDoesntWork.push('Aucune vente enregistrée');
                    whatDoesntWork.push('La boutique a besoin d\'optimisation urgente');
                    recommendations.push('Revoyez complètement la stratégie: prix, images, descriptions, tags');
                  }

                  // Patterns depuis l'analyse AI
                  if (analysisData.analysis?.listingsAnalysis?.patterns) {
                    analysisData.analysis.listingsAnalysis.patterns.slice(0, 3).forEach(pattern => {
                      whatWorks.push(`Pattern observé: ${pattern}`);
                    });
                  }

                  if (analysisData.analysis?.listingsAnalysis?.opportunities) {
                    analysisData.analysis.listingsAnalysis.opportunities.slice(0, 3).forEach(opp => {
                      whatDoesntWork.push(`Opportunité: ${opp}`);
                    });
                  }

                  return (
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      <div className="bg-gradient-to-br from-green-500/10 to-green-400/5 border border-green-500/20 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                          Ce qui Marche
                        </h3>
                        {whatWorks.length > 0 ? (
                          <div className="space-y-4">
                            <ul className="space-y-2">
                              {whatWorks.map((item, idx) => (
                                <li key={idx} className="text-sm text-white/90 flex items-start gap-2">
                                  <span className="text-green-400 mt-1">✓</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                            {bestListings.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-green-500/20">
                                <p className="text-xs text-white/70 mb-2">Best-sellers identifiés ({bestListings.length}):</p>
                                <ul className="space-y-1">
                                  {bestListings.map((listing, idx) => (
                                    <li key={idx} className="text-xs text-white/60">
                                      • {listing.title.substring(0, 50)}... ({listing.sales} ventes)
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="bg-green-500/10 rounded-lg p-3 mt-4">
                              <p className="text-xs text-green-300 font-medium">💡 Analyse:</p>
                              <p className="text-xs text-white/70 mt-1">
                                Ces points forts sont vos avantages concurrentiels. Maintenez et renforcez ces aspects.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-white/70">Analyse en cours...</p>
                        )}
                      </div>

                      <div className="bg-gradient-to-br from-red-500/10 to-red-400/5 border border-red-500/20 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-400" />
                          Ce qui ne Marche Pas
                        </h3>
                        {whatDoesntWork.length > 0 ? (
                          <div className="space-y-4">
                            <ul className="space-y-2">
                              {whatDoesntWork.map((item, idx) => (
                                <li key={idx} className="text-sm text-white/90 flex items-start gap-2">
                                  <span className="text-red-400 mt-1">⚠</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                            {worstListings.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-red-500/20">
                                <p className="text-xs text-white/70 mb-2">Listings à améliorer ({worstListings.length}):</p>
                                <ul className="space-y-1">
                                  {worstListings.slice(0, 3).map((listing, idx) => (
                                    <li key={idx} className="text-xs text-white/60">
                                      • {listing.title.substring(0, 50)}... ({listing.sales || 0} ventes)
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {recommendations.length > 0 && (
                              <div className="bg-red-500/10 rounded-lg p-3 mt-4">
                                <p className="text-xs text-red-300 font-medium">💡 Actions Recommandées:</p>
                                <ul className="mt-2 space-y-1">
                                  {recommendations.map((rec, idx) => (
                                    <li key={idx} className="text-xs text-white/70">• {rec}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-white/70">Aucun problème majeur identifié</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Strengths & Weaknesses */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                      Forces ({analysisData.analysis.strengths?.length || 0})
                    </h3>
                    <ul className="space-y-2">
                      {analysisData.analysis.strengths?.map((strength, idx) => (
                        <li key={idx} className="text-white/70 text-sm flex items-start gap-2">
                          <span className="text-green-400 mt-1">•</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-400" />
                      Faiblesses ({analysisData.analysis.weaknesses?.length || 0})
                    </h3>
                    <ul className="space-y-2">
                      {analysisData.analysis.weaknesses?.map((weakness, idx) => (
                        <li key={idx} className="text-white/70 text-sm flex items-start gap-2">
                          <span className="text-amber-400 mt-1">•</span>
                          <span>{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Strategies */}
                {analysisData.analysis.strategies && analysisData.analysis.strategies.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-[#00d4ff]" />
                      Stratégies pour les Battre
                    </h2>
                    <ul className="space-y-3">
                      {analysisData.analysis.strategies.map((strategy, idx) => (
                        <li key={idx} className="text-white/70 flex items-start gap-3">
                          <span className="text-[#00d4ff] mt-1">→</span>
                          <span>{strategy}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Insights */}
                {analysisData.analysis.insights && (
                  <div className="bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/10 border border-[#00d4ff]/20 rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-[#00d4ff]" />
                      Insights Stratégiques
                    </h2>
                    <p className="text-white/70 leading-relaxed">{analysisData.analysis.insights}</p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* Listings Tab */
          <div className="space-y-4">
            {listings.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <Package className="w-12 h-12 text-white/50 mx-auto mb-4" />
                <p className="text-white/70">Aucun listing trouvé</p>
              </div>
            ) : (
              listings.map((listing, idx) => {
                const scores = calculateListingScores(listing, idx);
                const gradeColors: { [key: string]: string } = {
                  'A+': 'text-green-400',
                  'A': 'text-green-400',
                  'A-': 'text-green-400',
                  'B+': 'text-blue-400',
                  'B': 'text-blue-400',
                  'B-': 'text-yellow-400',
                  'C+': 'text-yellow-400',
                  'C': 'text-orange-400',
                  'D': 'text-red-400'
                };

                return (
                  <div
                    key={idx}
                    className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#00d4ff]/30 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row gap-6">
                      {/* Listing Image */}
                      <div className="relative w-full sm:w-48 h-48 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                        {listing.images && listing.images[0] ? (
                          <img
                            src={listing.images[0]}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-12 h-12 text-white/30" />
                          </div>
                        )}
                        <div className={`absolute top-2 left-2 text-3xl font-bold ${gradeColors[scores.grade] || 'text-white'}`}>
                          {scores.grade}
                        </div>
            </div>

                      {/* Listing Details */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">
                              {listing.title}
                            </h3>
                            <a
                              href={listing.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#00d4ff] hover:underline flex items-center gap-1"
                            >
                              Voir le listing
                              <ExternalLink size={14} />
                            </a>
              </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-white">{listing.price.toFixed(2)} €</div>
                            {listing.sales && (
                              <div className="text-sm text-white/70">{listing.sales} ventes</div>
                            )}
            </div>
          </div>

                        {/* Performance Metrics */}
                        <div className="space-y-3">
                          {/* Conseils généraux */}
                          {scores.generalTips && scores.generalTips.length > 0 && (
                            <div className="bg-white/5 rounded-lg p-3 mb-2">
                              {scores.generalTips.map((tip, tipIdx) => (
                                <div key={tipIdx} className="text-xs text-white/70 mb-1">{tip}</div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <FileText className="w-4 h-4" />
                              <span>TITLE</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    scores.title >= 80 ? 'bg-green-500' : scores.title >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${scores.title}%` }}
                                />
                              </div>
                              <span className="text-sm text-white/70 w-12 text-right">{scores.title}/100</span>
                            </div>
                          </div>
                          {scores.feedback.title.length > 0 && (
                            <div className="ml-6 text-xs text-white/50 space-y-1">
                              {scores.feedback.title.map((fb, fbIdx) => (
                                <div key={fbIdx}>• {fb}</div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <Tag className="w-4 h-4" />
                              <span>TAGS</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    scores.tags >= 80 ? 'bg-green-500' : scores.tags >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${scores.tags}%` }}
                                />
                              </div>
                              <span className="text-sm text-white/70 w-12 text-right">{scores.tags}/100</span>
                            </div>
                          </div>
                          {scores.feedback.tags.length > 0 && (
                            <div className="ml-6 text-xs text-white/50 space-y-1">
                              {scores.feedback.tags.map((fb, fbIdx) => (
                                <div key={fbIdx}>• {fb}</div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <ImageIcon className="w-4 h-4" />
                              <span>IMAGES</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    scores.images >= 80 ? 'bg-green-500' : scores.images >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${scores.images}%` }}
                                />
                              </div>
                              <span className="text-sm text-white/70 w-12 text-right">{scores.images}/100</span>
                            </div>
                          </div>
                          {scores.feedback.images.length > 0 && (
                            <div className="ml-6 text-xs text-white/50 space-y-1">
                              {scores.feedback.images.map((fb, fbIdx) => (
                                <div key={fbIdx}>• {fb}</div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <Video className="w-4 h-4" />
                              <span>VIDEO</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    scores.video >= 80 ? 'bg-green-500' : scores.video >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${scores.video}%` }}
                                />
                              </div>
                              <span className="text-sm text-white/70 w-12 text-right">{scores.video}/100</span>
                            </div>
                          </div>
                          {scores.feedback.video.length > 0 && (
                            <div className="ml-6 text-xs text-white/50 space-y-1">
                              {scores.feedback.video.map((fb, fbIdx) => (
                                <div key={fbIdx}>• {fb}</div>
                              ))}
          </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <Package className="w-4 h-4" />
                              <span>MATERIALS</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    scores.materials >= 80 ? 'bg-green-500' : scores.materials >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${scores.materials}%` }}
                                />
                              </div>
                              <span className="text-sm text-white/70 w-12 text-right">{scores.materials}/100</span>
                            </div>
                          </div>
                          {scores.feedback.materials.length > 0 && (
                            <div className="ml-6 text-xs text-white/50 space-y-1">
                              {scores.feedback.materials.map((fb, fbIdx) => (
                                <div key={fbIdx}>• {fb}</div>
                              ))}
          </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <FileText className="w-4 h-4" />
                              <span>DESCRIPTION</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    scores.description >= 80 ? 'bg-green-500' : scores.description >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${scores.description}%` }}
                                />
                              </div>
                              <span className="text-sm text-white/70 w-12 text-right">{scores.description}/100</span>
                            </div>
                          </div>
                          {scores.feedback.description.length > 0 && (
                            <div className="ml-6 text-xs text-white/50 space-y-1">
                              {scores.feedback.description.map((fb, fbIdx) => (
                                <div key={fbIdx}>• {fb}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
            </div>
                );
              })
          )}
        </div>
        )}
      </main>
    </div>
  );
}
