'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe2, Loader2, Upload, FileDown, Sparkles, RefreshCw } from 'lucide-react';
import type { CountryOpportunity } from '@/types/opportunityMap';
import { useOpportunityMapStore } from '@/store/useOpportunityMapStore';
import { generateMockAnalysis } from '@/components/dashboard/opportunity-map/mockOpportunityAnalysis';
import { WorldOpportunityMap } from '@/components/dashboard/opportunity-map/WorldOpportunityMap';

const BG = '#0f1117';
const BORDER = '#1e2535';
const ACCENT = '#00BFA5';

const LOADING_STEPS = [
  { emoji: '🔍', text: 'Analyse du produit en cours...', ms: 1200 },
  { emoji: '🌍', text: 'Scan des marchés mondiaux...', ms: 1500 },
  { emoji: '📊', text: 'Calcul de la saturation par pays...', ms: 1300 },
  { emoji: '🎯', text: 'Identification des opportunités...', ms: 1000 },
] as const;

const TOTAL_MS = LOADING_STEPS.reduce((a, s) => a + s.ms, 0);

function MetricBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const display = invert ? 100 - value : value;
  const hue = invert
    ? value > 60
      ? 'bg-amber-500/80'
      : value > 35
        ? 'bg-[#00BFA5]/80'
        : 'bg-[#00BFA5]'
    : 'bg-[#00BFA5]';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-white/55">
        <span>{label}</span>
        <span className="font-mono text-white/80">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/50" style={{ border: `1px solid ${BORDER}` }}>
        <motion.div
          className={`h-full rounded-full ${hue}`}
          initial={{ width: 0 }}
          animate={{ width: `${display}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: 1 | 2 | 3 }) {
  const styles =
    rank === 1
      ? 'bg-gradient-to-r from-amber-600/30 to-amber-500/20 text-amber-300 border-amber-500/40'
      : rank === 2
        ? 'bg-gradient-to-r from-slate-400/25 to-slate-500/15 text-slate-200 border-slate-400/35'
        : 'bg-gradient-to-r from-amber-900/40 to-orange-900/25 text-orange-200 border-orange-700/40';
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${styles}`}
    >
      #{rank}
    </span>
  );
}

