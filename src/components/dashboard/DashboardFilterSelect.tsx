'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type DashboardFilterOption = { value: string; label: string };

type DashboardFilterSelectProps = {
  id: string;
  /** Libellé au-dessus du bouton (ignoré si `hideLabel`) */
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: DashboardFilterOption[];
  /** Largeur max du déclencheur (ex. sm:max-w-[280px]) */
  triggerClassName?: string;
  /** Ne pas afficher le label visuel (utiliser `triggerAriaLabel` pour l’accessibilité) */
  hideLabel?: boolean;
  /** `aria-label` du bouton quand le label visuel est masqué */
  triggerAriaLabel?: string;
};

/**
 * Liste déroulante stylée (noir / blanc / bleu Etsmart) — remplace un &lt;select&gt; natif
 * pour un rendu cohérent sur tous les navigateurs.
 */
export function DashboardFilterSelect({
  id,
  label = '',
  value,
  onChange,
  options,
  triggerClassName = '',
  hideLabel = false,
  triggerAriaLabel,
}: DashboardFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = `${id}-listbox`;

  const selected = options.find((o) => o.value === value) ?? options[0];
  const displayLabel = selected?.label ?? '';

  const close = useCallback(() => {
    setOpen(false);
    setHighlighted(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const pick = (v: string) => {
    onChange(v);
    close();
  };

  return (
    <div ref={rootRef} className={`relative ${triggerClassName}`}>
      {!hideLabel && label ? (
        <label htmlFor={id} className="text-xs text-white/50">
          {label}
        </label>
      ) : null}
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={hideLabel ? (triggerAriaLabel ?? 'Choisir une option') : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`${hideLabel || !label ? '' : 'mt-1 '}flex w-full min-h-[48px] cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/12 bg-black px-4 py-3.5 text-left text-sm font-medium text-[#00d4ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-[#00d4ff]/35 hover:shadow-[0_0_24px_-8px_rgba(0,212,255,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
      >
        <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${open ? 'rotate-180 text-[#00d4ff]' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={hideLabel ? undefined : id}
          aria-label={hideLabel ? (triggerAriaLabel ?? 'Options') : undefined}
          className="absolute left-0 right-0 top-full z-[120] mt-2 max-h-[min(320px,55vh)] overflow-y-auto rounded-xl border border-white/12 bg-black py-2 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.9),0_0_0_1px_rgba(0,212,255,0.08)] custom-scrollbar"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isHi = highlighted === i;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlighted(i)}
                onMouseLeave={() => setHighlighted(-1)}
                onClick={() => pick(opt.value)}
                className={`mx-1.5 flex min-h-[48px] w-[calc(100%-12px)] items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors duration-150 ${
                  isSelected
                    ? 'bg-[#0088b3] font-semibold text-white shadow-[0_4px_18px_-4px_rgba(0,180,230,0.45)] ring-1 ring-inset ring-white/15'
                    : isHi
                      ? 'bg-white/[0.07] text-[#00d4ff]'
                      : 'text-white/80 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center ${
                    isSelected ? 'text-white' : 'text-transparent'
                  }`}
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                </span>
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
