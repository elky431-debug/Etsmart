'use client';

import { FormEvent, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, Loader2, ExternalLink } from 'lucide-react';
import { decodeListingTitleEntities } from '@/lib/etsy/decode-listing-title';
import type { ShopPayload } from '@/lib/etsy/shop-scrape-service';
import type {
  ShopCompareIndicators,
  ShopCompareQuality,
  ShopCompareSynthesis,
  ShopCompareTagDiff,
} from '@/types/shop-compare';
import { scoreBadgeClasses, scoreBarClass } from '@/lib/etsy/listing-letter-grade';

const PREFILL_LISTING_URL_KEY = 'etsmart-prefill-listing-url';

type ApiOk = {
  success: true;
  shopA: ShopPayload;
  shopB: ShopPayload;
  indicatorsA: ShopCompareIndicators;
  indicatorsB: ShopCompareIndicators;
  qualityA: ShopCompareQuality;
  qualityB: ShopCompareQuality;
  tags: ShopCompareTagDiff;
  titleKeywords: ShopCompareTagDiff;
  synthesis: ShopCompareSynthesis;
};

type ApiErr = { error?: string; message?: string };

const gradientBtn =
  'rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 disabled:opacity-60 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]';

function formatFrInt(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
}

function formatPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(2)} €`;
}

function IndicatorRow({ label, a, b }: { label: string; a: ReactNode; b: ReactNode }) {
  return (
    <tr className="border-t border-white/10 transition-colors hover:bg-white/[0.03]">
      <th className="bg-white/[0.02] px-3 py-3 text-left text-xs font-medium text-white/55 sm:px-4">{label}</th>
      <td className="px-3 py-3 text-sm font-semibold tabular-nums text-white/95 sm:px-4">{a}</td>
      <td className="px-3 py-3 text-sm font-semibold tabular-nums text-white/95 sm:px-4">{b}</td>
    </tr>
  );
}

function listingThumbUrl(images?: string[]): string | null {
  const raw = images?.find((x) => typeof x === 'string' && x.trim());
  if (!raw) return null;
  const u = raw.trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return u.split('?')[0];
  if (u.startsWith('//')) return `https:${u}`.split('?')[0];
  return `https://${u.replace(/^\/+/, '')}`.split('?')[0];
}

