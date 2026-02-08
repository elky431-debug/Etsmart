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
 * RÈGLE ABSOLUE: Détecte TOUS les bijoux (obligation stricte < 3/10)
 * Cette fonction détecte n'importe quel bijou, quelle que soit sa spécificité
 */
function isJewelry(
  niche: string,
  productType: string,
  productTitle: string,
  productVisualDescription?: string
): boolean {
  const nicheLower = niche.toLowerCase();
  const typeLower = productType.toLowerCase();
  const titleLower = productTitle.toLowerCase();
  const descriptionLower = (productVisualDescription || '').toLowerCase();
  
  // Vérifier si c'est un bijou (niche ou type)
  const isJewelryNiche = nicheLower === 'jewelry' || nicheLower === 'bijoux' || 
                         nicheLower.includes('jewelry') || nicheLower.includes('bijou');
  const jewelryTypes = [
    'bracelet', 'necklace', 'ring', 'earring', 'earrings', 'pendant', 
    'charm', 'chain', 'jewelry', 'bijou', 'bijoux', 'collier', 'bague', 
    'boucle', 'brooch', 'broche', 'pendentif', 'choker', 'anklet', 
    'cheville', 'toe ring', 'bague orteil'
  ];
  const isJewelryType = jewelryTypes.some(type => 
    typeLower.includes(type) || 
    titleLower.includes(type) || 
    descriptionLower.includes(type)
  );
  
  return isJewelryNiche || isJewelryType;
}

/**
 * RÈGLE ABSOLUE: Détecte TOUS les produits pour bébés/naissance (obligation stricte >= 7/10)
 * Cette fonction détecte n'importe quel produit pour bébés, quelle que soit sa spécificité
 */
function isBaby(
  niche: string,
  productType: string,
  productTitle: string,
  productVisualDescription?: string
): boolean {
  const nicheLower = niche.toLowerCase();
  const typeLower = productType.toLowerCase();
  const titleLower = productTitle.toLowerCase();
  const descriptionLower = (productVisualDescription || '').toLowerCase();
  
  // Vérifier si c'est un produit bébé (niche ou type)
  const isBabyNiche = nicheLower === 'baby' || nicheLower === 'bébé' || 
                      nicheLower.includes('baby') || nicheLower.includes('bébé');
  const babyTypes = [
    'baby', 'bébé', 'infant', 'nursery', 'newborn', 'nouveau-né',
    'toddler', 'bambin', 'prenatal', 'prénatal', 'maternity', 'maternité',
    'birth', 'naissance', 'christening', 'baptême', 'baby shower',
    'crib', 'berceau', 'stroller', 'poussette', 'onesie', 'bodysuit',
    'pacifier', 'tétine', 'bottle', 'biberon', 'rattle', 'hochet'
  ];
  const isBabyType = babyTypes.some(type => 
    typeLower.includes(type) || 
    titleLower.includes(type) || 
    descriptionLower.includes(type)
  );
  
  return isBabyNiche || isBabyType;
}

/**
 * RÈGLE ABSOLUE: Détecte TOUS les sacs (obligation stricte = 4/10)
 * Cette fonction détecte n'importe quel sac, quelle que soit sa spécificité
 */
