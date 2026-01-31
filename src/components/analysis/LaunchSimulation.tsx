'use client';

import { motion } from 'framer-motion';
import { Rocket, Clock, TrendingUp, DollarSign, Percent, Zap, Target } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils';
import type { LaunchSimulation as LaunchSimulationType } from '@/types';

interface LaunchSimulationProps {
  simulation: LaunchSimulationType;
}

export function LaunchSimulation({ simulation }: LaunchSimulationProps) {
  const scenarios = [
    { 
      key: 'conservative', 
      label: 'Prudent', 
      color: 'slate',
      data: simulation.threeMonthProjection.conservative 
    },
    { 
      key: 'realistic', 
      label: 'Réaliste', 
      color: 'violet',
      highlighted: true,
      data: simulation.threeMonthProjection.realistic 
    },
    { 
      key: 'optimistic', 
      label: 'Optimisé', 
      color: 'forest',
      data: simulation.threeMonthProjection.optimistic 
    },
  ];

  return (
    <div className="space-y-6">
      {/* Time to First Sale */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-6 rounded-2xl bg-slate-900/30 border border-white/5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-slate-400" />
            <span className="text-sm font-medium text-white">Sans publicité</span>
          </div>
          <div className="text-4xl font-bold text-white mb-1">
            {simulation.timeToFirstSale.withoutAds.expected}
            <span className="text-lg font-normal text-slate-500 ml-1">jours</span>
          </div>
          <p className="text-xs text-slate-500">
            Entre {simulation.timeToFirstSale.withoutAds.min} et {simulation.timeToFirstSale.withoutAds.max} jours
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/20"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} className="text-violet-400" />
            <span className="text-sm font-medium text-white">Avec Etsy Ads</span>
          </div>
          <div className="text-4xl font-bold text-white mb-1">
            {simulation.timeToFirstSale.withAds.expected}
            <span className="text-lg font-normal text-slate-500 ml-1">jours</span>
          </div>
          <p className="text-xs text-slate-500">
            Entre {simulation.timeToFirstSale.withAds.min} et {simulation.timeToFirstSale.withAds.max} jours
          </p>
        </motion.div>
      </div>

      {/* 3-Month Projections */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-slate-900/30 border border-white/5"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Rocket size={18} className="text-violet-400" />
            <span className="font-medium text-white">Projection 3 mois</span>
          </div>
          <Badge variant="info">
            {formatPercentage(simulation.successProbability)} de réussite
          </Badge>
        </div>

        <div className="space-y-4">
          {scenarios.map((scenario, index) => (
            <motion.div
              key={scenario.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl ${
                scenario.highlighted 
                  ? 'bg-violet-500/10 border border-violet-500/20' 
                  : 'bg-slate-800/30'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-medium ${
                  scenario.highlighted ? 'text-violet-300' : 'text-slate-400'
                }`}>
                  {scenario.label}
                </span>
                {scenario.highlighted && <Badge variant="info" size="sm">Recommandé</Badge>}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="flex items-center gap-1 text-slate-500 mb-1">
                    <TrendingUp size={12} />
                    <span className="text-[10px]">Ventes</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {formatNumber(scenario.data.estimatedSales)}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-slate-500 mb-1">
                    <DollarSign size={12} />
                    <span className="text-[10px]">CA</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {formatCurrency(scenario.data.estimatedRevenue)}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-slate-500 mb-1">
                    <Target size={12} />
                    <span className="text-[10px]">Profit</span>
                  </div>
                  <p className="text-lg font-bold text-[#00c9b7]">
                    {formatCurrency(scenario.data.estimatedProfit)}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-slate-500 mb-1">
                    <Percent size={12} />
                    <span className="text-[10px]">Marge</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {scenario.data.marginPercentage}%
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Key Factors */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-5 rounded-xl bg-slate-900/30 border border-white/5"
      >
        <h4 className="text-sm font-medium text-white mb-4">Facteurs clés de succès</h4>
        <div className="grid sm:grid-cols-2 gap-2">
          {simulation.keyFactors.map((factor, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30"
            >
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400">
                {index + 1}
              </div>
              <span className="text-sm text-slate-300">{factor}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
