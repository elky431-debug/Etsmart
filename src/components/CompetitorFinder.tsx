'use client';

import { useMemo, useState } from 'react';
import { Search, AlertCircle, Loader2, ExternalLink, Store, Sparkles, Coins, Clock } from 'lucide-react';
import { computeListingScore, computeShopScore } from '@/lib/etsy/score-system';

interface CompetitorFinderProps {
  onAnalysisComplete?: (data: any) => void;
}

export function CompetitorFinder({ onAnalysisComplete }: CompetitorFinderProps) {
  const [shopInput, setShopInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<any | null>(null);

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const scoreBar = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const listings = analysisData?.rawData?.listings || [];
  const shopAveragePrice = useMemo(() => {
    const prices = listings.map((l: any) => Number(l.price || 0)).filter((p: number) => p > 0);
    if (!prices.length) return 0;
    return prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
  }, [listings]);
  const listingScores = useMemo(
    () =>
      listings.map((listing: any) => ({
        listing,
        score: computeListingScore(
          {
            title: listing.title || '',
            price: Number(listing.price || 0),
            images: listing.images || [],
            tags: listing.tags || [],
            materials: listing.materials || [],
            description: listing.description || '',
            hasVideo: Boolean(listing.hasVideo),
            createdAt: listing.createdAt,
            updatedAt: listing.updatedAt,
            isPartialData: Boolean(listing.isPartialData),
          },
          { shopAveragePrice }
        ),
      })),
    [listings, shopAveragePrice]
  );

  const shopScore = useMemo(() => {
    if (!analysisData) return null;
    return computeShopScore({
      name: analysisData.analysis?.shopName || analysisData.shop?.name,
      averagePrice: shopAveragePrice,
      rating: analysisData.analysis?.metrics?.rating || 0,
      reviewsCount: analysisData.analysis?.metrics?.reviewCount || 0,
      salesCount: analysisData.analysis?.metrics?.totalSales || 0,
      listings: listings.map((l: any) => ({
        title: l.title || '',
        price: Number(l.price || 0),
        images: l.images || [],
      })),
    });
  }, [analysisData, listings, shopAveragePrice]);

  const handleStartAnalysis = async () => {
    if (!shopInput.trim()) {
      setError('Veuillez saisir un nom ou un lien de boutique Etsy.');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisData(null);

    try {
      const scrapeRes = await fetch('/api/shop/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopInput: shopInput.trim() }),
      });
      const scraped = await scrapeRes.json().catch(() => ({}));
      if (!scrapeRes.ok || !scraped?.shop) {
        setError(scraped?.message || scraped?.error || 'Impossible de scraper cette boutique.');
        return;
      }

      const analyzeRes = await fetch('/api/shop/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: scraped.shop }),
      });
      const analyzed = await analyzeRes.json().catch(() => ({}));
      if (!analyzeRes.ok || !analyzed?.analysis) {
        setError(analyzed?.message || analyzed?.error || "Impossible d'analyser cette boutique.");
        return;
      }

      setAnalysisData(analyzed);
      onAnalysisComplete?.(analyzed);
    } catch (err: any) {
      setError(err?.message || 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="absolute -inset-1 bg-gradient-to-r from-[#00d4ff]/20 via-[#00c9b7]/10 to-[#00d4ff]/20 rounded-3xl blur-xl opacity-60" />

      <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/50 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]" />

        <div className="p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/20 border border-[#00d4ff]/20 mb-4">
              <Store className="w-7 h-7 text-[#00d4ff]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Analyse boutique Etsy</h2>
            <p className="text-white/50 text-sm sm:text-base max-w-lg mx-auto">
              Cette fonctionnalité est actuellement en maintenance. Nous améliorons l&apos;analyse des boutiques Etsy
              pour te donner des insights encore plus précis.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-600/80 text-slate-200 text-sm font-medium mt-4">
              <Clock size={14} />
              Bientôt de retour
            </div>
          </div>

          {/* Mode maintenance : on masque le formulaire et les résultats */}
          {false && (
            <>
              {/* Formulaire d'analyse (désactivé pour maintenance) */}
          <div className="space-y-5 mb-6">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                    Nom ou lien de la boutique <span className="text-[#00d4ff]">*</span>
              </label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5 group-focus-within:text-[#00d4ff] transition-colors" />
                <input
                  type="text"
                      value={shopInput}
                      onChange={(e) => setShopInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStartAnalysis()}
                      placeholder="Ex: silvermoonshop ou https://www.etsy.com/shop/silvermoonshop"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50 focus:border-[#00d4ff]/50 transition-all hover:border-white/20"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-300 flex-1">{error}</p>
            </div>
          )}

          <button
                onClick={handleStartAnalysis}
                disabled={loading || !shopInput.trim()}
            className="group relative w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-[#00d4ff]/20 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analyse en cours...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                    <span>Analyser cette boutique</span>
              </>
            )}
          </button>
            </>
          )}

          {analysisData && shopScore && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white font-semibold text-lg">
                      {analysisData.analysis?.shopName || analysisData.shop?.name}
                    </p>
                    <p className="text-xs text-white/60 mt-1">
                      {analysisData.analysis?.metrics?.totalSales || analysisData.rawData?.salesCount || 0} ventes
                      · {analysisData.analysis?.metrics?.reviewCount || analysisData.rawData?.reviewCount || 0} avis
                    </p>
                    <a
                      href={analysisData.analysis?.shopUrl || analysisData.shop?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#00d4ff] inline-flex items-center gap-1"
                    >
                      Voir la boutique
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-black ${scoreColor(shopScore.global.score)}`}>
                      {shopScore.global.score}/100
                    </p>
                    <p className={`text-lg font-bold ${scoreColor(shopScore.global.score)}`}>
                      {shopScore.global.grade}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {Object.entries(shopScore.subScores).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/60 uppercase">{key}</span>
                      <span className={`text-sm font-semibold ${scoreColor(value.score)}`}>{value.score}/100</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                      <div className={`h-full ${scoreBar(value.score)}`} style={{ width: `${value.score}%` }} />
                    </div>
                    <p className="text-xs text-white/70">{value.explanation}</p>
                    <ul className="mt-2 space-y-1">
                      {value.improvements.slice(0, 2).map((tip, idx) => (
                        <li key={idx} className="text-[11px] text-white/55">
                          • {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {listingScores.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-white font-semibold mb-3">Listings détaillés</p>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {listingScores.map(({ listing, score }, idx: number) => (
                      <div key={idx} className="border border-white/10 rounded-lg bg-black/50 overflow-hidden">
                        <div className="relative h-40 bg-white/5">
                          {listing.images?.[0] ? (
                            <img src={listing.images[0]} alt={listing.title || 'Listing'} className="w-full h-full object-cover" />
                          ) : null}
                          <div className="absolute top-2 left-2">
                            <p className={`text-3xl font-black ${scoreColor(score.global.score)}`}>{score.global.grade}</p>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-sm text-white/85 line-clamp-2 min-h-[40px]">{listing.title || 'Listing Etsy'}</p>
                          <div className="flex items-center justify-between mt-2 mb-3">
                            <p className="text-[#00d4ff] font-semibold">{Number(listing.price || 0).toFixed(2)} $</p>
                            <p className={`font-bold ${scoreColor(score.global.score)}`}>{score.global.score}/100</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-white/60 mb-3">
                            <p>Ventes: {listing.sales ?? 0}</p>
                            <p>Avis: {listing.reviews ?? 0}</p>
                            <p>Vidéo: {listing.hasVideo ? 'Oui' : 'Non'}</p>
                            <p>Matériaux: {Array.isArray(listing.materials) ? listing.materials.length : 0}</p>
                          </div>
                          {listing.isPartialData && (
                            <p className="text-[11px] text-amber-300 mb-3">
                              Données Etsy partielles: score estimé, pas pénalisé à fond.
                            </p>
                          )}
                          <div className="space-y-2">
                            {[
                              ['Title', score.subScores.title.score],
                              ['Tags', score.subScores.tags.score],
                              ['Images', score.subScores.images.score],
                              ['Price', score.subScores.price.score],
                              ['Complete', score.subScores.completeness.score],
                              ['Fresh', score.subScores.freshness.score],
                            ].map(([label, value]) => (
                              <div key={label as string}>
                                <div className="flex items-center justify-between text-[11px] text-white/60">
                                  <span>{label as string}</span>
                                  <span>{value as number}/100</span>
                                </div>
                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`${scoreBar(value as number)} h-full`}
                                    style={{ width: `${value as number}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          {Array.isArray(listing.tags) && listing.tags.length > 0 && (
                            <div className="mt-3">
                              <p className="text-[11px] text-white/50 mb-1">Tags</p>
                              <div className="flex flex-wrap gap-1">
                                {listing.tags.slice(0, 8).map((t: string, i: number) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/70">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

