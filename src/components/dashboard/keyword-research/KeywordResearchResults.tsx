'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Search, TrendingUp, TrendingDown, Minus, ExternalLink, Star } from 'lucide-react';
import { KeywordResearchResult } from '@/lib/keyword-research/types';

interface Props {
  result: KeywordResearchResult;
  monthlySearches?: Array<{ year: number; month: number; searchVolume: number }> | null;
  similarKeywords?: Array<{ keyword: string; searchVolume: number; competitionIndex: number; score: number }> | null;
  onUseSuggestion?: (keyword: string) => void;
}

type ActiveTab = 'keyword' | 'listings' | 'shops';
type ChartView = 'current' | 'trend';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function formatRawNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n) || n <= 0) return '—';
  // Format with space as thousand separator: "225 246"
  return Math.round(n).toLocaleString('fr-FR');
}

function formatCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n) || n <= 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
}

function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300';
  if (score >= 45) return 'bg-amber-500/20 border-amber-400/40 text-amber-300';
  return 'bg-red-500/20 border-red-400/40 text-red-300';
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'Élevé';
  if (score >= 45) return 'Moyen';
  return 'Faible';
}

function competitionLabel(index: number): string {
  if (index >= 70) return 'Forte';
  if (index >= 40) return 'Moyenne';
  return 'Faible';
}

function buildSyntheticChartData(
  avgVolume: number
): Array<{ label: string; value: number }> {
  const base = avgVolume > 0 ? avgVolume : 1_000;
  const factors = [0.5, 0.55, 0.6, 0.6, 0.65, 0.7, 0.8, 1.1, 1.4, 1.6, 1.0, 0.7];
  const avgFactor = factors.reduce((s, f) => s + f, 0) / factors.length;
  const scale = base / avgFactor;
  return MONTH_LABELS.map((label, i) => ({
    label,
    value: Math.round(scale * factors[i]),
  }));
}

