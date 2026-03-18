'use client';

import { useMemo, useState } from 'react';
import { ArrowUpDown, CircleHelp, ShieldAlert, Target, TrendingUp } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { KeywordResearchResult } from '@/lib/keyword-research/types';
import { difficultyBadgeClass, formatCurrency, verdictBadgeClass } from '@/lib/keyword-research/formatters';

interface Props {
  result: KeywordResearchResult;
  onUseSuggestion?: (keyword: string) => void;
}

type ListingSort = 'rank' | 'reviews' | 'price';

function formatCount(value: number | null): string {
  if (!value || value <= 0) return 'N/A';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

function buildSyntheticVolumeSeries(avgMonthlySearches: number | null): { label: string; value: number }[] {
  const base = avgMonthlySearches && avgMonthlySearches > 0 ? avgMonthlySearches : 1_000;
  const months = ['MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB'];
  const factors = [0.5, 0.55, 0.6, 0.6, 0.65, 0.7, 0.8, 1.1, 1.4, 1.6, 1.0, 0.7];
  const avgFactor = factors.reduce((s, f) => s + f, 0) / factors.length;
  const scale = base / avgFactor;
  return months.map((m, i) => ({
    label: m,
    value: Math.round(scale * factors[i]),
  }));
}

function verdictLabel(verdict: KeywordResearchResult['scores']['verdict']): 'GO' | 'TEST' | 'AVOID' {
  if (verdict === 'Launch') return 'GO';
  if (verdict === 'Test') return 'TEST';
  return 'AVOID';
}

function actionSentence(result: KeywordResearchResult): string {
  const { scores } = result;
  if (scores.verdict === 'Launch') {
    return 'Bon mot-cle a tester avec une version long-tail bien ciblee.';
  }
  if (scores.verdict === 'Test') {
    return "Mot-cle a tester en priorite avec un angle produit plus specifique.";
  }
  return 'Mot-cle trop large ou trop concurrentiel, a affiner avant de lancer.';
}

function demandLabel(score: number): string {
  if (score >= 70) return 'Forte';
  if (score >= 45) return 'Moyenne';
  return 'Faible';
}

function competitionLabel(score: number): string {
  if (score >= 70) return 'Forte';
  if (score >= 45) return 'Moyenne';
  return 'Faible';
}

function scoreHelpText(kind: 'demand' | 'competition' | 'opportunity'): string {
  if (kind === 'demand') return 'Signaux de traction observes sur Etsy.';
  if (kind === 'competition') return 'Force des concurrents et saturation du top resultats.';
  return 'Synthese demande / concurrence / intention acheteur.';
}

function levelTagClass(label: string): string {
  if (/high competition|hard|avoid|low buyer intent/i.test(label)) {
    return 'bg-red-500/15 border-red-400/30 text-red-200';
  }
  if (/medium|test/i.test(label)) {
    return 'bg-amber-500/15 border-amber-400/30 text-amber-200';
  }
  return 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200';
}

function PrimaryScoreCard(props: {
  label: 'Demand' | 'Competition' | 'Opportunity';
  value: number;
  icon: React.ReactNode;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 min-h-[152px]">
      <div className="flex items-center justify-between mb-3 text-white/70 text-xs uppercase tracking-wider">
        <span>{props.label}</span>
        {props.icon}
      </div>
      <p className="text-white font-bold text-3xl leading-none">{props.value}/100</p>
      <p className="mt-2 text-white/65 text-xs flex items-start gap-1.5 leading-relaxed">
        <CircleHelp className="w-3.5 h-3.5 mt-0.5 text-white/45 flex-shrink-0" />
        {props.helper}
      </p>
    </div>
  );
}

function formatAluraNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function AluraVolumeBars(props: {
  title: string;
  volumes: { year: string; month: string; monthlySearches: string }[];
  barGradientClass: string;
}) {
  const slice = props.volumes.slice(-14);
  if (!slice.length) return null;
  const max = Math.max(...slice.map((p) => Number(p.monthlySearches) || 0), 1);
  return (
    <div>
      <p className="text-white/80 text-xs font-semibold mb-3">{props.title}</p>
      <div className="flex items-end gap-1 h-32 sm:h-36">
        {slice.map((pt, i) => {
          const v = Number(pt.monthlySearches) || 0;
          const h = Math.max(8, (v / max) * 100);
          const label = `${pt.month.slice(0, 3)} ${pt.year.slice(2)}`;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className={`w-full max-w-[28px] mx-auto rounded-t bg-gradient-to-t ${props.barGradientClass}`}
                style={{ height: `${h}%` }}
                title={`${pt.month} ${pt.year}: ${Number(pt.monthlySearches).toLocaleString('fr-FR')}`}
              />
              <span className="text-[8px] sm:text-[9px] text-white/40 truncate w-full text-center">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KeywordResearchResults({ result, onUseSuggestion }: Props) {
  const { scores, metrics, listings, strategicInsights } = result;
  const isAlura = result.dataSource === 'alura' || result.dataSource === 'rankhero' || Boolean(result.aluraOverview);
  const alura = result.aluraOverview;
  const [listingSort, setListingSort] = useState<ListingSort>('rank');
  const [aluraMoreOpen, setAluraMoreOpen] = useState(false);

  const sortedListings = useMemo(() => {
    const data = [...listings];
    const signal = (l: (typeof listings)[0]) =>
      isAlura ? (l.aluraMonthlySales ?? l.reviewCount ?? 0) : (l.reviewCount ?? 0);
    if (listingSort === 'reviews') return data.sort((a, b) => signal(b) - signal(a));
    if (listingSort === 'price') return data.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return data.sort((a, b) => a.rank - b.rank);
  }, [listings, listingSort, isAlura]);

  const verdict = verdictLabel(scores.verdict);
  const quickRead = [
    `Demande ${demandLabel(scores.demandScore).toLowerCase()} (${scores.demandScore}/100).`,
    `Concurrence ${competitionLabel(scores.competitionScore).toLowerCase()} (${scores.competitionScore}/100).`,
    `Niveau de difficulte ${scores.difficulty.toLowerCase()}.`,
    actionSentence(result),
  ];

  const tags = [
    scores.keywordShape,
    scores.saturationLevel === 'Low' ? 'Low competition' : 'High competition',
    scores.difficulty,
    scores.buyerIntentLevel === 'High' ? 'High buyer intent' : 'Low buyer intent',
  ];
  const estimatedConversionRate =
    scores.opportunityScore >= 75
      ? 3.2
      : scores.opportunityScore >= 55
        ? 2.4
        : scores.opportunityScore >= 35
          ? 1.6
          : 0.9;

  const volumeSeries = buildSyntheticVolumeSeries(alura?.etsyVolumeMonthly ?? null);


  const aluraCompact = Boolean(isAlura && alura);
  const showExtendedBlocks = !aluraCompact || aluraMoreOpen;

  const aluraDetailCells = alura
    ? [
        {
          label: 'Volume Etsy / mois',
          v:
            alura.etsyVolumeMonthly != null
              ? alura.etsyVolumeMonthly.toLocaleString('fr-FR')
              : null,
        },
        {
          label: 'Volume Google / mois',
          v:
            alura.googleVolumeMonthly != null
              ? alura.googleVolumeMonthly.toLocaleString('fr-FR')
              : null,
        },
        {
          label: 'Listings concurrents',
          v: alura.competingListings != null ? alura.competingListings.toLocaleString('fr-FR') : null,
        },
        {
          label: 'Vues (top)',
          v: alura.viewsTopListings != null ? formatAluraNum(alura.viewsTopListings) : null,
        },
        {
          label: 'Vues moy. / listing',
          v: alura.avgViewsPerListing != null ? formatAluraNum(alura.avgViewsPerListing) : null,
        },
        {
          label: 'Favoris moy.',
          v: alura.avgFavorers != null ? formatAluraNum(alura.avgFavorers) : null,
        },
        {
          label: 'Ventes totales (estim.)',
          v: alura.salesTotal != null ? alura.salesTotal.toLocaleString('fr-FR') : null,
        },
        {
          label: 'CA total ($)',
          v: alura.revenueTotal != null ? formatAluraNum(alura.revenueTotal) : null,
        },
        {
          label: 'Prix moyen (USD)',
          v: alura.avgPriceUsd != null ? `$${alura.avgPriceUsd.toFixed(2)}` : null,
        },
        {
          label: 'Ratio rech. / concurrence',
          v: alura.searchCompetitionRatio ?? null,
        },
      ]
    : [];

  return (
    <div className="space-y-7">
      {aluraCompact && alura ? (
        <>
          <section className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-950/50 to-black/40 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-violet-300/90 text-xs uppercase tracking-wide">
                  RankHero — overview façon Keyword Finder
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <h2 className="text-white text-3xl font-bold">{result.keyword}</h2>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-violet-400/40 bg-violet-500/15 text-violet-200">
                    RankHero
                  </span>
                </div>
                <p className="text-white/65 text-sm mt-2 max-w-xl">
                  Demande, compétition et score 0–100 dérivés des données RankHero (volume de recherche Etsy et
                  concurrence).
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full border text-sm font-semibold ${verdictBadgeClass(
                  scores.verdict
                )}`}
              >
                {verdict}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/50 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Search volume
                </p>
                <p className="text-white text-3xl font-bold mt-2 tabular-nums">
                  {alura.etsyVolumeMonthly != null
                    ? alura.etsyVolumeMonthly.toLocaleString('fr-FR')
                    : '—'}
                </p>
                <p className="text-white/45 text-xs mt-1">Recherches Etsy / mois</p>
                {alura.etsyVolumeMonthly != null && (
                  <p className="text-cyan-300/90 text-xs mt-2 font-medium">Pic saisonnier Oct–Déc.</p>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/50 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Competition
                </p>
                <p className="text-white text-3xl font-bold mt-2 tabular-nums">
                  {alura.competingListings != null
                    ? alura.competingListings.toLocaleString('fr-FR')
                    : '—'}
                </p>
                <p className="text-white/45 text-xs mt-1">Listings concurrents estimés</p>
                {alura.competingListings != null && (
                  <p className="text-white/55 text-xs mt-2">
                    {alura.competitionLevel ? alura.competitionLevel : ''}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/50">Conversion rate</p>
                <p className="text-white text-3xl font-bold mt-2 tabular-nums">
                  {estimatedConversionRate.toFixed(2)}%
                </p>
                <p className="text-white/45 text-xs mt-1">
                  Estimation basée sur le potentiel du mot-clé.
                </p>
              </div>
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-4">
                <p className="text-[10px] uppercase tracking-wider text-violet-200/80">Score global</p>
                <p className="text-white text-3xl font-bold mt-2 tabular-nums">
                  {alura.keywordScore ?? scores.globalScore}
                </p>
                <p className="text-white/45 text-xs mt-1">/ 100</p>
                <p className="text-violet-200/70 text-xs mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Opportunité {scores.opportunityScore}/100
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-white/70 text-xs font-semibold mb-3">Graphiques volume (recherches / mois)</p>
            <div className="h-40 sm:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volumeSeries} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  />
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.9)',
                      borderRadius: 8,
                      border: '1px solid rgba(148, 236, 255, 0.4)',
                      padding: '6px 8px',
                    }}
                    labelStyle={{ color: '#e5e7eb', fontSize: 11 }}
                    formatter={(value: unknown) => [
                      typeof value === 'number'
                        ? (value as number).toLocaleString('fr-FR') + ' recherches / mois'
                        : value,
                      '',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#22d3ee"
                    strokeWidth={2.4}
                    dot={{ r: 3, stroke: '#0f172a', strokeWidth: 1.2, fill: '#22d3ee' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {result.suggestions.length > 0 && (
            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <h3 className="text-emerald-200 text-sm font-semibold mb-1">Mots-clés proposés</h3>
              <p className="text-white/45 text-xs mb-4">Suggestions Alura (clique pour analyser).</p>
              <div className="flex flex-wrap gap-2">
                {result.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onUseSuggestion?.(s)}
                    className="px-3 py-1.5 rounded-full border border-white/20 bg-black/35 text-white/90 text-sm hover:border-[#00d4ff]/50 hover:bg-[#00d4ff]/10 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={() => setAluraMoreOpen((o) => !o)}
            className="w-full rounded-xl border border-white/15 bg-white/[0.02] py-3 text-sm text-white/70 hover:text-white hover:border-white/25 transition"
          >
            {aluraMoreOpen ? '▼ Masquer détails' : '▶ Voir plus (insights IA, listings, chiffres…)'}
          </button>

          {aluraMoreOpen && (
            <div className="space-y-7 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div>
                <p className="text-white/60 text-xs font-semibold mb-3">Autres métriques Alura</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {aluraDetailCells.map((cell, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                      <p className="text-[9px] uppercase text-white/45">{cell.label}</p>
                      <p className="text-white text-sm font-medium mt-0.5">{cell.v ?? '—'}</p>
                    </div>
                  ))}
                </div>
                {alura.etsyChangeYr != null && (
                  <p className="text-emerald-400/90 text-xs mt-2">
                    Tendance Etsy / an : {Number(alura.etsyChangeYr) >= 0 ? '+' : ''}
                    {alura.etsyChangeYr}%
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#00d4ff]/14 to-[#00c9b7]/8 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wide">Keyword analyse</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <h2 className="text-white text-3xl font-bold">{result.keyword}</h2>
                </div>
                <p className="text-white/80 mt-3 text-sm max-w-2xl">{actionSentence(result)}</p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <span
                  className={`px-3 py-1 rounded-full border text-sm font-semibold ${verdictBadgeClass(
                    scores.verdict
                  )}`}
                >
                  Verdict: {verdict}
                </span>
                <p className="text-white/70 text-xs">Score global</p>
                <p className="text-white text-3xl font-bold leading-none">{scores.globalScore}/100</p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PrimaryScoreCard
              label="Demand"
              value={scores.demandScore}
              icon={<Target className="w-4 h-4" />}
              helper={scoreHelpText('demand')}
            />
            <PrimaryScoreCard
              label="Competition"
              value={scores.competitionScore}
              icon={<ShieldAlert className="w-4 h-4" />}
              helper={scoreHelpText('competition')}
            />
            <PrimaryScoreCard
              label="Opportunity"
              value={scores.opportunityScore}
              icon={<TrendingUp className="w-4 h-4" />}
              helper={scoreHelpText('opportunity')}
            />
          </section>
        </>
      )}

      {showExtendedBlocks && (
        <>
          <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
            <h3 className="text-cyan-200 text-sm font-semibold mb-3">Lecture rapide</h3>
            <div className="grid md:grid-cols-2 gap-2">
              {quickRead.map((point) => (
                <p key={point} className="text-sm text-white/85 leading-relaxed">
                  - {point}
                </p>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {tags.map((tag) => (
                <span key={tag} className={`px-2.5 py-1 rounded-full border text-xs ${levelTagClass(tag)}`}>
                  {tag}
                </span>
              ))}
              <span
                className={`px-2.5 py-1 rounded-full border text-xs ${difficultyBadgeClass(scores.difficulty)}`}
              >
                {scores.difficulty}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] uppercase tracking-wider text-white/55">Average price</p>
                <p className="text-white text-lg font-semibold mt-1">{formatCurrency(metrics.averagePrice)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] uppercase tracking-wider text-white/55">Avg reviews</p>
                <p className="text-white text-lg font-semibold mt-1">
                  {Math.round(metrics.averageReviewCount) || 'N/A'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] uppercase tracking-wider text-white/55">Market size</p>
                <p className="text-white text-lg font-semibold mt-1">{formatCount(metrics.marketSizeEstimate)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] uppercase tracking-wider text-white/55">Saturation</p>
                <p className="text-white text-lg font-semibold mt-1">{scores.saturationLevel}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] uppercase tracking-wider text-white/55">Difficulty</p>
                <p className="text-white text-lg font-semibold mt-1">{scores.difficulty}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] uppercase tracking-wider text-white/55">Top shops concentration</p>
                <p className="text-white text-lg font-semibold mt-1">{metrics.topShopsConcentration.toFixed(0)}%</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold mb-2">Strategic insights</h3>
            <p className="text-white/80 text-sm leading-relaxed mb-4">{strategicInsights.summary}</p>
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <p className="text-emerald-300 text-xs uppercase tracking-wide mb-2">Forces</p>
                <ul className="space-y-1 text-sm text-white/80 list-disc list-inside">
                  {strategicInsights.strengths.slice(0, 3).map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-amber-300 text-xs uppercase tracking-wide mb-2">Faiblesses</p>
                <ul className="space-y-1 text-sm text-white/80 list-disc list-inside">
                  {strategicInsights.weaknesses.slice(0, 3).map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-5">
              <p className="text-cyan-300 text-xs uppercase tracking-wide mb-2">Angle strategique</p>
              <p className="text-sm text-white/80">{strategicInsights.strategicAngle}</p>
            </div>
            <div className="mt-4">
              <p className="text-white/60 text-xs uppercase tracking-wide mb-2">Recommandation</p>
              <ul className="space-y-1 text-sm text-white/80 list-disc list-inside">
                {strategicInsights.recommendations.slice(0, 3).map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          </section>

          {!aluraCompact && result.suggestions.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="text-white font-semibold mb-3">Long-tail keywords</h3>
              <p className="text-white/55 text-xs mb-4">
                Clique sur une suggestion pour relancer l&apos;analyse instantanement.
              </p>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {result.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onUseSuggestion?.(s)}
                    className="text-left px-3 py-2 rounded-lg border border-white/20 bg-black/30 text-white/80 text-sm hover:border-[#00d4ff]/45 hover:text-white transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {showExtendedBlocks && (
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-white font-semibold">Sample listings</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/50">Trier par :</span>
            <button
              type="button"
              onClick={() => setListingSort('rank')}
              className={`px-2 py-1 rounded-md border transition ${
                listingSort === 'rank'
                  ? 'border-[#00d4ff]/50 text-[#00d4ff] bg-[#00d4ff]/10'
                  : 'border-white/15 text-white/70'
              }`}
            >
              Position
            </button>
            <button
              type="button"
              onClick={() => setListingSort('reviews')}
              className={`px-2 py-1 rounded-md border transition ${
                listingSort === 'reviews'
                  ? 'border-[#00d4ff]/50 text-[#00d4ff] bg-[#00d4ff]/10'
                  : 'border-white/15 text-white/70'
              }`}
            >
              {isAlura ? 'Ventes / signal' : 'Avis'}
            </button>
            <button
              type="button"
              onClick={() => setListingSort('price')}
              className={`px-2 py-1 rounded-md border transition ${
                listingSort === 'price'
                  ? 'border-[#00d4ff]/50 text-[#00d4ff] bg-[#00d4ff]/10'
                  : 'border-white/15 text-white/70'
              }`}
            >
              Prix
            </button>
            <ArrowUpDown className="w-3.5 h-3.5 text-white/40" />
          </div>
        </div>

        <table className={`w-full text-sm ${isAlura ? 'min-w-[1000px]' : 'min-w-[920px]'}`}>
          <thead className="text-white/55 text-xs uppercase tracking-wider">
            <tr className="border-b border-white/10">
              <th className="text-left py-2 pr-4">Rank</th>
              <th className="text-left py-2 pr-4">Listing</th>
              <th className="text-left py-2 pr-4">Price</th>
              <th className="text-left py-2 pr-4">{isAlura ? 'Ventes / mois' : 'Reviews'}</th>
              {isAlura && <th className="text-left py-2 pr-4">Vues</th>}
              <th className="text-left py-2 pr-4">Shop</th>
              <th className="text-left py-2">Rating</th>
            </tr>
          </thead>
          <tbody>
            {sortedListings.slice(0, 20).map((listing) => (
              <tr
                key={`${listing.id}-${listing.rank}`}
                className="border-b border-white/5 hover:bg-white/[0.02] align-middle"
              >
                <td className="py-3 pr-4 text-white/80 font-medium">#{listing.rank}</td>
                <td className="py-3 pr-4 max-w-[440px]">
                  <a
                    href={listing.listingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 min-w-0"
                  >
                    {listing.imageUrl ? (
                      <img
                        src={listing.imageUrl}
                        alt={listing.title}
                        className="w-11 h-11 rounded-md object-cover border border-white/10 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-md bg-white/5 border border-white/10 flex-shrink-0" />
                    )}
                    <span className="text-white/85 truncate block max-w-[360px]">{listing.title}</span>
                  </a>
                </td>
                <td className="py-3 pr-4 text-white/80">{formatCurrency(listing.price ?? 0)}</td>
                <td className="py-3 pr-4 text-white/80">
                  {isAlura && listing.aluraMonthlySales != null
                    ? listing.aluraMonthlySales
                    : (listing.reviewCount ?? '—')}
                </td>
                {isAlura && (
                  <td className="py-3 pr-4 text-white/80">
                    {listing.aluraViews != null ? formatAluraNum(listing.aluraViews) : '—'}
                  </td>
                )}
                <td className="py-3 pr-4 text-white/80 max-w-[180px] truncate">{listing.shopName ?? '—'}</td>
                <td className="py-3 text-white/80">{listing.rating?.toFixed(1) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      )}
    </div>
  );
}
