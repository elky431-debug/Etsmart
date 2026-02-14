/**
 * Module de calcul du Launch Potential Score (0-10)
 * 
 * NOUVEAU SYSTÈME (6 critères pondérés):
 * - Market Demand (25%)
 * - Competition Intensity (20%)
 * - Differentiation Potential (15%)
 * - Profit Margin Potential (20%)
 * - Impulse Buy Potential (10%)
 * - Scalability Potential (10%)
 * 
 * L'IA (GPT) calcule chaque critère et le score final pondéré.
 * Le module passe le score tel quel sauf pour les bijoux génériques (pénalité).
 */

import type { ScoringBreakdown } from '@/types';

export interface LaunchPotentialInput {
  competitionScore: number;
  niche: string;
  productTitle: string;
  productType: string;
  productVisualDescription?: string;
  aiLaunchPotentialScore?: number;
  aiLaunchPotentialScoreJustification?: string;
  aiClassification?: string;
  aiScoringBreakdown?: ScoringBreakdown;
}

export interface LaunchPotentialResult {
  score: number;
  tier: 'saturated' | 'competitive' | 'favorable';
  verdict: string;
  explanation: string;
  scoreJustification: string;
  badge: '🔴' | '🟡' | '🟢';
  classification?: string;
  scoringBreakdown?: ScoringBreakdown;
  factors: {
    competitionDensity: 'low' | 'medium' | 'high';
    nicheSaturation: 'low' | 'medium' | 'high';
    productSpecificity: 'low' | 'medium' | 'high';
  };
}

/**
 * Détecte si le produit est un bijou SIMPLE et NON ORIGINAL
 */
function isSimpleGenericJewelry(
  niche: string,
  productType: string,
  productTitle: string,
  productVisualDescription?: string
): boolean {
  const nicheLower = niche.toLowerCase();
  const typeLower = productType.toLowerCase();
  const titleLower = productTitle.toLowerCase();
  const descriptionLower = (productVisualDescription || '').toLowerCase();
  const combined = `${nicheLower} ${typeLower} ${titleLower} ${descriptionLower}`;
  
  const jewelryKeywords = [
    'bracelet', 'necklace', 'ring', 'earring', 'earrings', 'pendant', 
    'charm', 'chain', 'jewelry', 'bijou', 'bijoux', 'collier', 'bague', 
    'boucle', 'brooch', 'broche', 'pendentif', 'choker', 'anklet', 
    'cheville', 'toe ring'
  ];
  
  const isJewelry = (nicheLower.includes('jewelry') || nicheLower.includes('bijou')) ||
    jewelryKeywords.some(kw => typeLower.includes(kw) || titleLower.includes(kw) || descriptionLower.includes(kw));
  
  if (!isJewelry) return false;
  
  const originalityKeywords = [
    'personalized', 'personnalisé', 'custom', 'sur mesure',
    'engraved', 'gravé', 'monogram', 'monogramme',
    'medieval', 'médiéval', 'viking', 'celtic', 'gothic', 'steampunk',
    'themed', 'thématique', 'specialized',
    'vintage', 'antique', 'handmade', 'artisanal', 'fait main',
    'unique', 'one of a kind', 'limited edition',
    'name', 'initial', 'letter', 'birthstone', 'zodiac',
    'religious', 'religieux', 'cross', 'crucifix',
    'pet', 'animal', 'dog', 'cat', 'chien', 'chat',
    'baby', 'bébé', 'newborn',
    'resin', 'résine', 'epoxy', 'wood', 'bois',
    'ceramic', 'céramique', 'clay', 'argile',
    'macrame', 'macramé', 'crochet', 'knit', 'tricot',
    'leather', 'cuir', 'woven', 'tressé',
    'gemstone', 'pierre précieuse', 'crystal', 'cristal',
    'handcrafted', 'artisan', 'designer',
    'statement', 'chunky', 'oversized',
    'minimalist gold', 'geometric', 'géométrique',
  ];
  
  const hasOriginality = originalityKeywords.some(kw => combined.includes(kw));
  return !hasOriginality;
}

