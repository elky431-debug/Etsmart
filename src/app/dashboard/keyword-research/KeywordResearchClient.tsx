'use client';

import { FormEvent, useState } from 'react';
import { AlertCircle, KeyRound, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { KeywordResearchResult } from '@/lib/keyword-research/types';
import { KeywordResearchForm } from '@/components/dashboard/keyword-research/KeywordResearchForm';
import { KeywordResearchResults } from '@/components/dashboard/keyword-research/KeywordResearchResults';

type MonthlySearch = { year: number; month: number; searchVolume: number };
type SimilarKeyword = { keyword: string; searchVolume: number; competitionIndex: number; score: number };

export default function KeywordResearchClient() {
  const [keyword, setKeyword] = useState('');
  const [result, setResult] = useState<KeywordResearchResult | null>(null);
  const [monthlySearches, setMonthlySearches] = useState<MonthlySearch[] | null>(null);
  const [similarKeywords, setSimilarKeywords] = useState<SimilarKeyword[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalyze = async (rawKeyword: string) => {
    const clean = rawKeyword.trim();
    if (clean.length < 2) return;
    setError(null);
    setLoading(true);
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
        setResult(null);
        setMonthlySearches(null);
        setSimilarKeywords(null);
        setError(data?.message || data?.error || "Impossible d'analyser ce mot-clé.");
        return;
      }

      setError(null);
      setResult(data.result || null);
      setMonthlySearches(data.monthlySearches ?? null);
      setSimilarKeywords(data.similarKeywords ?? null);
      setKeyword(clean);
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

  return (
    <div className="min-h-screen bg-black px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/5 px-6 py-7 md:px-10 md:py-9">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Keyword Research</h1>
              <p className="text-white/70 mt-1 text-sm">
                Analyse la demande, la compétition et le potentiel de tes mots-clés Etsy en un coup d'œil.
              </p>
            </div>
          </div>

          <div className="mt-6 max-w-3xl mx-auto w-full">
            <KeywordResearchForm
              keyword={keyword}
              onKeywordChange={setKeyword}
              onSubmit={handleAnalyze}
              loading={loading}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-white/80">Résultats</h2>
              <div className="text-[11px] text-white/45">
                Scores calculés à partir des performances observées sur Etsy.
              </div>
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
                  <p className="text-white text-lg font-semibold mb-1">
                    Visualise la demande réelle et la compétition pour tes mots-clés Etsy.
                  </p>
                  <p className="text-white/55 text-sm">
                    Lance une analyse depuis le champ de recherche au-dessus pour voir les scores, un verdict clair
                    et des recommandations actionnables.
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
                  monthlySearches={monthlySearches}
                  similarKeywords={similarKeywords}
                  onUseSuggestion={async (suggested) => {
                    setKeyword(suggested);
                    await runAnalyze(suggested);
                  }}
                />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/65 leading-relaxed">
            <p className="flex items-center gap-2 text-white/80 font-semibold mb-1">
              <Sparkles className="w-4 h-4 text-[#00d4ff]" />
              Lecture des scores
            </p>
            <p>
              <span className="font-semibold">Demand</span> = traction observée,{' '}
              <span className="font-semibold">Competition</span> = difficulté pour se placer,{' '}
              <span className="font-semibold">Opportunity</span> = potentiel actionnable.
            </p>
            <p className="mt-2 text-white/45">1 crédit par analyse.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
