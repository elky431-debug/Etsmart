'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, TrendingUp, Target, Zap, Shield, Lightbulb, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

interface TopShop {
  rank: number;
  shopUrl: string;
  shopName: string;
  whyDominates: string;
  strengths: string[];
  weaknesses: string[];
}

interface AnalysisData {
  success: boolean;
  niche: string;
  shopsCount: number;
  analysis: {
    topShops: TopShop[];
    commonPatterns: string[];
    howToBeatThem: {
      angles: string[];
      actions: string[];
    };
    insights: string;
  };
  shops: any[];
}

export default function CompetitorsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingProgress, setAnalyzingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const niche = searchParams.get('niche') || '';
  const analyzingParam = searchParams.get('analyzing');
  const storageKey = searchParams.get('key') || '';

  useEffect(() => {
    // Vérifier d'abord si on a déjà des données (import=done)
    const importParam = searchParams.get('import');
    if (importParam === 'done') {
      // L'analyse est terminée, vérifier immédiatement le storage
      console.log('[Competitors] Import terminé, recherche immédiate des données...');
      
      const stored = localStorage.getItem('competitorAnalysis') || sessionStorage.getItem('competitorAnalysis');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          const storedNiche = (data.niche || '').toLowerCase().trim();
          const requestedNiche = niche.toLowerCase().trim();
          const nicheMatches = !requestedNiche || storedNiche === requestedNiche;
          
          if (nicheMatches) {
            console.log('[Competitors] Données trouvées après import:', data);
            setAnalysisData(data);
            sessionStorage.setItem('competitorAnalysis', stored);
            localStorage.setItem('competitorAnalysis', stored);
            setAnalyzing(false);
            setLoading(false);
            // Nettoyer l'URL sans recharger la page
            const cleanUrl = `/dashboard/competitors?niche=${encodeURIComponent(data.niche || niche)}`;
            window.history.replaceState({}, '', cleanUrl);
            return;
          }
        } catch (err) {
          console.error('[Competitors] Erreur parsing:', err);
        }
      }
    }

    // Si on est en mode "analyse en cours"
    if (analyzingParam === 'true') {
      // Nettoyer les anciennes données pour éviter d'afficher une analyse d'une autre niche
      try {
        sessionStorage.removeItem('competitorAnalysis');
        localStorage.removeItem('competitorAnalysis');
      } catch (err) {
        console.log('[Competitors] Erreur nettoyage storage:', err);
      }
      setAnalyzing(true);
      setLoading(false);
      
      // Écouter l'événement quand l'analyse est prête
      const handleAnalysisReady = (event: CustomEvent) => {
        const data = event.detail;
        console.log('[Competitors] Événement competitorAnalysisReady reçu:', data);
        setAnalysisData(data);
        sessionStorage.setItem('competitorAnalysis', JSON.stringify(data));
        localStorage.setItem('competitorAnalysis', JSON.stringify(data));
        setAnalyzing(false);
        setLoading(false);
        // Nettoyer l'URL sans recharger la page
        const cleanUrl = `/dashboard/competitors?niche=${encodeURIComponent(niche)}`;
        window.history.replaceState({}, '', cleanUrl);
      };

      window.addEventListener('competitorAnalysisReady', handleAnalysisReady as EventListener);

      // Vérifier localStorage une seule fois au démarrage
      const checkStorageOnce = () => {
        const stored = localStorage.getItem('competitorAnalysis');
        const storedSession = sessionStorage.getItem('competitorAnalysis');
        
        if (stored) {
          try {
            const data = JSON.parse(stored);
            if (data.niche && niche && 
                data.niche.toLowerCase().trim() === niche.toLowerCase().trim()) {
              setAnalysisData(data);
              sessionStorage.setItem('competitorAnalysis', stored);
              setAnalyzing(false);
              setLoading(false);
              const cleanUrl = `/dashboard/competitors?niche=${encodeURIComponent(niche)}`;
              window.history.replaceState({}, '', cleanUrl);
              return true;
            }
          } catch (err) {
            console.error('[Competitors] Erreur parsing localStorage:', err);
          }
        }
        
        if (storedSession) {
          try {
            const data = JSON.parse(storedSession);
            if (data.niche && niche && 
                data.niche.toLowerCase().trim() === niche.toLowerCase().trim()) {
              setAnalysisData(data);
              setAnalyzing(false);
              setLoading(false);
              const cleanUrl = `/dashboard/competitors?niche=${encodeURIComponent(niche)}`;
              window.history.replaceState({}, '', cleanUrl);
              return true;
            }
          } catch (err) {
            console.error('[Competitors] Erreur parsing sessionStorage:', err);
          }
        }
        return false;
      };
      
      // Vérifier une fois au démarrage
      if (checkStorageOnce()) {
        return; // Si on a trouvé les données, on s'arrête là
      }

      // Écouter les changements de storage (si supporté)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'competitorAnalysis' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data.niche && niche && 
                data.niche.toLowerCase().trim() === niche.toLowerCase().trim()) {
              setAnalysisData(data);
              sessionStorage.setItem('competitorAnalysis', e.newValue);
              setAnalyzing(false);
              setLoading(false);
              const cleanUrl = `/dashboard/competitors?niche=${encodeURIComponent(niche)}`;
              window.history.replaceState({}, '', cleanUrl);
            }
          } catch (err) {
            console.error('[Competitors] Erreur parsing storage event:', err);
          }
        }
      };
      
      window.addEventListener('storage', handleStorageChange);

      // Timeout de sécurité (60 secondes)
      const timeout = setTimeout(() => {
        console.error('[Competitors] Timeout - Aucune donnée reçue après 60 secondes');
        setError('L\'analyse prend plus de temps que prévu. Vérifiez les logs du serveur et réessayez.');
        setAnalyzing(false);
        setLoading(false);
      }, 60000);

      return () => {
        clearTimeout(timeout);
        window.removeEventListener('competitorAnalysisReady', handleAnalysisReady as EventListener);
        window.removeEventListener('storage', handleStorageChange);
      };
    }

    // Récupérer les données depuis sessionStorage ou localStorage
    let storedData = sessionStorage.getItem('competitorAnalysis');
    if (!storedData) {
      storedData = localStorage.getItem('competitorAnalysis');
    }
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        const storedNiche = (data.niche || '').toLowerCase().trim();
        const requestedNiche = niche.toLowerCase().trim();
        const nicheMatches = !requestedNiche || storedNiche === requestedNiche;
        
        console.log('[Competitors] Données récupérées depuis storage:', { 
          niche: data.niche, 
          shopsCount: data.shopsCount,
          hasAnalysis: !!data.analysis,
          nicheMatches
        });
        
        // Si la niche ne correspond pas, ignorer ces données
        if (!nicheMatches) {
          console.warn('[Competitors] Niche ne correspond pas, données ignorées:', { 
            stored: data.niche, 
            requested: niche 
          });
        } else {
          setAnalysisData(data);
          setLoading(false);
          return; // Important : ne pas continuer si on a des données
        }
      } catch (err) {
        console.error('[Competitors] Erreur parsing données:', err);
        setError('Erreur lors du chargement des données');
        setLoading(false);
        return;
      }
    }
    
    // Si pas de données dans le storage
    if (!storedData) {
      // Vérifier les paramètres d'erreur
      const errorParam = searchParams.get('import');
      if (errorParam === 'error') {
        const errorMessage = searchParams.get('message') || 'Erreur lors de l\'import';
        console.error('[Competitors] Erreur depuis URL:', errorMessage);
        setError(decodeURIComponent(errorMessage));
        setLoading(false);
      } else if (!analyzingParam) {
        // Pas d'analyse en cours et pas de données = pas d'analyse disponible
        setError('Aucune analyse disponible. Veuillez lancer une nouvelle analyse.');
        setLoading(false);
      }
    }

    // Écouter les événements de nouvelles analyses
    const handleAnalysisReady = (event: CustomEvent) => {
      const data = event.detail;
      setAnalysisData(data);
      sessionStorage.setItem('competitorAnalysis', JSON.stringify(data));
      setLoading(false);
    };

    window.addEventListener('competitorAnalysisReady', handleAnalysisReady as EventListener);

    return () => {
      window.removeEventListener('competitorAnalysisReady', handleAnalysisReady as EventListener);
    };
  }, [analyzingParam, storageKey, niche, router, searchParams]);

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

  if (analyzing) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-3">Analyse en cours</h2>
          <p className="text-white/70 mb-2">
            Analyse de la niche : <span className="font-semibold text-[#00d4ff]">{niche}</span>
          </p>
          <p className="text-sm text-white/50">
            GPT-4o analyse les boutiques concurrentes...
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3">
            Analyse Concurrentielle
          </h1>
          <p className="text-lg sm:text-xl text-white/70">
            Niche : <span className="font-semibold text-[#00d4ff]">{analysisData.niche}</span>
          </p>
          <p className="text-sm text-white/50 mt-2">
            {analysisData.shopsCount} boutiques analysées
              </p>
            </div>

        {/* Top 5 Boutiques */}
        <section className="mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">
            Top {Math.min(5, analysisData.analysis.topShops.length)} Boutiques Dominantes
          </h2>
          
          <div className="space-y-6">
            {analysisData.analysis.topShops.slice(0, 5).map((shop) => (
              <div
                key={shop.rank}
                className="bg-white/5 border-2 border-white/10 rounded-2xl p-6 sm:p-8 hover:border-[#00d4ff]/30 transition-all shadow-sm"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center text-white font-bold text-lg">
                        #{shop.rank}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{shop.shopName}</h3>
                        <a
                          href={shop.shopUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#00d4ff] hover:underline flex items-center gap-1"
                        >
                          Voir la boutique
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pourquoi domine */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-white/70 mb-2 flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#00d4ff]" />
                    Pourquoi cette boutique domine
                  </h4>
                  <p className="text-white/70 leading-relaxed">{shop.whyDominates}</p>
                </div>

                {/* Forces et Faiblesses */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Forces */}
                  <div>
                    <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-green-400" />
                      Forces ({shop.strengths.length})
                    </h4>
                    <ul className="space-y-2">
                      {shop.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-white/70 flex items-start gap-2">
                          <span className="text-green-400 mt-1">•</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Faiblesses */}
                  <div>
                    <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                      <Target size={16} className="text-amber-400" />
                      Faiblesses exploitables ({shop.weaknesses.length})
                    </h4>
                    <ul className="space-y-2">
                      {shop.weaknesses.map((weakness, idx) => (
                        <li key={idx} className="text-sm text-white/70 flex items-start gap-2">
                          <span className="text-amber-400 mt-1">•</span>
                          <span>{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Patterns Communs */}
        <section className="mb-12">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Lightbulb size={24} className="text-[#00d4ff]" />
              Patterns Communs Observés
            </h2>
            <ul className="space-y-3">
              {analysisData.analysis.commonPatterns.map((pattern, idx) => (
                <li key={idx} className="text-white/70 flex items-start gap-3">
                  <span className="text-[#00d4ff] mt-1">•</span>
                  <span>{pattern}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Comment les battre */}
        <section className="mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">
            Comment les Battre
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Angles stratégiques */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Zap size={20} className="text-[#00d4ff]" />
                Angles Stratégiques
              </h3>
              <ul className="space-y-3">
                {analysisData.analysis.howToBeatThem.angles.map((angle, idx) => (
                  <li key={idx} className="text-white/70 flex items-start gap-3">
                    <span className="text-[#00d4ff] mt-1">→</span>
                    <span>{angle}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions concrètes */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Shield size={20} className="text-[#00d4ff]" />
                Actions Concrètes
              </h3>
              <ul className="space-y-3">
                {analysisData.analysis.howToBeatThem.actions.map((action, idx) => (
                  <li key={idx} className="text-white/70 flex items-start gap-3">
                    <span className="text-[#00d4ff] mt-1">✓</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Insights stratégiques */}
        <section className="mb-12">
          <div className="bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/10 border border-[#00d4ff]/20 rounded-2xl p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Lightbulb size={24} className="text-[#00d4ff]" />
              Insights Stratégiques
            </h2>
            <p className="text-white/70 leading-relaxed text-base sm:text-lg">
              {analysisData.analysis.insights}
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Link href="/dashboard">
            <button className="px-8 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all">
              Retour au tableau de bord
            </button>
            </Link>
        </div>
      </main>
    </div>
  );
}
