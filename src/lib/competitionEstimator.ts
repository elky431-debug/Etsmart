/**
 * Module d'estimation de la concurrence produit sur Etsy
 * Méthode multi-signaux Etsmart (sans IA)
 * 
 * Ce module estime le niveau de concurrence en utilisant uniquement
 * des données publiques visibles sur Etsy (nombre de résultats de recherche)
 * et des heuristiques statistiques.
 */

export interface CompetitionEstimateInput {
  productTitle: string;
  productType: string; // ex: "mug", "bracelet", "sofa"
  category: string; // Catégorie Etsy estimée
  keywords?: string[]; // Mots-clés principaux (optionnel)
  market?: string; // Langue du marché (défaut: "EN")
}

export interface EtsyQueryResult {
  keyword: string;
  resultsCount: number;
  date: Date;
  market: string;
  valid: boolean;
}

export interface CompetitionEstimateResult {
  // Données brutes
  queries: EtsyQueryResult[];
  validQueries: EtsyQueryResult[];
  
  // Calculs intermédiaires
  baseCompetitionVolume: number; // BCV (médiane)
  adjustedCompetitionVolume: number; // ACV (BCV × coefficient catégorie)
  
  // Score final
  competitionScore: number; // 0-100
  saturationLevel: 'low' | 'viable' | 'high' | 'saturated';
  
  // Métadonnées
  category: string;
  categoryCoefficient: number;
  queriesUsed: number;
  
  // Décision
  decision: 'launch' | 'launch_with_caution' | 'do_not_launch';
  
  // Explication
  explanation: string;
}

// Table de coefficients par catégorie (OBLIGATOIRE selon cahier des charges)
const CATEGORY_COEFFICIENTS: Record<string, number> = {
  'Jewelry': 1.30,
  'Apparel': 1.25,
  'Home Decor': 1.10,
  'Digital Products': 1.40,
  'Pet Supplies': 0.90,
  'Furniture': 0.80,
  'Office / Organization': 0.95,
  'Wedding': 1.20,
  // Valeur par défaut pour catégories non listées
  'default': 1.00,
};

// Plafond pour le calcul du score
const MAX_COMPETITION_VOLUME = 20000;

/**
 * SOUS-SYSTÈME 1: Génération des requêtes Etsy (sans IA)
 * Génère 3-5 requêtes pertinentes pour éviter les biais d'un seul mot-clé
 */
export function generateEtsyQueries(input: CompetitionEstimateInput): string[] {
  const queries: string[] = [];
  const productType = input.productType.toLowerCase().trim();
  const title = input.productTitle.toLowerCase();
  
  // Mots à éviter (trop génériques ou marketing)
  const stopWords = ['gift', 'decor', 'best', 'unique', 'trending', 'new', 'hot', 'sale', 'free', 'shipping'];
  
  // Extraire les mots significatifs du titre
  const titleWords = title
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .slice(0, 4);
  
  // Requête principale: type de produit + caractéristique principale
  if (titleWords.length > 0) {
    const mainQuery = `${productType} ${titleWords[0]}`.trim();
    if (mainQuery.length > 3) {
      queries.push(mainQuery);
    }
  }
  
  // Requête alternative: synonymes ou formulation différente
  const synonyms: Record<string, string[]> = {
    'mug': ['coffee cup', 'tea cup', 'ceramic mug'],
    'bracelet': ['wristband', 'bangle', 'cuff'],
    'necklace': ['pendant', 'chain'],
    'poster': ['print', 'art print', 'wall art'],
    'pillow': ['cushion', 'throw pillow'],
    'bag': ['tote bag', 'handbag', 'purse'],
    't-shirt': ['shirt', 'tee'],
  };
  
  if (synonyms[productType]) {
    const altQuery = `${synonyms[productType][0]} ${titleWords[0] || ''}`.trim();
    if (altQuery.length > 3 && altQuery !== queries[0]) {
      queries.push(altQuery);
    }
  }
  
  // Requête usage: comment le produit est utilisé
  const usageTerms: Record<string, string> = {
    'mug': 'coffee',
    'bracelet': 'jewelry',
    'necklace': 'jewelry',
    'poster': 'wall decor',
    'pillow': 'home decor',
    'bag': 'accessories',
  };
  
  if (usageTerms[productType]) {
    const usageQuery = `${productType} ${usageTerms[productType]}`.trim();
    if (usageQuery.length > 3 && !queries.includes(usageQuery)) {
      queries.push(usageQuery);
    }
  }
  
  // Requête style/intention (si applicable)
  const styleTerms = ['minimalist', 'vintage', 'modern', 'rustic', 'bohemian'];
  for (const style of styleTerms) {
    if (title.includes(style)) {
      const styleQuery = `${style} ${productType}`.trim();
      if (styleQuery.length > 3 && !queries.includes(styleQuery)) {
        queries.push(styleQuery);
        break; // Un seul style
      }
    }
  }
  
  // Si on a moins de 3 requêtes, ajouter des variantes simples
  while (queries.length < 3 && titleWords.length > 0) {
    const remainingWords = titleWords.filter(w => !queries.some(q => q.includes(w)));
    if (remainingWords.length > 0) {
      queries.push(`${productType} ${remainingWords[0]}`.trim());
    } else {
      queries.push(productType); // Dernier recours
      break;
    }
  }
  
  // Limiter à 5 requêtes maximum
  return queries.slice(0, 5);
}

