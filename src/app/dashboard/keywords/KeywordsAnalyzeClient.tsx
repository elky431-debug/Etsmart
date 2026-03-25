'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Metrics = {
  competitionScore: number;
  demandScore: number;
  globalScore: number;
  avgFavorites: number;
  totalListings: number;
  prices: {
    min: string;
    bargain: string;
    midrange: string;
    premium: string;
    max: string;
  };
};

type SimilarKeywordRow = {
  keyword: string;
  totalListings: number;
  avgFavorites: number;
  competitionScore: number;
  demandScore: number;
  globalScore: number;
  conversionRate: number;
  trendDirection: 'up' | 'stable' | 'down';
};

type ResultState = {
  keyword: string;
  metrics: Metrics;
  suggestions: string[];
  similarKeywords: SimilarKeywordRow[];
  sampleTitles: string[];
  topListings?: Array<{
    title: string;
    url: string | null;
    image: string | null;
    price: number | null;
    sellerRating: number | null;
    reviews: number | null;
  }>;
  conversionRate?: number;
  trendDirection?: 'up' | 'stable' | 'down';
};

type HistoryItem = {
  id: string;
  keyword: string;
  status: string;
  created_at: string;
  globalScore: number | null;
  verdict: string;
};

type ScoreLabel = 'Very High' | 'High' | 'Moderate' | 'Low';

function scoreLabel(score: number): ScoreLabel {
  if (score >= 80) return 'Very High';
  if (score >= 65) return 'High';
  if (score >= 40) return 'Moderate';
  return 'Low';
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200';
  if (score >= 65) return 'border-sky-400/35 bg-sky-500/10 text-sky-200';
  if (score >= 40) return 'border-amber-400/35 bg-amber-500/10 text-amber-200';
  return 'border-red-400/35 bg-red-500/10 text-red-200';
}

function trendIcon(dir: 'up' | 'stable' | 'down'): string {
  if (dir === 'up') return '↗';
  if (dir === 'down') return '↘';
  return '→';
}

function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('fr-FR');
}

function barColor(score: number, invert = false): string {
  const v = invert ? 100 - score : score;
  if (v >= 60) return 'from-emerald-500 to-teal-400';
  if (v >= 40) return 'from-amber-400 to-yellow-500';
  return 'from-red-500 to-rose-500';
}

function formatPriceField(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return v.toFixed(2);
  return '—';
}

function priceBandFromMetrics(prices: Metrics['prices']): string {
  const midStr = formatPriceField(
    (prices as { midrange?: unknown }).midrange ?? (prices as { median?: unknown }).median
  );
  const mid = parseFloat(midStr);
  if (!Number.isFinite(mid) || mid <= 0) return '—';
  if (mid < 25) return 'Plutôt entrée de gamme (bargain)';
  if (mid < 65) return 'Milieu de gamme (midrange)';
  return 'Premium';
}

function totalListingsFromMetrics(m: Metrics & { nbListings?: number }): number {
  if (typeof m.totalListings === 'number') return m.totalListings;
  if (typeof m.nbListings === 'number') return m.nbListings;
  return 0;
}

function pickBestKeywords(rows: SimilarKeywordRow[]): string[] {
  return [...rows]
    .filter((t) => t.globalScore >= 40)
    .sort((a, b) => b.globalScore - a.globalScore)
    .slice(0, 20)
    .map((t) => t.keyword);
}

function tagRowColor(globalScore: number): string {
  if (globalScore >= 60) return 'border-emerald-500/35 bg-emerald-500/10';
  if (globalScore >= 40) return 'border-amber-500/35 bg-amber-500/10';
  return 'border-white/10 bg-white/[0.03]';
}

const LOADING_STEPS = [
  '⏳ Lancement de l’analyse…',
  '🔍 Scraping des listings Etsy (peut prendre 1–2 min)…',
  '🧮 Calcul des scores et métriques…',
  '🤖 Génération de keywords long-tail (IA, optionnel)…',
  '✅ Résultats prêts !',
];

