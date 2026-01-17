'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Trash2, 
  Eye, 
  Calendar,
  Tag,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import type { ProductAnalysis, Verdict, Niche } from '@/types';
import { getNicheById } from '@/lib/niches';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';

interface DashboardHistoryProps {
  analyses: ProductAnalysis[];
  onAnalysisClick: (analysis: ProductAnalysis) => void;
  onDeleteAnalysis: (productId: string) => void;
  onRefresh: () => Promise<void>;
}

export function DashboardHistory({ 
  analyses, 
  onAnalysisClick, 
  onDeleteAnalysis,
  onRefresh
}: DashboardHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<Verdict | 'all'>('all');
  const [nicheFilter, setNicheFilter] = useState<Niche | 'all'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const filteredAnalyses = useMemo(() => {
    return analyses.filter(analysis => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        analysis.product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        analysis.verdict.summary.toLowerCase().includes(searchQuery.toLowerCase());

      // Verdict filter
      const matchesVerdict = verdictFilter === 'all' || analysis.verdict.verdict === verdictFilter;

      // Niche filter
      const matchesNiche = nicheFilter === 'all' || analysis.niche === nicheFilter;

      return matchesSearch && matchesVerdict && matchesNiche;
    });
  }, [analyses, searchQuery, verdictFilter, nicheFilter]);

  const getVerdictDisplay = (verdict: Verdict, competitors: number) => {
    if (competitors <= 80) {
      return {
        label: 'LAUNCH QUICKLY',
        color: 'bg-green-600',
        icon: CheckCircle2,
        textColor: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    } else if (competitors <= 130) {
      return {
        label: 'LAUNCH BUT OPTIMIZE',
        color: 'bg-amber-500',
        icon: AlertTriangle,
        textColor: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
      };
    } else {
      return {
        label: 'DON\'T LAUNCH',
        color: 'bg-red-500',
        icon: XCircle,
        textColor: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    }
  };

  const handleDelete = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (showDeleteConfirm === productId) {
      onDeleteAnalysis(productId);
      setShowDeleteConfirm(null);
    } else {
      setShowDeleteConfirm(productId);
      setTimeout(() => setShowDeleteConfirm(null), 3000);
    }
  };

  if (analyses.length === 0) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Eye className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              No analysis yet
            </h2>
            <p className="text-slate-600 mb-6">
              Start by analyzing a product to see your history here.
            </p>
            <a
              href="/app"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              Analyze a product
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Analysis History</h1>
          <p className="text-slate-600">
            {analyses.length} {analyses.length === 1 ? 'product analyzed' : 'products analyzed'}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <Logo size="sm" showText={false} />
            </div>
            <input
              type="text"
              placeholder="Search for a product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-3">
            {/* Verdict filter */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-500" />
              <select
                value={verdictFilter}
                onChange={(e) => setVerdictFilter(e.target.value as Verdict | 'all')}
                className="px-4 py-2 bg-white border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
              >
                <option value="all">All verdicts</option>
                <option value="launch">Lancer</option>
                <option value="test">Tester</option>
                <option value="avoid">Éviter</option>
              </select>
            </div>

            {/* Niche filter */}
            <select
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value as Niche | 'all')}
              className="px-4 py-2 bg-white border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
            >
              <option value="all">All niches</option>
              {Array.from(new Set(analyses.map(a => a.niche))).map(niche => {
                const nicheInfo = getNicheById(niche);
                return (
                  <option key={niche} value={niche}>
                    {nicheInfo?.name || niche}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Results count */}
        {filteredAnalyses.length !== analyses.length && (
          <div className="mb-4 text-sm text-slate-600">
            {filteredAnalyses.length} {filteredAnalyses.length === 1 ? 'result' : 'results'}
          </div>
        )}

        {/* Products list */}
        <div className="space-y-4">
          {filteredAnalyses.map((analysis, index) => {
            const verdictDisplay = getVerdictDisplay(analysis.verdict.verdict, analysis.competitors.totalCompetitors);
            const VerdictIcon = verdictDisplay.icon;
            const nicheInfo = getNicheById(analysis.niche);

            return (
              <motion.div
                key={analysis.product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onAnalysisClick(analysis)}
                className="bg-white rounded-xl border-2 border-slate-200 p-6 hover:border-[#00d4ff] hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="flex gap-6">
                  {/* Product image */}
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 rounded-lg bg-slate-100 overflow-hidden">
                      {analysis.product.images[0] ? (
                        <img
                          src={analysis.product.images[0]}
                          alt={analysis.product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Tag size={32} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 mb-1 truncate">
                          {analysis.product.title}
                        </h3>
                        <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                          {analysis.verdict.summary || 'Complete analysis available'}
                        </p>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Tag size={14} />
                            <span>{nicheInfo?.name || analysis.niche}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} />
                            <span>
                              {format(new Date(analysis.analyzedAt), 'MMM d, yyyy', { locale: enUS })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span>{analysis.competitors.totalCompetitors} competitors</span>
                          </div>
                        </div>
                      </div>

                      {/* Verdict badge */}
                      <div className="flex-shrink-0">
                        <div className={`
                          px-4 py-2 rounded-lg border-2 ${verdictDisplay.borderColor} ${verdictDisplay.bgColor}
                          flex items-center gap-2
                        `}>
                          <VerdictIcon size={18} className={verdictDisplay.textColor} />
                          <span className={`text-sm font-bold ${verdictDisplay.textColor}`}>
                            {verdictDisplay.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-start gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnalysisClick(analysis);
                      }}
                      className="p-2 rounded-lg bg-slate-100 hover:bg-[#00d4ff] hover:text-white transition-colors group-hover:bg-[#00d4ff] group-hover:text-white"
                      title="Voir l'analyse complète"
                    >
                      <Eye size={20} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(analysis.product.id, e)}
                      className={`
                        p-2 rounded-lg transition-colors
                        ${showDeleteConfirm === analysis.product.id
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-100 hover:bg-red-100 hover:text-red-600'
                        }
                      `}
                      title="Supprimer"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredAnalyses.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-600">Aucun résultat trouvé avec ces filtres.</p>
          </div>
        )}
      </div>
    </div>
  );
}

