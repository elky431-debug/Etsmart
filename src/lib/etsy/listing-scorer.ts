/**
 * Système de scoring des listings Etsy
 * Score chaque aspect d'un listing (titre, tags, images, description, etc.)
 * Style RankHero
 */

export interface ListingScore {
  title: number;        // 0-100
  tags: number;         // 0-100
  images: number;       // 0-100
  video: number;         // 0-100
  materials: number;    // 0-100
  description: number;  // 0-100
  overall: number;      // 0-100 (moyenne pondérée)
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface ListingData {
  title: string;
  description: string;
  tags: string[];
  materials: string[];
  images?: Array<{ url: string; rank?: number }>;
  hasVideo?: boolean;
  videoLength?: number; // en secondes
  price?: number;
  quantity?: number;
  views?: number;
  num_favorers?: number;
}

/**
 * Score le titre d'un listing (0-100)
 */
export function scoreTitle(title: string): number {
  if (!title || title.trim().length === 0) return 0;

  let score = 0;
  const length = title.length;

  // Longueur optimale (100-140 caractères) : 30 points
  if (length >= 100 && length <= 140) {
    score += 30;
  } else if (length >= 80 && length < 100) {
    score += 20; // Trop court mais acceptable
  } else if (length > 140 && length <= 160) {
    score += 25; // Un peu trop long mais acceptable
  } else if (length >= 60 && length < 80) {
    score += 10; // Très court
  } else if (length > 160) {
    score += 15; // Trop long
  }

  // Mots-clés SEO pertinents : 25 points
  // Détecter les mots-clés importants (mots de 4+ caractères, pas de stop words)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'new', 'hot', 'sale', 'free', 'shipping']);
  const words = title.toLowerCase().split(/\s+/).filter(w => w.length >= 4 && !stopWords.has(w));
  const keywordCount = words.length;
  if (keywordCount >= 8) {
    score += 25;
  } else if (keywordCount >= 6) {
    score += 20;
  } else if (keywordCount >= 4) {
    score += 15;
  } else if (keywordCount >= 2) {
    score += 10;
  }

  // Structure claire (séparateurs, cohérence) : 20 points
  const hasSeparators = /[-–—|•]/.test(title);
  const hasMultipleWords = title.split(/\s+/).length >= 5;
  if (hasSeparators && hasMultipleWords) {
    score += 20;
  } else if (hasSeparators || hasMultipleWords) {
    score += 10;
  }

  // Évite le keyword stuffing : 15 points
  // Détecter les répétitions excessives
  const wordFreq: Record<string, number> = {};
  words.forEach(w => {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  });
  const maxFreq = Math.max(...Object.values(wordFreq));
  if (maxFreq <= 2) {
    score += 15; // Pas de répétition excessive
  } else if (maxFreq <= 3) {
    score += 10;
  } else {
    score += 5; // Keyword stuffing détecté
  }

  // Mots-clés en début de titre : 10 points
  const firstWords = title.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
  const hasKeywordsAtStart = words.some(w => firstWords.includes(w));
  if (hasKeywordsAtStart) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Score les tags d'un listing (0-100)
 */
export function scoreTags(tags: string[]): number {
  if (!tags || tags.length === 0) return 0;

  let score = 0;

  // Nombre de tags (13 tags max) : 20 points
  if (tags.length === 13) {
    score += 20;
  } else if (tags.length >= 10) {
    score += 15;
  } else if (tags.length >= 7) {
    score += 10;
  } else if (tags.length >= 4) {
    score += 5;
  }

  // Longueur des tags (max 20 caractères) : 15 points
  const validLengthTags = tags.filter(tag => tag.length <= 20 && tag.length > 0);
  const validLengthRatio = validLengthTags.length / tags.length;
  score += Math.round(15 * validLengthRatio);

  // Diversité (pas de doublons) : 15 points
  const uniqueTags = new Set(tags.map(t => t.toLowerCase().trim()));
  const diversityRatio = uniqueTags.size / tags.length;
  score += Math.round(15 * diversityRatio);

  // Pertinence des tags vs produit : 25 points
  // ⚠️ TODO: Implémenter une analyse plus poussée avec IA ou règles
  // Pour l'instant, on donne un score de base si les tags ne sont pas vides
  if (tags.length >= 5) {
    score += 20; // Avoir plusieurs tags est déjà un bon signe
  } else {
    score += 10;
  }

  // Opportunité SEO (demande vs concurrence) : 25 points
  // ⚠️ TODO: Intégrer avec l'analyse des tags (demande/concurrence)
  // Pour l'instant, on donne un score moyen
  score += 15;

  return Math.min(100, Math.max(0, score));
}

/**
 * Score les images d'un listing (0-100)
 */
export function scoreImages(images?: Array<{ url: string; rank?: number }>): number {
  if (!images || images.length === 0) return 0;

  let score = 0;

  // Nombre d'images (5-10 idéal) : 20 points
  if (images.length >= 5 && images.length <= 10) {
    score += 20;
  } else if (images.length >= 3 && images.length < 5) {
    score += 15;
  } else if (images.length > 10) {
    score += 18; // Beaucoup d'images, c'est bien mais pas optimal
  } else if (images.length >= 1) {
    score += 10;
  }

  // Qualité perçue (via analyse basique) : 30 points
  // ⚠️ TODO: Implémenter une analyse IA des images (clarté, composition, etc.)
  // Pour l'instant, on donne un score de base
  score += 20; // Score moyen par défaut

  // Cohérence visuelle : 20 points
  // ⚠️ TODO: Analyser la cohérence des images (couleurs, style, etc.)
  score += 15; // Score moyen par défaut

  // Première image accrocheuse : 15 points
  // ⚠️ TODO: Analyser la première image spécifiquement
  if (images.length > 0) {
    score += 12; // Avoir au moins une image
  }

  // Images montrant différents angles : 15 points
  if (images.length >= 3) {
    score += 15; // Plusieurs images = probablement différents angles
  } else if (images.length >= 2) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Score la vidéo d'un listing (0-100)
 */
export function scoreVideo(hasVideo?: boolean, videoLength?: number): number {
  if (!hasVideo) return 0;

  let score = 0;

  // Présence d'une vidéo : 50 points
  score += 50;

  // Longueur optimale (30-60s) : 25 points
  if (videoLength) {
    if (videoLength >= 30 && videoLength <= 60) {
      score += 25;
    } else if (videoLength >= 15 && videoLength < 30) {
      score += 20;
    } else if (videoLength > 60 && videoLength <= 120) {
      score += 20;
    } else {
      score += 10;
    }
  } else {
    score += 15; // Vidéo présente mais longueur inconnue
  }

  // Qualité du contenu : 25 points
  // ⚠️ TODO: Analyser le contenu de la vidéo (si possible)
  score += 20; // Score moyen par défaut

  return Math.min(100, Math.max(0, score));
}

/**
 * Score les matériaux d'un listing (0-100)
 */
export function scoreMaterials(materials: string[]): number {
  if (!materials || materials.length === 0) return 0;

  let score = 0;

  // Matériaux renseignés : 50 points
  score += 50;

  // Nombre de matériaux (2-4 idéal) : 25 points
  if (materials.length >= 2 && materials.length <= 4) {
    score += 25;
  } else if (materials.length === 1) {
    score += 15;
  } else if (materials.length > 4) {
    score += 20; // Beaucoup de matériaux, c'est bien mais peut être trop
  }

  // Pertinence : 25 points
  // ⚠️ TODO: Vérifier la pertinence des matériaux (cohérence avec le produit)
  score += 20; // Score moyen par défaut

  return Math.min(100, Math.max(0, score));
}

/**
 * Score la description d'un listing (0-100)
 */
export function scoreDescription(description: string): number {
  if (!description || description.trim().length === 0) return 0;

  let score = 0;
  const wordCount = description.split(/\s+/).length;

  // Longueur (300-500 mots) : 20 points
  if (wordCount >= 300 && wordCount <= 500) {
    score += 20;
  } else if (wordCount >= 200 && wordCount < 300) {
    score += 15;
  } else if (wordCount > 500 && wordCount <= 700) {
    score += 18;
  } else if (wordCount >= 100 && wordCount < 200) {
    score += 10;
  } else if (wordCount < 100) {
    score += 5;
  }

  // Structure (sections claires) : 20 points
  const hasSections = /#{1,3}\s|^[A-Z][^.!?]*:|\n\n/.test(description);
  const hasBulletPoints = /[-•*]\s/.test(description);
  if (hasSections || hasBulletPoints) {
    score += 20;
  } else if (description.split('\n\n').length >= 3) {
    score += 15; // Paragraphes séparés
  } else {
    score += 10;
  }

  // Mots-clés SEO : 15 points
  const keywordDensity = (description.match(/\b\w{4,}\b/g) || []).length / wordCount;
  if (keywordDensity >= 0.02 && keywordDensity <= 0.05) {
    score += 15; // Densité optimale
  } else if (keywordDensity > 0.05) {
    score += 10; // Trop de mots-clés (keyword stuffing)
  } else {
    score += 8; // Pas assez de mots-clés
  }

  // Bénéfices client : 20 points
  const benefitKeywords = ['benefit', 'perfect for', 'ideal for', 'great for', 'helps', 'improves', 'enhances', 'beneficial'];
  const hasBenefits = benefitKeywords.some(keyword => description.toLowerCase().includes(keyword));
  if (hasBenefits) {
    score += 20;
  } else {
    score += 10;
  }

  // Call-to-action : 10 points
  const ctaKeywords = ['add to cart', 'buy now', 'order', 'purchase', 'shop now', 'get yours'];
  const hasCTA = ctaKeywords.some(keyword => description.toLowerCase().includes(keyword));
  if (hasCTA) {
    score += 10;
  }

  // Emojis stratégiques : 15 points
  const emojiCount = (description.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount >= 8 && emojiCount <= 15) {
    score += 15;
  } else if (emojiCount >= 4 && emojiCount < 8) {
    score += 10;
  } else if (emojiCount > 15) {
    score += 12; // Trop d'emojis peut être contre-productif
  } else if (emojiCount >= 1) {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calcule le score global et le grade d'un listing
 */
export function calculateOverallScore(scores: Omit<ListingScore, 'overall' | 'grade'>): { overall: number; grade: 'A' | 'B' | 'C' | 'D' | 'F' } {
  // Moyenne pondérée (chaque critère a un poids)
  const weights = {
    title: 0.20,      // 20%
    tags: 0.15,       // 15%
    images: 0.20,     // 20%
    video: 0.10,      // 10%
    materials: 0.10,  // 10%
    description: 0.25, // 25%
  };

  const overall = Math.round(
    scores.title * weights.title +
    scores.tags * weights.tags +
    scores.images * weights.images +
    scores.video * weights.video +
    scores.materials * weights.materials +
    scores.description * weights.description
  );

  // Grade basé sur le score global
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (overall >= 90) {
    grade = 'A';
  } else if (overall >= 80) {
    grade = 'B';
  } else if (overall >= 70) {
    grade = 'C';
  } else if (overall >= 60) {
    grade = 'D';
  } else {
    grade = 'F';
  }

  return { overall, grade };
}

/**
 * Score complet d'un listing
 */
export function scoreListing(listing: ListingData): ListingScore {
  const titleScore = scoreTitle(listing.title);
  const tagsScore = scoreTags(listing.tags);
  const imagesScore = scoreImages(listing.images);
  const videoScore = scoreVideo(listing.hasVideo, listing.videoLength);
  const materialsScore = scoreMaterials(listing.materials);
  const descriptionScore = scoreDescription(listing.description);

  const { overall, grade } = calculateOverallScore({
    title: titleScore,
    tags: tagsScore,
    images: imagesScore,
    video: videoScore,
    materials: materialsScore,
    description: descriptionScore,
  });

  return {
    title: titleScore,
    tags: tagsScore,
    images: imagesScore,
    video: videoScore,
    materials: materialsScore,
    description: descriptionScore,
    overall,
    grade,
  };
}