function buildChartData(
  monthlySearches: Array<{ year: number; month: number; searchVolume: number }> | null | undefined,
  fallbackVolume: number
): Array<{ label: string; value: number }> {
  if (!monthlySearches || monthlySearches.length === 0) {
    return buildSyntheticChartData(fallbackVolume);
  }
  // Sort chronologically, take last 12 months
  const sorted = [...monthlySearches].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
  const last12 = sorted.slice(-12);
  return last12.map((pt) => ({
    label: MONTH_LABELS[pt.month - 1] ?? `M${pt.month}`,
    value: pt.searchVolume,
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  sublabel,
  children,
  accent,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-2 ${
        accent
          ? 'border-[#00d4ff]/30 bg-[#00d4ff]/5'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <p className="text-white/50 text-[11px] uppercase tracking-wider font-medium">{label}</p>
      <div className="flex-1">{children}</div>
      {sublabel && <p className="text-white/35 text-xs">{sublabel}</p>}
    </div>
  );
}

function ScoreCircle({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center w-16 h-16">
      <svg width="64" height="64" className="-rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="5"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-white font-bold text-sm">{score}</span>
    </div>
  );
}

function DemandBadge({ score }: { score: number }) {
  const Icon = score >= 70 ? TrendingUp : score >= 45 ? Minus : TrendingDown;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-3xl font-bold text-white tabular-nums`}>{score}</span>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${scoreBadgeClass(score)}`}
      >
        <Icon className="w-3 h-3" />
        {scoreLabel(score)}
      </span>
    </div>
  );
}

// Custom tooltip for the chart
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/90 border border-white/10 rounded-lg px-3 py-2 text-xs">
      <p className="text-white/60 mb-1">{label}</p>
      <p className="text-[#00d4ff] font-semibold">
        {formatRawNumber(payload[0].value)} recherches
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function KeywordResearchResults({
  result,
  monthlySearches,
  similarKeywords,
  onUseSuggestion,
}: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('keyword');
  const [chartView, setChartView] = useState<ChartView>('current');

  const { scores, metrics, listings } = result;

  // Average monthly search volume for display
  const avgMonthlyVolume = useMemo(() => {
    if (monthlySearches && monthlySearches.length > 0) {
      const sum = monthlySearches.reduce((s, m) => s + m.searchVolume, 0);
      return Math.round(sum / monthlySearches.length);
    }
    return metrics.marketSizeEstimate ?? 0;
  }, [monthlySearches, metrics.marketSizeEstimate]);

  const chartData = useMemo(
    () => buildChartData(monthlySearches, avgMonthlyVolume),
    [monthlySearches, avgMonthlyVolume]
  );

  // Derive shops from listings
  const shopsData = useMemo(() => {
    const map = new Map<
      string,
      { shopName: string; listingCount: number; totalPrice: number; totalReviews: number; priceCount: number; reviewCount: number }
    >();
    for (const l of listings) {
      const name = l.shopName ?? 'Boutique inconnue';
      const existing = map.get(name);
      if (existing) {
        existing.listingCount++;
        if (l.price != null) { existing.totalPrice += l.price; existing.priceCount++; }
        if (l.reviewCount != null) { existing.totalReviews += l.reviewCount; existing.reviewCount++; }
      } else {
        map.set(name, {
          shopName: name,
          listingCount: 1,
          totalPrice: l.price ?? 0,
          totalReviews: l.reviewCount ?? 0,
          priceCount: l.price != null ? 1 : 0,
          reviewCount: l.reviewCount != null ? 1 : 0,
        });
      }
    }
    return Array.from(map.values())
      .map((s) => ({
        shopName: s.shopName,
        listingCount: s.listingCount,
        avgPrice: s.priceCount > 0 ? s.totalPrice / s.priceCount : null,
        avgReviews: s.reviewCount > 0 ? Math.round(s.totalReviews / s.reviewCount) : null,
      }))
      .sort((a, b) => b.listingCount - a.listingCount);
  }, [listings]);

  // Similar keywords: use API data if available, otherwise fall back to suggestions
  const displaySimilarKws = useMemo(() => {
    if (similarKeywords && similarKeywords.length > 0) {
      return similarKeywords.slice(0, 20);
    }
    // Fallback: use suggestions with placeholder data
    return result.suggestions.slice(0, 20).map((kw) => ({
      keyword: kw,
      searchVolume: 0,
      competitionIndex: 0,
      score: 0,
      isPlaceholder: true,
    }));
  }, [similarKeywords, result.suggestions]);

  const tabs: { id: ActiveTab; label: string; count?: number }[] = [
    { id: 'keyword', label: 'Mot-clé' },
    { id: 'listings', label: 'Listings', count: listings.length },
    { id: 'shops', label: 'Boutiques', count: shopsData.length },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-white text-2xl font-bold">{result.keyword}</h2>
        <span
          className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${scoreBadgeClass(scores.globalScore)}`}
        >
          {scores.verdict === 'Launch' ? 'GO' : scores.verdict === 'Test' ? 'TEST' : 'AVOID'}
        </span>
      </div>

      {/* ── 4 metric cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search Volume */}
        <MetricCard label="Volume de recherche" sublabel="par mois">
          <p className="text-white font-bold text-2xl tabular-nums leading-none">
            {formatRawNumber(avgMonthlyVolume)}
          </p>
        </MetricCard>

        {/* Competition */}
        <MetricCard label="Concurrence" sublabel="listings Etsy">
          <p className="text-white font-bold text-2xl tabular-nums leading-none">
            {formatRawNumber(metrics.listingsCount)}
          </p>
        </MetricCard>

        {/* Demand */}
        <MetricCard label="Demande">
          <DemandBadge score={scores.demandScore} />
        </MetricCard>

        {/* Score global */}
        <MetricCard label="Score global" accent>
          <ScoreCircle score={scores.globalScore} />
        </MetricCard>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-white/10">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'text-[#00d4ff] border-b-2 border-[#00d4ff] -mb-px'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    activeTab === tab.id
                      ? 'bg-[#00d4ff]/20 text-[#00d4ff]'
                      : 'bg-white/10 text-white/50'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Keyword tab ── */}
      {activeTab === 'keyword' && (
        <div className="space-y-6">
          {/* Chart */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-semibold text-sm">Volume de recherche mensuel</h3>
                <p className="text-white/40 text-xs mt-0.5">
                  {monthlySearches && monthlySearches.length > 0
                    ? 'Données Google Ads (12 derniers mois)'
                    : 'Estimation saisonnière basée sur le volume moyen'}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setChartView('current')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    chartView === 'current'
                      ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30'
                      : 'text-white/50 hover:text-white/70 border border-white/10'
                  }`}
                >
                  Vue actuelle
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('trend')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    chartView === 'trend'
                      ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30'
                      : 'text-white/50 hover:text-white/70 border border-white/10'
                  }`}
                >
                  Tendance
                </button>
              </div>
            </div>

            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
                    tickFormatter={(v: number) => formatCompact(v)}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#00d4ff"
                    strokeWidth={2.5}
                    fill="url(#cyanGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#00d4ff', stroke: '#000', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Similar keywords table */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-white font-semibold text-sm">Mots-clés similaires</h3>
              {displaySimilarKws.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-xs">
                  {displaySimilarKws.length}
                </span>
              )}
            </div>

            {displaySimilarKws.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">
                Aucun mot-clé similaire disponible.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 pr-4 text-white/40 text-xs font-medium uppercase tracking-wider">
                        Mot-clé
                      </th>
                      <th className="text-right py-2 pr-4 text-white/40 text-xs font-medium uppercase tracking-wider">
                        Volume recherche
                      </th>
                      <th className="text-right py-2 pr-4 text-white/40 text-xs font-medium uppercase tracking-wider">
                        Concurrence
                      </th>
                      <th className="text-right py-2 text-white/40 text-xs font-medium uppercase tracking-wider">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displaySimilarKws.map((kw, i) => {
                      const isPlaceholder = 'isPlaceholder' in kw && kw.isPlaceholder;
                      return (
                        <tr
                          key={i}
                          className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-2.5 pr-4">
                            <button
                              type="button"
                              onClick={() => onUseSuggestion?.(kw.keyword)}
                              className="flex items-center gap-1.5 text-white/80 hover:text-[#00d4ff] transition-colors text-left group"
                            >
                              <Search className="w-3 h-3 text-white/30 group-hover:text-[#00d4ff]/60 flex-shrink-0" />
                              <span className="truncate max-w-[240px]">{kw.keyword}</span>
                            </button>
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            {isPlaceholder ? (
                              <span className="text-white/25 text-xs">—</span>
                            ) : (
                              <span className="text-white/70 tabular-nums">
                                {formatRawNumber(kw.searchVolume)}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            {isPlaceholder ? (
                              <span className="text-white/25 text-xs">—</span>
                            ) : (
                              <span className="text-white/70">
                                {competitionLabel(kw.competitionIndex)}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right">
                            {isPlaceholder ? (
                              <span className="text-white/25 text-xs">—</span>
                            ) : (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${scoreBadgeClass(kw.score)}`}
                              >
                                {kw.score}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Strategic insights (collapsed section) */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold text-sm mb-3">Analyse stratégique</h3>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              {result.strategicInsights.summary}
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-emerald-400 text-xs uppercase tracking-wide mb-2 font-medium">Forces</p>
                <ul className="space-y-1">
                  {result.strategicInsights.strengths.slice(0, 3).map((s, idx) => (
                    <li key={idx} className="text-white/65 text-xs leading-relaxed flex gap-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-amber-400 text-xs uppercase tracking-wide mb-2 font-medium">Points à surveiller</p>
                <ul className="space-y-1">
                  {result.strategicInsights.weaknesses.slice(0, 3).map((s, idx) => (
                    <li key={idx} className="text-white/65 text-xs leading-relaxed flex gap-2">
                      <span className="text-amber-400 mt-0.5">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Listings tab ── */}
      {activeTab === 'listings' && (
        <div>
          {listings.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
              <p className="text-white/50 text-sm">Aucun listing disponible pour ce mot-clé.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.slice(0, 24).map((listing) => (
                <a
                  key={`${listing.id}-${listing.rank}`}
                  href={listing.listingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-all overflow-hidden flex flex-col"
                >
                  {/* Image */}
                  <div className="aspect-square bg-white/5 overflow-hidden relative">
                    {listing.imageUrl ? (
                      <img
                        src={listing.imageUrl}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-white/15 text-xs">Pas d'image</span>
                      </div>
                    )}
                    {/* Rank badge */}
                    <span className="absolute top-2 left-2 bg-black/70 text-white/80 text-[10px] px-1.5 py-0.5 rounded-md">
                      #{listing.rank}
                    </span>
                    {/* External link icon */}
                    <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 rounded-md p-1">
                      <ExternalLink className="w-3 h-3 text-white/70" />
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-1.5 flex-1">
                    <p className="text-white/85 text-xs leading-relaxed line-clamp-2 font-medium">
                      {listing.title}
                    </p>
                    <p className="text-white/40 text-[11px] truncate">{listing.shopName ?? '—'}</p>
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <span className="text-[#00d4ff] font-semibold text-sm">
                        {listing.price != null ? `$${listing.price.toFixed(2)}` : '—'}
                      </span>
                      {listing.rating != null && (
                        <span className="flex items-center gap-1 text-white/50 text-xs">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {listing.rating.toFixed(1)}
                          {listing.reviewCount != null && (
                            <span className="text-white/30">({listing.reviewCount})</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Shops tab ── */}
      {activeTab === 'shops' && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
          {shopsData.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-white/50 text-sm">Aucune boutique à afficher pour ce mot-clé.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-5 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">
                      Boutique
                    </th>
                    <th className="text-right px-5 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">
                      Listings
                    </th>
                    <th className="text-right px-5 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">
                      Prix moyen
                    </th>
                    <th className="text-right px-5 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">
                      Avis moyens
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shopsData.map((shop, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-5 py-3 text-white/80 font-medium truncate max-w-[200px]">
                        {shop.shopName}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-[#00d4ff]/10 text-[#00d4ff] text-xs font-medium border border-[#00d4ff]/20">
                          {shop.listingCount}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-white/65">
                        {shop.avgPrice != null ? `$${shop.avgPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-white/65">
                        {shop.avgReviews != null ? shop.avgReviews.toLocaleString('fr-FR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
