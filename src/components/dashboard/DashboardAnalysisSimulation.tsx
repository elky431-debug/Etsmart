'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/useIsMobile';
import { 
  TrendingUp,
  Eye,
  AlertTriangle,
  Info,
  Calculator,
  Clock,
  Zap,
  Award,
  Activity,
  CircleDollarSign,
  Star
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  formatCurrency, 
  getPhaseLabel,
  formatNumber,
  formatPercentage
} from '@/lib/utils';
import type { ProductAnalysis } from '@/types';
import dynamic from 'next/dynamic';

const LaunchPotentialScore = dynamic(
  () => import('@/components/analysis/LaunchPotentialScore').then(mod => ({ default: mod.LaunchPotentialScore })),
  { ssr: false }
);

interface DashboardAnalysisSimulationProps {
  analysis: ProductAnalysis;
}

export function DashboardAnalysisSimulation({ analysis }: DashboardAnalysisSimulationProps) {
  const isMobile = useIsMobile();
  
  // Priorité au prix renseigné par l'utilisateur, sinon estimation IA
  const userSupplierPrice = analysis.product.price > 0 ? analysis.product.price : (analysis.verdict.estimatedSupplierPrice ?? 0);
  const aiEstimatedShippingCost = analysis.verdict.estimatedShippingCost ?? 0;
  
  const [sellingPrice, setSellingPrice] = useState<number>(analysis.pricing.recommendedPrice);
  const [shippingCost, setShippingCost] = useState<number>(aiEstimatedShippingCost);
  const [supplierPrice, setSupplierPrice] = useState<number>(userSupplierPrice);
  const [useEtsyAds, setUseEtsyAds] = useState<boolean>(false);
  
  // États locaux pour les valeurs d'affichage des inputs (permet de supprimer le 0)
  const [sellingPriceDisplay, setSellingPriceDisplay] = useState<string>(analysis.pricing.recommendedPrice > 0 ? analysis.pricing.recommendedPrice.toString() : '');
  const [shippingCostDisplay, setShippingCostDisplay] = useState<string>(aiEstimatedShippingCost > 0 ? aiEstimatedShippingCost.toString() : '');
  const [supplierPriceDisplay, setSupplierPriceDisplay] = useState<string>(userSupplierPrice > 0 ? userSupplierPrice.toString() : '');
  
  const simulationData = useMemo(() => {
    const costPerUnit = supplierPrice + shippingCost;
    
    // Etsy Ads cost: typically 15-20% of revenue as advertising spend
    const etsyAdsCostPercentage = 0.17; // 17% average
    const etsyAdsCostPerUnit = useEtsyAds ? sellingPrice * etsyAdsCostPercentage : 0;
    const totalCostPerUnit = costPerUnit + etsyAdsCostPerUnit;
    
    const profitPerUnit = sellingPrice - totalCostPerUnit;
    const marginPercent = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;
    
    // Adjust sales estimates based on Etsy Ads (ads typically increase sales by 20-40%)
    const adsMultiplier = useEtsyAds ? 1.3 : 1.0; // 30% increase with ads
    
    // Vérifier si launchSimulation existe
    const hasLaunchSimulation = analysis.launchSimulation?.threeMonthProjection;
    const defaultSales = { estimatedSales: 0 };
    
    const salesEstimates = {
      prudent: Math.round((hasLaunchSimulation?.conservative?.estimatedSales || defaultSales.estimatedSales) * adsMultiplier),
      realiste: Math.round((hasLaunchSimulation?.realistic?.estimatedSales || defaultSales.estimatedSales) * adsMultiplier),
      optimise: Math.round((hasLaunchSimulation?.optimistic?.estimatedSales || defaultSales.estimatedSales) * adsMultiplier),
    };
    
    return {
      prudent: {
        sales: salesEstimates.prudent,
        revenue: sellingPrice * salesEstimates.prudent,
        costs: totalCostPerUnit * salesEstimates.prudent,
        profit: profitPerUnit * salesEstimates.prudent,
        margin: marginPercent,
      },
      realiste: {
        sales: salesEstimates.realiste,
        revenue: sellingPrice * salesEstimates.realiste,
        costs: totalCostPerUnit * salesEstimates.realiste,
        profit: profitPerUnit * salesEstimates.realiste,
        margin: marginPercent,
      },
      optimise: {
        sales: salesEstimates.optimise,
        revenue: sellingPrice * salesEstimates.optimise,
        costs: totalCostPerUnit * salesEstimates.optimise,
        profit: profitPerUnit * salesEstimates.optimise,
        margin: marginPercent,
      },
      costPerUnit: totalCostPerUnit,
      profitPerUnit,
      marginPercent,
      etsyAdsCost: etsyAdsCostPerUnit,
    };
  }, [sellingPrice, shippingCost, supplierPrice, useEtsyAds, analysis.launchSimulation?.threeMonthProjection]);

  return (
    <div className="space-y-6">
      {/* SECTION ANALYSE */}
      <div className="space-y-4">
        {/* ⚠️ Avertissement si données de fallback utilisées */}
        {(analysis.dataSource === 'estimated' || analysis.verdict.warningIfAny) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="p-4 rounded-xl bg-black border-2 border-white/10"
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                typeof window !== 'undefined' && (
                  window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1'
                )
                  ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
                  : 'bg-amber-500'
              }`}>
                <AlertTriangle size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white mb-1 text-sm">⚠️ Données par défaut utilisées</h3>
                <p className="text-sm text-white/80 leading-relaxed">
                  {analysis.verdict.warningIfAny || 
                   'L\'API d\'analyse n\'a pas pu répondre dans les temps (timeout >30s). Les résultats affichés sont des estimations par défaut et peuvent être moins précis. Veuillez réessayer avec une image plus petite.'}
                </p>
                {analysis.dataSource === 'estimated' && (
                    <p className="text-xs text-white/70 mt-2 italic">
                    Source des données : Estimations par défaut (API non disponible)
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {[
            { icon: CircleDollarSign, label: 'Prix moyen du marché', value: formatCurrency(analysis.competitors.averageMarketPrice || analysis.pricing.recommendedPrice), sub: analysis.competitors.marketPriceRange ? `${formatCurrency(analysis.competitors.marketPriceRange.min)} - ${formatCurrency(analysis.competitors.marketPriceRange.max)}` : 'Plage', highlight: false },
            { icon: TrendingUp, label: 'Prix recommandé', value: formatCurrency(analysis.pricing.recommendedPrice), sub: 'Pour votre boutique', highlight: true },
            { icon: Star, label: 'Phase du marché', value: getPhaseLabel(analysis.saturation.phase), sub: 'Tendance', highlight: false },
          ].map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div
                key={i}
                className={`p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border ${
                  kpi.highlight 
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] border-[#00d4ff] text-white' 
                    : 'bg-black border-white/10'
                }`}
              >
                <div className={`w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center mb-2 sm:mb-3 ${
                  kpi.highlight ? 'bg-white/20' : 'bg-black border border-white/10'
                }`}>
                  <Icon size={isMobile ? 14 : 18} className={kpi.highlight ? 'text-white' : 'text-white/60'} />
                </div>
                <p className={`text-base sm:text-xl font-bold mb-1 ${kpi.highlight ? 'text-white' : 'text-white'}`}>{kpi.value}</p>
                <p className={`text-xs font-medium ${kpi.highlight ? 'text-white/80' : 'text-white/70'}`}>{kpi.label}</p>
                <p className={`text-[10px] mt-0.5 ${kpi.highlight ? 'text-white/60' : 'text-slate-400'}`}>{kpi.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Launch Potential Score */}
        {analysis.competitors.launchPotentialScore && (
          <div className="mb-8">
            <LaunchPotentialScore score={analysis.competitors.launchPotentialScore} />
          </div>
        )}

        {/* Explication estimation (si disponible) */}
        {analysis.competitors.competitorEstimationReasoning && (
          <div className="p-4 rounded-lg bg-black border border-white/10">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Info size={14} className="text-white/60" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-white mb-1">Méthodologie d'estimation</p>
                <p className="text-xs text-white/80 leading-relaxed">{analysis.competitors.competitorEstimationReasoning}</p>
                {analysis.competitors.marketPriceReasoning && (
                  <p className="text-xs text-white/70 mt-2 italic">{analysis.competitors.marketPriceReasoning}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recherche Etsy */}
        {analysis.verdict.etsySearchQuery && (
          <div className="p-5 rounded-xl bg-black border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  typeof window !== 'undefined' && (
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1'
                  )
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
                    : 'bg-indigo-500'
                }`}>
                  <Eye size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Vision IA</h3>
                  <p className="text-xs text-white/70">Recherche optimisée pour Etsy</p>
                </div>
              </div>
              <a
                href={`https://www.etsy.com/search?q=${encodeURIComponent(analysis.verdict.etsySearchQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                  typeof window !== 'undefined' && (
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1'
                  )
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:opacity-90'
                    : 'bg-indigo-500 hover:bg-indigo-600'
                }`}
              >
                <Eye size={14} />
                Voir sur Etsy
              </a>
            </div>
            {analysis.verdict.productVisualDescription && (
              <p className="text-sm text-white/80 italic mb-3">
                &quot;{analysis.verdict.productVisualDescription}&quot;
              </p>
            )}
            <div className="p-3 bg-black border border-white/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-[#00d4ff]" />
                <span className="text-sm text-[#00d4ff] font-medium">{analysis.verdict.etsySearchQuery}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION SIMULATION */}
      <div className="space-y-6">
        <div className="border-t border-white/10 pt-6">
          <h2 className="text-xl font-bold text-white mb-6">Simulation</h2>
        </div>
        <div className="p-5 rounded-xl bg-black border border-white/10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
              <Calculator size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Calculateur de profit</h2>
              <p className="text-white/70 text-xs">Ajustez les valeurs pour voir les projections</p>
            </div>
          </div>
          
          {analysis.verdict.supplierPriceReasoning && (
            <div className="mb-5 p-3 rounded-lg bg-black border border-white/10">
              <p className="text-xs font-semibold text-white/70 mb-1">Analyse IA</p>
              <p className="text-sm text-white/80">{analysis.verdict.supplierPriceReasoning}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
            {[
              { 
                label: 'Prix fournisseur', 
                displayValue: supplierPriceDisplay,
                setDisplayValue: setSupplierPriceDisplay,
                numericValue: supplierPrice, 
                setNumericValue: setSupplierPrice, 
                hint: analysis.product.price > 0 
                  ? `Prix entré : ${formatCurrency(analysis.product.price)}` 
                  : `Est. IA : ${formatCurrency(analysis.verdict.estimatedSupplierPrice ?? 0)}` 
              },
              { 
                label: 'Frais de livraison', 
                displayValue: shippingCostDisplay,
                setDisplayValue: setShippingCostDisplay,
                numericValue: shippingCost, 
                setNumericValue: setShippingCost, 
                hint: `Est. : ${formatCurrency(aiEstimatedShippingCost)}` 
              },
              { 
                label: 'Prix de vente', 
                displayValue: sellingPriceDisplay,
                setDisplayValue: setSellingPriceDisplay,
                numericValue: sellingPrice, 
                setNumericValue: setSellingPrice, 
                hint: `Rec. : ${formatCurrency(analysis.pricing.recommendedPrice)}`, 
                highlight: true 
              },
            ].map((field, i) => (
              <div key={i}>
                <label className="block text-xs font-bold text-white/70 mb-2 uppercase tracking-wide">
                  {field.label}
                </label>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${field.highlight ? 'text-[#00d4ff]' : 'text-white/60'}`}>$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={field.displayValue}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      field.setDisplayValue(inputValue);
                      if (inputValue === '' || inputValue === '0') {
                        field.setNumericValue(0);
                      } else {
                        const numValue = parseFloat(inputValue);
                        if (!isNaN(numValue) && numValue >= 0) {
                          field.setNumericValue(numValue);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const numValue = field.numericValue;
                      if (numValue === 0) {
                        field.setDisplayValue('');
                      } else {
                        field.setDisplayValue(numValue.toString());
                      }
                    }}
                    className={`w-full pl-8 pr-3 py-3 rounded-lg text-lg font-bold focus:ring-0 focus:outline-none transition-colors text-white ${
                      field.highlight 
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]/10 border border-[#00d4ff] focus:border-[#00d4ff]' 
                        : 'bg-black border border-white/10 focus:border-white/20'
                    }`}
                  />
                </div>
                <p className="text-xs text-white/70 mt-1">{field.hint}</p>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-black border border-white/10">
            <div className="text-center">
              <p className="text-xs text-white/70 mb-1">Coût unitaire</p>
              <p className="text-xl font-bold text-white">{formatCurrency(simulationData.costPerUnit)}</p>
              {useEtsyAds && simulationData.etsyAdsCost > 0 && (
                <p className="text-xs text-white/60 mt-1">+ Pub : {formatCurrency(simulationData.etsyAdsCost)}</p>
              )}
            </div>
            <div className="text-center border-x border-white/10">
              <p className="text-xs text-white/70 mb-1">Profit unitaire</p>
              <p className={`text-xl font-bold ${simulationData.profitPerUnit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(simulationData.profitPerUnit)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/70 mb-1">Marge</p>
              <p className={`text-xl font-bold ${simulationData.marginPercent > 30 ? 'text-emerald-400' : 'text-white'}`}>
                {simulationData.marginPercent.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Etsy Ads */}
        <div className="p-5 rounded-xl bg-black border border-white/10">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/10">
            <Zap size={18} className="text-[#00d4ff]" />
            <h3 className="text-base font-bold text-white">Etsy Ads</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white mb-1">Activer Etsy Ads</h4>
                <p className="text-sm text-white/70">
                  Activez la publicité pour accélérer la croissance et augmenter les ventes
                </p>
              </div>
              <button
                onClick={() => setUseEtsyAds(!useEtsyAds)}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00d4ff] focus:ring-offset-2 ${
                  useEtsyAds
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
                    : 'bg-black border border-white/10'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg ${
                    useEtsyAds ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Time to First Sale */}
        <div className="p-5 rounded-xl bg-black border border-white/10">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/10">
            <Clock size={18} className="text-[#00d4ff]" />
            <h3 className="text-base font-bold text-white">Temps estimé avant la première vente</h3>
          </div>
          
          <div className="space-y-4">
            <div className={`p-6 rounded-xl border-2 ${
              useEtsyAds
                ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white border-transparent shadow-lg shadow-[#00d4ff]/30'
                : 'bg-black border-[#00d4ff]'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {useEtsyAds ? (
                  <Zap size={24} className="text-white" />
                ) : (
                  <Clock size={24} className="text-[#00d4ff]" />
                )}
                <div>
                  <h4 className={`text-base font-bold ${useEtsyAds ? 'text-white' : 'text-[#00d4ff]'}`}>
                    {useEtsyAds ? 'Avec Etsy Ads' : 'Sans Etsy Ads'}
                  </h4>
                  <p className={`text-xs ${useEtsyAds ? 'text-white/70' : 'text-white/70'}`}>
                    {useEtsyAds ? 'Croissance accélérée' : 'Croissance organique'}
                  </p>
                </div>
              </div>
              <p className={`text-4xl font-bold mb-2 ${useEtsyAds ? 'text-white' : 'text-[#00d4ff]'}`}>
                {useEtsyAds 
                  ? analysis.launchSimulation?.timeToFirstSale?.withAds?.expected || 'N/A'
                  : analysis.launchSimulation?.timeToFirstSale?.withoutAds?.expected || 'N/A'
                }
                <span className={`text-lg font-normal ml-2 ${useEtsyAds ? 'text-white/70' : 'text-[#00d4ff]/70'}`}>jours</span>
              </p>
              <p className={`text-sm mb-3 ${useEtsyAds ? 'text-white/70' : 'text-white/70'}`}>
                {analysis.launchSimulation?.timeToFirstSale ? (
                  <>
                    Entre {
                      useEtsyAds
                        ? `${analysis.launchSimulation.timeToFirstSale.withAds?.min || 0} et ${analysis.launchSimulation.timeToFirstSale.withAds?.max || 0}`
                        : `${analysis.launchSimulation.timeToFirstSale.withoutAds?.min || 0} et ${analysis.launchSimulation.timeToFirstSale.withoutAds?.max || 0}`
                    } jours
                  </>
                ) : (
                  'Données non disponibles'
                )}
              </p>
              <p className={`text-xs ${useEtsyAds ? 'text-white/60' : 'text-white/60'}`}>
                Cette estimation est basée sur le score de potentiel de lancement du produit et reflète le comportement typique du marché Etsy.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-black border border-white/10">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-white/60 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/70 leading-relaxed">
                  <strong>Important :</strong> Tous les délais sont des estimations basées sur les conditions du marché et le positionnement du produit. Les résultats réels peuvent varier.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Projection 3 mois */}
        <div className="p-5 rounded-xl bg-black border border-white/10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <TrendingUp size={20} className="text-[#00d4ff]" />
              <h3 className="text-base font-bold text-white">Projection 3 mois</h3>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
              {analysis.launchSimulation?.successProbability ? formatPercentage(analysis.launchSimulation.successProbability) : 'N/A'} taux de réussite
            </span>
          </div>

          <div className="space-y-3">
            {[
              { key: 'prudent', label: 'Prudent', sublabel: 'Pessimiste', data: simulationData.prudent, highlight: false },
              { key: 'realiste', label: 'Réaliste', sublabel: 'Probable', data: simulationData.realiste, highlight: true },
              { key: 'optimise', label: 'Optimiste', sublabel: 'Meilleur', data: simulationData.optimise, highlight: false },
            ].map((scenario) => (
              <div 
                key={scenario.key}
                className={`p-4 rounded-lg transition-all ${
                  scenario.highlight 
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white' 
                    : 'bg-black border border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold">{scenario.label}</p>
                    <p className={`text-xs ${scenario.highlight ? 'text-white/70' : 'text-white/70'}`}>
                      {scenario.sublabel}
                    </p>
                  </div>
                  {scenario.highlight && (
                    <span className="px-2 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                      Recommandé
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                  {[
                    { label: 'Ventes', value: scenario.data.sales },
                    { label: 'Revenus', value: formatCurrency(scenario.data.revenue) },
                    { label: 'Coûts', value: formatCurrency(scenario.data.costs) },
                    { label: 'Profit', value: formatCurrency(scenario.data.profit), profit: true },
                    { label: 'Marge', value: `${scenario.data.margin.toFixed(0)}%` },
                  ].map((metric, i) => (
                    <div key={i} className="text-center">
                      <p className={`text-lg font-bold ${
                        metric.profit && scenario.data.profit > 0 
                          ? (scenario.highlight ? 'text-emerald-300' : 'text-emerald-400') 
                          : scenario.highlight ? 'text-white' : 'text-white'
                      }`}>
                        {typeof metric.value === 'number' ? formatNumber(metric.value) : metric.value}
                      </p>
                      <p className={`text-xs mt-0.5 ${scenario.highlight ? 'text-white/60' : 'text-white/70'}`}>
                        {metric.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Facteurs clés de succès */}
        <div className="p-5 rounded-xl bg-black border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <Award size={20} className={`${
              typeof window !== 'undefined' && (
                window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1'
              )
                ? 'text-[#00d4ff]'
                : 'text-amber-500'
            }`} />
            <h3 className="text-base font-bold text-white">Facteurs clés de succès</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(analysis.launchSimulation?.keyFactors || []).map((factor, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-black border border-white/10">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                  typeof window !== 'undefined' && (
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1'
                  )
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
                    : 'bg-amber-500'
                }`}>
                  {i + 1}
                </div>
                <span className="text-xs text-white">{factor}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

