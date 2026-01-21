'use client';

import { motion } from 'framer-motion';
import { 
  CheckCircle2,
  AlertTriangle,
  Shield,
  Lightbulb,
  ArrowUpRight,
  TrendingUp, 
  Sparkles,
  Copy,
  Tag,
  Target,
  Check
} from 'lucide-react';
import { Badge } from '@/components/ui';
import type { ProductVerdict } from '@/types';
import { useState } from 'react';

interface VerdictCardProps {
  verdict: ProductVerdict;
  competitors?: number;
}

export function VerdictCard({ verdict, competitors }: VerdictCardProps) {
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);

  const copyToClipboard = (text: string, type: 'title' | 'tags') => {
    navigator.clipboard.writeText(text);
    if (type === 'title') {
      setCopiedTitle(true);
      setTimeout(() => setCopiedTitle(false), 2000);
    } else {
      setCopiedTags(true);
      setTimeout(() => setCopiedTags(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Comment */}
      {verdict.aiComment && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-violet-500/5 border border-violet-500/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-violet-400 font-medium mb-1">Analyse IA</p>
              <p className="text-slate-300 text-sm">{verdict.aiComment}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Difficulty & Competition */}
      {(verdict.difficultyAnalysis || verdict.competitionComment) && (
        <div className="grid md:grid-cols-2 gap-4">
          {verdict.difficultyAnalysis && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 rounded-xl bg-slate-900/30 border border-white/5"
            >
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-amber-400" />
                <span className="text-xs font-medium text-white">Difficulté</span>
              </div>
              <p className="text-slate-400 text-sm">{verdict.difficultyAnalysis}</p>
            </motion.div>
          )}
          
          {verdict.competitionComment && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 rounded-xl bg-slate-900/30 border border-white/5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-cyan-400" />
                <span className="text-xs font-medium text-white">Concurrence</span>
              </div>
              <p className="text-slate-400 text-sm">{verdict.competitionComment}</p>
            </motion.div>
          )}
        </div>
      )}

      {/* Viral Title */}
      {verdict.viralTitleEN && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-[#00d4ff]/5 border border-[#00d4ff]/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#00c9b7]" />
              <span className="text-sm font-medium text-white">SEO Title</span>
            </div>
            <button
              onClick={() => copyToClipboard(verdict.viralTitleEN!, 'title')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#00d4ff]/10 text-[#00c9b7] text-xs hover:bg-[#00d4ff]/20 transition-colors"
            >
              {copiedTitle ? <Check size={12} /> : <Copy size={12} />}
              {copiedTitle ? 'Copied' : 'Copy'}
            </button>
          </div>
          
          <div className="p-4 rounded-lg bg-slate-900/50 mb-3">
            <p className="text-xs text-slate-500 mb-1">EN</p>
            <p className="text-white">{verdict.viralTitleEN}</p>
          </div>
          
          {verdict.viralTitleFR && (
            <div className="p-4 rounded-lg bg-slate-900/30">
              <p className="text-xs text-slate-500 mb-1">FR</p>
              <p className="text-slate-300 text-sm">{verdict.viralTitleFR}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* SEO Tags */}
      {verdict.seoTags && verdict.seoTags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-slate-900/30 border border-white/5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-cyan-400" />
              <span className="text-sm font-medium text-white">Tags ({verdict.seoTags.length})</span>
            </div>
            <button
              onClick={() => copyToClipboard(verdict.seoTags!.join(', '), 'tags')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:text-white transition-colors"
            >
              {copiedTags ? <Check size={12} /> : <Copy size={12} />}
              {copiedTags ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {verdict.seoTags.map((tag, idx) => (
              <Badge key={idx} variant="default" size="sm">{tag}</Badge>
            ))}
          </div>
        </motion.div>
      )}

      {/* Strengths & Risks */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-5 rounded-xl bg-[#00d4ff]/5 border border-[#00d4ff]/20"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[#00c9b7]" />
            <span className="text-sm font-medium text-[#4dd9cc]">Points forts</span>
          </div>
          <ul className="space-y-2">
            {verdict.strengths.map((strength, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle2 size={14} className="text-[#00c9b7] mt-0.5 flex-shrink-0" />
                {strength}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-5 rounded-xl bg-rose-500/5 border border-rose-500/20"
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-rose-400" />
            <span className="text-sm font-medium text-rose-300">Risques</span>
          </div>
          <ul className="space-y-2">
            {verdict.risks.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                <AlertTriangle size={14} className="text-rose-400 mt-0.5 flex-shrink-0" />
                {risk}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Launch Tips */}
      {verdict.launchTips && verdict.launchTips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-violet-500/5 border border-violet-500/20"
        >
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={16} className="text-violet-400" />
            <span className="text-sm font-medium text-violet-300">Conseils</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {verdict.launchTips.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-slate-900/30">
                <ArrowUpRight size={14} className="text-violet-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-slate-300">{tip}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
