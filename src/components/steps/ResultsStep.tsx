'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/useIsMobile';
import { 
  ArrowLeft, 
  Package, 
  Search,
  TrendingUp,
  Target,
  Users,
  ExternalLink,
  Eye,
  FileText,
  Lightbulb,
  PenTool,
  Hash,
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Star,
  Clock,
  Zap,
  Copy,
  Check,
  Info,
  Calculator,
  Activity,
  CircleDollarSign,
  ArrowUpRight,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Home,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Logo } from '@/components/ui';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useSubscription } from '@/hooks/useSubscription';
import { useRouter } from 'next/navigation';
import { 
  formatCurrency, 
  getPhaseLabel,
  formatNumber,
  formatPercentage
} from '@/lib/utils';
import type { ProductAnalysis, Niche } from '@/types';
import dynamic from 'next/dynamic';
import { ImageGenerator } from './ImageGenerator';

// Lazy loading du composant LaunchPotentialScore
const LaunchPotentialScore = dynamic(() => import('@/components/analysis/LaunchPotentialScore').then(mod => ({ default: mod.LaunchPotentialScore })), {
  loading: () => <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl border-2 border-white/10 bg-black animate-pulse"><div className="h-32 bg-black border border-white/10 rounded-lg"></div></div>,
  ssr: false,
});


// ═══════════════════════════════════════════════════════════════════════════════
// GÉNÉRATEUR DE PROMPT CRÉATIF POUR IMAGES PUBLICITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

