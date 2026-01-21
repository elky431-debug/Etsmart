'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  TrendingUp, 
  AlertTriangle, 
  Package,
  DollarSign,
  Target,
  BarChart3,
  Lightbulb,
  ArrowUpRight,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, Badge, Progress } from '@/components/ui';
import { 
  formatCurrency, 
  getVerdictLabel, 
  getVerdictColor,
  getVerdictBg
} from '@/lib/utils';
import type { ProductAnalysis } from '@/types';

interface GlobalDashboardProps {
  analyses: ProductAnalysis[];
}

export function GlobalDashboard({ analyses }: GlobalDashboardProps) {
  const stats = useMemo(() => {
    const launchCount = analyses.filter(a => a.verdict.verdict === 'launch').length;
    const testCount = analyses.filter(a => a.verdict.verdict === 'test').length;
    const avoidCount = analyses.filter(a => a.verdict.verdict === 'avoid').length;
    
    const avgCompetitors = Math.round(
      analyses.reduce((acc, a) => acc + a.competitors.totalCompetitors, 0) / analyses.length
    );
    
    const totalPotentialRevenue = analyses
      .filter(a => a.verdict.verdict !== 'avoid')
      .reduce((acc, a) => acc + a.launchSimulation.threeMonthProjection.realistic.estimatedRevenue, 0);
    
    const avgTimeToSale = Math.round(
      analyses.reduce((acc, a) => acc + a.launchSimulation.timeToFirstSale.withoutAds.expected, 0) / analyses.length
    );

    // Sort by verdict priority
    const priorityProducts = [...analyses]
      .sort((a, b) => {
        const verdictPriority = { launch: 0, test: 1, avoid: 2 };
        return verdictPriority[a.verdict.verdict] - verdictPriority[b.verdict.verdict];
      })
      .filter(a => a.verdict.verdict !== 'avoid');

    return {
      launchCount,
      testCount,
      avoidCount,
      avgCompetitors,
      totalPotentialRevenue,
      avgTimeToSale,
      priorityProducts,
    };
  }, [analyses]);

  // Calculate global risk
  const globalRisk = useMemo(() => {
    const avoidRatio = stats.avoidCount / analyses.length;
    const avgSaturation = analyses.reduce((acc, a) => acc + a.saturation.saturationProbability, 0) / analyses.length;
    
    if (avoidRatio > 0.5 || avgSaturation > 70) return 'high';
    if (avoidRatio > 0.25 || avgSaturation > 50) return 'medium';
    return 'low';
  }, [analyses, stats.avoidCount]);

  // Calculate niche viability
  const nicheViability = useMemo(() => {
    const launchRatio = stats.launchCount / analyses.length;
    if (launchRatio >= 0.5) return 'high';
    if (launchRatio >= 0.25) return 'medium';
    return 'low';
  }, [analyses.length, stats.launchCount]);

  // Calculate coherence score
  const coherenceScore = useMemo(() => {
    // Check if products are in similar phases
    const phases = analyses.map(a => a.saturation.phase);
    const uniquePhases = new Set(phases).size;
    
    // Check market structure consistency
    const structures = analyses.map(a => a.competitors.marketStructure);
    const uniqueStructures = new Set(structures).size;
    
    // Higher coherence if products are in similar market conditions
    const phaseCoherence = Math.max(0, 100 - (uniquePhases - 1) * 25);
    const structureCoherence = Math.max(0, 100 - (uniqueStructures - 1) * 30);
    
    return Math.round((phaseCoherence + structureCoherence) / 2);
  }, [analyses]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 mb-4 shadow-lg shadow-violet-500/30"
        >
          <BarChart3 className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-3xl font-bold text-white mb-2">
          Global Shop Dashboard
        </h2>
        <p className="text-slate-400">
          Consolidated view of {analyses.length} analyzed products
        </p>
      </div>

      {/* Verdict Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { verdict: 'launch', count: stats.launchCount, label: 'To launch' },
          { verdict: 'test', count: stats.testCount, label: 'To test' },
          { verdict: 'avoid', count: stats.avoidCount, label: 'To avoid' },
        ].map((item) => (
          <motion.div
            key={item.verdict}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={`text-center ${getVerdictBg(item.verdict as 'launch' | 'test' | 'avoid')}`}>
              <div className={`flex justify-center mb-2 ${getVerdictColor(item.verdict as 'launch' | 'test' | 'avoid')}`}>
                {item.verdict === 'launch' && <CheckCircle2 size={36} />}
                {item.verdict === 'test' && <AlertTriangle size={36} />}
                {item.verdict === 'avoid' && <XCircle size={36} />}
              </div>
              <p className={`text-3xl font-bold ${getVerdictColor(item.verdict as 'launch' | 'test' | 'avoid')}`}>
                {item.count}
              </p>
              <p className="text-sm text-slate-400">{item.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00d4ff]/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-[#00c9b7]" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Potential revenue 3 months</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(stats.totalPotentialRevenue)}
              </p>
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Target className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Average competitors</p>
              <p className="text-xl font-bold text-white">~{stats.avgCompetitors}</p>
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Package className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Concurrents moyens</p>
              <p className="text-xl font-bold text-white">~{stats.avgCompetitors}</p>
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Temps moyen 1ère vente</p>
              <p className="text-xl font-bold text-white">~{stats.avgTimeToSale}j</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Boutique Health */}
      <Card>
        <CardHeader>
          <CardTitle>Santé de la boutique</CardTitle>
        </CardHeader>
        
        <div className="grid md:grid-cols-3 gap-6">
          {/* Niche Viability */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Viabilité de la niche</span>
              <Badge 
                variant={nicheViability === 'high' ? 'success' : nicheViability === 'medium' ? 'warning' : 'danger'}
              >
                {nicheViability === 'high' ? 'Élevée' : nicheViability === 'medium' ? 'Moyenne' : 'Faible'}
              </Badge>
            </div>
            <Progress 
              value={nicheViability === 'high' ? 85 : nicheViability === 'medium' ? 55 : 25}
              variant={nicheViability === 'high' ? 'success' : nicheViability === 'medium' ? 'warning' : 'danger'}
            />
          </div>

          {/* Coherence Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Product coherence</span>
              <span className="text-sm font-medium text-white">{coherenceScore}%</span>
            </div>
            <Progress 
              value={coherenceScore}
              variant={coherenceScore >= 70 ? 'success' : coherenceScore >= 40 ? 'warning' : 'danger'}
            />
          </div>

          {/* Global Risk */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Risque global</span>
              <Badge 
                variant={globalRisk === 'low' ? 'success' : globalRisk === 'medium' ? 'warning' : 'danger'}
              >
                {globalRisk === 'low' ? 'Faible' : globalRisk === 'medium' ? 'Moyen' : 'Élevé'}
              </Badge>
            </div>
            <Progress 
              value={globalRisk === 'low' ? 25 : globalRisk === 'medium' ? 55 : 85}
              variant={globalRisk === 'low' ? 'success' : globalRisk === 'medium' ? 'warning' : 'danger'}
            />
          </div>
        </div>
      </Card>

      {/* Priority Products */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-violet-400" />
            <CardTitle>Produits prioritaires</CardTitle>
          </div>
        </CardHeader>
        
        {stats.priorityProducts.length > 0 ? (
          <div className="space-y-3">
            {stats.priorityProducts.slice(0, 5).map((analysis, index) => (
              <motion.div
                key={analysis.product.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-3 glass-card rounded-xl"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-violet-400 font-bold text-sm">
                  {index + 1}
                </div>
                
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800/50 flex-shrink-0">
                  {analysis.product.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={analysis.product.images[0]}
                      alt={analysis.product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-slate-600 m-3" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {analysis.product.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className={`flex items-center gap-1 ${getVerdictColor(analysis.verdict.verdict)}`}>
                      {analysis.verdict.verdict === 'launch' && <CheckCircle2 size={12} />}
                      {analysis.verdict.verdict === 'test' && <AlertTriangle size={12} />}
                      {analysis.verdict.verdict === 'avoid' && <XCircle size={12} />}
                      {getVerdictLabel(analysis.verdict.verdict, analysis.competitors.totalCompetitors)}
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-sm font-medium text-[#00c9b7]">
                    {formatCurrency(analysis.pricing.recommendedPrice)}
                  </p>
                  <p className="text-xs text-slate-400">
                    ~{analysis.launchSimulation.threeMonthProjection.realistic.estimatedSales} ventes/3m
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <p className="text-slate-400">No priority products identified</p>
            <p className="text-sm text-slate-500">All products should be avoided</p>
          </div>
        )}
      </Card>

      {/* Recommended Strategy */}
      <Card className="border-violet-500/20 bg-violet-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-violet-400" />
            <CardTitle className="text-violet-300">Recommended Strategy</CardTitle>
          </div>
        </CardHeader>
        
        <div className="space-y-4">
          {stats.launchCount > 0 && (
            <div className="flex items-start gap-3 p-3 bg-[#00d4ff]/10 border border-[#00d4ff]/20 rounded-lg">
              <ArrowUpRight className="w-5 h-5 text-[#00c9b7] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#4dd9cc]">
                  Launch priority
                </p>
                <p className="text-sm text-slate-300">
                  Start with the {stats.launchCount} recommended product{stats.launchCount > 1 ? 's' : ''}. 
                  They present the best potential/risk ratio.
                </p>
              </div>
            </div>
          )}
          
          {stats.testCount > 0 && (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <ArrowUpRight className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-300">
                  Test with caution
                </p>
                <p className="text-sm text-slate-300">
                  The {stats.testCount} product{stats.testCount > 1 ? 's' : ''} to test require validation. 
                  Start with limited stock.
                </p>
              </div>
            </div>
          )}
          
          {stats.avoidCount > 0 && (
            <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-rose-300">
                  Avoid for now
                </p>
                <p className="text-sm text-slate-300">
                  {stats.avoidCount} product{stats.avoidCount > 1 ? 's present' : ' presents'} too many risks. 
                  Look for alternatives with less competition.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
