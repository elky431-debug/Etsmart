'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingProgress, setAnalyzingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // ⚠️ CRITICAL: Read URL params ONCE at mount and store in refs
  // This prevents re-running the effect when replaceState changes the URL
  const initialParamsRef = useRef({
    niche: searchParams.get('niche') || '',
    analyzing: searchParams.get('analyzing'),
    importDone: searchParams.get('import'),
    key: searchParams.get('key') || '',
  });
  
  // Track if we already loaded data to prevent re-processing
  const dataLoadedRef = useRef(false);
  
  // Expose niche for the UI (use the latest from analysisData or initial params)
  const niche = analysisData?.niche || initialParamsRef.current.niche;

  // Helper to find analysis data in storage
  const findDataInStorage = useCallback((requestedNiche: string): AnalysisData | null => {
    const stored = localStorage.getItem('competitorAnalysis') || sessionStorage.getItem('competitorAnalysis');
    if (!stored) return null;
    
    try {
      const data = JSON.parse(stored);
      const storedNiche = (data.niche || '').toLowerCase().trim();
      const normalizedRequest = requestedNiche.toLowerCase().trim();
      const nicheMatches = !normalizedRequest || storedNiche === normalizedRequest;
      
      if (nicheMatches) {
        // Ensure both storages have the data
        sessionStorage.setItem('competitorAnalysis', stored);
        localStorage.setItem('competitorAnalysis', stored);
        return data;
      }
    } catch (err) {
      console.error('[Competitors] Erreur parsing storage:', err);
    }
    return null;
  }, []);

  // Main data loading effect — runs ONCE on mount
  useEffect(() => {
    const { niche: initialNiche, analyzing: analyzingParam, importDone: importParam } = initialParamsRef.current;
    
    // ════════════════════════════════════════════════════════════════
    // CASE 1: import=done → Data was saved by extension, load it
    // ════════════════════════════════════════════════════════════════
    if (importParam === 'done') {
      console.log('[Competitors] Import terminé, recherche des données...');
      
      const checkForData = (attempt = 0) => {
        if (dataLoadedRef.current) return; // Already loaded
        
        const data = findDataInStorage(initialNiche);
        if (data) {
          console.log('[Competitors] ✅ Données trouvées après import:', data.niche);
          dataLoadedRef.current = true;
          setAnalysisData(data);
          setAnalyzing(false);
          setLoading(false);
          // Clean URL without triggering re-renders
          const cleanUrl = `/dashboard/competitors?niche=${encodeURIComponent(data.niche || initialNiche)}`;
          window.history.replaceState({}, '', cleanUrl);
          return;
        }
        
        // Retry up to 5 times with increasing delays
        if (attempt < 5) {
          setTimeout(() => checkForData(attempt + 1), 500 + attempt * 200);
        } else {
          // Final fallback: show error after all retries
          console.error('[Competitors] ❌ Données introuvables après 5 tentatives');
          setError('Les données d\'analyse n\'ont pas été trouvées. Veuillez relancer l\'analyse.');
          setLoading(false);
        }
      };
      
      checkForData();
      return; // ⚠️ CRITICAL: Stop here, don't fall through to other cases
    }

    // ════════════════════════════════════════════════════════════════
    // CASE 2: analyzing=true → Analysis in progress, wait for event
    // ════════════════════════════════════════════════════════════════
    if (analyzingParam === 'true') {
      // Clean old data to avoid showing stale results
      try {
        sessionStorage.removeItem('competitorAnalysis');
        localStorage.removeItem('competitorAnalysis');
      } catch (err) {
        console.log('[Competitors] Erreur nettoyage storage:', err);
      }
      setAnalyzing(true);
      setLoading(false);
      
      // Listen for analysis completion event (from extension's injected script)
      const handleAnalysisReady = (event: CustomEvent) => {
        if (dataLoadedRef.current) return;
        const data = event.detail;
        console.log('[Competitors] ✅ Événement competitorAnalysisReady reçu');
        dataLoadedRef.current = true;
        setAnalysisData(data);
        sessionStorage.setItem('competitorAnalysis', JSON.stringify(data));
        localStorage.setItem('competitorAnalysis', JSON.stringify(data));
        setAnalyzing(false);
        setLoading(false);
        // DON'T replaceState here — the extension will navigate the tab
      };

      // Check if data already arrived before we set up the listener
      const existingData = findDataInStorage(initialNiche);
      if (existingData) {
        console.log('[Competitors] ✅ Données déjà en storage pendant l\'analyse');
        dataLoadedRef.current = true;
        setAnalysisData(existingData);
        setAnalyzing(false);
        setLoading(false);
        const cleanUrl = `/dashboard/competitors?niche=${encodeURIComponent(initialNiche)}`;
        window.history.replaceState({}, '', cleanUrl);
        return;
      }

      window.addEventListener('competitorAnalysisReady', handleAnalysisReady as EventListener);

      // Listen for storage changes (cross-tab)
      const handleStorageChange = (e: StorageEvent) => {
        if (dataLoadedRef.current) return;
        if (e.key === 'competitorAnalysis' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            const storedNiche = (data.niche || '').toLowerCase().trim();
            const normalizedNiche = initialNiche.toLowerCase().trim();
            if (!normalizedNiche || storedNiche === normalizedNiche) {
              dataLoadedRef.current = true;
              setAnalysisData(data);
              sessionStorage.setItem('competitorAnalysis', e.newValue);
              setAnalyzing(false);
              setLoading(false);
            }
          } catch (err) {
            console.error('[Competitors] Erreur parsing storage event:', err);
          }
        }
      };
      window.addEventListener('storage', handleStorageChange);

      // Safety timeout (2 minutes)
      const timeout = setTimeout(() => {
        if (!dataLoadedRef.current) {
          setError('L\'analyse prend plus de temps que prévu. L\'analyse continue en arrière-plan, veuillez patienter...');
        }
      }, 120000);

      // Listen for analysis errors
      const handleAnalysisError = (event: CustomEvent) => {
        const errorData = event.detail;
        console.error('[Competitors] ❌ Erreur d\'analyse:', errorData);
        setError(errorData.message || 'Erreur lors de l\'analyse');
        setAnalyzing(false);
        setLoading(false);
      };
      window.addEventListener('competitorAnalysisError', handleAnalysisError as EventListener);

      // Also poll localStorage every 2 seconds as backup
      const pollInterval = setInterval(() => {
        if (dataLoadedRef.current) {
          clearInterval(pollInterval);
          return;
        }
        const data = findDataInStorage(initialNiche);
        if (data) {
          console.log('[Competitors] ✅ Données trouvées via polling');
          dataLoadedRef.current = true;
          setAnalysisData(data);
          setAnalyzing(false);
          setLoading(false);
          clearInterval(pollInterval);
        }
      }, 2000);

      return () => {
        clearTimeout(timeout);
        clearInterval(pollInterval);
        window.removeEventListener('competitorAnalysisReady', handleAnalysisReady as EventListener);
        window.removeEventListener('competitorAnalysisError', handleAnalysisError as EventListener);
        window.removeEventListener('storage', handleStorageChange);
      };
    }

    // ════════════════════════════════════════════════════════════════
    // CASE 3: No special params → Load existing data from storage
    // ════════════════════════════════════════════════════════════════
    const existingData = findDataInStorage(initialNiche);
    if (existingData) {
      console.log('[Competitors] ✅ Données chargées depuis le storage');
      dataLoadedRef.current = true;
      setAnalysisData(existingData);
      setLoading(false);
      return;
    }

    // Check for error params
    const errorParam = searchParams.get('import');
    if (errorParam === 'error') {
      const errorMessage = searchParams.get('message') || 'Erreur lors de l\'import';
      setError(decodeURIComponent(errorMessage));
      setLoading(false);
      return;
    }

    // No data and no analysis in progress → wait a bit then show error
    const timeoutId = setTimeout(() => {
      if (dataLoadedRef.current) return;
      // One last check
      const lastCheck = findDataInStorage(initialNiche);
      if (lastCheck) {
        dataLoadedRef.current = true;
        setAnalysisData(lastCheck);
        setLoading(false);
      } else {
        setError('Aucune analyse disponible. Veuillez lancer une nouvelle analyse.');
        setLoading(false);
      }
    }, 3000);

    // Also listen for late-arriving events
    const handleAnalysisReady = (event: CustomEvent) => {
      if (dataLoadedRef.current) return;
      const data = event.detail;
      dataLoadedRef.current = true;
      setAnalysisData(data);
      sessionStorage.setItem('competitorAnalysis', JSON.stringify(data));
      setLoading(false);
    };
    window.addEventListener('competitorAnalysisReady', handleAnalysisReady as EventListener);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('competitorAnalysisReady', handleAnalysisReady as EventListener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ⚠️ CRITICAL: Empty deps — run ONCE on mount only

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

  // Ne pas afficher d'erreur si on est en train d'analyser
  // Si on a une erreur mais qu'on est toujours en train d'analyser, afficher le loader avec le message
  if (error && analyzing) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-xl font-bold text-white mb-2">Analyse en cours</h2>
          <p className="text-white/70 mb-4">{error}</p>
          <p className="text-sm text-white/50">L'analyse continue en arrière-plan. Cette page se mettra à jour automatiquement quand les résultats seront prêts.</p>
        </div>
      </div>
    );
  }

  // Afficher l'erreur seulement si on n'est plus en train d'analyser
  if ((error || !analysisData) && !analyzing && !loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl shadow-lg p-8 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Erreur</h2>
          <p className="text-white/70 mb-6">{error || 'Aucune analyse disponible'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard?section=competitors">
              <button className="px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-full hover:opacity-90 transition-opacity">
                Réessayer
              </button>
            </Link>
            <Link href="/dashboard">
              <button className="px-6 py-3 bg-white/10 border border-white/20 text-white font-semibold rounded-full hover:bg-white/20 transition-colors">
                Retour au tableau de bord
              </button>
            </Link>
          </div>
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