/**
 * Détermine la tranche et le verdict basés sur la classification
 */
function getTierAndVerdict(score: number, classification?: string): {
  tier: 'saturated' | 'competitive' | 'favorable';
  verdict: string;
  badge: '🔴' | '🟡' | '🟢';
} {
  if (score < 4) {
    return {
      tier: 'saturated',
      verdict: classification || 'NOT RECOMMENDED',
      badge: '🔴',
    };
  }
  
  if (score < 7.5) {
    return {
      tier: 'competitive',
      verdict: classification || (score < 6 ? 'HIGH RISK' : 'MODERATE OPPORTUNITY'),
      badge: '🟡',
    };
  }
  
  return {
    tier: 'favorable',
    verdict: classification || (score <= 8.5 ? 'STRONG OPPORTUNITY' : 'EXCEPTIONAL OPPORTUNITY'),
    badge: '🟢',
  };
}

/**
 * Évalue les facteurs pour l'affichage
 */
function assessFactors(
  competitionScore: number,
  niche: string,
  productTitle: string,
  productType: string,
  productVisualDescription?: string
): LaunchPotentialResult['factors'] {
  let competitionDensity: 'low' | 'medium' | 'high';
  if (competitionScore < 50) competitionDensity = 'low';
  else if (competitionScore < 85) competitionDensity = 'medium';
  else competitionDensity = 'high';
  
  const nicheLower = niche.toLowerCase();
  const saturatedNiches = ['jewelry', 'bijoux', 'fashion', 'mode', 'wedding', 'mariage', 'personalized-gifts'];
  const mediumNiches = ['home-decor', 'decoration', 'art', 'illustrations', 'baby', 'bébé', 'sport', 'fitness'];
  
  let nicheSaturation: 'low' | 'medium' | 'high';
  if (saturatedNiches.some(n => nicheLower.includes(n))) nicheSaturation = 'high';
  else if (mediumNiches.some(n => nicheLower.includes(n))) nicheSaturation = 'medium';
  else nicheSaturation = 'low';
  
  const combined = `${productTitle} ${productVisualDescription || ''}`.toLowerCase();
  const highSpecKeywords = ['personalized', 'personnalisé', 'custom', 'engraved', 'gravé', 'themed', 'vintage', 'handmade', 'unique'];
  const medSpecKeywords = ['decorative', 'gift', 'cadeau', 'stylish', 'modern', 'minimalist'];
  
  const highCount = highSpecKeywords.filter(k => combined.includes(k)).length;
  const medCount = medSpecKeywords.filter(k => combined.includes(k)).length;
  
  let productSpecificity: 'low' | 'medium' | 'high';
  if (highCount >= 2) productSpecificity = 'high';
  else if (highCount >= 1 || medCount >= 2) productSpecificity = 'medium';
  else productSpecificity = 'low';
  
  return { competitionDensity, nicheSaturation, productSpecificity };
}

/**
 * Fonction principale: Calcule le Launch Potential Score
 */
