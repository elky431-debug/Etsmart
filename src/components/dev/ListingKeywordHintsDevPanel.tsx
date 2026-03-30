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

  const isLocalDev = process.env.NODE_ENV === 'development';

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-950/35 p-3 shadow-sm shadow-black/20">
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-500/15">
          <Hash className="h-4 w-4 text-amber-200/90" strokeWidth={2.25} />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {isLocalDev ? (
              <span className="rounded bg-amber-500/25 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-amber-100/90">
                Dev
              </span>
            ) : (
              <span className="rounded bg-white/10 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide text-white/70">
                Optionnel
              </span>
            )}
            <h3 className="text-sm font-semibold text-white">Mots-clés listing</h3>
          </div>
          <p className="text-[11px] leading-snug text-white/65">
            Niche ou ambiance à faire apparaître dans le{' '}
            <span className="font-medium text-white/85">titre</span>, les{' '}
            <span className="font-medium text-white/85">tags</span> et la{' '}
            <span className="font-medium text-white/85">description</span> si la photo ne suffit pas (ex.{' '}
            <span className="text-white/75">minimaliste, artisanal, tons neutres</span>).
          </p>

          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            maxLength={400}
            className="max-h-24 min-h-[2.75rem] w-full resize-y rounded-lg border border-amber-400/25 bg-black/55 px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/25"
            placeholder="Ex. scandinave, fait main, cadeau personnalisé…"
          />
          <div className="flex items-center justify-between gap-2 text-[10px] text-white/40">
            <span>{value.length}/400</span>
            {isLocalDev ? <span>npm run dev</span> : null}
          </div>

          {children ? <div className="flex flex-wrap gap-2 pt-1">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