interface PromptGeneratorProps {
  productDescription: string;
  niche: Niche;
  positioning?: string;
  psychologicalTriggers?: { trigger: string; explanation: string }[];
  competitorMistakes?: { mistake: string; frequency: string }[];
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PROMPT IA UNIVERSEL – ETSMART (VERSION DÉFINITIVE)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ⚠️ PROMPT UNIQUE, FIXE ET IMMUTABLE
 * Ce prompt ne doit JAMAIS être modifié ou adapté dynamiquement.
 * Il fonctionne pour tous les produits sans exception.
 * 
 * Source: Cahier des charges officiel Etsmart - Génération d'images produit via IA
 */
function getUniversalImagePrompt(): string {
  return `You are a professional lifestyle photographer specialized in high-converting product images for Etsy.

REFERENCE PRODUCT
Use the provided product image as the ONLY reference. The generated image must faithfully represent the exact same product.

CRITICAL RULE – EXACT PRODUCT FIDELITY
The product in the generated image must be IDENTICAL to the product shown in the reference image
Reproduce the product exactly as it appears: shape, proportions, colors, materials, textures, finishes, and details
If the product contains any writing, text, symbols, engravings, or markings, they must be reproduced EXACTLY as shown
Do NOT modify, enhance, stylize, or reinterpret the product in any way
The product must remain the central focus of the image

SCENE & CONTEXT
Create a realistic, natural lifestyle scene that shows the product in its ideal real-world usage context.
The environment must feel authentic, credible, and appropriate for the type of product.

BACKGROUND & DEPTH (MANDATORY)
The scene must include a natural background with visible depth
Use foreground and background separation to create a sense of space
The background should be softly blurred or naturally out of focus (depth of field)
Avoid flat, empty, or plain backgrounds

MOOD & EMOTION
Calm, pleasant, and inviting atmosphere
Emotion to convey: comfort, trust, and desirability
Style: premium Etsy lifestyle photography (authentic, warm, aspirational, not commercial or artificial)

PHOTOGRAPHY STYLE
Soft natural lighting only (no artificial flash)
Ultra-realistic photo rendering
Natural depth of field
Balanced, harmonious colors
Clean and engaging camera angle

ABSOLUTE PROHIBITIONS (outside of the product itself)
NO added text
NO added logos
NO brand names
NO watermarks
NO price tags
NO badges, stickers, or icons
NO artificial marketing elements
NO frames, borders, overlays, or graphic elements
NO flat catalog-style photography

The final image should look like a high-quality Etsy listing photo and naturally make people want to click and buy.`;
}

/**
 * ⚠️ DÉPRÉCIÉ: Cette fonction est conservée pour compatibilité mais ne doit plus être utilisée.
 * Utiliser getUniversalImagePrompt() à la place.
 */
function generateCreativePrompt(props: PromptGeneratorProps): { main: string; variant?: string } {
  // Retourner le prompt universel fixe (pas de génération dynamique)
  return { main: getUniversalImagePrompt() };
}

function CreativePromptGenerator({ 
  productDescription, 
  niche, 
  positioning, 
  psychologicalTriggers,
  competitorMistakes 
}: PromptGeneratorProps) {
  const [copiedMain, setCopiedMain] = useState(false);

  // ⚠️ PROMPT UNIQUE, FIXE ET IMMUTABLE - Pas de génération dynamique
  const prompt = useMemo(() => getUniversalImagePrompt(), []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedMain(true);
      setTimeout(() => setCopiedMain(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-black border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            typeof window !== 'undefined' && (
              window.location.hostname === 'localhost' || 
              window.location.hostname === '127.0.0.1'
            )
              ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
              : 'bg-gradient-to-br from-violet-500 to-indigo-500'
          }`}>
            <Logo size="sm" showText={false} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Prompt IA pour images</h2>
            <p className="text-white/70 text-xs">Utilisez ce prompt avec votre photo de produit dans un outil de génération d'images IA pour créer des images produit réalistes et de haute qualité.</p>
          </div>
        </div>
      </div>

      {/* Prompt principal */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wide">Prompt IA universel</span>
          <button
            onClick={copyToClipboard}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              copiedMain 
                ? 'bg-emerald-500 text-white' 
                : typeof window !== 'undefined' && (
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1'
                  )
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white hover:opacity-90'
                    : 'bg-violet-500 text-white hover:bg-violet-600'
            }`}
          >
            {copiedMain ? <Check size={12} /> : <Copy size={12} />}
            {copiedMain ? 'Copié !' : 'Copier'}
          </button>
        </div>
        <div className="p-4 bg-black rounded-lg border border-white/10 max-h-64 overflow-y-auto">
          <pre className="text-xs text-white whitespace-pre-wrap font-mono leading-relaxed">
            {prompt}
          </pre>
        </div>
        <p className="mt-2 text-[10px] text-white/70 italic">
          ⚠️ Ce prompt universel et fixe fonctionne pour tous les produits. Utilisez-le avec votre photo de produit dans n'importe quel outil de génération d'images IA.
        </p>
      </div>

      {/* Instructions d'utilisation */}
      <div className="p-4 bg-black rounded-lg border border-white/10">
        <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
          <Info size={14} className="text-[#00d4ff]" />
          Comment utiliser ce prompt ?
        </h4>
        <ol className="space-y-2 text-xs text-white/80">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-black border border-[#00d4ff] text-[#00d4ff] flex items-center justify-center flex-shrink-0 font-bold text-[10px]">1</span>
            <span>Copiez le prompt ci-dessus</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-black border border-[#00d4ff] text-[#00d4ff] flex items-center justify-center flex-shrink-0 font-bold text-[10px]">2</span>
            <span>Ouvrez ChatGPT, Midjourney ou autre IA d'images</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-black border border-[#00d4ff] text-[#00d4ff] flex items-center justify-center flex-shrink-0 font-bold text-[10px]">3</span>
            <span>Importez votre photo de produit</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-black border border-[#00d4ff] text-[#00d4ff] flex items-center justify-center flex-shrink-0 font-bold text-[10px]">4</span>
            <span>Collez le prompt et générez l'image</span>
          </li>
        </ol>
        <p className="mt-3 text-[10px] text-white/70 italic">
          Ce prompt universel est conçu pour produire des images produit réalistes et de haute qualité style Etsy. 
          Le prompt est fixe et immuable - il fonctionne pour tous les produits sans modification. 
          Aucun texte ou logo ne sera ajouté à l'image générée.
        </p>
      </div>
    </div>
  );
}



export function ProductAnalysisView({ analysis, hideTitle = false }: { analysis: ProductAnalysis; hideTitle?: boolean }) {
  // Vérifier si on est sur localhost
  const [isLocalhost, setIsLocalhost] = useState(false);
  
  useEffect(() => {
    setIsLocalhost(
      typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1'
      )
    );
  }, []);

  // Plus d'onglets - seulement Analyse et Simulation
  // Le Listing et Images est maintenant une fonctionnalité séparée dans le dashboard
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
    <div className="min-h-screen bg-black">
      {/* Titre Résultats - Masqué si hideTitle est true */}
      {!hideTitle && (
        <div className="bg-black border-b border-white/10 px-4 sm:px-6 lg:px-8 py-8">
          <motion.h1 
            className="text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
              Résultats
            </span>
          </motion.h1>
        </div>
      )}

      {/* Contenu - Plus d'onglets, seulement Analyse et Simulation */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* ANALYSE ET SIMULATION - Contenu unique */}
          <div className="space-y-6">
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
                        <p className="text-xs font-medium text-slate-700 mb-1">Méthodologie d'estimation</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{analysis.competitors.competitorEstimationReasoning}</p>
                        {analysis.competitors.marketPriceReasoning && (
                          <p className="text-xs text-slate-500 mt-2 italic">{analysis.competitors.marketPriceReasoning}</p>
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
                        <Search size={14} />
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
                        <Search size={16} className="text-[#00d4ff]" />
                        <span className="text-sm text-[#00d4ff] font-medium">{analysis.verdict.etsySearchQuery}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Forces et Risques */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                </div>
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
            </div>
          </motion.div>
      </div>
    </div>
  );
}

export function ResultsStep() {
  const { analyses: storeAnalyses, setStep } = useStore();
  const [dbAnalyses, setDbAnalyses] = useState<ProductAnalysis[]>([]);
  // Initialiser isLoading à false si on a déjà des analyses en store (évite le chargement au retour)
  const [isLoading, setIsLoading] = useState(() => storeAnalyses.length === 0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const { subscription } = useSubscription();
  const router = useRouter();
  const hasRedirectedRef = useRef(false);
  
  // Charger les analyses depuis la DB au montage UNE SEULE FOIS
  // Ne pas recharger si on revient sur l'onglet (évite les rechargements inutiles)
  useEffect(() => {
    // Si on a déjà chargé une fois, ne pas recharger
    if (hasLoadedOnce) {
      setIsLoading(false);
      return;
    }
    
    // Si on a déjà des analyses en store, on peut afficher directement
    if (storeAnalyses.length > 0) {
      setIsLoading(false);
    }
    
    const loadAndSaveAnalyses = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }
        
        const { analysisDb } = await import('@/lib/db/analyses');
        const { productDb } = await import('@/lib/db/products');
        
        // ═══════════════════════════════════════════════════════════════════════════
        // SAUVEGARDE GARANTIE: Chaque analyse DOIT être sauvegardée dans l'historique
        // Cette fonction est appelée à chaque montage de ResultsStep
        // ═══════════════════════════════════════════════════════════════════════════
        if (storeAnalyses.length > 0) {
          for (const analysis of storeAnalyses) {
            try {
              console.log('💾 [HISTORY SAVE] Starting save for:', analysis.product.title?.substring(0, 40));
              
              // ÉTAPE 1: Créer ou trouver le produit dans la base de données
              let dbProductId: string | null = null;
              
              // Chercher d'abord par URL (identifiant unique du produit)
              const { data: existingByUrl } = await supabase
                  .from('products')
                  .select('id')
                  .eq('user_id', user.id)
                  .eq('url', analysis.product.url)
                  .limit(1);
                
              if (existingByUrl && existingByUrl.length > 0) {
                dbProductId = existingByUrl[0].id;
                console.log('✅ [HISTORY] Found existing product by URL:', dbProductId);
                } else {
                // Créer un nouveau produit dans la base de données
                try {
                  const { data: newProduct, error: createError } = await supabase
                    .from('products')
                    .insert({
                      user_id: user.id,
                      url: analysis.product.url || `local-${Date.now()}`,
                      source: analysis.product.source || 'aliexpress',
                      title: analysis.product.title || 'Product',
                      description: analysis.product.description || '',
                      images: analysis.product.images || [],
                      price: analysis.product.price || 0,
                      currency: analysis.product.currency || 'USD',
                      category: analysis.niche || 'custom',
                      shipping_time: analysis.product.shippingTime || '',
                      min_order_quantity: analysis.product.minOrderQuantity || 1,
                      supplier_rating: analysis.product.supplierRating || 0,
                      niche: analysis.niche || 'custom',
                    })
                    .select('id')
                    .single();
                  
                  if (createError) {
                    console.error('❌ [HISTORY] Product creation error:', createError.message);
                  } else if (newProduct) {
                    dbProductId = newProduct.id;
                    console.log('✅ [HISTORY] New product created:', dbProductId);
                  }
                } catch (insertError: any) {
                  console.error('❌ [HISTORY] Product insert exception:', insertError?.message);
                }
              }
              
              // ÉTAPE 2: Sauvegarder l'analyse avec le product_id correct
              if (dbProductId) {
              const analysisToSave = {
                ...analysis,
                  product: { ...analysis.product, id: dbProductId }
              };
              
                try {
              await analysisDb.saveAnalysis(user.id, analysisToSave);
                  console.log('✅ [HISTORY] Analysis saved successfully!', analysis.product.title?.substring(0, 30));
                } catch (analysisError: any) {
                  console.error('❌ [HISTORY] Analysis save error:', analysisError?.message);
                  
                  // Tentative de sauvegarde directe si l'upsert échoue
                  try {
                    const { error: directError } = await supabase
                      .from('product_analyses')
                      .insert({
                        product_id: dbProductId,
                        user_id: user.id,
                        verdict: analysis.verdict?.verdict || 'test',
                        confidence_score: analysis.verdict?.confidenceScore || 50,
                        summary: analysis.verdict?.summary || '',
                        full_analysis_data: analysis,
                      });
                    
                    if (directError) {
                      console.error('❌ [HISTORY] Direct insert also failed:', directError.message);
                    } else {
                      console.log('✅ [HISTORY] Analysis saved via direct insert!');
                    }
                  } catch (directException: any) {
                    console.error('❌ [HISTORY] Direct insert exception:', directException?.message);
                  }
                }
              } else {
                console.error('❌ [HISTORY] No product ID available, cannot save analysis');
              }
            } catch (saveError: any) {
              console.error('❌ [HISTORY] Global save error:', saveError?.message || saveError);
            }
          }
        }
        
        // Charger les analyses depuis la DB (en arrière-plan, ne bloque pas l'affichage)
        const analyses = await analysisDb.getAnalyses(user.id);
        setDbAnalyses(analyses);
        console.log('📊 Loaded', analyses.length, 'analyses from database');
        setHasLoadedOnce(true);
      } catch (error) {
        console.error('Error loading/saving analyses:', error);
      } finally {
        setIsLoading(false);
        setHasLoadedOnce(true); // Marquer comme chargé même en cas d'erreur
      }
    };
    
    // Ne charger que si on n'a pas encore chargé ET qu'on n'a pas d'analyses en store
    if (!hasLoadedOnce && storeAnalyses.length === 0) {
      loadAndSaveAnalyses();
    } else {
      // Si on a déjà des données, ne pas charger et ne pas afficher le chargement
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [storeAnalyses, hasLoadedOnce]);

  // ⚠️ NOTE: La redirection automatique vers la page de listing a été retirée
  // L'utilisateur peut maintenant voir les résultats et choisir de naviguer vers le listing manuellement
  
  // Récupérer le produit actuel du store pour identifier l'analyse à afficher
  const { products: currentProducts } = useStore();
  const currentProductId = currentProducts.length > 0 ? currentProducts[0].id : null;
  
  // Combiner store et DB, en priorisant le store pour l'analyse récente
  const allAnalyses = [...storeAnalyses, ...dbAnalyses.filter(db => !storeAnalyses.some(s => s.product.id === db.product.id))];
  
  // VERROUILLAGE TOTAL: Trouver l'analyse du produit actuel UNE FOIS et ne JAMAIS changer
  const findAndLockAnalysis = useCallback(() => {
    // PRIORITÉ 1: Si on a un currentProductId, chercher cette analyse spécifique
    if (currentProductId) {
      // Chercher dans le store
      if (storeAnalyses.length > 0) {
        const storeAnalysis = storeAnalyses.find(a => a.product.id === currentProductId);
        if (storeAnalysis) {
          console.log('🔒🔒🔒 LOCKED: Store analysis for current product:', currentProductId);
          return storeAnalysis;
        }
      }
      
      // Chercher dans la DB
      if (dbAnalyses.length > 0) {
        const dbAnalysis = dbAnalyses.find(a => a.product.id === currentProductId);
        if (dbAnalysis) {
          console.log('🔒🔒🔒 LOCKED: DB analysis for current product:', currentProductId);
          return dbAnalysis;
        }
      }
    }
    
    // PRIORITÉ 2: Pas de currentProductId, prendre la première analyse disponible
    if (storeAnalyses.length > 0) {
      console.log('🔒 FALLBACK: First store analysis');
      return storeAnalyses[0];
    }
    
    // PRIORITÉ 3: Prendre la première analyse de la DB (la plus récente)
    if (dbAnalyses.length > 0) {
      console.log('🔒 FALLBACK: First DB analysis (most recent)');
      return dbAnalyses[0];
    }
    
    return null;
  }, [currentProductId, storeAnalyses, dbAnalyses]);
  
  // Initialiser UNE SEULE FOIS avec l'analyse du produit actuel - NE JAMAIS CHANGER
  const lockedAnalysisRef = useRef<ProductAnalysis | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  // Effect pour trouver et verrouiller l'analyse
  useEffect(() => {
    // Si on a déjà une analyse verrouillée qui existe toujours, NE RIEN FAIRE
    if (lockedAnalysisRef.current) {
      const stillExists = allAnalyses.some(a => a.product.id === lockedAnalysisRef.current?.product.id);
      if (stillExists) {
        console.log('🔒 KEEPING LOCKED ANALYSIS:', lockedAnalysisRef.current.product.id);
        return;
      }
    }
    
    // Sinon, chercher et verrouiller une analyse
    const analysis = findAndLockAnalysis();
    if (analysis) {
      lockedAnalysisRef.current = analysis;
      console.log('🔒 LOCKING ANALYSIS:', analysis.product.id);
      setSelectedProductId(analysis.product.id);
    }
  }, [findAndLockAnalysis, allAnalyses]);
  
  // Trouver l'analyse sélectionnée - utiliser celle verrouillée si disponible
  const selectedAnalysis = lockedAnalysisRef.current || allAnalyses.find((a) => a.product.id === selectedProductId) || (allAnalyses.length > 0 ? allAnalyses[0] : null);
  
  // ⚠️ NE PAS nettoyer le store - garder les analyses en mémoire pour la persistance
  // Les analyses restent dans le store pour permettre de revenir sur la page

  // ⚠️ Afficher le chargement SEULEMENT si on n'a vraiment aucune donnée
  // Si on a des analyses en store ou en DB, on peut afficher directement
  const hasAnyData = storeAnalyses.length > 0 || dbAnalyses.length > 0;
  
  // Ne jamais afficher de loader si on a déjà chargé une fois dans cette session
  const hasLoadedInSession = typeof window !== 'undefined' && sessionStorage.getItem('etsmart-results-loaded') === 'true';
  
  // Marquer comme chargé une fois qu'on a des données
  useEffect(() => {
    if (hasAnyData && !isLoading) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('etsmart-results-loaded', 'true');
      }
    }
  }, [hasAnyData, isLoading]);
  
  // Ne pas afficher de loader si on a déjà chargé dans cette session
  if (isLoading && !hasAnyData && !hasLoadedInSession) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#00d4ff] animate-spin mx-auto mb-4" />
          <p className="text-xl text-slate-900 mb-4">Chargement de l'analyse...</p>
        </div>
      </div>
    );
  }