export function calculateLaunchPotentialScore(
  input: LaunchPotentialInput
): LaunchPotentialResult {
  const factors = assessFactors(
    input.competitionScore,
    input.niche,
    input.productTitle,
    input.productType,
    input.productVisualDescription
  );
  
  const isGenericJewelry = isSimpleGenericJewelry(
    input.niche,
    input.productType,
    input.productTitle,
    input.productVisualDescription
  );
  
  let score: number;
  let scoreJustification: string;
  let classification: string | undefined = input.aiClassification;
  let scoringBreakdown: ScoringBreakdown | undefined = input.aiScoringBreakdown;
  
  // ═══════════════════════════════════════════════════════════════
  // RÈGLE 1: Bijoux simples non originaux → forcé à 3/10 max
  // ═══════════════════════════════════════════════════════════════
  if (isGenericJewelry) {
    const aiScore = input.aiLaunchPotentialScore ?? 3.0;
    score = Math.min(aiScore, 3.0);
    classification = 'NOT RECOMMENDED';
    scoreJustification = `Score fixé à ${score.toFixed(1)}/10 car le produit est un bijou simple et non original. Le marché des bijoux génériques sur Etsy est extrêmement saturé avec des milliers de vendeurs proposant des produits similaires. Pour obtenir un meilleur score, il faudrait se différencier davantage (personnalisation, design unique, matériaux rares, etc.).`;
    console.log(`[LaunchScore] ⚠️ Generic jewelry detected → capped at ${score}/10`);
  }
  // ═══════════════════════════════════════════════════════════════
  // RÈGLE 2: Score IA disponible → l'utiliser directement
  // ═══════════════════════════════════════════════════════════════
  else if (input.aiLaunchPotentialScore !== undefined && input.aiLaunchPotentialScore !== null && input.aiLaunchPotentialScore >= 0 && input.aiLaunchPotentialScore <= 10) {
    score = Math.round(input.aiLaunchPotentialScore * 10) / 10;
    scoreJustification = input.aiLaunchPotentialScoreJustification || `Score de ${score}/10 attribué par l'IA basé sur l'analyse multicritères du produit.`;
    console.log(`[LaunchScore] ✅ Using AI score: ${score}/10 (${classification || 'no classification'})`);
  }
  // ═══════════════════════════════════════════════════════════════
  // FALLBACK: Pas de score IA → score par défaut
  // ═══════════════════════════════════════════════════════════════
  else {
    score = 5.0;
    scoreJustification = 'Score par défaut - analyse IA non disponible.';
    classification = 'HIGH RISK';
    console.log(`[LaunchScore] ℹ️ No AI score available, using default: ${score}/10`);
  }
  
  // Assurer les limites
  score = Math.max(0, Math.min(10, score));
  
  // Déterminer classification si pas fournie
  if (!classification) {
    if (score < 4) classification = 'NOT RECOMMENDED';
    else if (score < 6) classification = 'HIGH RISK';
    else if (score < 7.5) classification = 'MODERATE OPPORTUNITY';
    else if (score <= 8.5) classification = 'STRONG OPPORTUNITY';
    else classification = 'EXCEPTIONAL OPPORTUNITY';
  }
  
  const { tier, verdict, badge } = getTierAndVerdict(score, classification);
  const explanation = generateExplanation(score, tier, factors, classification);
  
  return {
    score,
    tier,
    verdict,
    explanation,
    scoreJustification,
    badge,
    classification,
    scoringBreakdown,
    factors,
  };
}

/**
 * Génère l'explication
 */
function generateExplanation(
  score: number,
  tier: 'saturated' | 'competitive' | 'favorable',
  factors: LaunchPotentialResult['factors'],
  classification?: string
): string {
  const parts: string[] = [];
  
  if (classification) {
    parts.push(`Classification: ${classification}.`);
  }
  
  if (tier === 'favorable') {
    parts.push('Bonne opportunité de lancement avec un potentiel de marché favorable.');
  } else if (tier === 'competitive') {
    parts.push('Marché concurrentiel nécessitant une stratégie de différenciation.');
  } else {
    parts.push('Conditions de marché difficiles, lancement non recommandé.');
  }
  
  const factorDetails: string[] = [];
  if (factors.nicheSaturation === 'low') factorDetails.push('niche peu saturée');
  else if (factors.nicheSaturation === 'high') factorDetails.push('niche très saturée');
  if (factors.productSpecificity === 'high') factorDetails.push('produit très spécifique');
  else if (factors.productSpecificity === 'low') factorDetails.push('produit générique');
  if (factors.competitionDensity === 'low') factorDetails.push('concurrence limitée');
  else if (factors.competitionDensity === 'high') factorDetails.push('forte concurrence');
  
  if (factorDetails.length > 0) {
    parts.push(`Points clés : ${factorDetails.join(', ')}.`);
  }
  
  return parts.join(' ');
}