function ShopColumnHeader({
  shop,
  label,
  quality,
}: {
  shop: ShopPayload;
  label: string;
  quality?: ShopCompareQuality | null;
}) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-cyan-950/25 ring-1 ring-cyan-500/15 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      {shop.bannerUrl ? (
        <div className="relative h-20 w-full overflow-hidden bg-black/40 sm:h-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shop.bannerUrl} alt="" className="h-full w-full object-cover object-[center_35%]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/65" />
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(ellipse_at_30%_0%,rgba(0,212,255,0.18),transparent_55%)]" />
        </div>
      ) : (
        <div className="h-14 w-full bg-gradient-to-r from-cyan-950/40 via-black/50 to-violet-950/30 sm:h-16" />
      )}
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="flex min-w-0 gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-black bg-black ring-1 ring-white/10 sm:h-[4.5rem] sm:w-[4.5rem]">
            {shop.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white/35">
                {(shop.shopName || label).slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200/55">Boutique {label}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-white sm:text-xl">{shop.shopName}</h2>
              {quality?.grade && quality.grade !== '—' ? (
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight ${scoreBadgeClasses(
                    quality.score100
                  )}`}
                  title={`Score qualité global: ${quality.score100}/100 (${quality.verbal})`}
                >
                  {quality.grade}
                </span>
              ) : null}
            </div>
            <a
              href={shop.shopUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
            >
              <span className="truncate">{shop.shopUrl.replace(/^https?:\/\//, '')}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:text-right">
          <div>
            <dt className="text-white/40">Création / depuis</dt>
            <dd className="font-medium text-white">{shop.shopAge?.trim() || '—'}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function TagChips({ items }: { items: string[] }) {
  const ring = 'border-white/15 bg-white/5 text-white/80';
  if (!items.length) {
    return <p className="text-xs text-white/35">Aucun</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <li key={t} className={`rounded-full border px-2 py-0.5 text-[11px] ${ring}`}>
          {t}
        </li>
      ))}
    </ul>
  );
}

function ListingsColumn({
  shop,
  label,
  onOpenListingAnalysis,
}: {
  shop: ShopPayload;
  label: string;
  onOpenListingAnalysis?: (listingUrl: string) => void;
}) {
  const openListingAnalyzer = (listingUrl: string) => {
    const u = listingUrl.trim();
    if (!u) return;
    try {
      sessionStorage.setItem(PREFILL_LISTING_URL_KEY, u);
    } catch {
      /* ignore */
    }
    if (onOpenListingAnalysis) onOpenListingAnalysis(u);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4 ring-1 ring-cyan-500/10">
      <h3 className="text-sm font-semibold text-white">
        Listings ({label}) — {shop.listings.length}
      </h3>
      <div className="mt-4 max-h-[min(720px,70vh)] space-y-4 overflow-y-auto pr-1">
        {shop.listings.map((l) => {
          const img = listingThumbUrl(l.images);
          const title = decodeListingTitleEntities(l.title || '—');
          return (
            <article
              key={l.url}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-sm"
            >
              <div className="flex gap-3 p-3">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/40 hover:opacity-95"
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-white/30">—</div>
                  )}
                </a>

                <div className="min-w-0 flex-1">
                  <a href={l.url} target="_blank" rel="noreferrer" className="hover:text-cyan-200">
                    <p className="line-clamp-2 font-medium leading-snug text-white/90">{title}</p>
                  </a>
                  <p className="mt-1 text-xs tabular-nums text-cyan-200/80">
                    {l.price > 0 ? `${l.price.toFixed(2)} €` : '—'}
                    {l.sales != null && l.sales > 0 ? (
                      <span className="text-white/45"> · {formatFrInt(l.sales)} ventes</span>
                    ) : null}
                    {l.rating != null && l.rating > 0 ? (
                      <span className="text-white/45">
                        {' '}
                        · {l.rating.toFixed(1)}★
                        {l.reviews != null && l.reviews > 0 ? ` (${formatFrInt(Math.round(l.reviews))} avis)` : ''}
                      </span>
                    ) : null}
                  </p>
                  {l.tags && l.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {l.tags.slice(0, 10).map((t) => (
                        <span
                          key={t}
                          className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-white/55"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {onOpenListingAnalysis ? (
                    <button
                      type="button"
                      onClick={() => openListingAnalyzer(l.url)}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/35 bg-cyan-500/10 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-400/55 hover:bg-cyan-500/20"
                    >
                      <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Analyse détaillée (listing)
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export type DashboardShopCompareProps = {
  /** Navigation SPA vers l’analyseur de listing avec URL préremplie */
  onOpenListingAnalysis?: (listingUrl: string) => void;
};

export function DashboardShopCompare({ onOpenListingAnalysis }: DashboardShopCompareProps = {}) {
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<ApiOk | null>(null);

  const canSubmit = useMemo(() => urlA.trim().length > 5 && urlB.trim().length > 5, [urlA, urlB]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setData(null);
    if (!canSubmit) {
      setError('Renseigne les deux URLs de boutique Etsy.');
      return;
    }

    setLoading(true);
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      let session = refreshed.session;
      if (!session?.access_token) {
        const {
          data: { session: cached },
        } = await supabase.auth.getSession();
        session = cached;
      }
      const token = session?.access_token;
      if (!token) {
        setError('Session expirée. Reconnecte-toi.');
        return;
      }

      const controller = new AbortController();
      const timeoutMs = 600_000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const fetchPromise = fetch('/api/etsy/shop-compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shopUrlA: urlA.trim(), shopUrlB: urlB.trim(), maxListings: 18 }),
        signal: controller.signal,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          try {
            controller.abort();
          } catch {
            /* ignore */
          }
          reject(new Error('CLIENT_TIMEOUT'));
        }, timeoutMs);
      });

      let res: Response;
      try {
        res = await Promise.race([fetchPromise, timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      const rawText = await res.text();
      let json = {} as ApiOk & ApiErr;
      if (rawText.trim()) {
        try {
          json = JSON.parse(rawText) as ApiOk & ApiErr;
        } catch {
          setError(res.ok ? 'Réponse serveur illisible.' : `Erreur ${res.status}`);
          return;
        }
      }

      if (!res.ok) {
        setError(json.message || json.error || `Erreur ${res.status}`);
        return;
      }
      if (json.success && json.shopA && json.shopB) {
        setData(json as ApiOk);
      } else {
        setError('Réponse incomplète du serveur.');
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'CLIENT_TIMEOUT')) {
        setError('Délai dépassé : les deux runs Apify peuvent prendre plusieurs minutes. Réessaie.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const ia = data?.indicatorsA;
  const ib = data?.indicatorsB;
  const qa = data?.qualityA;
  const qb = data?.qualityB;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="border-b border-white/10 pb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400/90">Etsmart</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Comparaison de boutiques</h1>
        </header>

        <form
          onSubmit={onSubmit}
          className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 ring-1 ring-cyan-500/15"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-white/55">URL boutique A</label>
              <input
                type="text"
                value={urlA}
                onChange={(e) => setUrlA(e.target.value)}
                placeholder="https://www.etsy.com/shop/…"
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-500/55"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-white/55">URL boutique B</label>
              <input
                type="text"
                value={urlB}
                onChange={(e) => setUrlB(e.target.value)}
                placeholder="https://www.etsy.com/shop/…"
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-500/55"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={loading || !canSubmit} className={gradientBtn}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Comparaison…
                </span>
              ) : (
                'Comparer les boutiques'
              )}
            </button>
            <p className="text-xs text-white/40">Prévoir ~3–8 min (2× Apify résidentiel + IA).</p>
          </div>
          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </form>

        {data && ia && ib && qa && qb ? (
          <div className="mt-12 space-y-12">
            <div className="relative">
              <div className="grid gap-6 lg:grid-cols-2">
                <ShopColumnHeader shop={data.shopA} label="A" quality={qa} />
                <ShopColumnHeader shop={data.shopB} label="B" quality={qb} />
              </div>
              <div className="pointer-events-none absolute inset-x-0 -top-3 hidden justify-center lg:flex">
                <div className="rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-semibold tracking-widest text-white/70 shadow-[0_10px_30px_rgba(0,0,0,0.35)] ring-1 ring-cyan-500/10">
                  VS
                </div>
              </div>
            </div>

            <section className="overflow-x-auto rounded-2xl border border-white/10 bg-black/35 ring-1 ring-cyan-500/10 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
              <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">Indicateurs clés (côte à côte)</h2>
                </div>
              </div>
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/45">
                    <th className="px-3 py-3 sm:px-4">Indicateur</th>
                    <th className="px-3 py-3 sm:px-4">Boutique A</th>
                    <th className="px-3 py-3 sm:px-4">Boutique B</th>
                  </tr>
                </thead>
                <tbody>
                  <IndicatorRow
                    label="Ventes (boutique)"
                    a={ia.sales > 0 ? formatFrInt(ia.sales) : '—'}
                    b={ib.sales > 0 ? formatFrInt(ib.sales) : '—'}
                  />
                  <IndicatorRow
                    label="Note moyenne"
                    a={ia.rating > 0 ? `${ia.rating.toFixed(1)} / 5` : '—'}
                    b={ib.rating > 0 ? `${ib.rating.toFixed(1)} / 5` : '—'}
                  />
                  <IndicatorRow
                    label="Nombre d’avis"
                    a={ia.reviewCount > 0 ? formatFrInt(ia.reviewCount) : '—'}
                    b={ib.reviewCount > 0 ? formatFrInt(ib.reviewCount) : '—'}
                  />
                  <IndicatorRow
                    label="Listings actifs (données publiques)"
                    a={ia.listingsActive != null && ia.listingsActive > 0 ? formatFrInt(ia.listingsActive) : '—'}
                    b={ib.listingsActive != null && ib.listingsActive > 0 ? formatFrInt(ib.listingsActive) : '—'}
                  />
                  <IndicatorRow
                    label="Fiches dans l’échantillon"
                    a={formatFrInt(ia.listingsSampleCount)}
                    b={formatFrInt(ib.listingsSampleCount)}
                  />
                  <IndicatorRow
                    label="Prix min / max / moyen (échantillon)"
                    a={`${formatPrice(ia.minPrice)} · ${formatPrice(ia.maxPrice)} · ${formatPrice(ia.avgPrice)}`}
                    b={`${formatPrice(ib.minPrice)} · ${formatPrice(ib.maxPrice)} · ${formatPrice(ib.avgPrice)}`}
                  />
                  <IndicatorRow label="Ancienneté affichée" a={ia.shopAgeLabel} b={ib.shopAgeLabel} />
                  <tr className="border-t border-white/10">
                    <th className="bg-white/[0.02] px-3 py-3 text-left text-xs font-medium text-white/55 sm:px-4">
                      Score qualité global
                    </th>
                    <td className="px-3 py-3 sm:px-4">
                      <div className="flex flex-wrap items-end gap-2">
                        <span className="text-2xl font-bold text-white">{qa.grade}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${scoreBadgeClasses(qa.score100)}`}
                        >
                          {qa.verbal}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${scoreBarClass(qa.score100)}`} style={{ width: `${qa.score100}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] tabular-nums text-white/45">{qa.score100} / 100 — moyenne des fiches</p>
                    </td>
                    <td className="px-3 py-3 sm:px-4">
                      <div className="flex flex-wrap items-end gap-2">
                        <span className="text-2xl font-bold text-white">{qb.grade}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${scoreBadgeClasses(qb.score100)}`}
                        >
                          {qb.verbal}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${scoreBarClass(qb.score100)}`} style={{ width: `${qb.score100}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] tabular-nums text-white/45">{qb.score100} / 100 — moyenne des fiches</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/25 to-black/50 p-5 ring-1 ring-cyan-500/20 sm:p-8">
              <h2 className="text-lg font-semibold text-white">Synthèse IA</h2>
              <p className="mt-1 text-xs text-white/45">
                La plus forte :{' '}
                <strong className="text-cyan-200/90">
                  {data.synthesis.strongerShop === 'A'
                    ? 'Boutique A'
                    : data.synthesis.strongerShop === 'B'
                      ? 'Boutique B'
                      : 'Égalité / tie'}
                </strong>
              </p>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-white/85">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Pourquoi</p>
                  <p className="mt-1 whitespace-pre-wrap">{data.synthesis.why}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Opportunité pour toi</p>
                  <p className="mt-1 whitespace-pre-wrap">{data.synthesis.opportunityForUser}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <ListingsColumn shop={data.shopA} label="A" onOpenListingAnalysis={onOpenListingAnalysis} />
              <ListingsColumn shop={data.shopB} label="B" onOpenListingAnalysis={onOpenListingAnalysis} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
