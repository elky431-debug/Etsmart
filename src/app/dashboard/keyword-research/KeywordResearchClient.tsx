'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertCircle, KeyRound, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  KeywordResearchHistoryItem,
  KeywordResearchResult,
} from '@/lib/keyword-research/types';
import { KeywordResearchForm } from '@/components/dashboard/keyword-research/KeywordResearchForm';
import { KeywordResearchResults } from '@/components/dashboard/keyword-research/KeywordResearchResults';
import { KeywordResearchHistory } from '@/components/dashboard/keyword-research/KeywordResearchHistory';

export default function KeywordResearchClient() {
  const [keyword, setKeyword] = useState('');
  const [result, setResult] = useState<KeywordResearchResult | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<KeywordResearchHistoryItem | null>(null);
  const [history, setHistory] = useState<KeywordResearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch('/api/keyword-research/history?limit=30', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setHistory(Array.isArray(data.history) ? data.history : []);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const runAnalyze = async (rawKeyword: string) => {
    const clean = rawKeyword.trim();
    if (clean.length < 2) return;
    setError(null);
    setLoading(true);
    setSelectedHistory(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Tu dois être connecté.');
        return;
      }

      const res = await fetch('/api/keyword-research/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keyword: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || data?.error || "Impossible d'analyser ce mot-clé.");
        return;
      }

      setResult(data.result || null);
      setKeyword(clean);
      window.dispatchEvent(new Event('credits-updated'));
      await fetchHistory();
    } catch {
      setError('Erreur réseau. Réessaie.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    await runAnalyze(keyword);
  };

  const openHistoryDetail = async (item: KeywordResearchHistoryItem) => {
    setError(null);
    setSelectedHistory(item);
    setResult(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/keyword-research/history/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.item) return;

      const detail = data.item as KeywordResearchHistoryItem;
      const keywordWordCount = detail.keyword.trim().split(/\s+/).filter(Boolean).length;
      const keywordShape = keywordWordCount >= 4 ? 'Long-tail' : keywordWordCount >= 2 ? 'Niche' : 'Broad';
      const intentScore = keywordShape === 'Broad' ? 32 : keywordShape === 'Niche' ? 52 : 68;
      const buyerIntentLevel = intentScore >= 70 ? 'High' : intentScore >= 40 ? 'Medium' : 'Low';
      const globalScore = Math.round(detail.opportunityScore * 0.6 + detail.demandScore * 0.4);
      setSelectedHistory(detail);
      setResult({
        keyword: detail.keyword,
        sourceUrl: detail.sourceUrl,
        generatedAt: detail.createdAt,
        metrics: {
          averagePrice: detail.averagePrice,
          averageReviewCount: detail.averageReviews,
          topShopsConcentration: detail.topShopsConcentration,
          listingsCount: detail.listingsCount,
        },
        scores: {
          globalScore,
          intentScore,
          demandScore: detail.demandScore,
          competitionScore: detail.competitionScore,
          opportunityScore: detail.opportunityScore,
          saturationLevel: detail.saturationLevel,
          difficulty: detail.difficulty,
          buyerIntentLevel,
          keywordShape,
          verdict: detail.verdict,
        },
        listings: detail.rawListings || [],
        strategicInsights: detail.strategicInsights || {
          summary: '',
          strengths: [],
          weaknesses: [],
          recommendations: [],
          strategicAngle: '',
          verdictExplanation: '',
        },
        suggestions: detail.suggestions || [],
      });
    } catch {
      // keep basic selected history only
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/5 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Keyword Research</h1>
              <p className="text-white/70 mt-2">Analyse rapide pour choisir un mot-cle Etsy plus rentable.</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-5">
          <div className="space-y-5">
            <KeywordResearchForm
              keyword={keyword}
              onKeywordChange={setKeyword}
              onSubmit={handleAnalyze}
              loading={loading}
            />
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/65 leading-relaxed">
              <p className="flex items-center gap-2 text-white/80 font-semibold mb-1">
                <Sparkles className="w-4 h-4 text-[#00d4ff]" />
                Lecture des scores
              </p>
              <p>
                Demand = traction observee, Competition = difficulte pour se placer, Opportunity =
                potentiel actionnable.
              </p>
              <p className="mt-2 text-white/45">1 credit par analyse.</p>
            </div>
            <KeywordResearchHistory
              history={history}
              loading={historyLoading}
              onSelect={openHistoryDetail}
              selectedId={selectedHistory?.id ?? null}
            />
          </div>

          <div className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {!result && !loading && !error && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
                <p className="text-white text-lg font-semibold mb-1">Prêt pour ton prochain keyword ?</p>
                <p className="text-white/55 text-sm">
                  Lance une analyse depuis le formulaire pour voir les scores, le verdict et les insights
                  stratégiques.
                </p>
              </div>
            )}

            {loading && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            )}

            {result && (
              <KeywordResearchResults
                result={result}
                onUseSuggestion={async (suggested) => {
                  setKeyword(suggested);
                  await runAnalyze(suggested);
                }}
              />
            )}

            {selectedHistory && (
              <p className="text-xs text-white/45">
                Détail chargé depuis l&apos;historique : {selectedHistory.keyword}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
