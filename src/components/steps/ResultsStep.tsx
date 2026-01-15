'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Package, 
  Search,
  TrendingUp,
  Target,
  Users,
  ExternalLink,
  Sparkles,
  Eye,
  Megaphone,
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
  Home
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Logo } from '@/components/ui';
import Link from 'next/link';
import { 
  formatCurrency, 
  getVerdictLabel, 
  getPhaseLabel,
  formatNumber,
  formatPercentage
} from '@/lib/utils';
import type { ProductAnalysis, Niche } from '@/types';
import { AcquisitionMarketing } from '@/components/analysis/AcquisitionMarketing';

type MainTab = 'analyse' | 'marketing' | 'conception' | 'simulation';

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

function generateCreativePrompt(props: PromptGeneratorProps): { main: string; variant?: string } {
  const { productDescription, niche, positioning, psychologicalTriggers, competitorMistakes } = props;

  // Déterminer le moteur d'achat
  const isForPleasure = psychologicalTriggers?.some(t => 
    t.trigger.toLowerCase().includes('plaisir') || 
    t.trigger.toLowerCase().includes('fun') ||
    t.trigger.toLowerCase().includes('joie') ||
    t.trigger.toLowerCase().includes('cadeau') ||
    t.trigger.toLowerCase().includes('bonheur')
  );

  // Déterminer l'ambiance selon la niche
  const nicheAmbiance: Record<string, string> = {
    'home-decor': 'intérieur chaleureux et accueillant, lumière douce de fin d\'après-midi',
    'jewelry': 'lumière naturelle délicate, arrière-plan épuré et élégant',
    'pets': 'ambiance joyeuse et vivante, environnement familial',
    'baby': 'atmosphère douce et tendre, tons pastels naturels',
    'wedding': 'ambiance romantique et élégante, lumière dorée',
    'personalized-gifts': 'moment émotionnel et authentique, cadre intime',
    'wellness': 'ambiance zen et apaisante, lumière naturelle douce',
    'art': 'mise en valeur artistique, éclairage de galerie naturel',
    'vintage': 'atmosphère nostalgique et authentique, lumière chaude',
    'crafts': 'environnement créatif et artisanal, lumière naturelle d\'atelier',
  };

  const ambiance = nicheAmbiance[niche] || 'lumière naturelle, ambiance lifestyle authentique';

  // Déterminer l'émotion
  const emotion = isForPleasure 
    ? 'joie, plaisir et satisfaction'
    : 'confort, sérénité et bien-être';

  // Construire le prompt principal
  const mainPrompt = `Tu es un photographe lifestyle spécialisé dans les photos produits pour Etsy.

PRODUIT À PHOTOGRAPHIER :
Utilise la photo du produit fournie comme référence principale. Le produit est : ${productDescription}

⚠️ RÈGLE CRITIQUE - REPRODUCTION EXACTE :
- Reprends EXACTEMENT le produit tel qu'il apparaît sur la photo importée
- Si le produit a des écritures, textes, logos ou inscriptions dessus, REPRODUIS-LES EXACTEMENT
- Le produit sur l'image générée doit être IDENTIQUE au produit de la photo importée
- Place le produit exactement comme sur la photo de référence
- Conserve toutes les caractéristiques visuelles du produit original (couleurs, textures, détails, écritures)

SCÈNE À CRÉER :
Crée une mise en situation réaliste et naturelle montrant le produit en cours d'utilisation ou dans son contexte d'usage idéal.
${positioning ? `Positionnement marketing : ${positioning}` : ''}

AMBIANCE :
- ${ambiance}
- Émotion à transmettre : ${emotion}
- Style : photo lifestyle premium pour Etsy, authentique et aspirationnel

CONSIGNES TECHNIQUES :
- Lumière naturelle douce, pas de flash artificiel
- Rendu photo ultra-réaliste
- Profondeur de champ naturelle
- Couleurs fidèles et harmonieuses
- Angle de vue engageant

INTERDICTIONS ABSOLUES (sauf sur le produit lui-même) :
- NO text ajouté en dehors du produit
- NO logo ajouté en dehors du produit
- NO brand name ajouté en dehors du produit
- NO watermark
- NO price tag, NO badge, NO sticker ajoutés
- NO artificial marketing elements ajoutés
- NO frames, NO borders, NO overlays
- NO catalog-style flat photography

L'image doit donner envie de cliquer et d'acheter sur Etsy.`;

  // Construire une variante si possible
  let variantPrompt: string | undefined;
  
  if (psychologicalTriggers && psychologicalTriggers.length > 0) {
    const mainTrigger = psychologicalTriggers[0].trigger;
    variantPrompt = `Tu es un photographe lifestyle spécialisé dans les photos produits pour Etsy.

PRODUIT :
Utilise la photo du produit fournie comme référence. Produit : ${productDescription}

⚠️ RÈGLE CRITIQUE - REPRODUCTION EXACTE :
- Reprends EXACTEMENT le produit tel qu'il apparaît sur la photo importée
- Si le produit a des écritures, textes, logos ou inscriptions dessus, REPRODUIS-LES EXACTEMENT
- Le produit sur l'image générée doit être IDENTIQUE au produit de la photo importée
- Place le produit exactement comme sur la photo de référence
- Conserve toutes les caractéristiques visuelles du produit original (couleurs, textures, détails, écritures)

CONCEPT CRÉATIF :
Mets en avant l'aspect "${mainTrigger}" du produit. Montre comment ce produit transforme un moment ordinaire en moment spécial.

AMBIANCE :
- Scène de vie quotidienne sublimée
- Lumière naturelle, atmosphère chaleureuse
- Focus sur l'émotion et l'usage réel

STYLE :
Photo lifestyle Etsy, authentique, émotionnelle, professionnelle.

INTERDICTIONS (sauf sur le produit lui-même) :
NO text ajouté, NO logo ajouté, NO watermark, NO price, NO badge, NO artificial elements ajoutés.`;
  }

  return { main: mainPrompt, variant: variantPrompt };
}

