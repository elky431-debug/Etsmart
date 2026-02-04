'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  RefreshCw,
  ChevronDown,
  Check
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import type { ProductAnalysis, Verdict, Niche } from '@/types';
import { getNicheById } from '@/lib/niches';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DashboardHistoryProps {
  analyses: ProductAnalysis[];
  onAnalysisClick: (analysis: ProductAnalysis) => void;
  onDeleteAnalysis: (productId: string) => void;
  onRefresh: () => Promise<void>;
}

interface FilterDropdownProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: React.ComponentType<{ size?: number; className?: string }> }[];
  placeholder?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
}

function FilterDropdown<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  icon: Icon,
  className = '',
}: FilterDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative w-full px-4 py-3.5 pr-11
          bg-white/5
          border-2 rounded-lg
          font-semibold text-white
          transition-all duration-300 ease-out
          flex items-center gap-3
          backdrop-blur-sm
          ${isOpen 
            ? 'border-[#00d4ff] shadow-xl shadow-[#00d4ff]/25 ring-2 ring-[#00d4ff]/30 bg-white/10' 
            : 'border-white/10 hover:border-[#00d4ff]/60 hover:shadow-lg hover:shadow-[#00d4ff]/10'
          }
        `}
      >
        {/* Icon */}
        {Icon && (
          <Icon 
            size={18} 
            className={`transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-white/60'}`} 
          />
        )}
        
        {/* Selected value */}
        <span className="flex-1 text-left">
          {selectedOption?.label || placeholder}
        </span>

        {/* Chevron icon */}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute right-3"
        >
          <ChevronDown 
            size={18} 
            className={`transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-white/60'}`} 
          />
        </motion.div>

        {/* Gradient overlay when open */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-gradient-to-r from-[#00d4ff]/5 to-[#00c9b7]/5 rounded-xl pointer-events-none"
          />
        )}
      </motion.button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 z-50
              bg-black rounded-lg border-2 border-white/10
              shadow-2xl shadow-[#00d4ff]/15
              overflow-hidden
              backdrop-blur-xl"
          >
            <div className="max-h-64 overflow-y-auto">
              {options.map((option, index) => {
                const OptionIcon = option.icon;
                const isSelected = option.value === value;
                
                return (
                  <motion.button
                    key={option.value}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ backgroundColor: 'rgba(0, 212, 255, 0.05)' }}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full px-4 py-3.5 text-left
                      flex items-center gap-3
                      transition-all duration-200 ease-out
                      relative group
                      ${isSelected 
                        ? 'bg-gradient-to-r from-[#00d4ff]/15 via-[#00d4ff]/10 to-[#00c9b7]/15 border-l-4 border-[#00d4ff]' 
                        : 'hover:bg-white/5'
                      }
                    `}
                  >
                    {/* Option icon */}
                    {OptionIcon && (
                      <OptionIcon 
                        size={16} 
                        className={`transition-colors ${
                          isSelected ? 'text-[#00d4ff]' : 'text-white/60 group-hover:text-[#00d4ff]'
                        }`} 
                      />
                    )}
                    
                    {/* Option label */}
                    <span className={`flex-1 font-medium ${
                      isSelected ? 'text-[#00d4ff]' : 'text-white/80'
                    }`}>
                      {option.label}
                    </span>

                    {/* Checkmark for selected */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center"
                      >
                        <Check size={12} className="text-white" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

  // Helper function to determine verdict from score
  const getVerdictFromScore = (analysis: ProductAnalysis): Verdict => {
    // Get the score (Launch Potential Score or confidence score)
    const launchScore = analysis.competitors?.launchPotentialScore?.score;
    const confidenceScore = analysis.verdict?.confidenceScore;
    
    // Use launch score if available, otherwise use confidence score / 10
    const score = launchScore !== undefined ? launchScore : (confidenceScore ? confidenceScore / 10 : 5);
    
    // Determine verdict based on score:
    // - launch (green): score >= 7
    // - test (orange): score >= 4 and < 7
    // - avoid (red): score < 4
    if (score >= 7) return 'launch';
    if (score >= 4) return 'test';
    return 'avoid';
  };

  const filteredAnalyses = useMemo(() => {
    return analyses.filter(analysis => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        analysis.product?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        analysis.verdict?.summary?.toLowerCase().includes(searchQuery.toLowerCase());

      // Verdict filter - based on SCORE for accurate filtering
      let matchesVerdict = true;
      if (verdictFilter !== 'all') {
        const derivedVerdict = getVerdictFromScore(analysis);
        matchesVerdict = derivedVerdict === verdictFilter;
      }

      // Niche filter
      const matchesNiche = nicheFilter === 'all' || analysis.niche === nicheFilter;

      return matchesSearch && matchesVerdict && matchesNiche;
    });
  }, [analyses, searchQuery, verdictFilter, nicheFilter]);

  const getScoreDisplay = (score: number) => {
    // Score sur 10, converti en note sur 10
    const note = score / 10;
    
    if (note < 3.9) {
      return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/50',
      };
    } else if (note >= 4 && note <= 7) {
      return {
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500/50',
      };
    } else {
      return {
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        borderColor: 'border-green-500/50',
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
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Eye className="w-10 h-10 text-white/60" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Aucune analyse pour le moment
            </h2>
            <p className="text-white/70 mb-6">
              Commencez par analyser un produit pour voir votre historique ici.
            </p>
            <a
              href="/app"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
            >
              Analyser un produit
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
          <h1 className="text-3xl font-bold text-white mb-2">Historique des analyses</h1>
          <p className="text-white/70">
            {analyses.length} {analyses.length === 1 ? 'produit analysé' : 'produits analysés'}
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
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-4 py-3 bg-white/5 border-2 border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all text-white placeholder:text-white/40"
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-3">
            {/* Verdict filter */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-white/60 flex-shrink-0" />
              <FilterDropdown
                value={verdictFilter}
                onChange={(value) => setVerdictFilter(value as Verdict | 'all')}
                options={[
                  { value: 'all' as const, label: 'Tous les verdicts', icon: Filter },
                  { value: 'launch' as const, label: 'Lancer', icon: CheckCircle2 },
                  { value: 'test' as const, label: 'Tester', icon: AlertTriangle },
                  { value: 'avoid' as const, label: 'Éviter', icon: XCircle },
                ]}
                className="min-w-[180px]"
              />
            </div>

            {/* Niche filter */}
            <FilterDropdown
              value={nicheFilter}
              onChange={(value) => setNicheFilter(value as Niche | 'all')}
              options={[
                { value: 'all' as const, label: 'Toutes les niches', icon: Tag },
                ...Array.from(new Set(analyses.map(a => a.niche))).map(niche => {
                  const nicheInfo = getNicheById(niche);
                  return {
                    value: niche as Niche,
                    label: nicheInfo?.name || niche,
                    icon: Tag,
                  };
                }),
              ]}
              className="min-w-[180px]"
            />
          </div>
        </div>

        {/* Results count */}
        {filteredAnalyses.length !== analyses.length && (
          <div className="mb-4 text-sm text-white/70">
            {filteredAnalyses.length} {filteredAnalyses.length === 1 ? 'résultat' : 'résultats'}
          </div>
        )}

        {/* Products list */}
        <div className="space-y-4">
          {filteredAnalyses.map((analysis, index) => {
            // Utiliser Launch Potential Score si disponible, sinon confidenceScore/10
            const launchScore = analysis.competitors.launchPotentialScore?.score;
            const score = launchScore !== undefined ? launchScore : (analysis.verdict.confidenceScore / 10);
            // Pour le code couleur, multiplier par 10 pour avoir la valeur sur 100
            const scoreForColor = launchScore !== undefined ? launchScore * 10 : analysis.verdict.confidenceScore;
            const scoreDisplay = getScoreDisplay(scoreForColor);
            const nicheInfo = getNicheById(analysis.niche);

            return (
              <motion.div
                key={analysis.product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onAnalysisClick(analysis)}
                className="bg-white/5 rounded-lg border-2 border-white/10 p-6 hover:border-[#00d4ff] hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="flex gap-6">
                  {/* Product image */}
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 rounded-lg bg-white/5 overflow-hidden">
                      {analysis.product.images[0] ? (
                        <img
                          src={analysis.product.images[0]}
                          alt={analysis.product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/40">
                          <Tag size={32} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white mb-1 truncate">
                          {analysis.product.title}
                        </h3>
                        <p className="text-sm text-white/70 mb-3 line-clamp-2">
                          {analysis.verdict.summary || 'Analyse complète disponible'}
                        </p>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
                          <div className="flex items-center gap-1.5">
                            <Tag size={14} />
                            <span>{nicheInfo?.name || analysis.niche}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} />
                            <span>
                              {format(new Date(analysis.analyzedAt), 'd MMM yyyy', { locale: fr })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span>{analysis.competitors.totalCompetitors} concurrents</span>
                          </div>
                        </div>
                      </div>

                      {/* Score badge */}
                      <div className="flex-shrink-0">
                        <div className={`
                          px-4 py-2 rounded-lg border-2 ${scoreDisplay.borderColor} ${scoreDisplay.bgColor}
                          flex items-center gap-2
                        `}>
                          <span className={`text-lg font-bold ${scoreDisplay.color}`}>
                            {score.toFixed(1)}/10
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
                      className="p-2 rounded-lg bg-white/5 hover:bg-[#00d4ff] hover:text-white transition-colors group-hover:bg-[#00d4ff] group-hover:text-white text-white/80"
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
                          : 'bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-white/80'
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
            <p className="text-white/70">Aucun résultat trouvé pour ces filtres.</p>
          </div>
        )}
      </div>
    </div>
  );
}