function CountryResultCard({ c }: { c: CountryOpportunity }) {
  return (
    <motion.div
      layout
      className="rounded-xl p-4"
      style={{ background: '#151922', border: `1px solid ${BORDER}` }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none" aria-hidden>
            {c.flag}
          </span>
          <div>
            <p className="font-semibold text-white">{c.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/40">{c.code}</p>
          </div>
        </div>
        <RankBadge rank={c.rank} />
      </div>
      <p className="mb-3 text-3xl font-bold tabular-nums text-[#00BFA5]">
        {c.score}
        <span className="text-lg font-semibold text-white/40">/100</span>
      </p>
      <div className="mb-3 space-y-2.5">
        <MetricBar label="Demande (volume recherches estimé)" value={c.demand} />
        <MetricBar label="Concurrence (vendeurs locaux)" value={c.competition} invert />
        <MetricBar label="Potentiel profit (marge estimée)" value={c.profitPotential} />
      </div>
      <p className="mb-3 text-xs leading-relaxed text-white/60">{c.insight}</p>
      <button
        type="button"
        className="w-full rounded-lg py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
        style={{ background: `linear-gradient(90deg, ${ACCENT}, #00d4aa)` }}
      >
        Cibler ce marché →
      </button>
    </motion.div>
  );
}

export function OpportunityMapCard() {
  const { lastAnalysis, setLastAnalysis } = useOpportunityMapStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [nicheHint, setNicheHint] = useState('');
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef(0);
  const [drag, setDrag] = useState(false);

  const revokePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const onFile = useCallback(
    (f: File | null) => {
      if (!f || !/^image\/(jpeg|png)$/i.test(f.type)) {
        return;
      }
      revokePreview();
      const url = URL.createObjectURL(f);
      setFile(f);
      setPreviewUrl(url);
    },
    [revokePreview]
  );

  useEffect(() => () => revokePreview(), [revokePreview]);

  const runLoadingAndAnalyze = async () => {
    if (!file) return;
    setStep(2);
    setProgress(0);
    let elapsed = 0;
    for (let i = 0; i < LOADING_STEPS.length; i++) {
      setLoadingIdx(i);
      const { ms } = LOADING_STEPS[i];
      const start = Date.now();
      while (Date.now() - start < ms) {
        const p = ((elapsed + (Date.now() - start)) / TOTAL_MS) * 100;
        setProgress(Math.min(99, p));
        await new Promise((r) => setTimeout(r, 40));
      }
      elapsed += ms;
    }
    const data = generateMockAnalysis(nicheHint);
    setLastAnalysis(data);
    setProgress(100);
    setStep(3);
  };

  const resetAll = () => {
    revokePreview();
    setFile(null);
    setPreviewUrl(null);
    setNicheHint('');
    setLastAnalysis(null);
    setStep(1);
    setProgress(0);
  };

  const exportPdf = () => {
    setToast('Export en cours...');
    setTimeout(() => setToast(null), 2800);
  };

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: BG }}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, #00897b)` }}
            >
              <Globe2 className="h-6 w-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white md:text-3xl">Carte des Opportunités</h1>
              <p className="text-sm text-white/55">
                Visualise où ton produit AliExpress a le plus de potentiel (démo simulée).
              </p>
            </div>
          </div>
          {step === 3 && lastAnalysis && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/5"
                style={{ borderColor: BORDER }}
              >
                <RefreshCw className="h-4 w-4 text-[#00BFA5]" />
                Nouvelle analyse
              </button>
              <button
                type="button"
                onClick={exportPdf}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/5"
                style={{ borderColor: BORDER }}
              >
                <FileDown className="h-4 w-4 text-[#00BFA5]" />
                Exporter PDF
              </button>
            </div>
          )}
        </header>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-auto max-w-lg rounded-2xl p-6 md:p-8"
              style={{ border: `1px solid ${BORDER}`, background: '#151922' }}
            >
              {lastAnalysis && (
                <div className="mb-4 rounded-lg border border-[#00BFA5]/30 bg-[#00BFA5]/10 px-4 py-3 text-sm text-white/85">
                  <p className="mb-2">Une analyse est enregistrée localement.</p>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="font-semibold text-[#00BFA5] underline-offset-2 hover:underline"
                  >
                    Reprendre la dernière analyse
                  </button>
                </div>
              )}

              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  dragRef.current += 1;
                  setDrag(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  dragRef.current -= 1;
                  if (dragRef.current <= 0) {
                    dragRef.current = 0;
                    setDrag(false);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  dragRef.current = 0;
                  setDrag(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) onFile(f);
                }}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
                  drag ? 'border-[#00BFA5] bg-[#00BFA5]/10' : 'border-white/15 bg-black/30 hover:border-[#00BFA5]/50'
                }`}
              >
                <Upload className="mb-3 h-10 w-10 text-[#00BFA5]" />
                <p className="mb-1 text-sm font-medium text-white">
                  Dépose la photo
                  <br />
                  de ton produit AliExpress
                </p>
                <p className="mb-4 text-xs text-white/45">JPG ou PNG</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold text-[#00BFA5] transition hover:bg-[#00BFA5]/10"
                  style={{ borderColor: BORDER }}
                >
                  Parcourir
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] || null)}
                />
              </div>

              {previewUrl && (
                <div className="mt-5 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Aperçu produit"
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-xl object-cover ring-2 ring-[#00BFA5]/30"
                  />
                  <p className="text-xs text-white/50">{file?.name}</p>
                </div>
              )}

              <label className="mt-6 block text-xs font-medium text-white/60">
                Précise la niche (optionnel)
                <input
                  value={nicheHint}
                  onChange={(e) => setNicheHint(e.target.value)}
                  placeholder="ex: céramique, poster..."
                  className="mt-2 w-full rounded-lg border bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#00BFA5]/40"
                  style={{ borderColor: BORDER }}
                />
              </label>

              <button
                type="button"
                disabled={!file}
                onClick={() => void runLoadingAndAnalyze()}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: `linear-gradient(90deg, #00d4aa, ${ACCENT})` }}
              >
                <Sparkles className="h-4 w-4" />
                Analyser les opportunités →
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-md rounded-2xl p-8 text-center"
              style={{ border: `1px solid ${BORDER}`, background: '#151922' }}
            >
              <Loader2 className="mx-auto mb-6 h-10 w-10 animate-spin text-[#00BFA5]" />
              <AnimatePresence mode="wait">
                <motion.p
                  key={loadingIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-6 min-h-[3rem] text-base text-white/90"
                >
                  <span className="mr-2">{LOADING_STEPS[loadingIdx]?.emoji}</span>
                  {LOADING_STEPS[loadingIdx]?.text}
                </motion.p>
              </AnimatePresence>
              <div className="h-2 overflow-hidden rounded-full bg-black/50" style={{ border: `1px solid ${BORDER}` }}>
                <motion.div
                  className="h-full rounded-full bg-[#00BFA5]"
                  style={{ width: `${progress}%` }}
                  transition={{ type: 'tween', duration: 0.08 }}
                />
              </div>
              <p className="mt-2 text-xs tabular-nums text-white/40">{Math.round(progress)}%</p>
            </motion.div>
          )}

          {step === 3 && lastAnalysis && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1 space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[#00BFA5]">
                    Carte du monde
                  </h2>
                  <WorldOpportunityMap markets={lastAnalysis.mapMarkets} topCountries={lastAnalysis.topCountries} />
                  <p className="text-xs text-white/45">
                    Vert = opportunité · Orange/rouge = saturé · Gris = neutre · Contour teal = top 3
                  </p>
                </div>
                <aside className="w-full shrink-0 space-y-4 lg:w-[340px]">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[#00BFA5]">
                    Top 3 pays
                  </h2>
                  {lastAnalysis.topCountries.map((c) => (
                    <CountryResultCard key={c.code} c={c} />
                  ))}
                </aside>
              </div>

              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
                  Insights globaux
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div
                    className="rounded-xl p-4"
                    style={{ background: '#151922', border: `1px solid ${BORDER}` }}
                  >
                    <p className="mb-2 text-lg">🌡️</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
                      Température de niche
                    </p>
                    <p className="mt-2 text-xl font-bold text-[#00BFA5]">
                      {lastAnalysis.globalInsights.temperature}
                    </p>
                    <p className="mt-1 text-xs text-white/55">{lastAnalysis.globalInsights.temperatureLabel}</p>
                  </div>
                  <div
                    className="rounded-xl p-4"
                    style={{ background: '#151922', border: `1px solid ${BORDER}` }}
                  >
                    <p className="mb-2 text-lg">⏱️</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
                      Fenêtre d&apos;opportunité
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-white/80">
                      {lastAnalysis.globalInsights.window}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-4"
                    style={{ background: '#151922', border: `1px solid ${BORDER}` }}
                  >
                    <p className="mb-2 text-lg">💡</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Conseil</p>
                    <p className="mt-3 text-sm leading-relaxed text-white/80">
                      {lastAnalysis.globalInsights.advice}
                    </p>
                  </div>
                </div>
              </section>

              {lastAnalysis.nicheHint ? (
                <p className="text-center text-xs text-white/40">
                  Niche indiquée : <span className="text-white/70">{lastAnalysis.nicheHint}</span>
                </p>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 rounded-lg border px-4 py-3 text-sm text-white shadow-xl"
          style={{ background: '#1a1f2e', borderColor: BORDER }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
