'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Star, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { Card, Badge } from '@/components/ui';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { EtsyCompetitor } from '@/types';

interface CompetitorCardProps {
  competitor: EtsyCompetitor;
  index: number;
}

export function CompetitorCard({ competitor, index }: CompetitorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card hover className="relative overflow-hidden">
        <div className="flex gap-4">
          {/* Product Image */}
          <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-slate-800/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={competitor.listingImage}
              alt={competitor.listingTitle}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-1 left-1">
              <Badge variant="default" size="sm" className="text-[10px]">
                #{index + 1}
              </Badge>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white text-sm truncate mb-1">
              {competitor.shopName}
            </h4>
            <p className="text-xs text-slate-400 truncate mb-2">
              {competitor.listingTitle}
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <div className="flex items-center gap-1 text-[#00c9b7]">
                <DollarSign size={12} />
                <span>{formatCurrency(competitor.price)}</span>
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <Star size={12} />
                <span>{competitor.rating}</span>
              </div>
              <div className="flex items-center gap-1 text-cyan-400">
                <TrendingUp size={12} />
                <span>~{formatNumber(competitor.estimatedMonthlySales)}/mois</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Clock size={12} />
                <span>{Math.round(competitor.listingAge / 30)} mois</span>
              </div>
            </div>
          </div>

          {/* External Link */}
          <a
            href={competitor.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-2 text-slate-500 hover:text-violet-400 transition-colors"
          >
            <ExternalLink size={16} />
          </a>
        </div>

        {/* Monthly Revenue Badge */}
        <div className="absolute bottom-3 right-3">
          <Badge variant="success" size="sm">
            ~{formatCurrency(competitor.estimatedMonthlyRevenue)}/mois
          </Badge>
        </div>
      </Card>
    </motion.div>
  );
}