/**
 * SOUS-SYSTÈME 2: Récupération du nombre de résultats Etsy
 * Récupère le nombre approximatif de résultats affiché par Etsy
 */
export async function fetchEtsyResultsCount(query: string, market: string = 'EN'): Promise<number | null> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.etsy.com/search?q=${encodedQuery}&ref=search_bar`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      // Timeout de 10 secondes
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      console.warn(`Etsy search failed for "${query}": HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Chercher le nombre de résultats dans le HTML
    // Etsy affiche généralement "X,XXX results" ou "X results"
    const resultsPatterns = [
      /([\d,]+)\s+results?/i,
      /([\d,]+)\s+resultats?/i, // Français
      /"total_results":\s*(\d+)/i,
      /results_count["']?\s*[:=]\s*(\d+)/i,
    ];
    
    for (const pattern of resultsPatterns) {
      const match = html.match(pattern);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ''));
        if (count > 0 && count < 10000000) { // Plausible
          return count;
        }
      }
    }
    
    // Si "many results" ou similaire
    if (html.includes('many results') || html.includes('beaucoup de résultats')) {
      return 50000; // Estimation conservatrice
    }
    
    return null;
  } catch (error) {
    console.warn(`Error fetching Etsy results for "${query}":`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * SOUS-SYSTÈME 3: Normalisation statistique (MÉDIANE)
 * Calcule la médiane des résultats pour éviter les extrêmes
 */
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * SOUS-SYSTÈME 4: Ajustement par catégorie
 * Applique le coefficient de catégorie au BCV
 */
export function getCategoryCoefficient(category: string): number {
  // Normaliser la catégorie
  const normalizedCategory = category.trim();
  
  // Chercher une correspondance exacte
  if (CATEGORY_COEFFICIENTS[normalizedCategory]) {
    return CATEGORY_COEFFICIENTS[normalizedCategory];
  }
  
  // Chercher une correspondance partielle
  for (const [key, value] of Object.entries(CATEGORY_COEFFICIENTS)) {
    if (normalizedCategory.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(normalizedCategory.toLowerCase())) {
      return value;
    }
  }
  
  // Valeur par défaut
  return CATEGORY_COEFFICIENTS['default'];
}

/**
 * SOUS-SYSTÈME 5: Score de concurrence (0-100)
 * Transforme le volume ajusté en score lisible
 */
export function calculateCompetitionScore(adjustedVolume: number): number {
  const score = Math.min((adjustedVolume / MAX_COMPETITION_VOLUME) * 100, 100);
  return Math.round(score * 10) / 10; // Arrondir à 1 décimale
}

/**
 * Détermine le niveau de saturation basé sur le score
 */
export function getSaturationLevel(score: number): 'low' | 'viable' | 'high' | 'saturated' {
  if (score < 30) return 'low';
  if (score < 55) return 'viable';
  if (score < 75) return 'high';
  return 'saturated';
}

/**
 * Détermine la décision finale basée sur le score
 */
export function getDecision(score: number): 'launch' | 'launch_with_caution' | 'do_not_launch' {
  if (score < 40) return 'launch';
  if (score < 70) return 'launch_with_caution';
  return 'do_not_launch';
}

/**
 * Fonction principale: Estime la concurrence complète
 */
export async function estimateCompetition(
  input: CompetitionEstimateInput
): Promise<CompetitionEstimateResult> {
  // 1. Générer les requêtes
  const queryKeywords = generateEtsyQueries(input);
  
  if (queryKeywords.length === 0) {
    throw new Error('Impossible de générer des requêtes de recherche valides');
  }
  
  // 2. Récupérer les résultats pour chaque requête
  const queryResults: EtsyQueryResult[] = [];
  const market = input.market || 'EN';
  
  for (const keyword of queryKeywords) {
    const resultsCount = await fetchEtsyResultsCount(keyword, market);
    
    queryResults.push({
      keyword,
      resultsCount: resultsCount || 0,
      date: new Date(),
      market,
      valid: resultsCount !== null && resultsCount > 0,
    });
    
    // Petite pause pour éviter de surcharger Etsy
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Filtrer les requêtes valides (minimum 2 requêtes valides requis)
  const validQueries = queryResults.filter(q => q.valid);
  
  if (validQueries.length < 2) {
    throw new Error(`Pas assez de requêtes valides (${validQueries.length}/2 minimum requis)`);
  }
  
  // 3. Calculer la médiane (BCV)
  const resultsCounts = validQueries.map(q => q.resultsCount);
  const baseCompetitionVolume = calculateMedian(resultsCounts);
  
  // 4. Appliquer le coefficient de catégorie (ACV)
  const categoryCoefficient = getCategoryCoefficient(input.category);
  const adjustedCompetitionVolume = Math.round(baseCompetitionVolume * categoryCoefficient);
  
  // 5. Calculer le score final
  const competitionScore = calculateCompetitionScore(adjustedCompetitionVolume);
  const saturationLevel = getSaturationLevel(competitionScore);
  const decision = getDecision(competitionScore);
  
  // 6. Générer l'explication
  const explanation = `Competition is estimated based on Etsy search result volumes across ${validQueries.length} keyword variations and adjusted using category benchmarks. Values are approximate and intended to support decision-making.`;
  
  return {
    queries: queryResults,
    validQueries,
    baseCompetitionVolume: Math.round(baseCompetitionVolume),
    adjustedCompetitionVolume,
    competitionScore,
    saturationLevel,
    category: input.category,
    categoryCoefficient,
    queriesUsed: validQueries.length,
    decision,
    explanation,
  };
}