function isBag(
  niche: string,
  productType: string,
  productTitle: string,
  productVisualDescription?: string
): boolean {
  const nicheLower = niche.toLowerCase();
  const typeLower = productType.toLowerCase();
  const titleLower = productTitle.toLowerCase();
  const descriptionLower = (productVisualDescription || '').toLowerCase();
  
  // Vérifier si c'est un sac (niche ou type)
  const isBagNiche = nicheLower === 'bag' || nicheLower === 'bags' || 
                     nicheLower === 'sac' || nicheLower === 'sacs' ||
                     nicheLower.includes('bag');
  const bagTypes = [
    'bag', 'bags', 'sac', 'sacs', 'handbag', 'purse', 'tote', 'backpack',
    'shoulder bag', 'crossbody', 'clutch', 'wallet', 'portefeuille',
    'messenger bag', 'duffel', 'suitcase', 'valise', 'briefcase',
    'shopping bag', 'sac shopping', 'beach bag', 'sac plage',
    'gym bag', 'sac de sport', 'lunch bag', 'sac repas'
  ];
  const isBagType = bagTypes.some(type => 
    typeLower.includes(type) || 
    titleLower.includes(type) || 
    descriptionLower.includes(type)
  );
  
  return isBagNiche || isBagType;
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
  // D'abord vérifier si c'est un bijou
  if (!isJewelry(niche, productType, productTitle, productVisualDescription)) {
    return false; // Ce n'est pas un bijou
  }
  
  const titleLower = productTitle.toLowerCase();
  const descriptionLower = (productVisualDescription || '').toLowerCase();
  const combined = `${titleLower} ${descriptionLower}`;
  
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
  // Matrice de notation - Ajustée pour être plus généreuse et cohérente
  // Logique: Les bons produits (faible saturation, faible concurrence, haute spécificité) doivent avoir des scores élevés
  const matrix: Record<string, Record<string, Record<string, { min: number; max: number }>>> = {
    high: { // Saturation niche élevée
      low: { // Spécificité faible
        low: { min: 4, max: 6 }, // Augmenté pour éviter les scores trop bas
        medium: { min: 4, max: 6 },
        high: { min: 3, max: 5 },
      },
      medium: { // Spécificité moyenne
        low: { min: 6, max: 8 }, // Augmenté pour récompenser la spécificité moyenne
        medium: { min: 5, max: 7 },
        high: { min: 4, max: 6 },
      },
      high: { // Spécificité forte
        low: { min: 7, max: 8 }, // Même avec saturation élevée, haute spécificité = bon score
        medium: { min: 6, max: 8 },
        high: { min: 5, max: 7 },
      },
    },
    medium: { // Saturation niche moyenne
      low: { // Spécificité faible
        low: { min: 6, max: 8 }, // Augmenté pour marché moyen
        medium: { min: 6, max: 8 },
        high: { min: 5, max: 7 },
      },
      medium: { // Spécificité moyenne
        low: { min: 8, max: 9 }, // Bon score pour spécificité moyenne + saturation moyenne
        medium: { min: 7, max: 9 },
        high: { min: 6, max: 8 },
      },
      high: { // Spécificité forte
        low: { min: 9, max: 10 }, // Excellent score pour haute spécificité
        medium: { min: 8, max: 10 },
        high: { min: 7, max: 9 },
      },
    },
    low: { // Saturation niche faible - MEILLEURS SCORES
      low: { // Spécificité faible
        low: { min: 8, max: 9 }, // Même avec spécificité faible, faible saturation = bon score
        medium: { min: 8, max: 9 },
        high: { min: 7, max: 9 },
      },
      medium: { // Spécificité moyenne
        low: { min: 9, max: 10 }, // Excellent pour spécificité moyenne + faible saturation
        medium: { min: 9, max: 10 },
        high: { min: 8, max: 10 },
      },
      high: { // Spécificité forte
        low: { min: 10, max: 10 }, // Parfait: faible saturation + haute spécificité = 10/10
        medium: { min: 10, max: 10 },
        high: { min: 9, max: 10 },
      },
    },
  };
  
  const range = matrix[nicheSaturation][productSpecificity][competitionDensity];
  
  // Calculer le score avec variation aléatoire dans la plage pour éviter les scores identiques
  // Utiliser un hash basé sur les inputs pour avoir une variation déterministe mais variée
  const inputHash = `${competitionDensity}-${nicheSaturation}-${productSpecificity}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variation = (inputHash % 100) / 100; // Variation entre 0 et 1
  const rangeSize = range.max - range.min;
  const baseScore = range.min + (rangeSize * variation * 0.7 + rangeSize * 0.3); // 70% variation, 30% vers le milieu
  
  // Ajustements fins basés sur les combinaisons favorables/défavorables
  // Logique: Récompenser les bonnes combinaisons, pénaliser modérément les mauvaises
  let adjustment = 0.2; // Bonus réduit pour permettre plus de variation
  
  // Combinaisons très favorables (faible saturation + haute spécificité + faible concurrence)
  if (nicheSaturation === 'low' && productSpecificity === 'high' && competitionDensity === 'low') {
    adjustment = 1.0; // Bonus maximum pour la meilleure combinaison
  }
  
  // Combinaisons favorables (faible saturation OU haute spécificité)
  if (nicheSaturation === 'low' && competitionDensity === 'low') {
    adjustment += 0.6; // Bonus important pour faible saturation + faible concurrence
  }
  
  if (productSpecificity === 'high' && competitionDensity === 'low') {
    adjustment += 0.4; // Bonus pour haute spécificité + faible concurrence
  }
  
  // Combinaisons défavorables - Pénalité modérée
  if (nicheSaturation === 'high' && productSpecificity === 'low' && competitionDensity === 'high') {
    adjustment = -0.3; // Pénalité modérée pour la pire combinaison
  }
  
  // Pénalités modérées pour saturation/concurrence élevées
  if (competitionDensity === 'high' && nicheSaturation === 'high') {
    adjustment -= 0.3; // Pénalité modérée
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
  // ⚠️ RÈGLE ABSOLUE: TOUS les bijoux = note strictement < 3 (priorité absolue)
  const isJewelryProduct = isJewelry(
    input.niche,
    input.productType,
    input.productTitle,
    input.productVisualDescription
  );
  
  // ⚠️ RÈGLE ABSOLUE: TOUS les sacs = note fixe 4 (seulement si ce n'est pas un bijou)
  const isBagProduct = isBag(
    input.niche,
    input.productType,
    input.productTitle,
    input.productVisualDescription
  );
  
  // ⚠️ RÈGLE ABSOLUE: TOUS les produits bébés/naissance = note >= 7 (seulement si ce n'est pas un bijou ou un sac)
  const isBabyProduct = isBaby(
    input.niche,
    input.productType,
    input.productTitle,
    input.productVisualDescription
  );
  
  // ⚠️ RÈGLE SPÉCIALE: Bijoux génériques = note forcée < 3 (déjà couvert par la règle ci-dessus)
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
  
  // ⚠️ OBLIGATION ABSOLUE: FORCER LA NOTE STRICTEMENT < 3 pour TOUS les bijoux (priorité absolue) mais avec variation
  if (isJewelryProduct) {
    console.log('⚠️ Produit bijoux détecté - Calcul Launch Potential Score varié strictement < 3');
    
    // Calculer un score varié basé sur les caractéristiques
    const isGenericJewelryProduct = isGenericJewelry(
      input.niche,
      input.productType,
      input.productTitle,
      input.productVisualDescription
    );
    
    // Score de base pour bijoux (entre 1.0 et 2.99)
    let jewelryScore = 1.5; // Base pour bijoux génériques
    
    // Ajuster selon la spécificité et la concurrence
    if (!isGenericJewelryProduct) {
      // Bijoux avec spécificité (personnalisé, médiéval, etc.)
      if (competitionDensity === 'low') {
        jewelryScore = 2.7; // Faible concurrence + spécificité = meilleur score mais toujours < 3
      } else if (competitionDensity === 'medium') {
        jewelryScore = 2.3; // Concurrence modérée + spécificité
      } else {
        jewelryScore = 1.9; // Forte concurrence + spécificité
      }
    } else {
      // Bijoux génériques
      if (competitionDensity === 'low') {
        jewelryScore = 2.0; // Faible concurrence mais générique
      } else if (competitionDensity === 'medium') {
        jewelryScore = 1.6; // Concurrence modérée + générique
      } else {
        jewelryScore = 1.2; // Forte concurrence + générique = score plus bas
      }
    }
    
    // Ajuster selon la saturation de la niche
    if (nicheSaturation === 'high') {
      jewelryScore = Math.max(1.0, jewelryScore - 0.3);
    } else if (nicheSaturation === 'low') {
      jewelryScore = Math.min(2.99, jewelryScore + 0.2);
    }
    
    // S'assurer que le score est strictement < 3
    score = Math.min(2.99, Math.max(1.0, jewelryScore));
    
    console.log(`✅ Launch Potential Score bijoux calculé: ${score} (concurrence: ${competitionDensity}, saturation: ${nicheSaturation}, générique: ${isGenericJewelryProduct})`);
    
    // ⚠️ VALIDATION FINALE ABSOLUE: S'assurer que le score est STRICTEMENT < 3
    if (score >= 3.0) {
      console.error('❌ ERREUR: Launch Potential Score bijoux >= 3.0 détecté, correction automatique à 2.99');
      score = 2.99; // Forcer strictement < 3
    }
  }
  // ⚠️ OBLIGATION ABSOLUE: FORCER LA NOTE autour de 4 pour TOUS les sacs (seulement si ce n'est pas un bijou) mais avec variation
  else if (isBagProduct) {
    console.log('⚠️ Produit sac détecté - Calcul Launch Potential Score varié autour de 4');
    
    // Score de base pour sacs (autour de 4.0)
    let bagScore = 4.0; // Base
    
    // Ajuster selon la spécificité et la concurrence
    if (productSpecificity === 'high') {
      // Sac avec haute spécificité (personnalisé, premium, etc.)
      if (competitionDensity === 'low') {
        bagScore = 4.4; // Faible concurrence + haute spécificité = meilleur score
      } else if (competitionDensity === 'medium') {
        bagScore = 4.2; // Concurrence modérée + haute spécificité
      } else {
        bagScore = 4.0; // Forte concurrence + haute spécificité
      }
    } else if (productSpecificity === 'medium') {
      // Sac avec spécificité moyenne
      if (competitionDensity === 'low') {
        bagScore = 4.3; // Faible concurrence + spécificité moyenne
      } else if (competitionDensity === 'medium') {
        bagScore = 4.1; // Concurrence modérée + spécificité moyenne
      } else {
        bagScore = 3.9; // Forte concurrence + spécificité moyenne
      }
    } else {
      // Sac générique
      if (competitionDensity === 'low') {
        bagScore = 4.1; // Faible concurrence mais générique
      } else if (competitionDensity === 'medium') {
        bagScore = 3.9; // Concurrence modérée + générique
      } else {
        bagScore = 3.7; // Forte concurrence + générique = score plus bas
      }
    }
    
    // Ajuster selon la saturation de la niche
    if (nicheSaturation === 'high') {
      bagScore = Math.max(3.7, bagScore - 0.2);
    } else if (nicheSaturation === 'low') {
      bagScore = Math.min(4.5, bagScore + 0.2);
    }
    
    // Limiter autour de 4.0 (entre 3.7 et 4.5 pour avoir une variation)
    score = Math.min(4.5, Math.max(3.7, bagScore));
    
    console.log(`✅ Launch Potential Score sac calculé: ${score} (concurrence: ${competitionDensity}, saturation: ${nicheSaturation}, spécificité: ${productSpecificity})`);
    
    // ⚠️ VALIDATION FINALE: S'assurer que le score est dans la plage acceptable
    if (score < 3.7 || score > 4.5) {
      console.warn(`⚠️ Launch Potential Score sac hors plage (${score}), ajustement à 4.0`);
      score = 4.0;
    }
  }
  // ⚠️ OBLIGATION ABSOLUE: FORCER LA NOTE >= 7 pour TOUS les produits bébés/naissance (seulement si ce n'est pas un bijou ou un sac)
  else if (isBabyProduct) {
    console.log('⚠️ Produit bébé/naissance détecté - Forçage Launch Potential Score >= 7');
    // Forcer minimum 7 (entre 7.0 et 10.0, jamais moins de 7)
    score = Math.max(7.0, Math.min(10.0, score)); // Minimum 7
    
    // ⚠️ VALIDATION FINALE ABSOLUE: S'assurer que le score est >= 7
    if (score < 7.0) {
      console.error('❌ ERREUR: Launch Potential Score bébé < 7.0 détecté, correction automatique à 7.0');
      score = 7.0; // Forcer minimum 7
    }
  }
  
  // Déterminer la tranche et le verdict
  const { tier, verdict, badge } = getTierAndVerdict(score);
  
  // Générer l'explication
  let explanation = generateExplanation(score, tier, {
    competitionDensity,
    nicheSaturation,
    productSpecificity,
  });
  
  // Ajouter une explication spéciale pour TOUS les bijoux
  if (isJewelryProduct) {
    if (isGenericJewelryProduct) {
      explanation = 'Les bijoux génériques sans spécificité unique (comme le style médiéval, la personnalisation ou les thèmes de niche) font face à une saturation de marché extrêmement élevée sur Etsy. ' + explanation;
    } else {
      explanation = 'Le marché des bijoux sur Etsy est extrêmement saturé, ce qui limite significativement le potentiel de lancement, même pour des produits avec une certaine spécificité. ' + explanation;
    }
  }
  // Ajouter une explication spéciale pour TOUS les sacs
  else if (isBagProduct) {
    explanation = 'Le marché des sacs sur Etsy présente un niveau de concurrence modéré avec des opportunités moyennes pour les produits bien positionnés. ' + explanation;
  }
  // Ajouter une explication spéciale pour TOUS les produits bébés/naissance
  else if (isBabyProduct) {
    explanation = 'Le marché des produits pour bébés et naissances sur Etsy présente de bonnes opportunités avec une demande constante et des parents prêts à investir dans des produits de qualité. ' + explanation;
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




