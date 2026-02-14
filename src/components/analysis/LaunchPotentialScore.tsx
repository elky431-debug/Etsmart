'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Sparkles, TrendingUp, Shield, Lightbulb, DollarSign, Zap, Layers } from 'lucide-react';
import type { LaunchPotentialScore as LaunchPotentialScoreType } from '@/types';

interface LaunchPotentialScoreProps {
  score: LaunchPotentialScoreType;
}

// Classification labels en français
const classificationLabelsFR: Record<string, string> = {
  'NOT RECOMMENDED': 'Non recommandé',
  'HIGH RISK': 'Risque élevé',
  'MODERATE OPPORTUNITY': 'Opportunité modérée',
  'STRONG OPPORTUNITY': 'Bonne opportunité',
  'EXCEPTIONAL OPPORTUNITY': 'Opportunité exceptionnelle',
};

// Criteria display config
const criteriaConfig = [
  { key: 'market_demand', label: 'Demande marché', weight: '25%', icon: TrendingUp, color: 'text-blue-400' },
  { key: 'competition_intensity', label: 'Concurrence', weight: '20%', icon: Shield, color: 'text-red-400' },
  { key: 'differentiation_potential', label: 'Différenciation', weight: '15%', icon: Lightbulb, color: 'text-purple-400' },
  { key: 'profit_margin_potential', label: 'Marges', weight: '20%', icon: DollarSign, color: 'text-emerald-400' },
  { key: 'impulse_buy_potential', label: 'Achat impulsif', weight: '10%', icon: Zap, color: 'text-amber-400' },
  { key: 'scalability_potential', label: 'Scalabilité', weight: '10%', icon: Layers, color: 'text-cyan-400' },
] as const;

function getScoreBarColor(score: number): string {
  if (score <= 3) return 'bg-red-500';
  if (score <= 5) return 'bg-orange-500';
  if (score <= 7) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

export function LaunchPotentialScore({ score }: LaunchPotentialScoreProps) {
  const classificationFR = useMemo(() => {
    if (score.classification) return classificationLabelsFR[score.classification] || score.classification;
    if (score.score < 4) return 'Non recommandé';
    if (score.score < 6) return 'Risque élevé';
    if (score.score < 7.5) return 'Opportunité modérée';
    if (score.score <= 8.5) return 'Bonne opportunité';
    return 'Opportunité exceptionnelle';
  }, [score.classification, score.score]);

  const justificationFR = useMemo(() => {
    return score.scoreJustification || `Score de ${score.score.toFixed(1)}/10 basé sur l'analyse multicritères du produit.`;
  }, [score.score, score.scoreJustification]);

  const getScoreColors = () => {
    if (score.score < 4) {
      return { border: 'border-red-500', scoreText: 'text-red-500', classificationBg: 'bg-red-500/20 text-red-400' };
    } else if (score.score < 6) {
      return { border: 'border-orange-500', scoreText: 'text-orange-500', classificationBg: 'bg-orange-500/20 text-orange-400' };
    } else if (score.score < 7.5) {
      return { border: 'border-yellow-500', scoreText: 'text-yellow-500', classificationBg: 'bg-yellow-500/20 text-yellow-400' };
    } else {
      return { border: 'border-emerald-500', scoreText: 'text-emerald-500', classificationBg: 'bg-emerald-500/20 text-emerald-400' };
    }
  };

  const colors = getScoreColors();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, type: 'spring' }}
      className={`relative overflow-hidden p-8 rounded-3xl border-2 bg-black ${colors.border}`}
    >
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]"
            >
              <span className="text-3xl font-bold text-white">i</span>
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Score de potentiel</h2>
              <p className="text-sm text-white/70">Évaluation multicritères du produit</p>
            </div>
          </div>
          
          {/* Classification badge */}
          <motion.span
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${colors.classificationBg}`}
          >
            {classificationFR}
          </motion.span>
        </div>

        {/* Score principal */}
        <div className="mb-6">
          <div className="flex items-baseline gap-3 mb-4">
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
              className={`text-6xl font-black ${colors.scoreText}`}
            >
              {score.score.toFixed(1)}
            </motion.span>
            <span className="text-2xl font-bold text-white/50">/ 10</span>
          </div>
        </div>

        {/* 6 Criteria Breakdown */}
        {score.scoringBreakdown && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-6 space-y-3"
          >
            <h3 className="text-sm font-semibold text-white/80 mb-4">Détail des critères</h3>
            {criteriaConfig.map((criterion, index) => {
              const data = score.scoringBreakdown?.[criterion.key as keyof typeof score.scoringBreakdown];
              if (!data) return null;
              const Icon = criterion.icon;
              
              return (
                <motion.div
                  key={criterion.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.08 }}
                  className="group"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <Icon size={14} className={criterion.color} />
                    <span className="text-xs font-medium text-white/70 flex-1">{criterion.label}</span>
                    <span className="text-[10px] text-white/40">{criterion.weight}</span>
                    <span className={`text-sm font-bold ${data.score <= 3 ? 'text-red-400' : data.score <= 5 ? 'text-orange-400' : data.score <= 7 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {data.score}/10
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(data.score / 10) * 100}%` }}
                      transition={{ delay: 0.6 + index * 0.08, duration: 0.5 }}
                      className={`h-full rounded-full ${getScoreBarColor(data.score)}`}
                    />
                  </div>
                  {/* Analysis text - shown on hover/always for mobile */}
                  {data.analysis && (
                    <p className="text-[10px] text-white/40 leading-relaxed mt-1 line-clamp-2">
                      {data.analysis}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Strategic Summary / Justification */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="p-4 rounded-xl bg-black border border-white/10 mb-4"
        >
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="text-[#00d4ff] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-white/90 leading-relaxed">
              {justificationFR}
            </p>
          </div>
        </motion.div>

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="p-4 rounded-lg bg-black border border-white/10"
        >
          <p className="text-xs text-white/70 leading-relaxed italic">
            Ce score reflète une évaluation multicritères objective basée sur la demande du marché, 
            la concurrence, le potentiel de différenciation, les marges, l&apos;attractivité émotionnelle et la scalabilité. 
            C&apos;est une estimation destinée à faciliter la prise de décision et ne garantit pas les résultats.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
