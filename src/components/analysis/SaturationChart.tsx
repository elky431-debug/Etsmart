'use client';

import { motion } from 'framer-motion';
import { Calendar, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui';
import { getPhaseLabel, getPhaseColor } from '@/lib/utils';
import type { SaturationAnalysis } from '@/types';

interface SaturationChartProps {
  saturation: SaturationAnalysis;
}

export function SaturationChart({ saturation }: SaturationChartProps) {
  const phases = ['launch', 'growth', 'saturation', 'decline'] as const;
  const phaseIndex = phases.indexOf(saturation.phase);

  return (
    <div className="space-y-6">
      {/* Phase Progress */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-slate-900/30 border border-white/5"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-violet-400" />
            <span className="font-medium text-white">Cycle de vie</span>
          </div>
          <Badge 
            variant={
              saturation.phase === 'growth' ? 'success' : 
              saturation.phase === 'saturation' ? 'warning' : 
              saturation.phase === 'decline' ? 'danger' : 'info'
            }
          >
            {getPhaseLabel(saturation.phase)}
          </Badge>
        </div>

        {/* Phase Timeline */}
        <div className="relative mb-4">
          <div className="flex justify-between mb-2">
            {phases.map((phase, index) => (
              <span 
                key={phase}
                className={`text-xs ${index === phaseIndex ? getPhaseColor(phase) : 'text-slate-600'}`}
              >
                {getPhaseLabel(phase)}
              </span>
            ))}
          </div>
          
          <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ 
                width: `${((phaseIndex + saturation.phasePercentage / 100) / (phases.length - 1)) * 100}%` 
              }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-violet-500 to-rose-500 rounded-full"
            />
          </div>
          
          {/* Markers */}
          <div className="absolute top-8 left-0 right-0 flex justify-between">
            {phases.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full border-2 -translate-x-1/2 ${
                  index <= phaseIndex 
                    ? 'bg-white border-white' 
                    : 'bg-slate-700 border-slate-600'
                }`}
                style={{ marginLeft: index === 0 ? '0' : undefined }}
              />
            ))}
          </div>
        </div>

        <div className="text-center mt-8 pt-4 border-t border-white/5">
          <span className="text-3xl font-bold text-white">{saturation.phasePercentage}%</span>
          <p className="text-xs text-slate-500 mt-1">progression dans cette phase</p>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-slate-900/30 border border-white/5 text-center"
        >
          <Users size={18} className="text-slate-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">+{saturation.newSellersRate}</p>
          <p className="text-[10px] text-slate-500 mt-1">vendeurs/mois</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-xl bg-slate-900/30 border border-white/5 text-center"
        >
          <TrendingUp size={18} className="text-slate-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">+{saturation.listingGrowthRate}%</p>
          <p className="text-[10px] text-slate-500 mt-1">croissance</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-xl bg-slate-900/30 border border-white/5 text-center"
        >
          <div className={`text-xl font-bold ${
            saturation.saturationProbability > 70 ? 'text-rose-400' : 
            saturation.saturationProbability > 40 ? 'text-amber-400' : 'text-[#00c9b7]'
          }`}>
            {saturation.saturationProbability}%
          </div>
          <p className="text-[10px] text-slate-500 mt-1">prob. saturation</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="p-4 rounded-xl bg-slate-900/30 border border-white/5 text-center"
        >
          <Badge 
            variant={
              saturation.declineRisk === 'high' ? 'danger' : 
              saturation.declineRisk === 'medium' ? 'warning' : 'success'
            }
            size="sm"
          >
            {saturation.declineRisk === 'high' ? 'Élevé' : 
             saturation.declineRisk === 'medium' ? 'Moyen' : 'Faible'}
          </Badge>
          <p className="text-[10px] text-slate-500 mt-2">risque déclin</p>
        </motion.div>
      </div>

      {/* Seasonality */}
      {saturation.seasonality.isSeasonalProduct && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20"
        >
          <div className="flex items-center gap-2 text-cyan-400 text-sm">
            <Calendar size={16} />
            <span>
              Produit saisonnier • Pics en{' '}
              <span className="font-medium">
                {saturation.seasonality.peakMonths.map(m => 
                  new Date(2024, m - 1).toLocaleString('fr-FR', { month: 'short' })
                ).join(', ')}
              </span>
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
