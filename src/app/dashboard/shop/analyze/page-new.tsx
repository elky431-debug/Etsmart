'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Store, 
  Search, 
  TrendingUp, 
  DollarSign, 
  BarChart3,
  ExternalLink,
  Star,
  Calendar,
  MapPin,
  Tag,
  Image as ImageIcon,
  Video,
  FileText,
  Package,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { analyzeShop, normalizeShopInput, type ShopAnalysis, type ShopListing } from '@/lib/shopAnalyzer';

interface ShopAnalyzePageProps {}

export default function ShopAnalyzePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const analyzingParam = searchParams.get('analyzing');
  const shopUrlParam = searchParams.get('shop');
  const importParam = searchParams.get('import');

  const [shopInput, setShopInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ShopAnalysis | null>(null);
  const [history, setHistory] = useState<ShopAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'overview' | 'reviews' | 'about'>('overview');
  const [sortBy, setSortBy] = useState<'created' | 'sales' | 'price'>('created');
  const [sortOrder, setSortOrder] = useState<'high' | 'low'>('high');

  // Vérifier si on vient de l'extension avec des données
  useEffect(() => {
    if (importParam === 'done' && shopUrlParam) {
      // Essayer de récupérer les données depuis localStorage
      try {
        const stored = localStorage.getItem('shopAnalysis');
        if (stored) {
          const data = JSON.parse(stored);
          if (data.analysis && data.rawData) {
            // Convertir les données brutes en format ShopAnalysis
            const shopAnalysis = analyzeShop(
              data.rawData.shopName || shopUrlParam.split('/shop/')[1]?.split('?')[0] || 'Boutique',
              data.rawData.shopUrl || shopUrlParam,
              data.rawData.listings || [],
              {
                rating: data.rawData.rating,
                reviewCount: data.rawData.reviewCount,
                salesCount: data.rawData.salesCount,
                shopAge: data.rawData.shopAge,
                location: data.rawData.location,
              }
            );
            setAnalysis(shopAnalysis);
            setShopInput(shopAnalysis.shopUrl);
            setHistory((prev) => [shopAnalysis, ...prev]);
          }
        }
      } catch (err) {
        console.error('Erreur lors de la récupération des données:', err);
      }
    } else if (analyzingParam === 'true' && shopUrlParam) {
      setShopInput(shopUrlParam);
      setIsAnalyzing(true);
      // L'extension va envoyer les données, on attend
    }
  }, [importParam, analyzingParam, shopUrlParam]);

  // Écouter les événements de l'extension
  useEffect(() => {
    const handleShopAnalysisReady = (event: CustomEvent) => {
      const data = event.detail;
      if (data.analysis && data.rawData) {
        const shopAnalysis = analyzeShop(
          data.rawData.shopName || 'Boutique',
          data.rawData.shopUrl || shopUrlParam || '',
          data.rawData.listings || [],
          {
            rating: data.rawData.rating,
            reviewCount: data.rawData.reviewCount,
            salesCount: data.rawData.salesCount,
            shopAge: data.rawData.shopAge,
            location: data.rawData.location,
          }
        );
        setAnalysis(shopAnalysis);
        setHistory((prev) => [shopAnalysis, ...prev]);
        setIsAnalyzing(false);
        setError(null);
      }
    };

    window.addEventListener('shopAnalysisReady', handleShopAnalysisReady as EventListener);
    return () => {
      window.removeEventListener('shopAnalysisReady', handleShopAnalysisReady as EventListener);
    };
  }, [shopUrlParam]);

  const handleAnalyze = async () => {
    if (!shopInput.trim()) {
      setError('Veuillez entrer un nom ou lien de boutique');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const normalizedUrl = normalizeShopInput(shopInput);
      
      // Vérifier si l'extension Chrome est disponible
      if (typeof window !== 'undefined' && (window as any).chrome?.runtime) {
        // Envoyer un message à l'extension pour analyser la boutique
        try {
          const response = await new Promise<any>((resolve) => {
            (window as any).chrome.runtime.sendMessage(
              (window as any).chrome.runtime.id,
              {
                type: 'ANALYZE_SHOP_FROM_WEB',
                shopUrl: normalizedUrl,
              },
              (resp: any) => {
                if ((window as any).chrome.runtime.lastError) {
                  resolve(null);
                } else {
                  resolve(resp);
                }
              }
            );
          });

          if (response?.success) {
            // L'extension va ouvrir la page et envoyer les données
            router.push(`/dashboard/shop/analyze?analyzing=true&shop=${encodeURIComponent(normalizedUrl)}`);
            return;
          }
        } catch (extError) {
          console.log('Extension non disponible, utilisation du scraping direct');
        }
      }

      // Fallback: utiliser l'API backend pour scraper
      const response = await fetch('/api/shop/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopUrl: normalizedUrl }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors du scraping de la boutique');
      }

      const data = await response.json();
      
      if (data.shop) {
        const shopAnalysis = analyzeShop(
          data.shop.shopName,
          data.shop.shopUrl,
          data.shop.listings || [],
          {
            rating: data.shop.rating,
            reviewCount: data.shop.reviewCount,
            salesCount: data.shop.salesCount,
            shopAge: data.shop.shopAge,
            location: data.shop.location,
          }
        );
        setAnalysis(shopAnalysis);
        setHistory((prev) => [shopAnalysis, ...prev]);
      } else {
        throw new Error('Données de boutique non disponibles');
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l\'analyse');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sortedListings = analysis?.listings ? [...analysis.listings].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'created') {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      comparison = bDate - aDate;
    } else if (sortBy === 'sales') {
      comparison = (b.sales || 0) - (a.sales || 0);
    } else if (sortBy === 'price') {
      comparison = b.price - a.price;
    }
    return sortOrder === 'high' ? comparison : -comparison;
  }) : [];

  // Page de recherche (état initial)
  if (!analysis && !isAnalyzing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-2">
                <Logo className="w-8 h-8" />
                <span className="text-xl font-bold text-white">Etsmart</span>
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Retour au dashboard
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] mb-6 sm:mb-8">
              <Store className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Shop Analyzer
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 mb-8 sm:mb-12 max-w-2xl mx-auto">
              Voyez ce qui fonctionne, ce qui ne fonctionne pas, et comment améliorer votre boutique Etsy.
            </p>

            {/* Champ de recherche */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Exemple: 'ShopName' ou 'ShopName.etsy.com'"
                    value={shopInput}
                    onChange={(e) => setShopInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                    className="pl-12 bg-slate-800/50 border-slate-700 text-white placeholder-slate-400 h-14 text-lg"
                  />
                </div>
                <Button
                  onClick={handleAnalyze}
                  className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white px-8 h-14 font-semibold hover:opacity-90"
                >
                  Rechercher
                </Button>
              </div>
              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Informations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              <Card className="bg-slate-800/50 border-slate-700/50 p-6 text-left">
                <h3 className="text-lg font-semibold text-white mb-2">Qu'est-ce que Shop Analyzer ?</h3>
                <p className="text-sm text-slate-400">
                  Le Shop Analyzer d'Etsmart donne aux vendeurs Etsy un aperçu clair et de haut niveau de leur boutique (ou de n'importe quelle boutique) pour voir ce qui fonctionne et ce qui peut freiner la visibilité. Il vous aide à comprendre où même de petits changements peuvent faire une vraie différence.
                </p>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700/50 p-6 text-left">
                <h3 className="text-lg font-semibold text-white mb-2">Pourquoi Shop Analyzer est important</h3>
                <p className="text-sm text-slate-400">
                  Shop Analyzer remplace les suppositions par la clarté, vous aidant à repérer les opportunités, à corriger les problèmes plus rapidement et à améliorer la visibilité en toute confiance. Vous saurez exactement sur quoi vous concentrer sans trop réfléchir ou douter.
                </p>
              </Card>
            </div>

            {/* Fonctionnalités clés */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-slate-800/50 border-slate-700/50 p-6">
                <RefreshCw className="w-8 h-8 text-[#00d4ff] mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Snapshot en temps réel</h3>
                <p className="text-sm text-slate-400">
                  Récupère les statistiques Etsy en direct à chaque exécution, garantissant que vous travaillez toujours avec les données les plus récentes.
                </p>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700/50 p-6">
                <BarChart3 className="w-8 h-8 text-[#00c9b7] mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Comparez votre boutique</h3>
                <p className="text-sm text-slate-400">
                  Voyez où se situe votre boutique dans le classement mondial d'Etsy. Suivez votre progression au fil du temps.
                </p>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700/50 p-6">
                <DollarSign className="w-8 h-8 text-[#00d4ff] mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Clarté des revenus</h3>
                <p className="text-sm text-slate-400">
                  Insights rapides sur les ventes pour comprendre la performance financière de vos concurrents.
                </p>
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Page d'analyse en cours
  if (isAnalyzing && !analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-16 h-16 text-[#00d4ff] animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Analyse en cours...</h2>
          <p className="text-slate-400">Nous analysons la boutique, cela peut prendre quelques instants.</p>
        </div>
      </div>
    );
  }

  // Page de résultats
  if (analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-2">
                <Logo className="w-8 h-8" />
                <span className="text-xl font-bold text-white">Etsmart</span>
              </Link>
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => {
                    setAnalysis(null);
                    setShopInput('');
                    router.push('/dashboard/shop/analyze');
                  }}
                  className="bg-slate-800/50 border border-slate-700 text-white hover:bg-slate-800"
                >
                  Nouvelle analyse
                </Button>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* En-tête de la boutique */}
          <div className="mb-8">
            <div className="bg-slate-800/50 rounded-xl p-6 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">{analysis.shopName}</h1>
                  <div className="flex flex-wrap items-center gap-4 text-slate-300 text-sm">
                    {analysis.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span>{analysis.rating.toFixed(1)} ({analysis.reviewCount || 0})</span>
                      </div>
                    )}
                    {analysis.shopAge && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Depuis {analysis.shopAge}</span>
                      </div>
                    )}
                    {analysis.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{analysis.location}</span>
                      </div>
                    )}
                  </div>
                </div>
                <a
                  href={analysis.shopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#00d4ff] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Voir sur Etsy
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Onglets */}
            <div className="flex gap-2 border-b border-slate-700">
              {(['overview', 'reviews', 'about'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCurrentTab(tab)}
                  className={`px-4 py-2 font-medium transition-colors ${
                    currentTab === tab
                      ? 'text-[#00d4ff] border-b-2 border-[#00d4ff]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'overview' ? 'Aperçu' : tab === 'reviews' ? 'Avis' : 'À propos'}
                </button>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-slate-800/50 border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Ventes mensuelles</span>
                <TrendingUp className="w-5 h-5 text-[#00d4ff]" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{analysis.monthlySales || 0}</div>
              <div className="text-sm text-slate-400">
                {analysis.monthlySales ? (analysis.monthlySales / 30).toFixed(2) : 0} par jour
              </div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Revenus mensuels</span>
                <DollarSign className="w-5 h-5 text-[#00c9b7]" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {analysis.monthlyRevenue ? `${analysis.monthlyRevenue.toFixed(2)} €` : '0 €'}
              </div>
              <div className="text-sm text-slate-400">
                {analysis.monthlyRevenue ? (analysis.monthlyRevenue / 30).toFixed(2) : 0} € par jour
              </div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Plus de ventes que</span>
                <BarChart3 className="w-5 h-5 text-[#00d4ff]" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {analysis.salesComparison ? `${analysis.salesComparison.toFixed(1)}%` : 'N/A'}
              </div>
              <div className="text-sm text-slate-400">des boutiques</div>
            </Card>
          </div>

          {/* Tags les plus utilisés et Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="bg-slate-800/50 border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Tags les plus utilisés</h2>
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-sm bg-[#00d4ff]/20 text-[#00d4ff] rounded">Tags</button>
                  <button className="px-3 py-1 text-sm text-slate-400 hover:text-white rounded">Catégories</button>
                </div>
              </div>
              <div className="space-y-2">
                {analysis.mostUsedTags.slice(0, 10).map((tag, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-slate-300">{tag.tag}</span>
                    <span className="text-slate-400 text-sm">{tag.percentage}%</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700/50 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Statistiques de la boutique</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Ventes totales</span>
                  <span className="text-white font-semibold">{analysis.salesCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Revenus totaux</span>
                  <span className="text-white font-semibold">{analysis.totalRevenue?.toFixed(2) || 0} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Listings actifs</span>
                  <span className="text-white font-semibold">{analysis.activeListings || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ventes par listing</span>
                  <span className="text-white font-semibold">
                    {analysis.activeListings
                      ? ((analysis.salesCount || 0) / analysis.activeListings).toFixed(2)
                      : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Prix moyen</span>
                  <span className="text-white font-semibold">{analysis.averagePrice?.toFixed(2) || 0} €</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Listings */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Listings</h2>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 text-white rounded px-3 py-2 text-sm"
                >
                  <option value="created">Créé</option>
                  <option value="sales">Ventes</option>
                  <option value="price">Prix</option>
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 text-white rounded px-3 py-2 text-sm"
                >
                  <option value="high">Du plus au moins</option>
                  <option value="low">Du moins au plus</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedListings.map((listing, idx) => (
                <Card key={idx} className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
                  {listing.images && listing.images[0] && (
                    <div className="relative aspect-square bg-slate-700">
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                      <Badge
                        className={`absolute top-2 left-2 ${
                          listing.score.grade.startsWith('A')
                            ? 'bg-green-500'
                            : listing.score.grade.startsWith('B')
                            ? 'bg-blue-500'
                            : listing.score.grade.startsWith('C')
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                      >
                        {listing.score.grade}
                      </Badge>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-white font-semibold mb-2 line-clamp-2">{listing.title}</h3>
                    <div className="text-xl font-bold text-[#00d4ff] mb-4">{listing.price.toFixed(2)} €</div>

                    {/* Scores */}
                    <div className="space-y-2 mb-4">
                      {[
                        { label: 'TITLE', score: listing.score.title, icon: FileText },
                        { label: 'TAGS', score: listing.score.tags, icon: Tag },
                        { label: 'IMAGES', score: listing.score.images, icon: ImageIcon },
                        { label: 'VIDEO', score: listing.score.video, icon: Video },
                        { label: 'MATERIALS', score: listing.score.materials, icon: Package },
                        { label: 'DESCRIPTION', score: listing.score.description, icon: FileText },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          <item.icon className="w-4 h-4 text-slate-400" />
                          <span className="text-xs text-slate-400 w-20">{item.label}</span>
                          <Progress
                            value={item.score}
                            className="flex-1 h-2"
                            style={{
                              backgroundColor:
                                item.score >= 80
                                  ? 'rgba(0, 212, 255, 0.2)'
                                  : item.score >= 60
                                  ? 'rgba(255, 193, 7, 0.2)'
                                  : 'rgba(239, 68, 68, 0.2)',
                            }}
                          />
                          <span className="text-xs text-slate-300 w-12 text-right">
                            {item.score}/100
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-sm text-slate-400">
                      {listing.createdAt && (
                        <span>
                          {new Date(listing.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          Créé
                        </span>
                      )}
                      {listing.sales && <span>{listing.sales} ventes</span>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Historique des analyses */}
          {history.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Historique des analyses</h2>
              <div className="space-y-3">
                {history.map((item, idx) => (
                  <div
                    key={`${item.shopUrl}-${idx}`}
                    className="flex items-center justify-between rounded-lg bg-slate-800/60 border border-slate-700/70 px-4 py-3"
                  >
                    <div>
                      <p className="text-white font-semibold">{item.shopName}</p>
                      <p className="text-xs text-slate-400 truncate max-w-xs">{item.shopUrl}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-300">
                      {typeof item.monthlyRevenue === 'number' && (
                        <span>Revenu mensuel: {item.monthlyRevenue.toFixed(0)} €</span>
                      )}
                      {typeof item.monthlySales === 'number' && (
                        <span>Ventes mensuelles: {item.monthlySales}</span>
                      )}
                      {typeof item.salesCount === 'number' && (
                        <span>Total ventes: {item.salesCount}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return null;
}
