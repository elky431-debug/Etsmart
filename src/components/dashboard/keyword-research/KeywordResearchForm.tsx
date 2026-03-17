'use client';

import { FormEvent } from 'react';
import { Loader2, Search } from 'lucide-react';

interface Props {
  keyword: string;
  onKeywordChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
}

export function KeywordResearchForm({ keyword, onKeywordChange, onSubmit, loading }: Props) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6 space-y-4"
    >
      <div>
        <label className="block text-xs uppercase tracking-wider text-white/60 mb-2 font-semibold">
          Enter a keyword
        </label>
        <input
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="Ex: birthday gift for mom"
          className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/40"
        />
      </div>
      <button
        type="submit"
        disabled={loading || keyword.trim().length < 2}
        className="w-full rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black font-semibold py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyse en cours...
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            Analyze Keyword
          </>
        )}
      </button>
    </form>
  );
}
