/**
 * Module de calcul du Launch Potential Score (0-10)
 * 
 * NOUVEAU SYSTÈME:
 * - L'IA (GPT) décide du score pour TOUS les produits
 * - SEULE EXCEPTION: Les bijoux simples non originaux sont forcés à 3/10
 * - Le module de fallback (matrice) est utilisé uniquement si l'IA n'a pas retourné de score
 */

export interface LaunchPotentialInput {
  competitionScore: number; // Score de concurrence (0-100) du module competitionEstimator
  niche: string; // ID de la niche
  productTitle: string; // Titre du produit
  productType: string; // Type de produit (mug, bracelet, etc.)
  productVisualDescription?: string; // Description visuelle du produit
  aiLaunchPotentialScore?: number; // Score décidé par l'IA (1.0-10.0) - PRIORITAIRE
  aiLaunchPotentialScoreJustification?: string; // Justification de l'IA
}

export interface LaunchPotentialResult {
  score: number; // Score sur 10 (0-10)
  tier: 'saturated' | 'competitive' | 'favorable'; // Tranche : 0-3 / 4-7 / 8-10
  verdict: string; // Verdict texte court
  explanation: string; // Explication détaillée
  scoreJustification: string; // Justification détaillée du score en 3-4 lignes
  badge: '🔴' | '🟡' | '🟢'; // Badge visuel
  factors: {
    competitionDensity: 'low' | 'medium' | 'high';
    nicheSaturation: 'low' | 'medium' | 'high';
    productSpecificity: 'low' | 'medium' | 'high';
  };
}

/**
 * Détecte si le produit est un bijou SIMPLE et NON ORIGINAL
 * Seuls ces bijoux sont forcés à 3/10
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
  
  // D'abord vérifier si c'est un bijou
  const jewelryKeywords = [
    'bracelet', 'necklace', 'ring', 'earring', 'earrings', 'pendant', 
    'charm', 'chain', 'jewelry', 'bijou', 'bijoux', 'collier', 'bague', 
    'boucle', 'brooch', 'broche', 'pendentif', 'choker', 'anklet', 
    'cheville', 'toe ring'
  ];
  
  const isJewelry = (nicheLower.includes('jewelry') || nicheLower.includes('bijou')) ||
    jewelryKeywords.some(kw => typeLower.includes(kw) || titleLower.includes(kw) || descriptionLower.includes(kw));
  
  if (!isJewelry) return false;
  
  // Mots-clés indiquant que le bijou est ORIGINAL / DIFFÉRENCIÉ
  // Si un de ces mots est présent, ce n'est PAS un bijou simple générique
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
    'birthstone', 'zodiac', 'horoscope', 'astro',
  ];
  
  // Si le bijou a un signe d'originalité, ce n'est PAS un bijou simple générique
  const hasOriginality = originalityKeywords.some(kw => combined.includes(kw));
  
  // C'est un bijou simple générique si aucun signe d'originalité
  return !hasOriginality;
}

/**
 * Détermine la tranche et le verdict
 */
function getTierAndVerdict(score: number): {
  tier: 'saturated' | 'competitive' | 'favorable';
  verdict: string;
  badge: '🔴' | '🟡' | '🟢';
} {
  if (score <= 3) {
    return {
      tier: 'saturated',
      verdict: 'Lancement non recommandé',
      badge: '🔴',
    };
  }
  
  if (score <= 7) {
    return {
      tier: 'competitive',
      verdict: 'Possible avec stratégie',
      badge: '🟡',
    };
  }
  
  return {
    tier: 'favorable',
    verdict: 'Bonne opportunité de lancement',
    badge: '🟢',
  };
}

/**
 * Évalue les facteurs pour l'affichage (même si le score vient de l'IA)
 */
function assessFactors(
  competitionScore: number,
  niche: string,
  productTitle: string,
  productType: string,
  productVisualDescription?: string
): LaunchPotentialResult['factors'] {
  // Densité concurrentielle
  let competitionDensity: 'low' | 'medium' | 'high';
  if (competitionScore < 50) competitionDensity = 'low';
  else if (competitionScore < 85) competitionDensity = 'medium';
  else competitionDensity = 'high';
  
  // Saturation de la niche
  const nicheLower = niche.toLowerCase();
  const saturatedNiches = ['jewelry', 'bijoux', 'fashion', 'mode', 'wedding', 'mariage', 'personalized-gifts'];
  const mediumNiches = ['home-decor', 'decoration', 'art', 'illustrations', 'baby', 'bébé', 'sport', 'fitness'];
  
  let nicheSaturation: 'low' | 'medium' | 'high';
  if (saturatedNiches.some(n => nicheLower.includes(n))) nicheSaturation = 'high';
  else if (mediumNiches.some(n => nicheLower.includes(n))) nicheSaturation = 'medium';
  else nicheSaturation = 'low';
  
  // Spécificité du produit
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
 * 
 * PRIORITÉ:
 * 1. Si l'IA a retourné un score → l'utiliser (sauf pour bijoux simples → 3/10)
 * 2. Sinon → utiliser la matrice de fallback
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
  
  // Vérifier si c'est un bijou simple non original
  const isGenericJewelry = isSimpleGenericJewelry(
    input.niche,
    input.productType,
    input.productTitle,
    input.productVisualDescription
  );
  
  let score: number;
  let scoreJustification: string;
  
  // ═══════════════════════════════════════════════════════════════
  // RÈGLE 1: Bijoux simples non originaux → forcé à 3/10 max
  // ═══════════════════════════════════════════════════════════════
  if (isGenericJewelry) {
    score = 3.0;
    scoreJustification = `Score fixé à 3/10 car le produit est un bijou simple et non original. Le marché des bijoux génériques sur Etsy est extrêmement saturé avec des milliers de vendeurs proposant des produits similaires. Pour obtenir un meilleur score, il faudrait se différencier davantage (personnalisation, design unique, matériaux rares, etc.).`;
    console.log(`[LaunchScore] ⚠️ Generic jewelry detected → forced to 3.0/10`);
  }
  // ═══════════════════════════════════════════════════════════════
  // RÈGLE 2: Score IA disponible → l'utiliser directement
  // ═══════════════════════════════════════════════════════════════
  else if (input.aiLaunchPotentialScore !== undefined && input.aiLaunchPotentialScore !== null && input.aiLaunchPotentialScore >= 1 && input.aiLaunchPotentialScore <= 10) {
    score = Math.round(input.aiLaunchPotentialScore * 10) / 10; // Arrondir à 1 décimale
    scoreJustification = input.aiLaunchPotentialScoreJustification || `Score de ${score}/10 attribué par l'IA basé sur l'analyse de la saturation du marché, l'originalité du produit et le potentiel de marges.`;
    console.log(`[LaunchScore] ✅ Using AI score: ${score}/10`);
  }
  // ═══════════════════════════════════════════════════════════════
  // FALLBACK: Pas de score IA → utiliser la matrice simple
  // ═══════════════════════════════════════════════════════════════
  else {
    score = calculateFallbackScore(factors);
    scoreJustification = generateFallbackJustification(score, factors);
    console.log(`[LaunchScore] ℹ️ No AI score available, using fallback matrix: ${score}/10`);
  }
  
  // Assurer les limites
  score = Math.max(1, Math.min(10, score));
  
  const { tier, verdict, badge } = getTierAndVerdict(score);
  const explanation = generateExplanation(score, tier, factors);
  
  return {
    score,
    tier,
    verdict,
    explanation,
    scoreJustification,
    badge,
    factors,
  };
}

