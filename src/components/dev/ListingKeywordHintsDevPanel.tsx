'use client';

import type { ReactNode } from 'react';
import { Hash } from 'lucide-react';
import { listingKeywordHintsDevEnabled } from '@/lib/listing-keyword-hints-dev';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Ex. bouton « Régénérer » sur l’onglet Listing */
  children?: ReactNode;
};

/**
 * Panneau dev (NODE_ENV=development) : mots-clés / style pour enrichir titre, tags, description.
 */
export function ListingKeywordHintsDevPanel({ value, onChange, children }: Props) {
  if (!listingKeywordHintsDevEnabled()) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/45 bg-gradient-to-br from-amber-500/20 via-amber-600/[0.12] to-black/70 p-5 sm:p-6 shadow-[0_0_40px_-8px_rgba(251,191,36,0.35)] ring-1 ring-amber-300/25">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl"
        aria-hidden
      />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-16 w-40 rounded-full bg-[#00d4ff]/10 blur-2xl" aria-hidden />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/30 to-amber-600/20 border border-amber-300/40 shadow-inner">
          <Hash className="h-6 w-6 text-amber-100" strokeWidth={2.25} />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-amber-400/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-100 ring-1 ring-amber-300/30">
              Dev · local
            </span>
            <h3 className="text-base font-bold text-white sm:text-lg">Mots-clés pour le listing</h3>
          </div>
          <p className="text-sm leading-relaxed text-white/80">
            Indique le style ou la niche que la photo ne montre pas assez (ex.{' '}
            <span className="text-amber-100/95">Y2K</span>, streetwear). Ce sera intégré au{' '}
            <span className="font-semibold text-white">titre</span>, aux{' '}
            <span className="font-semibold text-white">tags</span> et à la{' '}
            <span className="font-semibold text-white">description</span>.
          </p>

          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            maxLength={400}
            className="w-full resize-y rounded-xl border border-amber-400/35 bg-black/60 px-4 py-3 text-sm text-white shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)] placeholder:text-white/35 focus:border-amber-400/70 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            placeholder="Ex. Y2K, low rise, 2000s, metallic, baggy jeans…"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-200/70">
            <span>{value.length}/400 caractères</span>
            <span className="text-white/45">Visible uniquement en npm run dev</span>
          </div>

          {children ? <div className="flex flex-wrap gap-2 pt-1">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
