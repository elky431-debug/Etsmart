'use client';

import { FormEvent, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  ExternalLink,
  TrendingUp,
  Tag,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import type { CompetitorShopAnalysis } from '@/types/competitor-shop-analysis';
import { decodeListingTitleEntities } from '@/lib/etsy/decode-listing-title';
import type { ShopPayload } from '@/lib/etsy/shop-scrape-service';
import {
  getCompetitorListingScoreBreakdown,
  scoreCompetitorListingCard,
} from '@/lib/etsy/competitor-listing-score';
import {
  etsyStarsToScore100,
  letterGradeVerbal,
  scoreBadgeClasses,
  scoreBarClass,
  scoreToLetterGrade,
} from '@/lib/etsy/listing-letter-grade';

type ApiOk = { success: true; shop: ShopPayload; analysis: CompetitorShopAnalysis };
type ApiErr = { error?: string; message?: string; shop?: ShopPayload };

const gradientBtn =
  'rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 disabled:opacity-60 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]';

function listingThumbUrl(images?: string[]): string | null {
  const raw = images?.find((x) => typeof x === 'string' && x.trim());
  if (!raw) return null;
  const u = raw.trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return u.split('?')[0];
  if (u.startsWith('//')) return `https:${u}`.split('?')[0];
  return `https://${u.replace(/^\/+/, '')}`.split('?')[0];
}

function formatFrInt(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
}

const PREFILL_LISTING_URL_KEY = 'etsmart-prefill-listing-url';

export type DashboardCompetitorShopProps = {
  /** Navigation SPA vers l’analyseur de listing avec URL préremplie */
  onOpenListingAnalysis?: (listingUrl: string) => void;
};

export function DashboardCompetitorShop({ onOpenListingAnalysis }: DashboardCompetitorShopProps = {}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shop, setShop] = useState<ShopPayload | null>(null);
  const [analysis, setAnalysis] = useState<CompetitorShopAnalysis | null>(null);

  const sampleMedianPrice = useMemo(() => {
    const prices = shop?.listings.map((l) => l.price).filter((x) => x > 0) ?? [];
    if (!prices.length) return undefined;
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }, [shop?.listings]);

  const openListingAnalyzer = (listingUrl: string) => {
    const u = listingUrl.trim();
    if (!u) return;
    try {
      sessionStorage.setItem(PREFILL_LISTING_URL_KEY, u);
    } catch {
      /* ignore */
    }
    if (onOpenListingAnalysis) {
      onOpenListingAnalysis(u);
    } else if (typeof window !== 'undefined') {
      window.location.assign('/dashboard?section=apify-test');
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setShop(null);
    setAnalysis(null);
    const clean = url.trim();
    if (!clean) {
      setError('Colle une URL de boutique Etsy.');
      return;
    }

    setLoading(true);
    try {
      // getSession() peut renvoyer un access_token déjà expiré (cache local) : le serveur
      // répond alors « Session invalide ». On force un refresh pour un JWT valide.
      const { data: refreshed } = await supabase.auth.refreshSession();
      let session = refreshed.session;
      if (!session?.access_token) {
        const { data: { session: cached } } = await supabase.auth.getSession();
        session = cached;
      }
      const token = session?.access_token;
      if (!token) {
        setError('Session expirée. Reconnecte-toi.');
        return;
      }

      const controller = new AbortController();
      /** Apify peut monter ~3 min + GPT-4o jusqu’à 120 s + marge réseau */
      const timeoutMs = 330_000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch('/api/etsy/competitor-shop-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ shopUrl: clean, maxListings: 18 }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const rawText = await res.text();
      let data = {} as ApiOk & ApiErr;
      if (rawText.trim()) {
        try {
          data = JSON.parse(rawText) as ApiOk & ApiErr;
        } catch {
          setError(
            res.ok
              ? 'Réponse serveur illisible. Réessaie dans un instant.'
              : `Erreur ${res.status} — réponse non JSON.`
          );
          return;
        }
      }

      if (!res.ok) {
        setError(data.message || data.error || `Erreur ${res.status}`);
        if (data.shop) setShop(data.shop as ShopPayload);
        return;
      }
      if (data.success && data.shop && data.analysis) {
        setShop(data.shop);
        setAnalysis(data.analysis);
      } else {
        setError('Réponse incomplète du serveur. Réessaie.');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError(
          'Délai dépassé (~5 min) : scraping + analyse IA trop longs. Réessaie ou vérifie ta connexion / les logs serveur.'
        );
        return;
      }
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="border-b border-white/10 pb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400/90">Etsmart</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Analyse boutique concurrente</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
            Colle l’URL d’une boutique Etsy : nous scrapons un échantillon de ses listings (page visible), puis GPT-4o
            synthétise les meilleures ventes, la stratégie de prix, les tags et une estimation de fréquence de
            publication.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 ring-1 ring-cyan-500/15"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-4">
            <div className="min-w-0 flex-1">
              <label className="mb-2 block text-xs font-medium text-white/55">URL de la boutique Etsy</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.etsy.com/fr/shop/NomBoutique"
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-cyan-500/55"
              />
            </div>
            <button type="submit" disabled={loading} className={`shrink-0 lg:min-w-[11rem] ${gradientBtn}`}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyse…
                </span>
              ) : (
                'Analyser la boutique'
              )}
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/40">
            Compte souvent 2 à 5 minutes : scraping Etsy (Apify) puis synthèse GPT-4o. Laisse l’onglet ouvert pendant le
            chargement.
          </p>
          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </form>

        {shop && (
          <div className="mt-12 space-y-10">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-cyan-950/20 ring-1 ring-cyan-500/15">
              {shop.bannerUrl ? (
                <div className="relative h-24 max-h-28 w-full overflow-hidden bg-black/40 sm:h-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shop.bannerUrl}
                    alt=""
                    className="h-full w-full object-cover object-[center_35%]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/15 to-black/70" />
                </div>
              ) : (
                <div className="relative h-16 w-full bg-gradient-to-r from-cyan-950/40 via-black/50 to-violet-950/30 sm:h-20">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(0,212,255,0.12),transparent_55%)]" />
                  <p className="absolute bottom-2 left-5 text-[10px] text-white/35">
                    Bannière non fournie par le scraper (souvent présente quand la page boutique est chargée ou dans le JSON
                    Apify).
                  </p>
                </div>
              )}

              <div
                className={`px-5 pb-6 pt-6 sm:px-8 ${shop.bannerUrl ? 'sm:pt-6' : 'sm:pt-8'}`}
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
                    <div className="shrink-0">
                      <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-[#0a0a0a] bg-black shadow-lg shadow-black/50 ring-1 ring-white/10 sm:h-24 sm:w-24">
                        {shop.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-black text-lg font-bold text-white/40 sm:text-xl">
                            {(shop.shopName || '?').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-cyan-200/55">Boutique</p>
                      <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{shop.shopName}</h2>
                      <a
                        href={shop.shopUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:text-cyan-200"
                      >
                        {shop.shopUrl.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>

                  <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:text-right lg:grid-cols-3">
                    <div>
                      <dt className="text-white/45">Ventes (boutique)</dt>
                      <dd className="font-semibold text-white">
                        {shop.salesCount > 0 ? formatFrInt(shop.salesCount) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Note / avis</dt>
                      <dd className="font-semibold text-white">
                        {shop.rating > 0 ? (
                          <>
                            <span className="tabular-nums">{shop.rating.toFixed(1)}</span>
                            <span className="text-white/50"> / 5</span>
                            {shop.reviewCount > 0 ? (
                              <>
                                {' '}
                                · <span className="tabular-nums">{formatFrInt(shop.reviewCount)}</span> avis
                              </>
                            ) : (
                              ' · —'
                            )}
                          </>
                        ) : (
                          '— · —'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Depuis</dt>
                      <dd className="font-semibold text-white">{shop.shopAge || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Listings analysés</dt>
                      <dd className="font-semibold text-white">{shop.listings.length}</dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Listings actifs (page)</dt>
                      <dd className="font-semibold text-white">
                        {shop.activeListingCount != null && shop.activeListingCount > 0
                          ? formatFrInt(shop.activeListingCount)
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Favoris</dt>
                      <dd className="font-semibold text-white">
                        {shop.favoritesCount != null && shop.favoritesCount > 0
                          ? formatFrInt(shop.favoritesCount)
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <p className="mt-5 text-xs text-white/40">
                  Totaux boutique : page HTML quand elle est lisible, sinon champs présents dans le JSON Apify. Si un
                  total manque, les ventes / avis peuvent correspondre à la somme ou à la moyenne sur l’échantillon de
                  fiches scrapées (indicatif).
                </p>
              </div>
            </section>

            {shop.derived ? (
              <section className="rounded-2xl border border-white/10 bg-black/35 p-6 ring-1 ring-cyan-500/10 sm:p-8">
                <h3 className="text-lg font-semibold text-white">Indicateurs (page publique & échantillon)</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/45">
                  Etsy ne publie pas le CA mensuel ni un « top % des boutiques » comme certains outils tiers — ce sont
                  des estimations internes. Ici : champs visibles sur la page quand le HTML les contient, et calculs
                  sur les listings scrapés (prix moyen, tags, ratios).
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-xs text-white/45">Prix moyen (échantillon)</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                      {shop.derived.averagePrice != null ? `${shop.derived.averagePrice.toFixed(2)}` : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-xs text-white/45">Ventes / listing actif</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                      {shop.derived.salesPerListing != null ? shop.derived.salesPerListing.toFixed(2) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-xs text-white/45">Avis / vente (indicatif)</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                      {shop.derived.reviewRatePercent != null ? `${shop.derived.reviewRatePercent} %` : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-xs text-white/45">Listings dans l’échantillon</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-white">{shop.listings.length}</p>
                  </div>
                </div>

                {shop.derived.tagTop.length > 0 ? (
                  <div className="mt-8">
                    <h4 className="text-sm font-semibold text-white">Tags les plus présents (échantillon)</h4>
                    <p className="mt-1 text-xs text-white/40">
                      Pourcentage = part des fiches de l’échantillon qui contiennent ce tag.
                    </p>
                    <ul className="mt-4 space-y-3">
                      {shop.derived.tagTop.slice(0, 14).map((row) => (
                        <li key={row.tag}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-white/90">{row.tag}</span>
                            <span className="shrink-0 tabular-nums text-cyan-300/90">{row.percentOfListings} %</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]"
                              style={{ width: `${Math.min(100, row.percentOfListings)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {shop.listings.length > 0 ? (
              <section className="rounded-2xl border border-white/10 bg-black/35 p-6 ring-1 ring-cyan-500/10 sm:p-8">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">3 fiches produits</h3>
                    <p className="mt-1 text-xs text-white/45">
                      Scores par fiche : titre (longueur + mots + écart aux autres), prix vs médiane, images (URLs
                      distinctes), tags ou estimation depuis le titre si absents, description ou proxy matériaux.
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-3">
                  {shop.listings.slice(0, 3).map((l, idx) => {
                    const top3 = shop.listings.slice(0, 3);
                    const peerTitles = top3.filter((_, j) => j !== idx).map((x) => x.title || '');
                    const cardCtx = {
                      shopMedianPrice: sampleMedianPrice,
                      peerTitlesInSample: peerTitles,
                    };

                    const cover = listingThumbUrl(l.images);
                    const titleDisplay = decodeListingTitleEntities(l.title || 'Fiche Etsy');
                    const qualityInput = {
                      title: l.title || '',
                      price: l.price,
                      images: l.images,
                      tags: l.tags,
                      description: l.description,
                      materials: l.materials,
                      sales: l.sales,
                      listingStars: l.rating != null && l.rating > 0 ? l.rating : undefined,
                      listingReviews:
                        l.reviews != null && l.reviews > 0 ? Math.round(l.reviews) : undefined,
                    };
                    const quality = scoreCompetitorListingCard(qualityInput, cardCtx);
                    const breakdown = getCompetitorListingScoreBreakdown(qualityInput, cardCtx);

                    const listingStars = l.rating != null && l.rating > 0 ? l.rating : null;
                    const shopStars = shop.rating > 0 ? shop.rating : null;
                    const effectiveStars = listingStars ?? shopStars ?? null;
                    const isShopFallback = listingStars == null && shopStars != null;
                    const etsyScore100 =
                      effectiveStars != null ? etsyStarsToScore100(effectiveStars) : null;
                    const etsyGrade = etsyScore100 != null ? scoreToLetterGrade(etsyScore100) : null;

                    return (
                      <article
                        key={l.url}
                        className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                      >
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative aspect-[4/3] w-full overflow-hidden bg-black/40"
                        >
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cover}
                              alt=""
                              className="h-full w-full object-cover transition-opacity hover:opacity-90"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-white/35">
                              Pas d’image
                            </div>
                          )}
                        </a>
                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-white/90 hover:text-cyan-200"
                          >
                            {titleDisplay}
                          </a>
                          <div className="mt-auto space-y-4 border-t border-white/10 pt-3">
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-200/55">
                                Note qualité fiche
                              </p>
                              <p className="mt-0.5 text-[10px] leading-relaxed text-white/38">
                                Le social reste identique si le scraper ne donne ni étoiles ni ventes. Les autres axes
                                utilisent les données propres à chaque fiche (ou des proxies explicites dans le détail).
                              </p>
                              <div className="mt-2 flex flex-wrap items-end gap-2">
                                <p className="text-3xl font-bold leading-none tracking-tight text-white">
                                  {quality.grade}
                                </p>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight ${scoreBadgeClasses(quality.score100)}`}
                                >
                                  {quality.verbal}
                                </span>
                              </div>
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                  className={`h-full rounded-full ${scoreBarClass(quality.score100)}`}
                                  style={{ width: `${quality.score100}%` }}
                                />
                              </div>
                              <p className="mt-1.5 text-[10px] tabular-nums text-white/45">
                                {quality.score100} / 100
                              </p>
                              <ul className="mt-3 space-y-2 border-t border-white/10 pt-3 text-[10px] leading-snug text-white/42">
                                {(
                                  [
                                    ['Titre', breakdown.title],
                                    ['Tags', breakdown.tags],
                                    ['Images', breakdown.images],
                                    ['Description', breakdown.description],
                                    ['Prix (boutique)', breakdown.price],
                                    ['Social (★ / avis / ventes)', breakdown.social],
                                  ] as const
                                ).map(([label, axis]) => (
                                  <li key={label}>
                                    <span className="font-medium text-white/55">{label}</span>{' '}
                                    <span className="tabular-nums text-cyan-200/70">{axis.score}/100</span>
                                    <span className="text-white/35"> — </span>
                                    {axis.detail}
                                  </li>
                                ))}
                              </ul>
                              <button
                                type="button"
                                onClick={() => openListingAnalyzer(l.url)}
                                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-400/55 hover:bg-cyan-500/25"
                              >
                                <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                Analyse détaillée (listing)
                              </button>
                            </div>

                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
                                Avis clients Etsy
                              </p>
                              {effectiveStars != null && etsyScore100 != null && etsyGrade ? (
                                <div className="mt-2 space-y-2">
                                  <p className="text-sm font-semibold tabular-nums text-white/90">
                                    {effectiveStars.toFixed(1)}★ sur 5
                                    {!isShopFallback && l.reviews != null && l.reviews > 0 ? (
                                      <span> · {formatFrInt(Math.round(l.reviews))} avis</span>
                                    ) : isShopFallback && shop.reviewCount > 0 ? (
                                      <span> · {formatFrInt(shop.reviewCount)} avis (totaux boutique)</span>
                                    ) : (
                                      <span className="text-white/45"> · avis non trouvés sur cette fiche</span>
                                    )}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-lg font-bold tabular-nums text-white">
                                      {etsyGrade}
                                    </span>
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${scoreBadgeClasses(etsyScore100)}`}
                                    >
                                      {letterGradeVerbal(etsyGrade)}
                                    </span>
                                  </div>
                                  <p className="text-[10px] leading-relaxed text-white/45">
                                    {isShopFallback
                                      ? 'Note moyenne de la boutique (fiche sans étoiles dans le JSON).'
                                      : 'Données issues du JSON listing (scraping).'}
                                  </p>
                                </div>
                              ) : (
                                <p className="mt-1.5 text-[10px] leading-relaxed text-white/40">
                                  Étoiles et nombre d’avis non fournis par le scraper pour cette fiche. Les totaux
                                  boutique (si présents) sont affichés dans l’en-tête.
                                </p>
                              )}
                              {l.sales != null && l.sales > 0 ? (
                                <p className="mt-2 text-[10px] text-white/50">
                                  Ventes (fiche, si fourni) :{' '}
                                  <span className="font-semibold tabular-nums text-white/75">
                                    {formatFrInt(l.sales)}
                                  </span>
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {analysis && (
              <>
                <section className="rounded-2xl border border-white/10 bg-black/35 p-6 ring-1 ring-cyan-500/10">
                  <h3 className="text-lg font-semibold text-white">Synthèse IA</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                    {analysis.summary || '—'}
                  </p>
                </section>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-2xl border border-white/10 bg-black/35 p-6 ring-1 ring-cyan-500/10">
                    <div className="flex items-center gap-2 text-cyan-300">
                      <TrendingUp className="h-5 w-5" />
                      <h3 className="font-semibold">Meilleures ventes (estimé)</h3>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {(analysis.bestSellers || []).map((b, i) => (
                        <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="font-medium text-white">{b.title}</p>
                          <p className="mt-1 text-xs text-white/55">{b.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-black/35 p-6 ring-1 ring-cyan-500/10">
                    <div className="flex items-center gap-2 text-cyan-300">
                      <Tag className="h-5 w-5" />
                      <h3 className="font-semibold">Tags & SEO</h3>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-white/40">Tags fréquents</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(analysis.tagInsights?.topTags || []).map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-white/40">Thèmes</p>
                      <ul className="mt-2 list-inside list-disc text-sm text-white/75">
                        {(analysis.tagInsights?.themes || []).map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  </section>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                    <div className="flex items-center gap-2 text-emerald-300">
                      <CheckCircle2 className="h-5 w-5" />
                      <h3 className="font-semibold">Forces</h3>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm text-white/80">
                      {(analysis.strengths || []).map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-emerald-400">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
                    <div className="flex items-center gap-2 text-amber-300">
                      <AlertTriangle className="h-5 w-5" />
                      <h3 className="font-semibold">Faiblesses</h3>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm text-white/80">
                      {(analysis.weaknesses || []).map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-400">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </>
            )}

            {shop.listings.length > 0 && (
              <section>
                <h3 className="mb-4 text-lg font-semibold text-white">Données brutes (échantillon)</h3>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[920px] text-left text-sm">
                    <thead className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-white/45">
                      <tr>
                        <th className="w-[76px] px-4 py-3">Image</th>
                        <th className="px-4 py-3">Titre</th>
                        <th className="px-4 py-3">Prix</th>
                        <th className="px-4 py-3">Ventes (listing)</th>
                        <th className="px-4 py-3">Tags</th>
                        <th className="whitespace-nowrap px-4 py-3">Fiche Etsy</th>
                        <th className="whitespace-nowrap px-4 py-3">Analyse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shop.listings.slice(0, 24).map((l, i) => {
                        const thumb = listingThumbUrl(l.images);
                        return (
                        <tr key={l.url + i} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="px-4 py-2 align-middle">
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block rounded-lg outline-none ring-offset-2 ring-offset-black focus-visible:ring-2 focus-visible:ring-cyan-500"
                              title="Ouvrir la fiche sur Etsy"
                            >
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={thumb}
                                  alt={l.title.slice(0, 120)}
                                  className="h-14 w-14 shrink-0 rounded-lg border border-white/10 object-cover transition-opacity hover:opacity-90"
                                  loading="lazy"
                                />
                              ) : (
                                <div
                                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/[0.04] text-[10px] text-white/35"
                                  aria-hidden
                                >
                                  —
                                </div>
                              )}
                            </a>
                          </td>
                          <td className="max-w-xs px-4 py-2 text-white/90">
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-left underline-offset-2 hover:text-cyan-300 hover:underline"
                            >
                              {l.title.slice(0, 80)}
                              {l.title.length > 80 ? '…' : ''}
                            </a>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-white/80">{l.price || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-white/80">{l.sales ?? '—'}</td>
                          <td className="px-4 py-2 text-xs text-white/55">
                            {(l.tags || []).slice(0, 5).join(', ') || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 align-middle">
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/20"
                            >
                              <span>Voir la fiche</span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                            </a>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 align-middle">
                            <button
                              type="button"
                              onClick={() => openListingAnalyzer(l.url)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/35 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-100 transition-colors hover:border-violet-400/50 hover:bg-violet-500/20"
                            >
                              <BarChart3 className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                              <span>Analyser</span>
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