  // ⚠️ Si pas d'analyses après chargement, afficher un message
  // On vérifie si on a une analyse sélectionnée OU s'il y a des analyses disponibles
  const hasAnyAnalysis = selectedAnalysis || allAnalyses.length > 0;
  
  if (!hasAnyAnalysis) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Aucune analyse trouvée</h2>
          <p className="text-slate-600 mb-6">
            Aucun résultat d'analyse n'est disponible. Veuillez lancer une nouvelle analyse.
          </p>
          <button
            onClick={() => setStep(1)}
            className="px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-xl hover:opacity-90 transition-all"
          >
            Nouvelle analyse
          </button>
        </div>
      </div>
    );
  }
  
  // Si on a des analyses mais pas encore de sélection, prendre la première
  const analysisToShow = selectedAnalysis || allAnalyses[0];
  
  if (!analysisToShow) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#00d4ff] animate-spin mx-auto mb-4" />
          <p className="text-xl text-slate-900 mb-4">Chargement de l'analyse...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header avec Logo et Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-white/10">
        {/* Barre de progression fine */}
        <div className="h-0.5 bg-white/10 relative">
          <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]" />
        </div>
        
        {/* Header principal */}
        <div className="px-4 sm:px-6 lg:px-8 py-3">
          <div className="w-full flex items-center justify-between gap-4">
            {/* Logo Etsmart */}
            <Link href="/" className="flex items-center gap-3 group">
              <Logo size="md" showText={true} />
            </Link>

            {/* Stepper au centre */}
            <div className="flex items-center gap-3 flex-1 justify-center max-w-2xl">
              {['Niche', 'Produits', 'Analyse', 'Résultats'].map((stepName, i) => (
                <div key={stepName} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i === 3 
                      ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-md shadow-[#00d4ff]/30' 
                      : 'bg-black border border-white/10 text-slate-400'
                  }`}>
                    {i < 3 ? <Check size={14} /> : '4'}
                  </div>
                  <span className={`text-sm hidden sm:block font-semibold transition-colors ${
                    i === 3 ? 'text-[#00d4ff]' : 'text-slate-400'
                  }`}>{stepName}</span>
                  {i < 3 && <div className="w-4 h-0.5 bg-white/10 mx-1.5" />}
                </div>
              ))}
            </div>

            {/* Actions à droite */}
            <div className="flex items-center gap-3">
              {/* Quota Indicator */}
              {subscription && subscription.status === 'active' && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#00d4ff]/10 to-[#00c9b7]/10 border border-[#00d4ff]/30">
                  <Zap size={14} className="text-[#00d4ff]" />
                  <span className="text-sm font-semibold text-slate-700">
                    {subscription.used % 1 === 0 ? subscription.used : subscription.used.toFixed(1)}/{subscription.quota}
                  </span>
                </div>
              )}
              <button
                onClick={() => setStep(1)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#00d4ff] hover:bg-[#00d4ff]/10 hover:text-[#00b8e6] transition-all"
              >
                Nouvelle analyse
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bouton Retour visible */}
      <div className="fixed top-[76px] left-0 right-0 z-40 bg-black border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3">
        <div className="w-full flex items-center justify-between">
          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black hover:bg-black border border-white/10 hover:border-white/20 text-white hover:text-white font-semibold text-sm transition-all shadow-sm hover:shadow-md"
          >
            <ArrowLeft size={18} />
            Retour à l&apos;import
          </button>

          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00d4ff]/10 to-[#00c9b7]/10 hover:from-[#00d4ff]/20 hover:to-[#00c9b7]/20 border border-[#00d4ff]/20 text-[#00d4ff] hover:text-[#00b8e6] font-semibold text-sm transition-all"
          >
            <Home size={18} />
            <span className="hidden sm:inline">Accueil</span>
          </Link>
        </div>
      </div>

      {/* En-tête produit */}
      <div className="pt-[140px] bg-black border-b border-white/10 py-4 px-4 sm:px-6 lg:px-8">
        <div className="w-full">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-black border border-white/10 flex-shrink-0 border border-slate-200">
              {analysisToShow.product.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={analysisToShow.product.images[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-7 h-7 text-slate-400" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate mb-1">{analysisToShow.product.title}</h1>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded-md bg-black border border-white/10 text-slate-600 text-xs font-medium">
                  {analysisToShow.product.source === 'aliexpress' ? 'AliExpress' : 'Alibaba'}
                </span>
                <span className="text-[#00d4ff] font-bold text-sm">{formatCurrency(analysisToShow.product.price)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Navigation supprimée - un seul produit à la fois */}
              <a
                href={analysisToShow.product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-black border border-white/10 text-slate-600 hover:text-slate-900 hover:bg-white/10 transition-colors"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>

      <ProductAnalysisView analysis={analysisToShow} />
    </div>
  );
}
