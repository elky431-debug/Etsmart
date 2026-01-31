'use client';

import { motion } from 'framer-motion';
import { Sparkles, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { LaunchPotentialScore as LaunchPotentialScoreType } from '@/types';

interface LaunchPotentialScoreProps {
  score: LaunchPotentialScoreType;
}

export function LaunchPotentialScore({ score }: LaunchPotentialScoreProps) {
  // Couleurs dynamiques basées sur le score
  // 0-3: Rouge, 4-6: Orange, 7-10: Vert
  const getScoreColors = () => {
    if (score.score <= 3) {
      return {
        bg: 'bg-gradient-to-br from-red-500/10 via-red-500/5 to-white',
        border: 'border-red-500/30',
        shadow: 'shadow-red-500/20',
        glow: 'bg-gradient-to-r from-red-500/20 to-red-400/20',
        iconBg: 'bg-gradient-to-br from-red-500 to-red-600',
        text: 'text-slate-800',
        badgeBg: 'bg-white/90 border-red-500/30 text-slate-800',
        scoreText: 'text-red-500',
      };
    } else if (score.score <= 6) {
      return {
        bg: 'bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-white',
        border: 'border-orange-500/30',
        shadow: 'shadow-orange-500/20',
        glow: 'bg-gradient-to-r from-orange-500/20 to-amber-400/20',
        iconBg: 'bg-gradient-to-br from-orange-500 to-amber-500',
        text: 'text-slate-800',
        badgeBg: 'bg-white/90 border-orange-500/30 text-slate-800',
        scoreText: 'text-orange-500',
      };
    } else {
      return {
        bg: 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white',
        border: 'border-emerald-500/30',
        shadow: 'shadow-emerald-500/20',
        glow: 'bg-gradient-to-r from-emerald-500/20 to-green-400/20',
        iconBg: 'bg-gradient-to-br from-emerald-500 to-green-500',
        text: 'text-slate-800',
        badgeBg: 'bg-white/90 border-emerald-500/30 text-slate-800',
        scoreText: 'text-emerald-500',
      };
    }
  };

  const colors = getScoreColors();

  const getIcon = () => {
    if (score.score > 6) {
      return <CheckCircle2 size={32} className="text-white" />;
    } else if (score.score > 3) {
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
        {/* Header */}
        <div className="flex items-start mb-6">
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
              <h2 className="text-xl font-bold text-slate-900 mb-1">Score de potentiel</h2>
              <p className="text-sm text-slate-600">Évaluation des opportunités de marché</p>
            </div>
          </div>
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
            className={`text-lg font-bold ${colors.text} mb-3`}
          >
            {score.verdict}
          </motion.p>
          
          {/* Score Justification - AI Explanation */}
          {score.scoreJustification && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="p-4 rounded-xl bg-gradient-to-r from-[#00d4ff]/5 to-[#00c9b7]/5 border border-[#00d4ff]/20 mb-4"
            >
              <div className="flex items-start gap-2">
                <Sparkles size={16} className="text-[#00d4ff] mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-700 leading-relaxed">
                  {score.scoreJustification}
                </p>
              </div>
            </motion.div>
          )}
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-sm text-slate-600 leading-relaxed"
          >
            {score.explanation}
          </motion.p>
        </div>

        {/* Texte explicatif obligatoire */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="p-4 rounded-lg bg-slate-50 border border-slate-200"
        >
          <p className="text-xs text-slate-600 leading-relaxed italic">
            Ce score reflète une évaluation globale de la saturation du marché et de la concurrence dans la niche du produit. 
            C'est une estimation destinée à faciliter la prise de décision et ne garantit pas les résultats.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}


