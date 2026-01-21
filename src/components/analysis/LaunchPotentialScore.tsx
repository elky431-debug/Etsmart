'use client';

import { motion } from 'framer-motion';
import { Sparkles, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { LaunchPotentialScore as LaunchPotentialScoreType } from '@/types';

interface LaunchPotentialScoreProps {
  score: LaunchPotentialScoreType;
}

export function LaunchPotentialScore({ score }: LaunchPotentialScoreProps) {
  const getScoreColors = () => {
    if (score.tier === 'favorable') {
      return {
        bg: 'bg-gradient-to-br from-green-50 via-green-50/50 to-white',
        border: 'border-green-300',
        shadow: 'shadow-green-200/50',
        glow: 'bg-gradient-to-r from-green-400/20 to-green-600/20',
        iconBg: 'bg-gradient-to-br from-green-500 to-green-600',
        text: 'text-green-800',
        badgeBg: 'bg-white/90 border-green-300 text-green-800',
        scoreText: 'text-green-700',
      };
    } else if (score.tier === 'competitive') {
      return {
        bg: 'bg-gradient-to-br from-amber-50 via-amber-50/50 to-white',
        border: 'border-amber-300',
        shadow: 'shadow-amber-200/50',
        glow: 'bg-gradient-to-r from-amber-400/20 to-amber-600/20',
        iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
        text: 'text-amber-800',
        badgeBg: 'bg-white/90 border-amber-300 text-amber-800',
        scoreText: 'text-amber-700',
      };
    } else {
      return {
        bg: 'bg-gradient-to-br from-red-50 via-red-50/50 to-white',
        border: 'border-red-300',
        shadow: 'shadow-red-200/50',
        glow: 'bg-gradient-to-r from-red-400/20 to-red-600/20',
        iconBg: 'bg-gradient-to-br from-red-500 to-red-600',
        text: 'text-red-800',
        badgeBg: 'bg-white/90 border-red-300 text-red-800',
        scoreText: 'text-red-700',
      };
    }
  };

  const colors = getScoreColors();

  const getIcon = () => {
    if (score.tier === 'favorable') {
      return <CheckCircle2 size={32} className="text-white" />;
    } else if (score.tier === 'competitive') {
      return <AlertCircle size={32} className="text-white" />;
    } else {
      return <XCircle size={32} className="text-white" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, type: 'spring' }}
      className={`relative overflow-hidden p-8 rounded-3xl border-2 shadow-xl ${colors.bg} ${colors.border} ${colors.shadow}`}
    >
      {/* Effet de glow */}
      <div className={`absolute inset-0 opacity-20 ${colors.glow} blur-3xl`} />
      
      <div className="relative z-10">
        {/* Header avec badge */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${colors.iconBg}`}
            >
              {getIcon()}
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Launch Potential Score</h2>
              <p className="text-sm text-slate-600">Market opportunity assessment</p>
            </div>
          </div>
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className={`text-4xl font-black ${colors.scoreText}`}
          >
            {score.badge}
          </motion.span>
        </div>

        {/* Score principal */}
        <div className="mb-6">
          <div className="flex items-baseline gap-3 mb-2">
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
              className={`text-6xl font-black ${colors.scoreText}`}
            >
              {score.score.toFixed(1)}
            </motion.span>
            <span className="text-2xl font-bold text-slate-400">/ 10</span>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`text-lg font-bold ${colors.text} mb-2`}
          >
            {score.verdict}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-sm text-slate-600 leading-relaxed"
          >
            {score.explanation}
          </motion.p>
        </div>

        {/* Barre de progression visuelle */}
        <div className="mb-4">
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(score.score / 10) * 100}%` }}
              transition={{ delay: 0.7, duration: 1, ease: 'easeOut' }}
              className={`h-full ${colors.iconBg} rounded-full`}
            />
          </div>
        </div>

        {/* Texte explicatif obligatoire */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="p-4 rounded-lg bg-slate-50 border border-slate-200"
        >
          <p className="text-xs text-slate-600 leading-relaxed italic">
            This score reflects an overall evaluation of market saturation and competition within the product's niche. 
            It is an estimate designed to support decision-making and does not guarantee results.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