function CreativePromptGenerator({ 
  productDescription, 
  niche, 
  positioning, 
  psychologicalTriggers,
  competitorMistakes 
}: PromptGeneratorProps) {
  const [showVariant, setShowVariant] = useState(false);
  const [copiedMain, setCopiedMain] = useState(false);
  const [copiedVariant, setCopiedVariant] = useState(false);

  const prompts = generateCreativePrompt({ 
    productDescription, 
    niche, 
    positioning, 
    psychologicalTriggers,
    competitorMistakes 
  });

  const copyToClipboard = async (text: string, type: 'main' | 'variant') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'main') {
        setCopiedMain(true);
        setTimeout(() => setCopiedMain(false), 2000);
      } else {
        setCopiedVariant(true);
        setTimeout(() => setCopiedVariant(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Prompt créatif IA</h2>
            <p className="text-slate-500 text-xs">Pour générer vos images publicitaires Etsy</p>
          </div>
        </div>
      </div>

      {/* Prompt principal */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Prompt principal</span>
          <button
            onClick={() => copyToClipboard(prompts.main, 'main')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              copiedMain 
                ? 'bg-emerald-500 text-white' 
                : 'bg-violet-500 text-white hover:bg-violet-600'
            }`}
          >
            {copiedMain ? <Check size={12} /> : <Copy size={12} />}
            {copiedMain ? 'Copié !' : 'Copier'}
          </button>
        </div>
        <div className="p-4 bg-white rounded-lg border border-violet-200 max-h-48 overflow-y-auto">
          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
            {prompts.main}
          </pre>
        </div>
      </div>

      {/* Variante */}
      {prompts.variant && (
        <div className="mb-4">
          <button
            onClick={() => setShowVariant(!showVariant)}
            className="flex items-center gap-2 text-xs text-violet-600 hover:text-violet-700 mb-2"
          >
            <ChevronRight size={14} className={`transition-transform ${showVariant ? 'rotate-90' : ''}`} />
            <span className="font-medium">Voir la variante émotionnelle</span>
          </button>
          
          {showVariant && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Variante</span>
                <button
                  onClick={() => copyToClipboard(prompts.variant!, 'variant')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    copiedVariant 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-indigo-500 text-white hover:bg-indigo-600'
                  }`}
                >
                  {copiedVariant ? <Check size={12} /> : <Copy size={12} />}
                  {copiedVariant ? 'Copié !' : 'Copier'}
                </button>
              </div>
              <div className="p-4 bg-white rounded-lg border border-indigo-200 max-h-40 overflow-y-auto">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {prompts.variant}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions d'utilisation */}
      <div className="p-4 bg-white rounded-lg border border-violet-200">
        <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Info size={14} className="text-violet-500" />
          Comment utiliser ce prompt ?
        </h4>
        <ol className="space-y-2 text-xs text-slate-600">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">1</span>
            <span>Copiez le prompt ci-dessus</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">2</span>
            <span>Ouvrez ChatGPT, Midjourney ou autre IA image</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">3</span>
            <span>Importez la photo de votre produit</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">4</span>
            <span>Collez le prompt et générez l&apos;image</span>
          </li>
        </ol>
        <p className="mt-3 text-[10px] text-slate-500 italic">
          Ce prompt est conçu pour produire une image publicitaire inspirée des meilleures pratiques Etsy.
        </p>
      </div>
    </div>
  );
}

const mainTabs = [
  { id: 'analyse' as MainTab, label: 'Analyse', icon: Activity },
  { id: 'marketing' as MainTab, label: 'Marketing', icon: Megaphone },
  { id: 'conception' as MainTab, label: 'Fiche produit', icon: FileText },
  { id: 'simulation' as MainTab, label: 'Simulation', icon: Calculator },
];

function VerdictBadge({ verdict, competitors }: { verdict: string; competitors?: number }) {
  // Déterminer les couleurs basées sur le nombre de concurrents
  let config;
  if (competitors !== undefined) {
    if (competitors <= 80) {
      config = { label: 'Lancer rapidement', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 };
    } else if (competitors <= 130) {
      config = { label: 'Lancer mais optimiser', bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle };
    } else {
      config = { label: 'Ne pas lancer', bg: 'bg-red-100', text: 'text-red-700', icon: XCircle };
    }
  } else {
    // Fallback sur les anciens labels si pas de nombre de concurrents
    config = {
      launch: { label: 'Lancer', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
      test: { label: 'Tester', bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
      avoid: { label: 'Éviter', bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
    }[verdict] || { label: 'Inconnu', bg: 'bg-slate-100', text: 'text-slate-700', icon: Info };
  }

  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${config.bg}`}>
      <Icon size={12} className={config.text} />
      <span className={`font-bold text-xs ${config.text}`}>{config.label}</span>
    </div>
  );
}

export function ProductAnalysisView({ analysis }: { analysis: ProductAnalysis }) {
  const [activeTab, setActiveTab] = useState<MainTab>('analyse');
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);
  const [etsyDescription, setEtsyDescription] = useState<string | null>(null);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [copiedDescription, setCopiedDescription] = useState(false);
  
  // Priorité au prix renseigné par l'utilisateur, sinon estimation IA
  const userSupplierPrice = analysis.product.price > 0 ? analysis.product.price : (analysis.verdict.estimatedSupplierPrice ?? 0);
  const aiEstimatedShippingCost = analysis.verdict.estimatedShippingCost ?? 0;
  
  // Déterminer les couleurs basées sur le nombre de concurrents
  const getVerdictColors = (competitors: number) => {
    if (competitors <= 80) {
      return {
        bg: 'bg-green-100',
        border: 'border-green-300',
        iconBg: 'bg-green-700',
        text: 'text-green-800',
      };
    } else if (competitors <= 130) {
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        iconBg: 'bg-amber-500',
        text: 'text-amber-700',
      };
    } else {
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        iconBg: 'bg-red-500',
        text: 'text-red-700',
      };
    }
  };
  
  const verdictColors = getVerdictColors(analysis.competitors.totalCompetitors);
  
  const [sellingPrice, setSellingPrice] = useState<number>(analysis.pricing.recommendedPrice);
  const [shippingCost, setShippingCost] = useState<number>(aiEstimatedShippingCost);
  const [supplierPrice, setSupplierPrice] = useState<number>(userSupplierPrice);
  
  const simulationData = useMemo(() => {
    const costPerUnit = supplierPrice + shippingCost;
    const profitPerUnit = sellingPrice - costPerUnit;
    const marginPercent = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;
    
    const salesEstimates = {
      prudent: analysis.launchSimulation.threeMonthProjection.conservative.estimatedSales,
      realiste: analysis.launchSimulation.threeMonthProjection.realistic.estimatedSales,
      optimise: analysis.launchSimulation.threeMonthProjection.optimistic.estimatedSales,
    };
    
    return {
      prudent: {
        sales: salesEstimates.prudent,
        revenue: sellingPrice * salesEstimates.prudent,
        costs: costPerUnit * salesEstimates.prudent,
        profit: profitPerUnit * salesEstimates.prudent,
        margin: marginPercent,
      },
      realiste: {
        sales: salesEstimates.realiste,
        revenue: sellingPrice * salesEstimates.realiste,
        costs: costPerUnit * salesEstimates.realiste,
        profit: profitPerUnit * salesEstimates.realiste,
        margin: marginPercent,
      },
      optimise: {
        sales: salesEstimates.optimise,
        revenue: sellingPrice * salesEstimates.optimise,
        costs: costPerUnit * salesEstimates.optimise,
        profit: profitPerUnit * salesEstimates.optimise,
        margin: marginPercent,
      },
      costPerUnit,
      profitPerUnit,
      marginPercent,
    };
  }, [sellingPrice, shippingCost, supplierPrice, analysis.launchSimulation.threeMonthProjection]);

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
          className="text-6xl md:text-7xl font-black text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
            Résultats
          </span>
        </motion.h1>
      </div>

      {/* Navigation onglets */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 py-2 px-4 sm:px-6 lg:px-8">
        <div className="w-full">
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
            {/* ONGLET ANALYSE */}
            {activeTab === 'analyse' && (
              <div className="space-y-4">
                {/* Verdict */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.5, type: 'spring' }}
                  className={`relative overflow-hidden p-8 rounded-3xl border-2 shadow-xl ${
                    analysis.competitors.totalCompetitors <= 80 
                      ? 'bg-gradient-to-br from-green-50 via-green-50/50 to-white border-green-300 shadow-green-200/50' 
                      : analysis.competitors.totalCompetitors <= 130
                      ? 'bg-gradient-to-br from-amber-50 via-amber-50/50 to-white border-amber-300 shadow-amber-200/50'
                      : 'bg-gradient-to-br from-red-50 via-red-50/50 to-white border-red-300 shadow-red-200/50'
                  }`}
                >
                  {/* Effet de glow */}
                  <div className={`absolute inset-0 opacity-20 ${
                    analysis.competitors.totalCompetitors <= 80 
                      ? 'bg-gradient-to-r from-green-400/20 to-green-600/20' 
                      : analysis.competitors.totalCompetitors <= 130
                      ? 'bg-gradient-to-r from-amber-400/20 to-amber-600/20'
                      : 'bg-gradient-to-r from-red-400/20 to-red-600/20'
                  } blur-3xl`} />
                  
                  <div className="relative z-10 flex items-start gap-6">
                    {/* Icône avec effet */}
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${verdictColors.iconBg}`}
                    >
                      {analysis.competitors.totalCompetitors <= 80 && <CheckCircle2 size={32} className="text-white" />}
                      {analysis.competitors.totalCompetitors > 80 && analysis.competitors.totalCompetitors <= 130 && <AlertTriangle size={32} className="text-white" />}
                      {analysis.competitors.totalCompetitors > 130 && <XCircle size={32} className="text-white" />}
                    </motion.div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-4 mb-3 flex-wrap">
                        <motion.h1
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                          className={`text-3xl sm:text-4xl font-black tracking-tight ${verdictColors.text}`}
                        >
                          {getVerdictLabel(analysis.verdict.verdict, analysis.competitors.totalCompetitors)}
                        </motion.h1>
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4 }}
                          className={`px-4 py-2 rounded-full font-bold text-xs border-2 backdrop-blur-sm ${
                            analysis.competitors.totalCompetitors <= 80
                              ? 'bg-white/90 border-green-300 text-green-800'
                              : analysis.competitors.totalCompetitors <= 130
                              ? 'bg-white/90 border-amber-300 text-amber-800'
                              : 'bg-white/90 border-red-300 text-red-800'
                          }`}
                        >
                          {analysis.verdict.confidenceScore}% confiance
                        </motion.span>
                      </div>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-base text-slate-700 leading-relaxed font-medium"
                      >
                        {analysis.competitors.totalCompetitors <= 80 
                          ? 'Lancer rapidement car il n\'y a pas beaucoup de concurrence.'
                          : analysis.competitors.totalCompetitors <= 130
                          ? 'Lancer mais il y a un peu de concurrence, il faut optimiser votre stratégie.'
                          : 'Ne pas lancer le produit car le marché est saturé.'
                        }
                      </motion.p>
                    </div>
                  </div>
                </motion.div>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: Users, label: 'Boutiques concurrentes', value: `≈${analysis.competitors.totalCompetitors}`, sub: analysis.competitors.competitorEstimationReliable !== false ? 'Estimation fiable' : 'Estimation approximative', highlight: false, reliable: analysis.competitors.competitorEstimationReliable !== false },
                    { icon: CircleDollarSign, label: 'Prix moyen marché', value: formatCurrency(analysis.competitors.averageMarketPrice || analysis.pricing.recommendedPrice), sub: analysis.competitors.marketPriceRange ? `${formatCurrency(analysis.competitors.marketPriceRange.min)} - ${formatCurrency(analysis.competitors.marketPriceRange.max)}` : 'Fourchette', highlight: false },
                    { icon: TrendingUp, label: 'Prix conseillé', value: formatCurrency(analysis.pricing.recommendedPrice), sub: 'Pour votre boutique', highlight: true },
                    { icon: Star, label: 'Phase marché', value: getPhaseLabel(analysis.saturation.phase), sub: 'Tendance', highlight: false },
                  ].map((kpi, i) => {
                    const Icon = kpi.icon;
                    return (
                      <div
                        key={i}
                        className={`p-5 rounded-xl border ${
                          kpi.highlight 
                            ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] border-[#00d4ff] text-white' 
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
                          kpi.highlight ? 'bg-white/20' : 'bg-slate-100'
                        }`}>
                          <Icon size={18} className={kpi.highlight ? 'text-white' : 'text-slate-600'} />
                        </div>
                        <p className={`text-xl font-bold mb-1 ${kpi.highlight ? 'text-white' : 'text-slate-900'}`}>{kpi.value}</p>
                        <p className={`text-xs font-medium ${kpi.highlight ? 'text-white/80' : 'text-slate-500'}`}>{kpi.label}</p>
                        <p className={`text-[10px] mt-0.5 ${kpi.highlight ? 'text-white/60' : 'text-slate-400'}`}>{kpi.sub}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Explication estimation concurrents */}
                {analysis.competitors.competitorEstimationReasoning && (
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <Info size={14} className="text-slate-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-700 mb-1">Méthodologie d&apos;estimation</p>
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
                          <h3 className="text-base font-bold text-slate-900">Vision IA</h3>
                          <p className="text-xs text-slate-500">Recherche optimisée pour Etsy</p>
                        </div>
                      </div>
                      <a
                        href={`https://www.etsy.com/search?q=${encodeURIComponent(analysis.verdict.etsySearchQuery)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Search size={14} />
                        Voir sur Etsy
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center">
                        <Award size={18} className="text-white" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">Points forts</h3>
                    </div>
                    <ul className="space-y-2">
                      {analysis.verdict.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check size={12} className="text-white" />
                          </div>
                          <span className="text-sm text-slate-600">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-5 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
                        <AlertTriangle size={18} className="text-white" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">Points de vigilance</h3>
                    </div>
                    <ul className="space-y-2">
                      {analysis.verdict.risks.map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <AlertTriangle size={12} className="text-white" />
                          </div>
                          <span className="text-sm text-slate-600">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ONGLET MARKETING */}
            {activeTab === 'marketing' && (
              <div className="space-y-6">
                {/* Marketing Acquisition IA */}
                {analysis.marketing?.acquisition && (
                  <AcquisitionMarketing acquisition={analysis.marketing.acquisition} />
                )}

                {analysis.marketing?.strategic?.anglesToAvoid && analysis.marketing.strategic.anglesToAvoid.length > 0 && (
                  <div className="p-5 rounded-xl bg-red-50 border border-red-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                        <XCircle size={20} className="text-white" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Angles à éviter</h2>
                        <p className="text-red-600 text-xs">Ne fais PAS ça</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {analysis.marketing.strategic.anglesToAvoid.map((angle, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-red-200">
                          <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                            <TrendingDown size={14} className="text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{angle.angle}</p>
                            <p className="text-red-600 text-xs mt-1">{angle.risk}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.marketing?.strategic?.competitorMistakes && analysis.marketing.strategic.competitorMistakes.length > 0 && (
                  <div className="p-5 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                        <AlertTriangle size={20} className="text-white" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Erreurs des concurrents</h2>
                        <p className="text-slate-600 text-xs">Ce que tu ne dois PAS faire</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {analysis.marketing.strategic.competitorMistakes.map((mistake, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-amber-200">
                          <XCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{mistake.mistake}</p>
                            <p className="text-amber-600 text-xs mt-1">
                              {mistake.frequency === 'very_frequent' ? 'Très fréquent' : mistake.frequency === 'frequent' ? 'Fréquent' : 'Courant'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.marketing?.strategic?.underexploitedAngles && analysis.marketing.strategic.underexploitedAngles.length > 0 && (
                  <div className="p-5 rounded-xl bg-white border border-slate-200">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center">
                        <Lightbulb size={20} className="text-white" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Angles sous-exploités</h2>
                        <p className="text-slate-500 text-xs">Comment te différencier intelligemment</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {analysis.marketing.strategic.underexploitedAngles.map((angle, i) => (
                        <div key={i} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-900">{angle.angle}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              angle.competitionLevel === 'low' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : angle.competitionLevel === 'medium'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {angle.competitionLevel === 'low' ? 'Faible' : angle.competitionLevel === 'medium' ? 'Moyenne' : 'Élevée'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mb-3">{angle.whyUnderexploited}</p>
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-cyan-50 border border-cyan-200">
                            <ArrowUpRight size={14} className="text-cyan-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-cyan-700">{angle.whyItCanWork}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!analysis.marketing?.strategic && !analysis.marketing?.acquisition && (
                  <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <Info size={40} className="text-slate-400 mx-auto mb-4" />
                    <p className="text-base text-slate-600">L&apos;analyse marketing stratégique n&apos;est pas disponible.</p>
                    <p className="text-slate-500 text-sm mt-2">Réanalysez le produit pour obtenir les recommandations.</p>
                  </div>
                )}
              </div>
            )}

            {/* ONGLET FICHE PRODUIT */}
            {activeTab === 'conception' && (
              <div className="space-y-6">
                {analysis.verdict.viralTitleEN && (
                  <div className="p-5 rounded-xl bg-white border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center">
                          <PenTool size={20} className="text-white" />
                        </div>
                        <h2 className="text-base font-bold text-slate-900">Titre SEO optimisé</h2>
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
                        {copiedTitle ? 'Copié' : 'Copier'}
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-cyan-50 border border-cyan-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-cyan-600">Anglais</span>
                          <span className="text-xs text-slate-500">{analysis.verdict.viralTitleEN.length}/140</span>
                        </div>
                        <p className="text-sm font-medium text-slate-900">{analysis.verdict.viralTitleEN}</p>
                      </div>
                      
                      {analysis.verdict.viralTitleFR && (
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Français</span>
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
                          <h3 className="text-base font-bold text-slate-900">Description Etsy</h3>
                          <p className="text-xs text-slate-500">Description optimisée pour Etsy (en anglais)</p>
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
                          {copiedDescription ? 'Copié' : 'Copier'}
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
                            'Générer la description'
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                          <p className="text-sm text-slate-600 mb-2">
                            Vous pouvez la copier et l&apos;utiliser directement dans votre fiche produit.
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
                        {copiedTags ? 'Copié' : 'Copier'}
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
                    <h3 className="text-base font-bold text-slate-900">Stratégie de prix</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Lancement', sublabel: 'Pénétration', price: analysis.pricing.aggressivePrice, active: false },
                      { label: 'Optimal', sublabel: 'Recommandé', price: analysis.pricing.recommendedPrice, active: true },
                      { label: 'Premium', sublabel: 'Marge max', price: analysis.pricing.premiumPrice, active: false },
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

            {/* ONGLET SIMULATION */}
            {activeTab === 'simulation' && (
              <div className="space-y-6">
                <div className="p-5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                      <Calculator size={20} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Calculateur de profit</h2>
                      <p className="text-slate-500 text-xs">Ajustez les valeurs pour voir les projections</p>
                    </div>
                  </div>
                  
                  {analysis.verdict.supplierPriceReasoning && (
                    <div className="mb-5 p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Analyse IA</p>
                      <p className="text-sm text-slate-700">{analysis.verdict.supplierPriceReasoning}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    {[
                      { 
                        label: 'Prix fournisseur', 
                        value: supplierPrice, 
                        setValue: setSupplierPrice, 
                        hint: analysis.product.price > 0 
                          ? `Prix renseigné: ${formatCurrency(analysis.product.price)}` 
                          : `Est IA: ${formatCurrency(analysis.verdict.estimatedSupplierPrice ?? 0)}` 
                      },
                      { label: 'Frais livraison', value: shippingCost, setValue: setShippingCost, hint: `Est: ${formatCurrency(aiEstimatedShippingCost)}` },
                      { label: 'Prix de vente', value: sellingPrice, setValue: setSellingPrice, hint: `Rec: ${formatCurrency(analysis.pricing.recommendedPrice)}`, highlight: true },
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
                      <p className="text-xs text-slate-500 mb-1">Coût unitaire</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(simulationData.costPerUnit)}</p>
                    </div>
                    <div className="text-center border-x border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Profit unitaire</p>
                      <p className={`text-xl font-bold ${simulationData.profitPerUnit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(simulationData.profitPerUnit)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">Marge</p>
                      <p className={`text-xl font-bold ${simulationData.marginPercent > 30 ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {simulationData.marginPercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-white border border-slate-200">
                    <div className="flex items-center gap-3 mb-3">
                      <Clock size={20} className="text-slate-400" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Sans publicité</h4>
                        <p className="text-xs text-slate-500">Croissance organique</p>
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 mb-1">
                      {analysis.launchSimulation.timeToFirstSale.withoutAds.expected}
                      <span className="text-sm font-normal text-slate-400 ml-2">jours</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Entre {analysis.launchSimulation.timeToFirstSale.withoutAds.min} et {analysis.launchSimulation.timeToFirstSale.withoutAds.max} jours
                    </p>
                  </div>

                  <div className="p-5 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white">
                    <div className="flex items-center gap-3 mb-3">
                      <Zap size={20} className="text-white" />
                      <div>
                        <h4 className="text-sm font-bold">Avec Etsy Ads</h4>
                        <p className="text-xs text-white/70">Croissance accélérée</p>
                      </div>
                    </div>
                    <p className="text-3xl font-bold mb-1">
                      {analysis.launchSimulation.timeToFirstSale.withAds.expected}
                      <span className="text-sm font-normal text-white/60 ml-2">jours</span>
                    </p>
                    <p className="text-xs text-white/70">
                      Entre {analysis.launchSimulation.timeToFirstSale.withAds.min} et {analysis.launchSimulation.timeToFirstSale.withAds.max} jours
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <TrendingUp size={20} className="text-[#00d4ff]" />
                      <h3 className="text-base font-bold text-slate-900">Projection sur 3 mois</h3>
                    </div>
                    <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      {formatPercentage(analysis.launchSimulation.successProbability)} de réussite
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
                              Recommandé
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-5 gap-3">
                          {[
                            { label: 'Ventes', value: scenario.data.sales },
                            { label: 'CA', value: formatCurrency(scenario.data.revenue) },
                            { label: 'Coûts', value: formatCurrency(scenario.data.costs) },
                            { label: 'Profit', value: formatCurrency(scenario.data.profit), profit: true },
                            { label: 'Marge', value: `${scenario.data.margin.toFixed(0)}%` },
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
                    <h3 className="text-base font-bold text-slate-900">Facteurs clés de succès</h3>
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

  if (!selectedAnalysis) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-slate-900 mb-4">Aucune analyse disponible</p>
          <button
            onClick={() => setStep(2)}
            className="px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white rounded-xl font-semibold"
          >
            Retourner à l&apos;import
          </button>
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
                <VerdictBadge verdict={selectedAnalysis.verdict.verdict} competitors={selectedAnalysis.competitors.totalCompetitors} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {analyses.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const currentIndex = analyses.findIndex(a => a.product.id === selectedProductId);
                      const prevIndex = currentIndex > 0 ? currentIndex - 1 : analyses.length - 1;
                      setSelectedProductId(analyses[prevIndex].product.id);
                    }}
                    className="p-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-slate-500 text-xs px-1">
                    {analyses.findIndex(a => a.product.id === selectedProductId) + 1}/{analyses.length}
                  </span>
                  <button
                    onClick={() => {
                      const currentIndex = analyses.findIndex(a => a.product.id === selectedProductId);
                      const nextIndex = currentIndex < analyses.length - 1 ? currentIndex + 1 : 0;
                      setSelectedProductId(analyses[nextIndex].product.id);
                    }}
                    className="p-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
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

      <ProductAnalysisView analysis={selectedAnalysis} />
    </div>
  );
}
