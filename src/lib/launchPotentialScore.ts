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
 * Vérifie si un produit est un bijou sans spécificité particulière
 * (ex: pas de style médiéval, vintage, personnalisé, etc.)
 */
function isGenericJewelry(
  niche: string,
  productTitle: string,
  productVisualDescription?: string
): boolean {
  const nicheLower = niche.toLowerCase();
  const isJewelryNiche = nicheLower.includes('jewelry') || nicheLower.includes('bijou');
  
  if (!isJewelryNiche) return false;
  
  // Mots-clés indiquant une spécificité particulière (style médiéval, vintage, etc.)
  const specificityKeywords = [
    'medieval', 'médiéval', 'médieval',
    'vintage', 'antique', 'retro', 'rétro',
    'personalized', 'personnalisé', 'custom', 'sur mesure',
    'engraved', 'gravé', 'monogram', 'monogramme',
    'themed', 'thématique', 'niche', 'specialized',
    'handmade', 'artisanal', 'unique', 'one of a kind',
    'wedding', 'mariage', 'anniversary', 'anniversaire',
    'gothic', 'gothique', 'steampunk', 'fantasy', 'fantastique',
  ];
  
  const titleLower = productTitle.toLowerCase();
  const descriptionLower = (productVisualDescription || '').toLowerCase();
  const combined = `${titleLower} ${descriptionLower}`;
  
  // Si aucun mot-clé de spécificité n'est trouvé, c'est un bijou générique
  const hasSpecificity = specificityKeywords.some(keyword => combined.includes(keyword));
  
  return !hasSpecificity;
}

/**
 * MATRICE DE NOTATION
 * Calcule le score sur 10 à partir des 3 piliers
 */
function calculateScoreFromMatrix(
  competitionDensity: 'low' | 'medium' | 'high',
  nicheSaturation: 'low' | 'medium' | 'high',
  productSpecificity: 'low' | 'medium' | 'high',
  niche?: string,
  productTitle?: string,
  productVisualDescription?: string
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
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // RÈGLE SPÉCIALE: Bijoux sans spécificité particulière
  // ═══════════════════════════════════════════════════════════════════════════════
  // Si c'est un bijou sans spécificité hors normes (ex: pas de style médiéval),
  // on ajoute un bonus significatif pour compenser la saturation de la niche
  if (niche && productTitle && isGenericJewelry(niche, productTitle, productVisualDescription)) {
    // Bonus pour bijoux génériques: +1.5 à +2.5 points selon la concurrence
    if (competitionDensity === 'low') {
      adjustment += 2.5; // Bonus maximal si faible concurrence
    } else if (competitionDensity === 'medium') {
      adjustment += 2.0; // Bonus moyen si concurrence modérée
    } else {
      adjustment += 1.5; // Bonus minimal si forte concurrence (mais toujours présent)
    }
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
      verdict: 'Not recommended to launch',
      badge: '🔴',
    };
  }
  
  if (score <= 7) {
    return {
      tier: 'competitive',
      verdict: 'Possible with strategy',
      badge: '🟡',
    };
  }
  
  return {
    tier: 'favorable',
    verdict: 'Good launch opportunity',
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
    parts.push('Low saturation niche with limited direct competition.');
    parts.push('Good opportunity for launch.');
  } else if (tier === 'competitive') {
    parts.push('Moderate competition in this niche.');
    parts.push('Launch is possible with proper differentiation and marketing strategy.');
  } else {
    parts.push('High market saturation with significant competition.');
    parts.push('Launch requires careful consideration and strong differentiation.');
  }
  
  // Détails sur les facteurs
  const factorDetails: string[] = [];
  
  if (factors.nicheSaturation === 'low') {
    factorDetails.push('niche is less saturated');
  } else if (factors.nicheSaturation === 'high') {
    factorDetails.push('niche is highly saturated');
  }
  
  if (factors.productSpecificity === 'high') {
    factorDetails.push('product is highly specific');
  } else if (factors.productSpecificity === 'low') {
    factorDetails.push('product is relatively generic');
  }
  
  if (factors.competitionDensity === 'low') {
    factorDetails.push('limited direct competition');
  } else if (factors.competitionDensity === 'high') {
    factorDetails.push('high competition density');
  }
  
  if (factorDetails.length > 0) {
    parts.push(`The ${factorDetails.join(', ')}.`);
  }
  
  return parts.join(' ');
}

/**
 * Fonction principale: Calcule le Launch Potential Score
 */
export function calculateLaunchPotentialScore(
  input: LaunchPotentialInput
): LaunchPotentialResult {
  // Évaluer les 3 piliers
  const competitionDensity = assessCompetitionDensity(input.competitionScore);
  const nicheSaturation = assessNicheSaturation(input.niche);
  const productSpecificity = assessProductSpecificity(
    input.productTitle,
    input.productType,
    input.productVisualDescription
  );
  
  // Calculer le score à partir de la matrice
  const score = calculateScoreFromMatrix(
    competitionDensity,
    nicheSaturation,
    productSpecificity,
    input.niche,
    input.productTitle,
    input.productVisualDescription
  );
  
  // Déterminer la tranche et le verdict
  const { tier, verdict, badge } = getTierAndVerdict(score);
  
  // Générer l'explication
  const explanation = generateExplanation(score, tier, {
    competitionDensity,
    nicheSaturation,
    productSpecificity,
  });
  
  return {
    score,
    tier,
    verdict,
    explanation,
    badge,
    factors: {
      competitionDensity,
      nicheSaturation,
      productSpecificity,
    },
  };
}




