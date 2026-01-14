'use client';

import { motion } from 'framer-motion';
import { Target, Users, Tag, Heart, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, Badge } from '@/components/ui';
import type { MarketingAnalysis, MarketingAngle } from '@/types';

interface MarketingAnglesProps {
  marketing: MarketingAnalysis;
}

function AngleCard({ angle, index }: { angle: MarketingAngle; index: number }) {
  const competitionBadge = {
    low: { variant: 'success' as const, label: 'Peu de concurrence' },
    medium: { variant: 'warning' as const, label: 'Concurrence moyenne' },
    high: { variant: 'danger' as const, label: 'Forte concurrence' },
  }[angle.competitionLevel];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card hover className="h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h4 className="font-semibold text-white">{angle.title}</h4>
              <p className="text-xs text-slate-400">{angle.targetAudience}</p>
            </div>
          </div>
          <Badge variant={competitionBadge.variant} size="sm">
            {competitionBadge.label}
          </Badge>
        </div>

        <p className="text-sm text-slate-300 mb-4">
          {angle.description}
        </p>

        {/* Why it works */}
        <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg mb-4">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-violet-300 mb-1">Pourquoi ça marche</p>
              <p className="text-sm text-slate-300">{angle.whyItWorks}</p>
            </div>
          </div>
        </div>

        {/* Emotional triggers */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-medium text-slate-400">Triggers émotionnels</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {angle.emotionalTriggers.map((trigger, idx) => (
              <Badge key={`trigger-${idx}-${trigger}`} variant="default" size="sm">
                {trigger}
              </Badge>
            ))}
          </div>
        </div>

        {/* Suggested keywords */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-slate-400">Mots-clés suggérés</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {angle.suggestedKeywords.map((keyword, idx) => (
              <Badge key={`kw-${idx}-${keyword}`} variant="info" size="sm">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function MarketingAngles({ marketing }: MarketingAnglesProps) {
  return (
    <div className="space-y-6">
      {/* Angles Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {marketing.angles.slice(0, 4).map((angle, index) => (
          <AngleCard key={angle.id} angle={angle} index={index} />
        ))}
      </div>

      {/* Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Références rapides</CardTitle>
        </CardHeader>

        <div className="grid sm:grid-cols-3 gap-4">
          {/* Top Keywords */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">Mots-clés populaires</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {marketing.topKeywords.map((keyword, idx) => (
                <Badge key={`topkw-${idx}`} variant="default" size="sm">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>

          {/* Emotional Hooks */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-rose-400" />
              <span className="text-sm font-medium text-white">Accroches émotionnelles</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {marketing.emotionalHooks.map((hook, idx) => (
                <Badge key={`hook-${idx}`} variant="danger" size="sm">
                  {hook}
                </Badge>
              ))}
            </div>
          </div>

          {/* Occasions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-white">Occasions d&apos;achat</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {marketing.occasions.map((occasion, idx) => (
                <Badge key={`occ-${idx}`} variant="warning" size="sm">
                  {occasion}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