/**
 * Calcul de fallback quand l'IA n'a pas retourné de score
 */
function calculateFallbackScore(
  factors: LaunchPotentialResult['factors']
): number {
  // Score basé sur la combinaison des 3 facteurs
  const densityScores = { low: 8, medium: 5, high: 3 };
  const saturationScores = { low: 8, medium: 5, high: 3 };
  const specificityScores = { low: 3, medium: 6, high: 8 };
  
  const d = densityScores[factors.competitionDensity];
  const s = saturationScores[factors.nicheSaturation];
  const p = specificityScores[factors.productSpecificity];
  
  // Moyenne pondérée: saturation 50%, spécificité 30%, densité 20%
  const score = (s * 0.5) + (p * 0.3) + (d * 0.2);
  
  return Math.round(score * 10) / 10;
}

/**
 * Génère l'explication
 */
function generateExplanation(
  score: number,
  tier: 'saturated' | 'competitive' | 'favorable',
  factors: LaunchPotentialResult['factors']
): string {
  const parts: string[] = [];
  
  if (tier === 'favorable') {
    parts.push('Niche peu saturée avec une concurrence directe limitée.');
    parts.push('Bonne opportunité de lancement.');
  } else if (tier === 'competitive') {
    parts.push('Concurrence modérée dans cette niche.');
    parts.push('Le lancement est possible avec une stratégie de différenciation et marketing adaptée.');
  } else {
    parts.push('Forte saturation du marché avec une concurrence significative.');
    parts.push('Le lancement nécessite une réflexion approfondie et une forte différenciation.');
  }
  
  const factorDetails: string[] = [];
  if (factors.nicheSaturation === 'low') factorDetails.push('la niche est peu saturée');
  else if (factors.nicheSaturation === 'high') factorDetails.push('la niche est très saturée');
  if (factors.productSpecificity === 'high') factorDetails.push('le produit est très spécifique');
  else if (factors.productSpecificity === 'low') factorDetails.push('le produit est relativement générique');
  if (factors.competitionDensity === 'low') factorDetails.push('concurrence directe limitée');
  else if (factors.competitionDensity === 'high') factorDetails.push('forte densité concurrentielle');
  
  if (factorDetails.length > 0) {
    parts.push(`Points clés : ${factorDetails.join(', ')}.`);
  }
  
  return parts.join(' ');
}

/**
 * Génère la justification pour le fallback
 */
function generateFallbackJustification(
  score: number,
  factors: LaunchPotentialResult['factors']
): string {
  const lines: string[] = [];
  
  if (score >= 8) {
    lines.push(`Excellent score de ${score}/10 indiquant une forte opportunité de marché.`);
  } else if (score >= 6) {
    lines.push(`Bon score de ${score}/10 suggérant un lancement viable avec une stratégie adaptée.`);
  } else if (score >= 4) {
    lines.push(`Score modéré de ${score}/10 indiquant un marché concurrentiel nécessitant une différenciation.`);
  } else {
    lines.push(`Score faible de ${score}/10 en raison de conditions de marché difficiles.`);
  }
  
  const strengths: string[] = [];
  if (factors.competitionDensity === 'low') strengths.push('faible densité concurrentielle');
  if (factors.nicheSaturation === 'low') strengths.push('niche sous-exploitée');
  if (factors.productSpecificity === 'high') strengths.push('produit fortement différencié');
  if (strengths.length > 0) lines.push(`Points forts : ${strengths.join(', ')}.`);
  
  const challenges: string[] = [];
  if (factors.competitionDensity === 'high') challenges.push('concurrence intense');
  if (factors.nicheSaturation === 'high') challenges.push('segment de marché saturé');
  if (factors.productSpecificity === 'low') challenges.push('le produit manque de différenciation unique');
  if (challenges.length > 0) lines.push(`Défis : ${challenges.join(', ')}.`);
  
  return lines.join(' ');
}
