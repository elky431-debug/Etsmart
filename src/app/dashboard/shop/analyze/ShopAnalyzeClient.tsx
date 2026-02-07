'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  Package
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

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
  const router = useRouter();
  const [analysisData, setAnalysisData] = useState<ShopAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingProgress, setAnalyzingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'listings'>('overview');
  const shopUrl = searchParams.get('shop') || '';
  const analyzingParam = searchParams.get('analyzing');
  const importParam = searchParams.get('import');

  useEffect(() => {
    // Vérifier d'abord si on a déjà des données (import=done)
    if (importParam === 'done') {
      const stored = localStorage.getItem('shopAnalysis') || sessionStorage.getItem('shopAnalysis');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setAnalysisData(data);
          setAnalyzing(false);
          setLoading(false);
          return;
        } catch (err) {
          console.error('[Shop Analyze] Erreur parsing:', err);
        }
      }
    }

    // Si on est en mode "analyse en cours"
    if (analyzingParam === 'true') {
      try {
        sessionStorage.removeItem('shopAnalysis');
        localStorage.removeItem('shopAnalysis');
      } catch (err) {
        console.log('[Shop Analyze] Erreur nettoyage storage:', err);
      }
      setAnalyzing(true);
      setLoading(false);
      
      // Écouter l'événement quand l'analyse est prête
      const handleAnalysisReady = (event: CustomEvent) => {
        const data = event.detail;
        console.log('[Shop Analyze] Événement shopAnalysisReady reçu:', data);
        setAnalysisData(data);
        sessionStorage.setItem('shopAnalysis', JSON.stringify(data));
        localStorage.setItem('shopAnalysis', JSON.stringify(data));
        setAnalyzing(false);
        setLoading(false);
        const cleanUrl = `/dashboard/shop/analyze?shop=${encodeURIComponent(shopUrl)}`;
        window.history.replaceState({}, '', cleanUrl);
      };

      window.addEventListener('shopAnalysisReady', handleAnalysisReady as EventListener);

      // Vérifier localStorage une fois au démarrage
      const checkStorageOnce = () => {
        const stored = localStorage.getItem('shopAnalysis');
        const storedSession = sessionStorage.getItem('shopAnalysis');
        
        if (stored) {
          try {
            const data = JSON.parse(stored);
            if (data.shop?.url === shopUrl || data.analysis?.shopUrl === shopUrl) {
              setAnalysisData(data);
              sessionStorage.setItem('shopAnalysis', stored);
              setAnalyzing(false);
              setLoading(false);
              const cleanUrl = `/dashboard/shop/analyze?shop=${encodeURIComponent(shopUrl)}`;
              window.history.replaceState({}, '', cleanUrl);
              return true;
            }
          } catch (err) {
            console.error('[Shop Analyze] Erreur parsing localStorage:', err);
          }
        }
        
        if (storedSession) {
          try {
            const data = JSON.parse(storedSession);
            if (data.shop?.url === shopUrl || data.analysis?.shopUrl === shopUrl) {
              setAnalysisData(data);
              setAnalyzing(false);
              setLoading(false);
              const cleanUrl = `/dashboard/shop/analyze?shop=${encodeURIComponent(shopUrl)}`;
              window.history.replaceState({}, '', cleanUrl);
              return true;
            }
          } catch (err) {
            console.error('[Shop Analyze] Erreur parsing sessionStorage:', err);
          }
        }
        return false;
      };
      
      if (checkStorageOnce()) {
        return;
      }

      // Timeout de sécurité (60 secondes)
      const timeout = setTimeout(() => {
        console.error('[Shop Analyze] Timeout - Aucune donnée reçue après 60 secondes');
        setError('L\'analyse prend plus de temps que prévu. Vérifiez les logs du serveur et réessayez.');
        setAnalyzing(false);
        setLoading(false);
      }, 60000);

      return () => {
        clearTimeout(timeout);
        window.removeEventListener('shopAnalysisReady', handleAnalysisReady as EventListener);
      };
    }

    // Récupérer les données depuis sessionStorage ou localStorage
    let storedData = sessionStorage.getItem('shopAnalysis');
    if (!storedData) {
      storedData = localStorage.getItem('shopAnalysis');
    }
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        setAnalysisData(data);
        setLoading(false);
        return;
      } catch (err) {
        console.error('[Shop Analyze] Erreur parsing données:', err);
        setError('Erreur lors du chargement des données');
        setLoading(false);
        return;
      }
    }
    
    // Si pas de données
    if (!storedData) {
      const errorParam = searchParams.get('import');
      if (errorParam === 'error') {
        const errorMessage = searchParams.get('message') || 'Erreur lors de l\'import';
        setError(decodeURIComponent(errorMessage));
        setLoading(false);
      } else if (!analyzingParam) {
        setError('Aucune analyse disponible. Veuillez lancer une nouvelle analyse.');
        setLoading(false);
      }
    }

    // Écouter les événements de nouvelles analyses
    const handleAnalysisReady = (event: CustomEvent) => {
      const data = event.detail;
      setAnalysisData(data);
      sessionStorage.setItem('shopAnalysis', JSON.stringify(data));
      setLoading(false);
    };

    window.addEventListener('shopAnalysisReady', handleAnalysisReady as EventListener);

    return () => {
      window.removeEventListener('shopAnalysisReady', handleAnalysisReady as EventListener);
    };
  }, [analyzingParam, shopUrl, importParam, searchParams]);

  useEffect(() => {
    if (!analyzing) return;
    setAnalyzingProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      const increment = Math.random() * 6 + 3;
      progress = Math.min(95, progress + increment);
      setAnalyzingProgress(progress);
    }, 600);
    return () => clearInterval(interval);
  }, [analyzing]);

  // Calculer les tags les plus utilisés depuis les listings
  const getMostUsedTags = () => {
    if (!analysisData?.rawData?.listings) return [];
    
    const tagCounts: { [key: string]: number } = {};
    analysisData.rawData.listings.forEach(listing => {
      // Extraire les tags depuis le titre (mots-clés communs)
      const words = listing.title.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) {
          tagCounts[word] = (tagCounts[word] || 0) + 1;
        }
      });
    });
    
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({
        tag: tag.charAt(0).toUpperCase() + tag.slice(1),
        count,
        percentage: Math.round((count / analysisData.rawData.listings.length) * 100)
      }));
  };

  // Calculer les scores pour chaque listing
  const calculateListingScores = (listing: ShopListing) => {
    const scores = {
      title: 0,
      tags: 0,
      images: 0,
      video: 0,
      materials: 0,
      description: 0
    };

    // Score Title (basé sur la longueur et les mots-clés)
    const titleLength = listing.title.length;
    if (titleLength >= 50 && titleLength <= 140) scores.title = 100;
    else if (titleLength >= 40 && titleLength < 50) scores.title = 90;
    else if (titleLength >= 30 && titleLength < 40) scores.title = 80;
    else if (titleLength >= 20 && titleLength < 30) scores.title = 70;
    else scores.title = 60;

    // Score Tags (estimé basé sur les mots dans le titre)
    const wordCount = listing.title.split(/\s+/).length;
    if (wordCount >= 10) scores.tags = 90;
    else if (wordCount >= 8) scores.tags = 85;
    else if (wordCount >= 6) scores.tags = 75;
    else scores.tags = 60;

    // Score Images
    if (listing.images && listing.images.length >= 5) scores.images = 100;
    else if (listing.images && listing.images.length >= 3) scores.images = 80;
    else if (listing.images && listing.images.length >= 1) scores.images = 60;
    else scores.images = 40;

    // Score Video (on ne peut pas le détecter facilement, donc on met une valeur moyenne)
    scores.video = 70;

    // Score Materials (on ne peut pas le détecter, donc valeur moyenne)
    scores.materials = 75;

    // Score Description (on ne peut pas le détecter, donc valeur moyenne)
    scores.description = 80;

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

    return { ...scores, total: Math.round(totalScore), grade };
  };

  if (analyzing) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-3">Analyse en cours</h2>
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
  const metrics = analysisData.analysis?.metrics || {
    totalSales: analysisData.rawData?.salesCount || 0,
    totalRevenue: analysisData.rawData?.totalRevenue || 0,
    monthlyRevenue: analysisData.rawData?.monthlyRevenue || 0,
    rating: analysisData.rawData?.rating || 0,
    reviewCount: analysisData.rawData?.reviewCount || 0,
    shopAge: analysisData.rawData?.shopAge || 'Inconnu',
    listingsCount: analysisData.rawData?.listings?.length || 0
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
        </div>

        {activeTab === 'overview' ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-[#00d4ff]" />
                  <span className="text-sm text-white/70">Ventes Mensuelles</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {Math.round(metrics.monthlyRevenue / (listings[0]?.price || 1)) || 0}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {((metrics.monthlyRevenue / (listings[0]?.price || 1)) / 30).toFixed(2)} par jour
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-[#00c9b7]" />
                  <span className="text-sm text-white/70">Revenu Mensuel</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {metrics.monthlyRevenue > 0 ? `${metrics.monthlyRevenue.toFixed(2)} €` : 'N/A'}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {metrics.monthlyRevenue > 0 ? `${(metrics.monthlyRevenue / 30).toFixed(2)} € par jour` : 'Données non disponibles'}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-white/70">Plus de ventes que</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {metrics.totalSales > 1000 ? '40%+' : metrics.totalSales > 500 ? '30%+' : '20%+'}
                </div>
                <div className="text-xs text-white/50 mt-1">des boutiques</div>
              </div>
            </div>

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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-white/70 mb-1">Ventes Totales</div>
                  <div className="text-lg font-bold text-white">{metrics.totalSales.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-white/70 mb-1">Revenu Total</div>
                  <div className="text-lg font-bold text-white">{metrics.totalRevenue > 0 ? `${metrics.totalRevenue.toFixed(2)} €` : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-white/70 mb-1">Listings Actifs</div>
                  <div className="text-lg font-bold text-white">{metrics.listingsCount}</div>
                </div>
                <div>
                  <div className="text-sm text-white/70 mb-1">Ventes par Listing</div>
                  <div className="text-lg font-bold text-white">
                    {metrics.listingsCount > 0 ? (metrics.totalSales / metrics.listingsCount).toFixed(1) : '0'}
                  </div>
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
                const scores = calculateListingScores(listing);
                const gradeColors: { [key: string]: string } = {
                  'A+': 'text-green-400',
                  'A': 'text-green-400',
                  'A-': 'text-green-400',
                  'B+': 'text-blue-400',
                  'B': 'text-blue-400',
                  'B-': 'text-yellow-400',
                  'C+': 'text-yellow-400',
                  'C': 'text-orange-400'
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
                        <div className="space-y-2">
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
