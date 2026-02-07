'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

// Page secrète pour les testeurs Google
// Cette page permet de tester l'extension sans authentification
function TestExtensionContent() {
  const searchParams = useSearchParams();
  const [productUrl, setProductUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Vérifier si on arrive depuis l'extension avec des paramètres
  useEffect(() => {
    const analyzingParam = searchParams.get('analyzing');
    const shopParam = searchParams.get('shop');
    const nicheParam = searchParams.get('niche');
    const importDone = searchParams.get('import');
    
    if (analyzingParam === 'true') {
      setAnalyzing(true);
      // Attendre que l'extension envoie les données via localStorage
      const checkForData = setInterval(() => {
        try {
          const competitorData = localStorage.getItem('competitorAnalysis');
          const shopData = localStorage.getItem('shopAnalysis');
          
          if (competitorData) {
            const data = JSON.parse(competitorData);
            setAnalysisResult(data);
            setAnalyzing(false);
            clearInterval(checkForData);
          } else if (shopData) {
            const data = JSON.parse(shopData);
            setAnalysisResult(data);
            setAnalyzing(false);
            clearInterval(checkForData);
          }
        } catch (err) {
          console.error('Erreur lors de la lecture des données:', err);
        }
      }, 500);
      
      // Timeout après 30 secondes
      setTimeout(() => {
        clearInterval(checkForData);
        if (analyzing) {
          setError('Timeout: Les données n\'ont pas été reçues de l\'extension');
          setAnalyzing(false);
        }
      }, 30000);
      
      return () => clearInterval(checkForData);
    } else if (importDone === 'done') {
      // Les résultats sont déjà là
      try {
        const competitorData = localStorage.getItem('competitorAnalysis');
        const shopData = localStorage.getItem('shopAnalysis');
        
        if (competitorData) {
          setAnalysisResult(JSON.parse(competitorData));
        } else if (shopData) {
          setAnalysisResult(JSON.parse(shopData));
        }
      } catch (err) {
        console.error('Erreur lors de la lecture des données:', err);
      }
    }
    
    // Écouter les événements personnalisés de l'extension
    const handleCompetitorAnalysis = (event: CustomEvent) => {
      setAnalysisResult(event.detail);
      setAnalyzing(false);
    };
    
    const handleShopAnalysis = (event: CustomEvent) => {
      setAnalysisResult(event.detail);
      setAnalyzing(false);
    };
    
    window.addEventListener('competitorAnalysisReady', handleCompetitorAnalysis as EventListener);
    window.addEventListener('shopAnalysisReady', handleShopAnalysis as EventListener);
    
    return () => {
      window.removeEventListener('competitorAnalysisReady', handleCompetitorAnalysis as EventListener);
      window.removeEventListener('shopAnalysisReady', handleShopAnalysis as EventListener);
    };
  }, [searchParams, analyzing]);

  const handleAnalyze = async () => {
    if (!productUrl.trim()) {
      setError('Veuillez entrer une URL de produit Etsy');
      return;
    }

    // Valider que c'est une URL Etsy
    if (!productUrl.includes('etsy.com') || !productUrl.includes('/listing/')) {
      setError('Veuillez entrer une URL valide de produit Etsy (ex: https://www.etsy.com/listing/...)');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      // Parser le produit
      const parseResponse = await fetch('/api/parse-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: productUrl,
        }),
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.error || 'Erreur lors du parsing du produit');
      }

      const productData = await parseResponse.json();

      // Analyser le produit
      const analyzeResponse = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product: productData.product,
          niche: productData.niche || 'Test',
        }),
      });

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.error || 'Erreur lors de l\'analyse');
      }

      const analysis = await analyzeResponse.json();
      setAnalysisResult(analysis);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Test de l'Extension Etsmart
            </h1>
            <p className="text-white/70 text-sm md:text-base">
              Page de test pour les testeurs Google - Analysez un produit Etsy
            </p>
          </div>

          {/* État d'analyse en cours depuis l'extension */}
          {analyzing && (
            <div className="bg-white/5 rounded-lg border border-white/10 p-6 mb-6">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#00d4ff]" />
                <div>
                  <p className="text-white font-medium">Analyse en cours...</p>
                  <p className="text-white/70 text-sm">L'extension est en train de collecter les données</p>
                </div>
              </div>
            </div>
          )}

          {/* Formulaire */}
          {!analyzing && (
            <div className="bg-white/5 rounded-lg border border-white/10 p-6 mb-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="productUrl" className="block text-sm font-medium mb-2">
                    URL du produit Etsy (test manuel)
                  </label>
                  <input
                    id="productUrl"
                    type="url"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://www.etsy.com/listing/..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#00d4ff] focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <button
                  onClick={handleAnalyze}
                  disabled={loading || !productUrl.trim()}
                  className="w-full px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Analyse en cours...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Analyser le produit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Résultats */}
          {analysisResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 rounded-lg border border-white/10 p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-6 h-6 text-[#00d4ff]" />
                <h2 className="text-xl font-bold">Résultats de l'analyse</h2>
              </div>

              <div className="space-y-4">
                {analysisResult.product && (
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-2">Produit</h3>
                    <div className="bg-white/5 rounded-lg p-4">
                      <p className="font-medium mb-1">{analysisResult.product.title}</p>
                      <p className="text-sm text-white/70">{analysisResult.product.price}</p>
                    </div>
                  </div>
                )}

                {/* Résultats d'analyse de concurrents */}
                {analysisResult.shops && analysisResult.shops.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-2">
                      Boutiques analysées ({analysisResult.shopsCount || analysisResult.shops.length})
                    </h3>
                    <div className="bg-white/5 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
                      {analysisResult.shops.slice(0, 10).map((shop: any, index: number) => (
                        <div key={index} className="border-b border-white/10 pb-2 last:border-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{shop.shopName || shop.name}</span>
                            {shop.shopUrl && (
                              <a
                                href={shop.shopUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#00d4ff] hover:underline text-xs flex items-center gap-1"
                              >
                                Voir <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="text-xs text-white/70">
                            {shop.sales && <span>Ventes: {shop.sales.toLocaleString()}</span>}
                            {shop.rating && <span className="ml-3">Note: {shop.rating}/5</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Résultats d'analyse de produit */}
                {analysisResult.analysis && (
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-2">Analyse</h3>
                    <div className="bg-white/5 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/70">Score de potentiel:</span>
                        <span className="text-lg font-bold text-[#00d4ff]">
                          {analysisResult.analysis.launchPotentialScore?.toFixed(1)}/10
                        </span>
                      </div>
                      {analysisResult.analysis.confidenceScore && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/70">Score de confiance:</span>
                          <span className="text-lg font-bold text-[#00c9b7]">
                            {analysisResult.analysis.confidenceScore.toFixed(1)}/10
                          </span>
                        </div>
                      )}
                      {analysisResult.analysis.recommendation && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-sm text-white/90">
                            {analysisResult.analysis.recommendation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Données brutes pour debug */}
                {process.env.NODE_ENV === 'development' && (
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-2">Données brutes (debug)</h3>
                    <div className="bg-white/5 rounded-lg p-4">
                      <pre className="text-xs text-white/70 whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {JSON.stringify(analysisResult, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Instructions pour les testeurs */}
          <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">Instructions pour les testeurs</h3>
            <ul className="text-xs text-white/70 space-y-1 list-disc list-inside">
              <li>Entrez l'URL d'un produit Etsy valide</li>
              <li>Cliquez sur "Analyser le produit" pour lancer l'analyse</li>
              <li>Les résultats s'afficheront ci-dessous</li>
              <li>Vous pouvez tester plusieurs produits en changeant l'URL</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function TestExtensionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-[#00d4ff]" />
      </div>
    }>
      <TestExtensionContent />
    </Suspense>
  );
}

