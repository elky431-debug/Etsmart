'use client';

import { Check } from 'lucide-react';
import { IMAGE_STYLE_PRESETS, type ImageStyleId } from '@/lib/image-style-presets';

export type { ImageStyleId };

type ImageStyleCardsProps = {
  value: ImageStyleId;
  onChange: (id: ImageStyleId) => void;
  variant?: 'quick' | 'compact';
};

export function ImageStyleCards({ value, onChange, variant = 'quick' }: ImageStyleCardsProps) {
  const compact = variant === 'compact';

  return (
    <div
      className={
        compact
          ? 'grid max-h-[min(48vh,280px)] grid-cols-2 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-3 sm:gap-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1'
          : 'grid max-h-[min(52vh,300px)] grid-cols-2 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-3 sm:gap-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1'
      }
    >
      {IMAGE_STYLE_PRESETS.map((s) => {
        const selected = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(s.id)}
            className={`group relative flex flex-col items-center rounded-lg border text-center transition-all duration-200 ${
              compact ? 'px-1.5 py-1.5 pt-2' : 'px-2 py-2 pt-2.5'
            } ${
              selected
                ? 'border-[#00d4ff]/50 bg-gradient-to-b from-[#00d4ff]/15 to-zinc-950/90 shadow-md shadow-[#00d4ff]/15 ring-1 ring-[#00d4ff]/35'
                : 'border-white/10 bg-zinc-900/40 hover:border-[#00d4ff]/30 hover:bg-zinc-800/50'
            }`}
          >
            <span
              className={`absolute right-1 top-1 flex items-center justify-center rounded-full border transition-colors ${
                compact ? 'h-3 w-3 border-[1.5px]' : 'h-3.5 w-3.5 border-2'
              } ${
                selected
                  ? 'border-[#00d4ff] bg-[#00d4ff]/20'
                  : 'border-zinc-600 bg-zinc-950/90 group-hover:border-zinc-500'
              }`}
              aria-hidden
            >
              {selected ? (
                <Check className={`text-[#00d4ff] ${compact ? 'h-2 w-2' : 'h-2.5 w-2.5'}`} strokeWidth={3} />
              ) : null}
            </span>

            <span
              className={`mb-0.5 flex select-none items-center justify-center rounded-md border border-white/5 bg-black/20 shadow-inner ${
                compact ? 'px-1 py-0.5 text-lg' : 'px-1.5 py-0.5 text-xl'
              }`}
              aria-hidden
            >
              {s.emoji}
            </span>
            <span
              className={`line-clamp-2 font-semibold leading-[1.15] text-white ${
                compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-xs'
              }`}
            >
              {s.label}
            </span>
            <span
              className={`mt-0.5 line-clamp-1 text-zinc-500 ${
                compact ? 'text-[8px] sm:text-[9px]' : 'text-[8px] sm:text-[10px]'
              }`}
            >
              {s.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
