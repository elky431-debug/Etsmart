/**
 * Module de calcul du Launch Potential Score (0-10)
 * Système de notation pour évaluer le potentiel de lancement d'un produit sur Etsy
 * 
 * Basé sur 3 piliers :
 * 1. Densité concurrentielle estimée
 * 2. Saturation de la niche
 * 3. Spécificité du produit
 */

export interface LaunchPotentialInput {
  competitionScore: number; // Score de concurrence (0-100) du module competitionEstimator
  niche: string; // ID de la niche
  productTitle: string; // Titre du produit
  productType: string; // Type de produit (mug, bracelet, etc.)
  productVisualDescription?: string; // Description visuelle du produit
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
 * PILIER 1: Densité concurrentielle estimée
 * Convertit le score de concurrence (0-100) en densité (faible/moyenne/élevée)
 * Ajusté pour être plus généreux
 */
function assessCompetitionDensity(competitionScore: number): 'low' | 'medium' | 'high' {
  if (competitionScore < 50) return 'low'; // Augmenté de 30 à 50
  if (competitionScore < 85) return 'medium'; // Augmenté de 70 à 85
  return 'high';
}

/**
 * PILIER 2: Saturation de la niche
 * Chaque niche a un niveau de saturation structurelle
 */
function assessNicheSaturation(niche: string): 'low' | 'medium' | 'high' {
  const nicheLower = niche.toLowerCase();
  
  // Niches structurellement saturées
  const saturatedNiches = [
    'jewelry', 'bijoux',
    'fashion', 'mode',
    'wedding', 'mariage',
    'personalized-gifts', 'cadeaux-personnalises',
  ];
  
  // Niches moyennement saturées
  const mediumNiches = [
    'home-decor', 'decoration', 'déco',
    'art', 'illustrations',
    'baby', 'bébé',
    'sport', 'fitness',
  ];
  
  // Niches peu saturées
  const lowSaturationNiches = [
    'furniture', 'meuble',
    'garden', 'jardin',
    'vintage', 'rétro',
    'crafts', 'artisanat',
    'wellness', 'bien-être',
  ];
  
  if (saturatedNiches.some(n => nicheLower.includes(n))) return 'high';
  if (mediumNiches.some(n => nicheLower.includes(n))) return 'medium';
  if (lowSaturationNiches.some(n => nicheLower.includes(n))) return 'low';
  
  // Par défaut : moyenne
  return 'medium';
}

/**
 * RÈGLE SPÉCIALE: Détecte les bijoux génériques sans spécificité hors normes
 * Si c'est un bijou générique, la note sera forcée à < 3
 */
function isGenericJewelry(
  niche: string,
  productType: string,
  productTitle: string,
  productVisualDescription?: string
): boolean {
  const nicheLower = niche.toLowerCase();
  const typeLower = productType.toLowerCase();
  const titleLower = productTitle.toLowerCase();
  const descriptionLower = (productVisualDescription || '').toLowerCase();
  const combined = `${titleLower} ${descriptionLower}`;
  
  // Vérifier si c'est un bijou (niche ou type)
  const isJewelryNiche = nicheLower.includes('jewelry') || nicheLower.includes('bijou');
  const jewelryTypes = ['bracelet', 'necklace', 'ring', 'earring', 'earrings', 'pendant', 'charm', 'chain', 'jewelry', 'bijou', 'bijoux'];
  const isJewelryType = jewelryTypes.some(type => typeLower.includes(type) || titleLower.includes(type));
  
  if (!isJewelryNiche && !isJewelryType) {
    return false; // Ce n'est pas un bijou
  }
  
  // Mots-clés indiquant une spécificité hors normes (ex: "medieval", "personalized", etc.)
  const highSpecificityKeywords = [
    'personalized', 'personnalisé', 'custom', 'sur mesure',
    'engraved', 'gravé', 'monogram', 'monogramme',
    'medieval', 'médiéval', 'viking', 'celtic', 'gothic',
    'themed', 'thématique', 'niche', 'specialized',
    'vintage', 'antique', 'handmade', 'artisanal',
    'unique', 'one of a kind', 'limited edition',
    'wedding', 'mariage', 'anniversary', 'anniversaire',
    'pet', 'animal', 'dog', 'cat', 'chien', 'chat',
    'baby', 'bébé', 'newborn', 'nouveau-né',
    'name', 'initial', 'letter', 'birthstone', 'zodiac',
    'religious', 'religieux', 'cross', 'crucifix',
  ];
  
  // Si aucun mot-clé de spécificité n'est trouvé, c'est un bijou générique
  const hasSpecificity = highSpecificityKeywords.some(keyword => 
    combined.includes(keyword)
  );
  
  return !hasSpecificity; // Bijou générique si pas de spécificité
}

/**
 * PILIER 3: Spécificité du produit
 * Détermine si le produit est générique, semi-spécifique ou très spécifique
 */
function assessProductSpecificity(
  productTitle: string,
  productType: string,
  productVisualDescription?: string
): 'low' | 'medium' | 'high' {
  const titleLower = productTitle.toLowerCase();
  const descriptionLower = (productVisualDescription || '').toLowerCase();
  const combined = `${titleLower} ${descriptionLower}`;
  
  // Mots-clés indiquant une forte spécificité
  const highSpecificityKeywords = [
    'personalized', 'personnalisé', 'custom', 'sur mesure',
    'engraved', 'gravé', 'monogram', 'monogramme',
    'themed', 'thématique', 'niche', 'specialized',
    'vintage', 'antique', 'handmade', 'artisanal',
    'unique', 'one of a kind', 'limited edition',
    'wedding', 'mariage', 'anniversary', 'anniversaire',
    'pet', 'animal', 'dog', 'cat', 'chien', 'chat',
    'baby', 'bébé', 'newborn', 'nouveau-né',
  ];
  
  // Mots-clés indiquant une spécificité moyenne
  const mediumSpecificityKeywords = [
    'decorative', 'décoratif', 'decor', 'déco',
    'gift', 'cadeau', 'present',
    'stylish', 'élégant', 'modern', 'moderne',
    'minimalist', 'minimaliste', 'simple',
    'colorful', 'coloré', 'patterned', 'motif',
  ];
  
  // Compter les occurrences
  const highCount = highSpecificityKeywords.filter(k => combined.includes(k)).length;
  const mediumCount = mediumSpecificityKeywords.filter(k => combined.includes(k)).length;
  
  // Produits génériques : type de base sans modificateurs
  const genericPatterns = [
    /^white\s+\w+$/i, // "white mug"
    /^black\s+\w+$/i, // "black bag"
    /^simple\s+\w+$/i, // "simple bracelet"
    /^basic\s+\w+$/i, // "basic t-shirt"
  ];
  
  const isGeneric = genericPatterns.some(pattern => pattern.test(productTitle));
  
  // Logique de détermination
  if (isGeneric && highCount === 0 && mediumCount === 0) {
    return 'low'; // Produit très générique
  }
  
  if (highCount >= 2) {
    return 'high'; // Forte spécificité
  }
  
  if (highCount >= 1 || mediumCount >= 2) {
    return 'medium'; // Spécificité moyenne
  }
  
  return 'low'; // Faible spécificité par défaut
}

/**
 * MATRICE DE NOTATION
 * Calcule le score sur 10 à partir des 3 piliers
 */
function calculateScoreFromMatrix(
  competitionDensity: 'low' | 'medium' | 'high',
  nicheSaturation: 'low' | 'medium' | 'high',
  productSpecificity: 'low' | 'medium' | 'high'
): number {
  // Matrice de notation - Ajustée pour être plus généreuse
  const matrix: Record<string, Record<string, Record<string, { min: number; max: number }>>> = {
    high: { // Saturation niche élevée
      low: { // Spécificité faible
        low: { min: 3, max: 5 }, // Augmenté de 1-3 à 3-5
        medium: { min: 3, max: 5 }, // Augmenté de 1-3 à 3-5
        high: { min: 2, max: 4 }, // Augmenté de 1-2 à 2-4
      },
      medium: { // Spécificité moyenne
        low: { min: 5, max: 7 }, // Augmenté de 4-5 à 5-7
        medium: { min: 4, max: 6 }, // Augmenté de 3-4 à 4-6
        high: { min: 3, max: 5 }, // Augmenté de 2-3 à 3-5
      },
      high: { // Spécificité forte
        low: { min: 6, max: 7 }, // Augmenté de 4-5 à 6-7
        medium: { min: 5, max: 7 }, // Augmenté de 4-5 à 5-7
        high: { min: 4, max: 6 }, // Augmenté de 3-4 à 4-6
      },
    },
    medium: { // Saturation niche moyenne
      low: { // Spécificité faible
        low: { min: 5, max: 7 }, // Augmenté de 4-5 à 5-7
        medium: { min: 5, max: 7 }, // Augmenté de 4-5 à 5-7
        high: { min: 4, max: 6 }, // Augmenté de 3-4 à 4-6
      },
      medium: { // Spécificité moyenne
        low: { min: 7, max: 9 }, // Augmenté de 5-7 à 7-9
        medium: { min: 6, max: 8 }, // Augmenté de 5-6 à 6-8
        high: { min: 5, max: 7 }, // Augmenté de 4-5 à 5-7
      },
      high: { // Spécificité forte
        low: { min: 8, max: 9 }, // Augmenté de 7-8 à 8-9
        medium: { min: 7, max: 9 }, // Augmenté de 6-7 à 7-9
        high: { min: 6, max: 8 }, // Augmenté de 5-6 à 6-8
      },
    },
    low: { // Saturation niche faible
      low: { // Spécificité faible
        low: { min: 7, max: 9 }, // Augmenté de 6-7 à 7-9
        medium: { min: 7, max: 9 }, // Augmenté de 6-7 à 7-9
        high: { min: 6, max: 8 }, // Augmenté de 5-6 à 6-8
      },
      medium: { // Spécificité moyenne
        low: { min: 9, max: 10 }, // Augmenté de 8-9 à 9-10
        medium: { min: 8, max: 10 }, // Augmenté de 7-8 à 8-10
        high: { min: 7, max: 9 }, // Augmenté de 6-7 à 7-9
      },
      high: { // Spécificité forte
        low: { min: 10, max: 10 }, // Augmenté de 9-10 à 10-10
        medium: { min: 9, max: 10 }, // Augmenté de 8-9 à 9-10
        high: { min: 8, max: 10 }, // Augmenté de 7-8 à 8-10
      },
    },
  };
  
  const range = matrix[nicheSaturation][productSpecificity][competitionDensity];
  
  // Calculer le score moyen avec ajustement de ±1 selon signaux secondaires
  const baseScore = (range.min + range.max) / 2;
  
  // Ajustements fins basés sur les combinaisons favorables/défavorables - Plus généreux
  let adjustment = 0.2; // Bonus de base pour être plus généreux
  
  // Combinaisons très favorables
  if (nicheSaturation === 'low' && productSpecificity === 'high' && competitionDensity === 'low') {
    adjustment = 0.8; // Augmenté de 0.5 à 0.8
  }
  
  // Combinaisons défavorables - Moins pénalisant
  if (nicheSaturation === 'high' && productSpecificity === 'low' && competitionDensity === 'high') {
    adjustment = -0.2; // Réduit de -0.5 à -0.2
  }
  
  // Ajustement selon la densité concurrentielle - Plus généreux
  if (competitionDensity === 'low' && nicheSaturation === 'low') {
    adjustment += 0.5; // Augmenté de 0.3 à 0.5
  }
  
  if (competitionDensity === 'high' && nicheSaturation === 'high') {
    adjustment -= 0.2; // Réduit de -0.3 à -0.2
  }
  
  const finalScore = Math.max(0, Math.min(10, baseScore + adjustment));
  
  // Arrondir à 1 décimale
  return Math.round(finalScore * 10) / 10;
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
 * Génère l'explication détaillée
 */
function generateExplanation(
  score: number,
  tier: 'saturated' | 'competitive' | 'favorable',
  factors: LaunchPotentialResult['factors']
): string {
  const parts: string[] = [];
  
  // Partie principale selon la tranche
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
  
  // Détails sur les facteurs
  const factorDetails: string[] = [];
  
  if (factors.nicheSaturation === 'low') {
    factorDetails.push('la niche est peu saturée');
  } else if (factors.nicheSaturation === 'high') {
    factorDetails.push('la niche est très saturée');
  }
  
  if (factors.productSpecificity === 'high') {
    factorDetails.push('le produit est très spécifique');
  } else if (factors.productSpecificity === 'low') {
    factorDetails.push('le produit est relativement générique');
  }
  
  if (factors.competitionDensity === 'low') {
    factorDetails.push('concurrence directe limitée');
  } else if (factors.competitionDensity === 'high') {
    factorDetails.push('forte densité concurrentielle');
  }
  
  if (factorDetails.length > 0) {
    parts.push(`Points clés : ${factorDetails.join(', ')}.`);
  }
  
  return parts.join(' ');
}

/**
 * Génère une justification détaillée du score en 3-4 lignes
 */
function generateScoreJustification(
  score: number,
  tier: 'saturated' | 'competitive' | 'favorable',
  factors: LaunchPotentialResult['factors'],
  isGenericJewelry: boolean
): string {
  const lines: string[] = [];
  
  // Ligne 1: Résumé du score
  if (score >= 8) {
    lines.push(`Excellent score de ${score}/10 indiquant une forte opportunité de marché.`);
  } else if (score >= 6) {
    lines.push(`Bon score de ${score}/10 suggérant un lancement viable avec une stratégie adaptée.`);
  } else if (score >= 4) {
    lines.push(`Score modéré de ${score}/10 indiquant un marché concurrentiel nécessitant une différenciation.`);
  } else {
    lines.push(`Score faible de ${score}/10 en raison de conditions de marché difficiles.`);
  }
  
  // Ligne 2: Points forts
  const strengths: string[] = [];
  if (factors.competitionDensity === 'low') strengths.push('faible densité concurrentielle');
  if (factors.nicheSaturation === 'low') strengths.push('niche sous-exploitée');
  if (factors.productSpecificity === 'high') strengths.push('produit fortement différencié');
  if (factors.productSpecificity === 'medium' && factors.nicheSaturation !== 'high') strengths.push('positionnement produit raisonnable');
  
  if (strengths.length > 0) {
    lines.push(`Points forts : ${strengths.join(', ')}.`);
  }
  
  // Ligne 3: Points faibles ou défis
  const challenges: string[] = [];
  if (factors.competitionDensity === 'high') challenges.push('concurrence intense');
  if (factors.nicheSaturation === 'high') challenges.push('segment de marché saturé');
  if (factors.productSpecificity === 'low') challenges.push('le produit manque de différenciation unique');
  if (isGenericJewelry) challenges.push('les bijoux génériques font face à une saturation extrême sur Etsy');
  
  if (challenges.length > 0) {
    lines.push(`Défis : ${challenges.join(', ')}.`);
  } else if (tier === 'favorable') {
    lines.push('Aucun obstacle majeur identifié pour l\'entrée sur le marché.');
  }
  
  // Ligne 4: Recommandation
  if (tier === 'favorable') {
    lines.push('Recommandé de procéder au lancement tout en maintenant les standards de qualité.');
  } else if (tier === 'competitive') {
    lines.push('Envisagez d\'investir dans l\'optimisation SEO et un branding unique pour vous démarquer.');
  } else {
    lines.push('Fortement recommandé de trouver un angle plus spécifique ou de cibler une niche différente.');
  }
  
  return lines.join(' ');
}

/**
 * Fonction principale: Calcule le Launch Potential Score
 */
export function calculateLaunchPotentialScore(
  input: LaunchPotentialInput
): LaunchPotentialResult {
  // ⚠️ RÈGLE SPÉCIALE: Bijoux génériques = note forcée < 3
  const isGenericJewelryProduct = isGenericJewelry(
    input.niche,
    input.productType,
    input.productTitle,
    input.productVisualDescription
  );
  
  // Évaluer les 3 piliers
  const competitionDensity = assessCompetitionDensity(input.competitionScore);
  const nicheSaturation = assessNicheSaturation(input.niche);
  const productSpecificity = assessProductSpecificity(
    input.productTitle,
    input.productType,
    input.productVisualDescription
  );
  
  // Calculer le score à partir de la matrice
  let score = calculateScoreFromMatrix(competitionDensity, nicheSaturation, productSpecificity);
  
  // ⚠️ FORCER LA NOTE < 3 pour les bijoux génériques
  if (isGenericJewelryProduct) {
    score = Math.min(2.9, score); // Forcer à maximum 2.9
  }
  
  // Déterminer la tranche et le verdict
  const { tier, verdict, badge } = getTierAndVerdict(score);
  
  // Générer l'explication
  let explanation = generateExplanation(score, tier, {
    competitionDensity,
    nicheSaturation,
    productSpecificity,
  });
  
  // Ajouter une explication spéciale pour les bijoux génériques
  if (isGenericJewelryProduct) {
    explanation = 'Les bijoux génériques sans spécificité unique (comme le style médiéval, la personnalisation ou les thèmes de niche) font face à une saturation de marché extrêmement élevée sur Etsy. ' + explanation;
  }
  
  // Générer la justification détaillée du score
  const scoreJustification = generateScoreJustification(
    score,
    tier,
    { competitionDensity, nicheSaturation, productSpecificity },
    isGenericJewelryProduct
  );
  
  return {
    score,
    tier,
    verdict,
    explanation,
    scoreJustification,
    badge,
    factors: {
      competitionDensity,
      nicheSaturation,
      productSpecificity,
    },
  };
}




