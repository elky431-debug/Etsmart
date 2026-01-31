'use client';

import { motion } from 'framer-motion';
import { DollarSign, TrendingDown, TrendingUp, Info, ArrowRight, Zap } from 'lucide-react';
import { Badge, Tooltip } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { PricingRecommendation } from '@/types';

interface PricingCardProps {
  pricing: PricingRecommendation;
  supplierPrice: number;
}

export function PricingCard({ pricing, supplierPrice }: PricingCardProps) {
  const priceOptions = [
    {
      label: 'Lancement',
      price: pricing.aggressivePrice,
      margin: pricing.marginAnalysis.atAggressivePrice,
      color: 'amber',
      icon: TrendingDown,
      description: 'Prix d\'entrée pour les premières ventes',
    },
    {
      label: 'Optimal',
      price: pricing.recommendedPrice,
      margin: pricing.marginAnalysis.atRecommendedPrice,
      color: 'violet',
      icon: Zap,
      highlighted: true,
      description: 'Équilibre recommandé entre ventes et marge',
    },
    {
      label: 'Premium',
      price: pricing.premiumPrice,
      margin: pricing.marginAnalysis.atPremiumPrice,
      color: 'emerald',
      icon: TrendingUp,
      description: 'Après avoir établi votre réputation',
    },
  ];

  const colorMap = {
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
    violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400' },
    emerald: { bg: 'bg-[#00d4ff]/10', border: 'border-[#00d4ff]/30', text: 'text-[#00c9b7]' },
  };

  return (
    <div className="space-y-6">
      {/* Price Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {priceOptions.map((option, index) => {
          const colors = colorMap[option.color as keyof typeof colorMap];
          const Icon = option.icon;

          return (
            <motion.div
              key={option.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative p-5 rounded-2xl border transition-all
                ${option.highlighted 
                  ? `${colors.bg} ${colors.border} ring-2 ring-violet-500/20` 
                  : 'bg-slate-900/30 border-white/5'}
              `}
            >
              {option.highlighted && (
                <Badge variant="info" size="sm" className="absolute -top-2 right-4">
                  Recommandé
                </Badge>
              )}

              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                  <Icon size={16} className={colors.text} />
                </div>
                <span className="text-sm font-medium text-white">{option.label}</span>
              </div>

              <div className="text-3xl font-bold text-white mb-2">
                {formatCurrency(option.price)}
              </div>

              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-slate-500">Marge</span>
                <span className={`font-medium ${
                  option.margin > 50 ? 'text-[#00c9b7]' : 
                  option.margin > 30 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {option.margin}%
                </span>
              </div>

              <p className="text-xs text-slate-500">{option.description}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Strategy Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-5 rounded-xl bg-slate-900/30 border border-white/5"
      >
        <h4 className="text-sm font-medium text-white mb-4">Stratégie évolutive</h4>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="warning" size="sm">Mois 1-2</Badge>
            <span className="text-white font-medium">{formatCurrency(pricing.priceStrategy.launch)}</span>
          </div>
          <ArrowRight size={14} className="text-slate-600" />
          <div className="flex items-center gap-2">
            <Badge variant="info" size="sm">Mois 3-6</Badge>
            <span className="text-white font-medium">{formatCurrency(pricing.priceStrategy.stable)}</span>
          </div>
          <ArrowRight size={14} className="text-slate-600" />
          <div className="flex items-center gap-2">
            <Badge variant="success" size="sm">Mois 6+</Badge>
            <span className="text-white font-medium">{formatCurrency(pricing.priceStrategy.premium)}</span>
          </div>
        </div>
      </motion.div>

      {/* Price Range Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-5 rounded-xl bg-slate-900/30 border border-white/5"
      >
        <h4 className="text-sm font-medium text-white mb-4">Position vs concurrents</h4>
        
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>{formatCurrency(pricing.competitorPriceAnalysis.below25)}</span>
            <span>{formatCurrency(pricing.competitorPriceAnalysis.median)}</span>
            <span>{formatCurrency(pricing.competitorPriceAnalysis.above75)}</span>
          </div>
          
          <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#00d4ff]/30 via-violet-500/30 to-rose-500/30" />
            
            <motion.div
              initial={{ left: 0 }}
              animate={{ 
                left: `${Math.min(100, Math.max(0, 
                  ((pricing.recommendedPrice - pricing.competitorPriceAnalysis.below25) / 
                  (pricing.competitorPriceAnalysis.above75 - pricing.competitorPriceAnalysis.below25)) * 100
                ))}%` 
              }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            >
              <div className="w-4 h-4 bg-violet-500 rounded-full border-2 border-white shadow-lg" />
            </motion.div>
          </div>
          
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>25e percentile</span>
            <span>Médiane</span>
            <span>75e percentile</span>
          </div>
        </div>
      </motion.div>

      {/* Justification */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/20"
      >
        <div className="flex items-start gap-3">
          <Info size={16} className="text-violet-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-slate-300">{pricing.justification}</p>
        </div>
      </motion.div>

      {/* Supplier Price */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/30 border border-white/5">
        <span className="text-sm text-slate-500">Prix fournisseur</span>
        <span className="font-medium text-white">{formatCurrency(supplierPrice)}</span>
      </div>
    </div>
  );
}
