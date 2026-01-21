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
import { enUS } from 'date-fns/locale';

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
          bg-gradient-to-br from-white via-white to-slate-50
          border-2 rounded-xl
          font-semibold text-slate-900
          transition-all duration-300 ease-out
          flex items-center gap-3
          backdrop-blur-sm
          ${isOpen 
            ? 'border-[#00d4ff] shadow-xl shadow-[#00d4ff]/25 ring-2 ring-[#00d4ff]/30 bg-gradient-to-br from-[#00d4ff]/5 via-white to-[#00c9b7]/5' 
            : 'border-slate-200 hover:border-[#00d4ff]/60 hover:shadow-lg hover:shadow-[#00d4ff]/10'
          }
        `}
      >
        {/* Icon */}
        {Icon && (
          <Icon 
            size={18} 
            className={`transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-slate-500'}`} 
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
            className={`transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-slate-400'}`} 
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
              bg-white rounded-xl border-2 border-slate-200
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
                        : 'hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-50/50'
                      }
                    `}
                  >
                    {/* Option icon */}
                    {OptionIcon && (
                      <OptionIcon 
                        size={16} 
                        className={`transition-colors ${
                          isSelected ? 'text-[#00d4ff]' : 'text-slate-400 group-hover:text-[#00d4ff]'
                        }`} 
                      />
                    )}
                    
                    {/* Option label */}
                    <span className={`flex-1 font-medium ${
                      isSelected ? 'text-[#00d4ff]' : 'text-slate-700'
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
    if (competitors <= 100) {
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
              <Filter size={18} className="text-slate-500 flex-shrink-0" />
              <FilterDropdown
                value={verdictFilter}
                onChange={(value) => setVerdictFilter(value as Verdict | 'all')}
                options={[
                  { value: 'all' as const, label: 'All verdicts', icon: Filter },
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
                { value: 'all' as const, label: 'All niches', icon: Tag },
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