const POLL_MS = 2000;
/** Une requête status bloquée ne doit pas geler tout le poll. */
const STATUS_FETCH_MS = 28_000;
/** Plusieurs runs Apify (mot-clé + tags) : le goulot est le scraping, pas le GPT (~quelques secondes). */
/** Timeout UX : si aucun `done/error` après X, on affiche l'erreur pour éviter la boucle. */
const SOFT_TIMEOUT_MS = 2 * 60 * 1000;
/** On continue à poll en arrière-plan plus longtemps pour éviter le “bug d’affichage”. */
const HARD_TIMEOUT_MS = 8 * 60 * 1000;
const STEP1_MS = 4000;
// “Finalisation…” uniquement après un délai plus réaliste (sinon tu as l’impression que
// c’est bloqué même quand Apify tags tourne encore).
const STEP2_MS = 25_000;

export default function KeywordsAnalyzeClient() {
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pollJobId, setPollJobId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [phaseTick, setPhaseTick] = useState(0);

  const strongTagsForCopy = useMemo(
    () => (result ? pickBestKeywords(result.similarKeywords) : []),
    [result]
  );

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadHistory = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch('/api/keywords/history', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.items)) {
      setHistory(data.items);
    }
  }, [getToken]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const loadingElapsed = useMemo(() => {
    if (!startedAt) return 0;
    return Math.max(0, Date.now() - startedAt);
  }, [startedAt, loading, pollJobId, phaseTick]);

  const loadingProgress = useMemo(() => {
    // Estimation basée sur le temps (Apify ~60–90s). On évite 100% tant qu'on n'a pas de résultat.
    const t = loadingElapsed;
    if (t <= 0) return 0;
    if (t < 4_000) return Math.round((t / 4_000) * 25);
    if (t < 30_000) return 25 + Math.round(((t - 4_000) / 26_000) * 35); // -> ~60%
    if (t < 75_000) return 60 + Math.round(((t - 30_000) / 45_000) * 25); // -> ~85%
    return 85 + Math.min(14, Math.round(((t - 75_000) / 45_000) * 14)); // -> max 99
  }, [loadingElapsed]);

  useEffect(() => {
    if (!loading || !startedAt) return;
    const id = window.setInterval(() => setPhaseTick((n) => n + 1), 400);
    return () => window.clearInterval(id);
  }, [loading, startedAt]);

  /**
   * Ne pas mettre `loading` dans les deps : sinon un flicker loading peut démonter l’effet,
   * arrêter le poll alors que le job est encore `pending`, et l’UI reste bloquée alors que
   * l’historique affiche bien le résultat.
   */
  useEffect(() => {
    if (!pollJobId) return;

    const jobId = pollJobId;
    let stop = false;
    let inFlight = false;
    let consecutivePollFailures = 0;
    const startedPollAt = Date.now();
    const hardDeadline = startedPollAt + HARD_TIMEOUT_MS;
    let softTimedOut = false;
    let intervalId = 0;

    const finish = () => {
      stop = true;
      if (intervalId) window.clearInterval(intervalId);
    };

    const applyStatusPayload = (data: Record<string, unknown>) => {
      if (data.status === 'done') {
        finish();
        setResult({
          keyword: String(data.keyword || ''),
          metrics: data.metrics as Metrics,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
          similarKeywords: Array.isArray(data.similarKeywords) ? (data.similarKeywords as SimilarKeywordRow[]) : [],
          sampleTitles: Array.isArray(data.sampleTitles) ? data.sampleTitles : [],
          topListings: Array.isArray(data.topListings) ? (data.topListings as ResultState['topListings']) : [],
          conversionRate: typeof data.conversionRate === 'number' ? data.conversionRate : undefined,
          trendDirection:
            data.trendDirection === 'up' || data.trendDirection === 'down' || data.trendDirection === 'stable'
              ? (data.trendDirection as 'up' | 'stable' | 'down')
              : undefined,
        });
        setSelectedTags(new Set(pickBestKeywords((data.similarKeywords as SimilarKeywordRow[]) || [])));
        setLoading(false);
        setPollJobId(null);
        setStartedAt(null);
        void loadHistory();
        window.dispatchEvent(new CustomEvent('subscription-refresh'));
        return true;
      }
      if (data.status === 'error') {
        finish();
        setError(String(data.message || 'Analyse échouée.'));
        setLoading(false);
        setPollJobId(null);
        setStartedAt(null);
        void loadHistory();
        return true;
      }
      return false;
    };

    const pollOnce = async () => {
      if (stop || inFlight) return;
      const now = Date.now();
      if (!softTimedOut && now - startedPollAt > SOFT_TIMEOUT_MS) {
        softTimedOut = true;
        // Soft-timeout: on informe l’utilisateur, mais on continue à poll pour afficher
        // les résultats dès qu’ils arrivent (évite de devoir recliquer).
        setError(
          `Toujours en cours après 2 min (jobId=${jobId}). ` +
            `Je continue à suivre en arrière-plan — les résultats s’afficheront dès qu’ils arrivent.`
        );
        setLoading(false);
        setStartedAt(null);
      }
      if (now > hardDeadline) {
        finish();
        setError(
          `Délai dépassé côté navigateur (8 min) : aucun \`done/error\` (jobId=${jobId}). ` +
            `Regarde l’historique ou relance l’analyse.`
        );
        setLoading(false);
        setPollJobId(null);
        setStartedAt(null);
        return;
      }
      inFlight = true;
      let timeoutId: number | undefined;
      try {
        const token = await getToken();
        if (!token || stop) return;
        const controller = new AbortController();
        timeoutId = window.setTimeout(() => controller.abort(), STATUS_FETCH_MS);
        const res = await fetch(`/api/keywords/status?jobId=${encodeURIComponent(jobId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (stop) return;

        if (!res.ok) {
          finish();
          consecutivePollFailures = 0;
          const msg =
            typeof data.message === 'string'
              ? data.message
              : typeof data.error === 'string'
                ? data.error
                : `Erreur ${res.status}`;
          setError(res.status === 401 ? 'Session expirée. Reconnecte-toi et relance l’analyse.' : msg);
          setLoading(false);
          setPollJobId(null);
          setStartedAt(null);
          return;
        }

        applyStatusPayload(data);
        consecutivePollFailures = 0;
      } catch (e: unknown) {
        /** Timeout réseau ou erreur parse : on retente au tick suivant (évite spinner sans fin si un fetch reste pending). */
        consecutivePollFailures += 1;
        if (stop) return;
        const errName = e instanceof Error && e.name ? e.name : 'Erreur';
        if (consecutivePollFailures >= 6) {
          finish();
          setError(
            `Impossible de récupérer le statut du job (${consecutivePollFailures} échecs). ` +
              `Dernière erreur: ${errName}.`
          );
          setLoading(false);
          setPollJobId(null);
          setStartedAt(null);
        }
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
        inFlight = false;
      }
    };

    intervalId = window.setInterval(() => {
      void pollOnce();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void pollOnce();
    };
    document.addEventListener('visibilitychange', onVisible);

    void pollOnce();

    return () => {
      stop = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [pollJobId, getToken, loadHistory]);

  const runAnalyze = async () => {
    const clean = keywordInput.trim();
    if (clean.length < 2) return;
    await runAnalyzeKeyword(clean);
  };

  const openHistoryItem = async (id: string) => {
    setError(null);
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`/api/keywords/status?jobId=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== 'done') {
      setError('Impossible de charger cette analyse.');
      return;
    }
    setResult({
      keyword: String(data.keyword || ''),
      metrics: data.metrics as Metrics,
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      similarKeywords: Array.isArray(data.similarKeywords) ? (data.similarKeywords as SimilarKeywordRow[]) : [],
      sampleTitles: Array.isArray(data.sampleTitles) ? data.sampleTitles : [],
      topListings: Array.isArray(data.topListings) ? (data.topListings as ResultState['topListings']) : [],
      conversionRate: typeof data.conversionRate === 'number' ? data.conversionRate : undefined,
      trendDirection:
        data.trendDirection === 'up' || data.trendDirection === 'down' || data.trendDirection === 'stable'
          ? (data.trendDirection as 'up' | 'stable' | 'down')
          : undefined,
    });
    setSelectedTags(new Set(pickBestKeywords((data.similarKeywords as SimilarKeywordRow[]) || [])));
    setKeywordInput(String(data.keyword || ''));
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Copie impossible dans ce navigateur.');
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const verdictBorder = 'border-amber-500/50';

  const runAnalyzeKeyword = async (kw: string) => {
    setKeywordInput(kw);
    setError(null);
    setLoading(true);
    setStartedAt(Date.now());
    setResult(null);
    setPollJobId(null);
    try {
      const token = await getToken();
      if (!token) {
        setError('Connecte-toi pour lancer une analyse.');
        setLoading(false);
        setStartedAt(null);
        return;
      }
      const res = await fetch('/api/keywords/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keyword: kw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || data?.error || 'Impossible de lancer l’analyse.');
        setLoading(false);
        setStartedAt(null);
        return;
      }
      if (data.status === 'done' && data.cached) {
        setResult({
          keyword: String(data.keyword || kw),
          metrics: data.metrics as Metrics,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
          similarKeywords: Array.isArray(data.similarKeywords) ? (data.similarKeywords as SimilarKeywordRow[]) : [],
          sampleTitles: Array.isArray(data.sampleTitles) ? data.sampleTitles : [],
          topListings: Array.isArray(data.topListings) ? (data.topListings as ResultState['topListings']) : [],
          conversionRate: typeof data.conversionRate === 'number' ? data.conversionRate : undefined,
          trendDirection:
            data.trendDirection === 'up' || data.trendDirection === 'down' || data.trendDirection === 'stable'
              ? (data.trendDirection as 'up' | 'stable' | 'down')
              : undefined,
        });
        setSelectedTags(new Set(pickBestKeywords((data.similarKeywords as SimilarKeywordRow[]) || [])));
        setLoading(false);
        setStartedAt(null);
        void loadHistory();
        return;
      }
      if (data.jobId) setPollJobId(String(data.jobId));
      else {
        setError('Réponse serveur inattendue.');
        setLoading(false);
        setStartedAt(null);
      }
    } catch {
      setError('Erreur réseau.');
      setLoading(false);
      setStartedAt(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-[#8befff]"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7]">
                <Search className="h-5 w-5 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">Analyse de Keyword Etsy</h1>
                <p className="mt-1 text-sm text-white/55">
                  Trouve les meilleures opportunités avant tes concurrents — 1 crédit Etsmart par analyse (hors cache
                  24 h). Listings via Apify (<span className="font-mono text-white/70">APIFY_API_TOKEN</span>, acteur{' '}
                  <span className="font-mono text-white/70">epctex~etsy-scraper</span>), autosuggest Etsy sans clé.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          <p className="font-medium text-amber-50/95">Apify : acteur epctex~etsy-scraper</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
            L’acteur exige un bloc <span className="font-mono text-amber-50/90">proxy</span> : Etsmart envoie par défaut{' '}
            <span className="font-mono">useApifyProxy + apifyProxyGroups: [&quot;RESIDENTIAL&quot;]</span>. Il faut un
            abonnement / quota{' '}
            <a
              href="https://docs.apify.com/platform/proxy"
              target="_blank"
              rel="noreferrer"
              className="text-[#8befff] underline underline-offset-2 hover:text-white"
            >
              Apify Proxy
            </a>
            . Optionnel : <span className="font-mono">APIFY_ETSY_PROXY_JSON</span> (JSON du proxy) ou{' '}
            <span className="font-mono">APIFY_ETSY_PROXY_GROUPS</span> (ex. <span className="font-mono">DATACENTER</span>
            ).
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-white/50">Mot-clé Etsy</label>
            <input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading && keywordInput.trim().length >= 2) {
                  e.preventDefault();
                  void runAnalyze();
                }
              }}
              placeholder="ex: minimalist wall art"
              disabled={loading}
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#00d4ff]/50"
            />
          </div>
          <button
            type="button"
            disabled={loading || keywordInput.trim().length < 2}
            onClick={() => void runAnalyze()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Analyser
          </button>
        </div>

        {loading && startedAt != null && (
          <div className="mb-6 rounded-xl border border-[#00d4ff]/25 bg-[#00d4ff]/10 px-4 py-4 text-sm text-[#b8f4ff]">
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-xs text-white/60">
                <span>Progression estimée</span>
                <span className="font-medium text-white/80">{loadingProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] transition-all duration-500"
                  style={{ width: `${Math.min(99, Math.max(2, loadingProgress))}%` }}
                />
              </div>
            </div>
            <ul className="space-y-2.5">
              {LOADING_STEPS.map((label, i) => {
                const thresholds = [0, 2_000, 15_000, 45_000, 120_000];
                const done = i < thresholds.length - 1 ? loadingElapsed >= thresholds[i + 1]! : false;
                const active =
                  i < thresholds.length - 1
                    ? loadingElapsed >= thresholds[i]! && loadingElapsed < thresholds[i + 1]!
                    : loadingElapsed >= thresholds[thresholds.length - 1]!;
                return (
                  <li key={label} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#00d4ff]/40 bg-black/20">
                      {done ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2.5} />
                      ) : active ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8befff]" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
                      )}
                    </span>
                    <span className={done ? 'text-white/70' : active ? 'text-[#b8f4ff]' : 'text-white/40'}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
            {pollJobId ? (
              <p className="mt-3 text-xs text-white/45">
                Actualisation toutes les {POLL_MS / 1000}s — la durée vient surtout d’Apify.
              </p>
            ) : null}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">
                    {result.keyword}
                  </h2>
                  <p className="mt-1 text-xs text-white/50">
                    {fmtInt(result.metrics.totalListings)} listings analysés (Apify) · conversion estimée{' '}
                    {typeof result.conversionRate === 'number' ? `${result.conversionRate}%` : '—'} · trend{' '}
                    {result.trendDirection ? `${trendIcon(result.trendDirection)} ${result.trendDirection}` : '—'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${scoreBadgeClass(
                    result.metrics.globalScore
                  )}`}
                >
                  Score {result.metrics.globalScore} · {scoreLabel(result.metrics.globalScore)}
                </span>
              </div>
              {result.suggestions.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="w-full text-xs font-medium uppercase tracking-wide text-white/45">
                    Suggestions Etsy
                  </span>
                  {result.suggestions.map((s, i) => (
                    <span
                      key={`${s}-${i}`}
                      className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs text-white/75"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/45">Search Volume</p>
                  <p className="mt-2 text-2xl font-semibold text-white">~{fmtInt(result.metrics.totalListings)}</p>
                  <p className="mt-1 text-xs text-white/50">listings Etsy (échantillon Apify)</p>
                  <p className="mt-3 text-xs text-white/45">Score demande: {result.metrics.demandScore}/100</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/45">Competition</p>
                  <p className="mt-2 text-2xl font-semibold text-white">~{fmtInt(result.metrics.totalListings)}</p>
                  <p className="mt-1 text-xs text-white/50">listings</p>
                  <p className="mt-3 text-xs text-white/45">Avis vendeurs moy.: ~{fmtInt(result.metrics.avgFavorites)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/45">Score</p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <p className="text-2xl font-semibold text-white">{result.metrics.globalScore}</p>
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${scoreBadgeClass(
                        result.metrics.globalScore
                      )}`}
                    >
                      {scoreLabel(result.metrics.globalScore)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-white/45">Concurrence: {result.metrics.competitionScore}/100</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                <h3 className="text-sm font-semibold text-white/80">Fourchette de prix (top résultats)</h3>
                <p className="mt-2 text-sm text-white/65">
                  Min {formatPriceField(result.metrics.prices.min)} · Bargain{' '}
                  {formatPriceField((result.metrics.prices as { bargain?: unknown }).bargain)} · Mid{' '}
                  {formatPriceField(result.metrics.prices.midrange)} · Premium{' '}
                  {formatPriceField((result.metrics.prices as { premium?: unknown }).premium)} · Max{' '}
                  {formatPriceField(result.metrics.prices.max)}
                </p>
                <p className="mt-2 text-sm text-[#8befff]">{priceBandFromMetrics(result.metrics.prices)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-semibold">Similar keywords</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={strongTagsForCopy.length === 0}
                    onClick={() => void copyText(strongTagsForCopy.join(', '), 'best13')}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#00d4ff]/35 bg-[#00d4ff]/10 px-3 py-2 text-xs font-medium text-[#8befff] hover:bg-[#00d4ff]/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copied === 'best13' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copier (score ≥ 40) ({strongTagsForCopy.length})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void copyText([...selectedTags].join(', '), 'selected')
                    }
                    disabled={selectedTags.size === 0}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10 disabled:opacity-40"
                  >
                    {copied === 'selected' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copier la sélection ({selectedTags.size})
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-white/50">
                      <th className="pb-2 pr-3">Keyword</th>
                      <th className="pb-2 pr-3">Est. Volume</th>
                      <th className="pb-2 pr-3">Competition</th>
                      <th className="pb-2 pr-3">Score</th>
                      <th className="pb-2 pr-3">Trend</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.similarKeywords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-sm text-white/45">
                          Aucun keyword similaire — relance plus tard ou essaie un keyword plus précis.
                        </td>
                      </tr>
                    ) : null}
                    {result.similarKeywords.map((t, i) => (
                      <tr
                        key={`${t.keyword}-${i}`}
                        className={`border-b border-white/5 ${tagRowColor(t.globalScore)}`}
                      >
                        <td className="py-2 pr-3 font-medium text-white">{t.keyword}</td>
                        <td className="py-2 pr-3 text-white/70">~{fmtInt(t.totalListings)}</td>
                        <td className="py-2 pr-3 text-white/70">{t.competitionScore}</td>
                        <td className="py-2 pr-3">
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${scoreBadgeClass(t.globalScore)}`}>
                            {t.globalScore} · {scoreLabel(t.globalScore)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-white/70">
                          {trendIcon(t.trendDirection)}{' '}
                          <span className="text-xs text-white/45">{t.trendDirection}</span>
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void runAnalyzeKeyword(t.keyword)}
                            className="rounded-lg border border-[#00d4ff]/35 bg-[#00d4ff]/10 px-3 py-1.5 text-xs font-semibold text-[#8befff] hover:bg-[#00d4ff]/20"
                          >
                            Analyser
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {result.topListings && result.topListings.length > 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Top listings</h3>
                  <p className="text-xs text-white/45">6 premiers résultats Apify</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {result.topListings.slice(0, 6).map((l, idx) => (
                    <div key={idx} className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                      <div className="aspect-[4/3] w-full bg-white/[0.03]">
                        {l.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.image} alt={l.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-white/35">
                            Pas d’image
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 p-3">
                        <p className="text-sm font-semibold text-white">
                          {l.title.length > 50 ? `${l.title.slice(0, 50)}…` : l.title}
                        </p>
                        <p className="text-xs text-white/55">
                          {typeof l.price === 'number' ? `${l.price.toFixed(2)} $` : '—'} ·{' '}
                          {typeof l.sellerRating === 'number' ? `⭐ ${l.sellerRating}` : '⭐ —'} ·{' '}
                          {typeof l.reviews === 'number' ? `${l.reviews} reviews` : '— reviews'}
                        </p>
                        {l.url ? (
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-full items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                          >
                            Voir sur Etsy
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white/80">Historique récent</h3>
          {history.length === 0 ? (
            <p className="text-sm text-white/45">Aucune analyse enregistrée.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => void openHistoryItem(h.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left text-sm transition-colors hover:border-[#00d4ff]/30 hover:bg-white/5"
                  >
                    <span className="font-medium text-white">{h.keyword}</span>
                    <span className="text-xs text-white/45">
                      {h.globalScore != null ? `score ${h.globalScore}` : h.status} ·{' '}
                      {new Date(h.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
