'use client';

import { Clock3, Eye } from 'lucide-react';
import { KeywordResearchHistoryItem } from '@/lib/keyword-research/types';
import { difficultyBadgeClass, verdictBadgeClass } from '@/lib/keyword-research/formatters';

interface Props {
  items: KeywordResearchHistoryItem[];
  loading: boolean;
  onSelect: (item: KeywordResearchHistoryItem) => void;
  selectedId?: string | null;
}

export function KeywordResearchHistory({ items, loading, onSelect, selectedId }: Props) {
  const history = items ?? [];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Historique des recherches</h3>
        <span className="text-xs text-white/50">{history.length} entrée(s)</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-white/55 text-sm">
          Aucune recherche sauvegardée pour le moment.
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className={`w-full text-left rounded-xl border p-3 transition ${
                selectedId === item.id
                  ? 'border-[#00d4ff]/55 bg-[#00d4ff]/10'
                  : 'border-white/10 bg-black/25 hover:border-[#00d4ff]/35'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{item.keyword}</p>
                  <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
                    <Clock3 className="w-3.5 h-3.5" />
                    {new Date(item.createdAt).toLocaleString('fr-FR')}
                  </div>
                </div>
                <Eye className="w-4 h-4 text-white/40 flex-shrink-0" />
              </div>
              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                <span className={`px-2 py-0.5 rounded-full border ${verdictBadgeClass(item.verdict)}`}>
                  {item.verdict}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full border ${difficultyBadgeClass(item.difficulty)}`}
                >
                  {item.difficulty}
                </span>
                <span className="px-2 py-0.5 rounded-full border border-white/15 text-white/70">
                  Opp {item.opportunityScore}/100
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
