'use client';

import { useState, useMemo } from 'react';
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
  Loader2
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Logo } from '@/components/ui';
import Link from 'next/link';
import { 
  formatCurrency, 
  getPhaseLabel,
  formatNumber,
  formatPercentage
} from '@/lib/utils';
import type { ProductAnalysis, Niche } from '@/types';
import dynamic from 'next/dynamic';

// Lazy loading du composant LaunchPotentialScore
const LaunchPotentialScore = dynamic(() => import('@/components/analysis/LaunchPotentialScore').then(mod => ({ default: mod.LaunchPotentialScore })), {
  loading: () => <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl border-2 border-slate-200 bg-white animate-pulse"><div className="h-32 bg-slate-100 rounded-lg"></div></div>,
  ssr: false,
});

type MainTab = 'analyse' | 'conception' | 'simulation';

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
    <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
            <Logo size="sm" showText={false} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">AI Image Prompt</h2>
            <p className="text-slate-500 text-xs">Use this prompt with your product photo in an AI image generation tool to create realistic, high-quality Etsy-style product images.</p>
          </div>
        </div>
      </div>

      {/* Prompt principal */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Universal AI Image Prompt</span>
          <button
            onClick={copyToClipboard}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              copiedMain 
                ? 'bg-emerald-500 text-white' 
                : 'bg-violet-500 text-white hover:bg-violet-600'
            }`}
          >
            {copiedMain ? <Check size={12} /> : <Copy size={12} />}
            {copiedMain ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="p-4 bg-white rounded-lg border border-violet-200 max-h-64 overflow-y-auto">
          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
            {prompt}
          </pre>
        </div>
        <p className="mt-2 text-[10px] text-slate-500 italic">
          ⚠️ This is a universal, fixed prompt that works for all products. Use it with your product photo in any AI image generation tool.
        </p>
      </div>

      {/* Instructions d'utilisation */}
      <div className="p-4 bg-white rounded-lg border border-violet-200">
        <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Info size={14} className="text-violet-500" />
          How to use this prompt?
        </h4>
        <ol className="space-y-2 text-xs text-slate-600">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">1</span>
            <span>Copy the prompt above</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">2</span>
            <span>Open ChatGPT, Midjourney or other image AI</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">3</span>
            <span>Import your product photo</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">4</span>
            <span>Paste the prompt and generate the image</span>
          </li>
        </ol>
        <p className="mt-3 text-[10px] text-slate-500 italic">
          This universal prompt is designed to produce realistic, high-quality Etsy-style product images. 
          The prompt is fixed and immutable - it works for all products without modification. 
          No text or logos will be added to the generated image.
        </p>
      </div>
    </div>
  );
}

const mainTabs = [
  { id: 'analyse' as MainTab, label: 'Analysis', icon: Activity },
  { id: 'conception' as MainTab, label: 'Product Sheet', icon: FileText },
  { id: 'simulation' as MainTab, label: 'Simulation', icon: Calculator },
];


export function ProductAnalysisView({ analysis }: { analysis: ProductAnalysis }) {
  const [activeTab, setActiveTab] = useState<MainTab>('analyse');
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);
  const [etsyDescription, setEtsyDescription] = useState<string | null>(null);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [copiedDescription, setCopiedDescription] = useState(false);
  const isMobile = useIsMobile();
  
  // Priorité au prix renseigné par l'utilisateur, sinon estimation IA
  const userSupplierPrice = analysis.product.price > 0 ? analysis.product.price : (analysis.verdict.estimatedSupplierPrice ?? 0);
  const aiEstimatedShippingCost = analysis.verdict.estimatedShippingCost ?? 0;
  
  
  const [sellingPrice, setSellingPrice] = useState<number>(analysis.pricing.recommendedPrice);
  const [shippingCost, setShippingCost] = useState<number>(aiEstimatedShippingCost);
  const [supplierPrice, setSupplierPrice] = useState<number>(userSupplierPrice);
  const [useEtsyAds, setUseEtsyAds] = useState<boolean>(false);
  
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
    
    const salesEstimates = {
      prudent: Math.round(analysis.launchSimulation.threeMonthProjection.conservative.estimatedSales * adsMultiplier),
      realiste: Math.round(analysis.launchSimulation.threeMonthProjection.realistic.estimatedSales * adsMultiplier),
      optimise: Math.round(analysis.launchSimulation.threeMonthProjection.optimistic.estimatedSales * adsMultiplier),
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
  }, [sellingPrice, shippingCost, supplierPrice, useEtsyAds, analysis.launchSimulation.threeMonthProjection]);

  const copyToClipboard = async (text: string, type: 'title' | 'tags' | 'description') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'title') {
        setCopiedTitle(true);
        setTimeout(() => setCopiedTitle(false), 2000);
      } else if (type === 'tags') {
        setCopiedTags(true);
        setTimeout(() => setCopiedTags(false), 2000);
      } else {
        setCopiedDescription(true);
        setTimeout(() => setCopiedDescription(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const generateEtsyDescription = async () => {
    if (etsyDescription) return; // Already generated
    
    setIsGeneratingDescription(true);
    try {
      const response = await fetch('/api/generate-etsy-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productVisualDescription: analysis.verdict.productVisualDescription || analysis.product.title,
          niche: analysis.niche,
          positioning: analysis.marketing?.strategic?.positioning?.mainPositioning,
          psychologicalTriggers: analysis.marketing?.strategic?.psychologicalTriggers,
          buyerMirror: undefined, // buyerMirror not available in current structure
          recommendedPrice: analysis.pricing.recommendedPrice,
          strengths: analysis.verdict.strengths,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate description');
      }

      const data = await response.json();
      setEtsyDescription(data.description);
    } catch (error) {
      console.error('Error generating description:', error);
      alert('Erreur lors de la génération de la description. Veuillez réessayer.');
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Titre Résultats */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-8">
        <motion.h1 
          className="text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
            Results
          </span>
        </motion.h1>
      </div>

      {/* Navigation onglets - Dropdown sur mobile, onglets sur desktop */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 py-2 px-4 sm:px-6 lg:px-8">
        <div className="w-full">
          {isMobile ? (
            // Dropdown sur mobile
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as MainTab)}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white border-0 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]"
            >
              {mainTabs.map((tab) => (
                <option key={tab.id} value={tab.id} className="bg-white text-slate-900">
                  {tab.label}
                </option>
              ))}
            </select>
          ) : (
            // Onglets horizontaux sur desktop
            <div className="flex items-center w-full">
              {mainTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all mx-1 ${
                      isActive 
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* ANALYSIS TAB */}
            {activeTab === 'analyse' && (
              <div className="space-y-4">
                {/* ⚠️ Avertissement si données de fallback utilisées */}
                {(analysis.dataSource === 'estimated' || analysis.verdict.warningIfAny) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={18} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-amber-900 mb-1 text-sm">⚠️ Données par défaut utilisées</h3>
                        <p className="text-sm text-amber-800 leading-relaxed">
                          {analysis.verdict.warningIfAny || 
                           'L\'API OpenAI n\'a pas pu répondre dans les temps (timeout >40s). Les résultats affichés sont des estimations par défaut et peuvent être moins précis. Veuillez réessayer avec une image plus petite ou vérifier les logs Netlify.'}
                        </p>
                        {analysis.dataSource === 'estimated' && (
                          <p className="text-xs text-amber-700 mt-2 italic">
                            Source des données: Estimations par défaut (API non disponible)
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                  {[
                    { icon: CircleDollarSign, label: 'Average market price', value: formatCurrency(analysis.competitors.averageMarketPrice || analysis.pricing.recommendedPrice), sub: analysis.competitors.marketPriceRange ? `${formatCurrency(analysis.competitors.marketPriceRange.min)} - ${formatCurrency(analysis.competitors.marketPriceRange.max)}` : 'Range', highlight: false },
                    { icon: TrendingUp, label: 'Recommended price', value: formatCurrency(analysis.pricing.recommendedPrice), sub: 'For your shop', highlight: true },
                    { icon: Star, label: 'Market phase', value: getPhaseLabel(analysis.saturation.phase), sub: 'Trend', highlight: false },
                  ].map((kpi, i) => {
                    const Icon = kpi.icon;
                    return (
                      <div
                        key={i}
                        className={`p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border ${
                          kpi.highlight 
                            ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] border-[#00d4ff] text-white' 
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className={`w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center mb-2 sm:mb-3 ${
                          kpi.highlight ? 'bg-white/20' : 'bg-slate-100'
                        }`}>
                          <Icon size={isMobile ? 14 : 18} className={kpi.highlight ? 'text-white' : 'text-slate-600'} />
                        </div>
                        <p className={`text-base sm:text-xl font-bold mb-1 ${kpi.highlight ? 'text-white' : 'text-slate-900'}`}>{kpi.value}</p>
                        <p className={`text-xs font-medium ${kpi.highlight ? 'text-white/80' : 'text-slate-500'}`}>{kpi.label}</p>
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
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <Info size={14} className="text-slate-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-700 mb-1">Estimation methodology</p>
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
                  <div className="p-5 rounded-xl bg-indigo-50 border border-indigo-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
                          <Eye size={20} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">AI Vision</h3>
                          <p className="text-xs text-slate-500">Optimized search for Etsy</p>
                        </div>
                      </div>
                      <a
                        href={`https://www.etsy.com/search?q=${encodeURIComponent(analysis.verdict.etsySearchQuery)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Search size={14} />
                        View on Etsy
                      </a>
                    </div>
                    {analysis.verdict.productVisualDescription && (
                      <p className="text-sm text-slate-600 italic mb-3">
                        &quot;{analysis.verdict.productVisualDescription}&quot;
                      </p>
                    )}
                    <div className="p-3 bg-white rounded-lg border border-indigo-200">
                      <div className="flex items-center gap-2">
                        <Search size={16} className="text-[#00d4ff]" />
                        <span className="text-sm text-[#00d4ff] font-medium">{analysis.verdict.etsySearchQuery}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Forces et Risques */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-4 sm:p-5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <Award size={isMobile ? 16 : 18} className="text-white" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">Strengths</h3>
                    </div>
                    <ul className="space-y-1.5 sm:space-y-2">
                      {analysis.verdict.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check size={isMobile ? 10 : 12} className="text-white" />
                          </div>
                          <span className="text-xs sm:text-sm text-slate-600">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 sm:p-5 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={isMobile ? 16 : 18} className="text-white" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">Watchpoints</h3>
                    </div>
                    <ul className="space-y-1.5 sm:space-y-2">
                      {analysis.verdict.risks.map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <AlertTriangle size={isMobile ? 10 : 12} className="text-white" />
                          </div>
                          <span className="text-xs sm:text-sm text-slate-600">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* PRODUCT SHEET TAB */}
            {activeTab === 'conception' && (
              <div className="space-y-6">
                {analysis.verdict.viralTitleEN && (
                  <div className="p-5 rounded-xl bg-white border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center">
                          <PenTool size={20} className="text-white" />
                        </div>
                        <h2 className="text-base font-bold text-slate-900">Optimized SEO Title</h2>
                      </div>
                      <button
                        onClick={() => copyToClipboard(analysis.verdict.viralTitleEN!, 'title')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          copiedTitle 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {copiedTitle ? <Check size={14} /> : <Copy size={14} />}
                        {copiedTitle ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-cyan-50 border border-cyan-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-cyan-600">English</span>
                          <span className="text-xs text-slate-500">{analysis.verdict.viralTitleEN.length}/140</span>
                        </div>
                        <p className="text-sm font-medium text-slate-900">{analysis.verdict.viralTitleEN}</p>
                      </div>
                      
                      {analysis.verdict.viralTitleFR && (
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">French</span>
                          <p className="text-sm text-slate-700">{analysis.verdict.viralTitleFR}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* DESCRIPTION ETSY */}
                {analysis.verdict.verdict !== 'avoid' && (
                  <div className="p-5 rounded-xl bg-white border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                          <FileText size={20} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Etsy Description</h3>
                          <p className="text-xs text-slate-500">Optimized description for Etsy (in English)</p>
                        </div>
                      </div>
                      {etsyDescription && (
                        <button
                          onClick={() => copyToClipboard(etsyDescription, 'description')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            copiedDescription 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {copiedDescription ? <Check size={14} /> : <Copy size={14} />}
                          {copiedDescription ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>

                    {!etsyDescription ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-slate-600 mb-4">
                          Cette description est générée par l&apos;IA à partir de l&apos;analyse du produit et des comportements d&apos;achat sur Etsy.
                        </p>
                        <button
                          onClick={generateEtsyDescription}
                          disabled={isGeneratingDescription}
                          className="px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingDescription ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Génération en cours...
                            </span>
                          ) : (
                            'Generate description'
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                          <p className="text-sm text-slate-600 mb-2">
                            You can copy and use it directly in your product listing.
                          </p>
                          <div className="p-4 bg-white rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                            <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                              {etsyDescription}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {analysis.verdict.seoTags && analysis.verdict.seoTags.length > 0 && (
                  <div className="p-5 rounded-xl bg-white border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Hash size={20} className="text-cyan-500" />
                        <h3 className="text-base font-bold text-slate-900">Tags Etsy ({analysis.verdict.seoTags.length}/13)</h3>
                      </div>
                      <button
                        onClick={() => copyToClipboard(analysis.verdict.seoTags!.join(', '), 'tags')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          copiedTags 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {copiedTags ? <Check size={12} /> : <Copy size={12} />}
                        {copiedTags ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.verdict.seoTags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-lg border border-cyan-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-3 mb-5">
                    <CircleDollarSign size={20} className="text-[#00d4ff]" />
                    <h3 className="text-base font-bold text-slate-900">Pricing Strategy</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Optimal', sublabel: 'Recommended', price: analysis.pricing.recommendedPrice, active: true },
                      { label: 'Premium', sublabel: 'Max margin', price: analysis.pricing.premiumPrice, active: false },
                    ].map((p, i) => (
                      <div 
                        key={i} 
                        className={`p-4 rounded-xl text-center transition-all ${
                          p.active 
                            ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white' 
                            : 'bg-slate-50 border border-slate-200'
                        }`}
                      >
                        <p className={`text-xs font-medium mb-1 ${p.active ? 'text-white/80' : 'text-slate-500'}`}>{p.sublabel}</p>
                        <p className="text-xl font-bold mb-0.5">{formatCurrency(p.price)}</p>
                        <p className={`text-xs font-semibold ${p.active ? 'text-white/90' : 'text-slate-600'}`}>{p.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PROMPT CRÉATIF POUR IMAGES PUBLICITAIRES */}
                <CreativePromptGenerator 
                  productDescription={analysis.verdict.productVisualDescription || analysis.product.title}
                  niche={analysis.niche}
                  positioning={analysis.marketing?.strategic?.positioning?.mainPositioning}
                  psychologicalTriggers={analysis.marketing?.strategic?.psychologicalTriggers}
                  competitorMistakes={analysis.marketing?.strategic?.competitorMistakes}
                />
              </div>
            )}

            {/* SIMULATION TAB */}
            {activeTab === 'simulation' && (
              <div className="space-y-6">
                <div className="p-5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                      <Calculator size={20} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Profit calculator</h2>
                      <p className="text-slate-500 text-xs">Adjust values to see projections</p>
                    </div>
                  </div>
                  
                  {analysis.verdict.supplierPriceReasoning && (
                    <div className="mb-5 p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Analyse IA</p>
                      <p className="text-sm text-slate-700">{analysis.verdict.supplierPriceReasoning}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
                    {[
                      { 
                        label: 'Supplier price', 
                        value: supplierPrice, 
                        setValue: setSupplierPrice, 
                        hint: analysis.product.price > 0 
                          ? `Price entered: ${formatCurrency(analysis.product.price)}` 
                          : `Est IA: ${formatCurrency(analysis.verdict.estimatedSupplierPrice ?? 0)}` 
                      },
                      { label: 'Shipping cost', value: shippingCost, setValue: setShippingCost, hint: `Est: ${formatCurrency(aiEstimatedShippingCost)}` },
                      { label: 'Selling price', value: sellingPrice, setValue: setSellingPrice, hint: `Rec: ${formatCurrency(analysis.pricing.recommendedPrice)}`, highlight: true },
                    ].map((field, i) => (
                      <div key={i}>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                          {field.label}
                        </label>
                        <div className="relative">
                          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${field.highlight ? 'text-[#00d4ff]' : 'text-slate-400'}`}>$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={field.value}
                            onChange={(e) => field.setValue(parseFloat(e.target.value) || 0)}
                            className={`w-full pl-8 pr-3 py-3 rounded-lg text-lg font-bold focus:ring-0 focus:outline-none transition-colors ${
                              field.highlight 
                                ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]/10 border border-[#00d4ff] text-slate-900 focus:border-[#00d4ff]' 
                                : 'bg-slate-50 border border-slate-200 text-slate-900 focus:border-slate-400'
                            }`}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{field.hint}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">Unit cost</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(simulationData.costPerUnit)}</p>
                      {useEtsyAds && simulationData.etsyAdsCost > 0 && (
                        <p className="text-xs text-slate-400 mt-1">+ Ads: {formatCurrency(simulationData.etsyAdsCost)}</p>
                      )}
                    </div>
                    <div className="text-center border-x border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Unit profit</p>
                      <p className={`text-xl font-bold ${simulationData.profitPerUnit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(simulationData.profitPerUnit)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">Margin</p>
                      <p className={`text-xl font-bold ${simulationData.marginPercent > 30 ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {simulationData.marginPercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Etsy Ads Sub-tab */}
                <div className="p-5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200">
                    <Zap size={18} className="text-[#00d4ff]" />
                    <h3 className="text-base font-bold text-slate-900">Etsy Ads</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-bold text-slate-900 mb-1">Enable Etsy Ads</h4>
                        <p className="text-sm text-slate-500">
                          Activate advertising to accelerate growth and increase sales
                        </p>
                      </div>
                      {/* Toggle Switch */}
                      <button
                        onClick={() => setUseEtsyAds(!useEtsyAds)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00d4ff] focus:ring-offset-2 ${
                          useEtsyAds
                            ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
                            : 'bg-slate-300'
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

                {/* Time to First Sale Sub-tab */}
                <div className="p-5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200">
                    <Clock size={18} className="text-[#00d4ff]" />
                    <h3 className="text-base font-bold text-slate-900">Estimated time to first sale</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className={`p-6 rounded-xl border-2 ${
                      useEtsyAds
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white border-transparent shadow-lg shadow-[#00d4ff]/30'
                        : 'bg-white border-[#00d4ff] shadow-lg shadow-[#00d4ff]/20'
                    }`}>
                      <div className="flex items-center gap-3 mb-4">
                        {useEtsyAds ? (
                          <Zap size={24} className="text-white" />
                        ) : (
                          <Clock size={24} className="text-[#00d4ff]" />
                        )}
                        <div>
                          <h4 className={`text-base font-bold ${useEtsyAds ? 'text-white' : 'text-[#00d4ff]'}`}>
                            {useEtsyAds ? 'With Etsy Ads' : 'Without Etsy Ads'}
                          </h4>
                          <p className={`text-xs ${useEtsyAds ? 'text-white/70' : 'text-slate-500'}`}>
                            {useEtsyAds ? 'Accelerated growth' : 'Organic growth'}
                          </p>
                        </div>
                      </div>
                      <p className={`text-4xl font-bold mb-2 ${useEtsyAds ? 'text-white' : 'text-[#00d4ff]'}`}>
                        {useEtsyAds 
                          ? analysis.launchSimulation.timeToFirstSale.withAds.expected
                          : analysis.launchSimulation.timeToFirstSale.withoutAds.expected
                        }
                        <span className={`text-lg font-normal ml-2 ${useEtsyAds ? 'text-white/70' : 'text-[#00d4ff]/70'}`}>days</span>
                      </p>
                      <p className={`text-sm mb-3 ${useEtsyAds ? 'text-white/70' : 'text-slate-500'}`}>
                        Between {
                          useEtsyAds
                            ? `${analysis.launchSimulation.timeToFirstSale.withAds.min} and ${analysis.launchSimulation.timeToFirstSale.withAds.max}`
                            : `${analysis.launchSimulation.timeToFirstSale.withoutAds.min} and ${analysis.launchSimulation.timeToFirstSale.withoutAds.max}`
                        } days
                      </p>
                      <p className={`text-xs ${useEtsyAds ? 'text-white/60' : 'text-slate-400'}`}>
                        This estimate is based on the product&apos;s launch potential score and reflects typical Etsy market behavior without paid advertising.
                      </p>
                    </div>
                    
                    {/* Texte de transparence obligatoire */}
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-start gap-2">
                        <Info size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <strong>Important:</strong> All timelines are estimates based on market conditions and product positioning. Actual results may vary.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <TrendingUp size={20} className="text-[#00d4ff]" />
                      <h3 className="text-base font-bold text-slate-900">3 Month Projection</h3>
                    </div>
                    <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      {formatPercentage(analysis.launchSimulation.successProbability)} success rate
                    </span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: 'prudent', label: 'Conservative', sublabel: 'Pessimistic', data: simulationData.prudent, highlight: false },
                      { key: 'realiste', label: 'Realistic', sublabel: 'Probable', data: simulationData.realiste, highlight: true },
                      { key: 'optimise', label: 'Optimistic', sublabel: 'Best', data: simulationData.optimise, highlight: false },
                    ].map((scenario) => (
                      <div 
                        key={scenario.key}
                        className={`p-4 rounded-lg transition-all ${
                          scenario.highlight 
                            ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white' 
                            : 'bg-slate-50 border border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-bold">{scenario.label}</p>
                            <p className={`text-xs ${scenario.highlight ? 'text-white/70' : 'text-slate-500'}`}>
                              {scenario.sublabel}
                            </p>
                          </div>
                          {scenario.highlight && (
                            <span className="px-2 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                          {[
                            { label: 'Sales', value: scenario.data.sales },
                            { label: 'Revenue', value: formatCurrency(scenario.data.revenue) },
                            { label: 'Costs', value: formatCurrency(scenario.data.costs) },
                            { label: 'Profit', value: formatCurrency(scenario.data.profit), profit: true },
                            { label: 'Margin', value: `${scenario.data.margin.toFixed(0)}%` },
                          ].map((metric, i) => (
                            <div key={i} className="text-center">
                              <p className={`text-lg font-bold ${
                                metric.profit && scenario.data.profit > 0 
                                  ? (scenario.highlight ? 'text-emerald-300' : 'text-emerald-600') 
                                  : ''
                              }`}>
                                {typeof metric.value === 'number' ? formatNumber(metric.value) : metric.value}
                              </p>
                              <p className={`text-xs mt-0.5 ${scenario.highlight ? 'text-white/60' : 'text-slate-500'}`}>
                                {metric.label}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-3 mb-4">
                    <Award size={20} className="text-amber-500" />
                    <h3 className="text-base font-bold text-slate-900">Key Success Factors</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {analysis.launchSimulation.keyFactors.map((factor, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-amber-200">
                        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {i + 1}
                        </div>
                        <span className="text-xs text-slate-700">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function ResultsStep() {
  const { analyses, setStep } = useStore();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    analyses.length > 0 ? analyses[0].product.id : null
  );

  const selectedAnalysis = analyses.find((a) => a.product.id === selectedProductId);

  // ⚠️ Ce cas ne devrait JAMAIS se produire car l'analyse ne peut jamais échouer
  // Mais si ça arrive, on crée une analyse par défaut pour éviter une erreur
  if (!selectedAnalysis || analyses.length === 0) {
    // Fallback ultime - créer une analyse minimale pour éviter le crash
    console.warn('⚠️ No analyses found - this should never happen. Creating fallback analysis.');
    
    // Si on a des produits mais pas d'analyses, les analyses sont probablement en cours
    // Rediriger vers l'étape d'analyse
    setTimeout(() => {
      setStep(3);
    }, 100);
    
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#00d4ff] animate-spin mx-auto mb-4" />
          <p className="text-xl text-slate-900 mb-4">Preparing analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header avec Logo et Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        {/* Barre de progression fine */}
        <div className="h-0.5 bg-slate-100 relative">
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
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    {i < 3 ? <Check size={14} /> : '4'}
                  </div>
                  <span className={`text-sm hidden sm:block font-semibold transition-colors ${
                    i === 3 ? 'text-[#00d4ff]' : 'text-slate-400'
                  }`}>{stepName}</span>
                  {i < 3 && <div className="w-4 h-0.5 bg-slate-200 mx-1.5" />}
                </div>
              ))}
            </div>

            {/* Actions à droite */}
            <div className="flex items-center gap-3">
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
      <div className="fixed top-[76px] left-0 right-0 z-40 bg-white border-b border-slate-100 px-4 sm:px-6 lg:px-8 py-3">
        <div className="w-full flex items-center justify-between">
          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-semibold text-sm transition-all shadow-sm hover:shadow-md"
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
      <div className="pt-[140px] bg-white border-b border-slate-200 py-4 px-4 sm:px-6 lg:px-8">
        <div className="w-full">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
              {selectedAnalysis.product.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedAnalysis.product.images[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-7 h-7 text-slate-400" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate mb-1">{selectedAnalysis.product.title}</h1>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                  {selectedAnalysis.product.source === 'aliexpress' ? 'AliExpress' : 'Alibaba'}
                </span>
                <span className="text-[#00d4ff] font-bold text-sm">{formatCurrency(selectedAnalysis.product.price)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Navigation supprimée - un seul produit à la fois */}
              <a
                href={selectedAnalysis.product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Message obligatoire selon cahier des charges */}
      <div className="max-w-7xl mx-auto px-6 mb-6">
        <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 font-medium">
              <strong>Important:</strong> All analyses are based on the provided screenshot and public market data. Results are estimates and not guaranteed.
            </p>
          </div>
        </div>
      </div>

      <ProductAnalysisView analysis={selectedAnalysis} />
    </div>
  );
}
