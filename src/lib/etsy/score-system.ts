export type ScoreGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'D';

export interface ScoreDetail {
  score: number;
  label: string;
  explanation: string;
  improvements: string[];
}

export interface ListingScoreBreakdown {
  global: {
    score: number;
    grade: ScoreGrade;
  };
  subScores: {
    title: ScoreDetail;
    tags: ScoreDetail;
    images: ScoreDetail;
    price: ScoreDetail;
    completeness: ScoreDetail;
    freshness: ScoreDetail;
  };
}

export interface ShopScoreBreakdown {
  global: {
    score: number;
    grade: ScoreGrade;
  };
  subScores: {
    seo: ScoreDetail;
    branding: ScoreDetail;
    catalog: ScoreDetail;
    pricing: ScoreDetail;
    trust: ScoreDetail;
  };
}

export interface ListingScoreInput {
  title: string;
  price?: number;
  tags?: string[];
  images?: string[];
  description?: string;
  materials?: string[];
  hasVideo?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  isPartialData?: boolean;
}

export interface ShopScoreInput {
  name?: string;
  averagePrice?: number;
  rating?: number;
  reviewsCount?: number;
  salesCount?: number;
  listings: ListingScoreInput[];
}

interface ListingScoreContext {
  mainKeyword?: string;
  shopAveragePrice?: number;
  now?: Date;
}

const LISTING_WEIGHTS = {
  title: 0.2,
  tags: 0.2,
  images: 0.15,
  price: 0.1,
  completeness: 0.15,
  freshness: 0.2,
};

const SHOP_WEIGHTS = {
  seo: 0.25,
  branding: 0.15,
  catalog: 0.2,
  pricing: 0.15,
  trust: 0.25,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value);
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Fort';
  if (score >= 60) return 'Moyen';
  return 'Faible';
}

function gradeFromScore(score: number): ScoreGrade {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 50) return 'C';
  return 'D';
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((w) => w.length >= 3);
}

function rootWord(token: string): string {
  return token
    .toLowerCase()
    .replace(/(ing|ed|ly|es|s)$/g, '')
    .trim();
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function detail(score: number, explanation: string, improvements: string[]): ScoreDetail {
  const bounded = clamp(round(score));
  return {
    score: bounded,
    label: scoreLabel(bounded),
    explanation,
    improvements: improvements.slice(0, 3),
  };
}

function toDate(value?: string | Date): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computeListingScore(
  listing: ListingScoreInput,
  context: ListingScoreContext = {}
): ListingScoreBreakdown {
  const isPartialData = Boolean(listing.isPartialData);
  const title = listing.title || '';
  const titleTokens = tokenize(title);
  const titleRoots = titleTokens.map(rootWord);
  const uniqueTitleRoots = unique(titleRoots);
  const wordCount = titleTokens.length;
  const first40 = normalize(title.slice(0, 40));
  const mainKeyword = normalize(context.mainKeyword || '');

  // TITLE
  const titleLength = title.length;
  let titleScore = 100; // Règle user: ~120 caractères et 14 mots
  const charGap = Math.abs(titleLength - 120);
  titleScore -= Math.min(30, charGap * 0.6);
  const wordGap = Math.abs(wordCount - 14);
  titleScore -= Math.min(30, wordGap * 5);
  if (titleLength < 105 || titleLength > 145) titleScore -= 10;
  if (mainKeyword && !first40.includes(mainKeyword)) titleScore -= 20;
  const titleDiversityRatio = titleRoots.length
    ? uniqueTitleRoots.length / titleRoots.length
    : 0;
  if (titleDiversityRatio < 0.85) titleScore -= 25; // pas de répétition
  if (title.endsWith('...')) titleScore = Math.max(titleScore, 65);
  if (isPartialData) titleScore = Math.max(titleScore, 60);
  const titleImprovements: string[] = [];
  if (titleLength < 110 || titleLength > 135)
    titleImprovements.push('Vise environ 120 caractères (zone idéale: 110-135).');
  if (wordCount !== 14) titleImprovements.push('Vise 14 mots pour un titre Etsy optimal.');
  if (mainKeyword && !first40.includes(mainKeyword))
    titleImprovements.push('Place le mot-clé principal dans les 40 premiers caractères.');
  if (titleDiversityRatio < 0.85)
    titleImprovements.push('Supprime les répétitions de mots pour garder un titre propre.');
  const titleDetail = detail(
    titleScore,
    `Titre ${titleLength} caractères, ${wordCount} mots, diversité ${Math.round(titleDiversityRatio * 100)}%${
      mainKeyword ? `, mot-clé principal ${first40.includes(mainKeyword) ? 'bien placé' : 'absent en début'}` : ''
    }.`,
    titleImprovements.length ? titleImprovements : ['Conserve cette structure de titre performante.']
  );

  // TAGS
  const rawTags = (listing.tags || []).map((t) => normalize(t)).filter(Boolean);
  const uniqueTags = unique(rawTags);
  const tagRoots = rawTags.flatMap((t) => tokenize(t).map(rootWord));
  const uniqueTagRoots = unique(tagRoots);
  let tagsScore = 35;
  if (rawTags.length > 0) {
    tagsScore = 55;
    // Règle user: 13 tags obligatoires
    if (rawTags.length === 13) tagsScore += 25;
    else tagsScore -= Math.min(30, Math.abs(13 - rawTags.length) * 5);
    if (uniqueTags.length !== rawTags.length) tagsScore -= 15;
    const diversityRatio = tagRoots.length ? uniqueTagRoots.length / tagRoots.length : 0;
    if (diversityRatio < 0.75) tagsScore -= 15;
    // Règle user: tags simples
    const avgWordsPerTag =
      rawTags.length > 0
        ? rawTags.reduce((acc, t) => acc + tokenize(t).length, 0) / rawTags.length
        : 0;
    if (avgWordsPerTag <= 3) tagsScore += 10;
    else tagsScore -= 10;
    const titleOverlap = uniqueTagRoots.filter((r) => uniqueTitleRoots.includes(r)).length;
    if (uniqueTagRoots.length > 0) {
      const overlapRatio = titleOverlap / uniqueTagRoots.length;
      if (overlapRatio < 0.2) tagsScore -= 10;
      if (overlapRatio > 0.85) tagsScore -= 8;
    }
  }
  if (isPartialData && rawTags.length === 0) tagsScore = Math.max(tagsScore, 60);
  const tagImprovements: string[] = [];
  if (rawTags.length !== 13) tagImprovements.push('Utilise exactement 13 tags.');
  if (uniqueTags.length !== rawTags.length)
    tagImprovements.push('Supprime les doublons de tags pour éviter la perte de portée.');
  if (tagRoots.length > 0 && uniqueTagRoots.length / tagRoots.length < 0.75)
    tagImprovements.push('Diversifie les racines de mots pour couvrir plus de requêtes.');
  const avgWordsPerTag =
    rawTags.length > 0
      ? rawTags.reduce((acc, t) => acc + tokenize(t).length, 0) / rawTags.length
      : 0;
  if (rawTags.length > 0 && avgWordsPerTag > 3)
    tagImprovements.push('Garde des tags simples (idéalement 1 à 3 mots par tag).');
  if (rawTags.length === 0)
    tagImprovements.push('Ajoute des tags précis et long-tail liés au titre et à la niche.');
  const tagsDetail = detail(
    tagsScore,
    `${rawTags.length}/13 tags, ${uniqueTags.length} uniques, diversité racines ${tagRoots.length ? Math.round((uniqueTagRoots.length / tagRoots.length) * 100) : 0}%, simplicité moyenne ${rawTags.length ? avgWordsPerTag.toFixed(1) : '0'} mot(s)/tag.`,
    tagImprovements
  );

  // IMAGES
  const imagesCount = listing.images?.length || 0;
  let imagesScore = 35 + Math.min(45, imagesCount * 6);
  const titleText = normalize(title);
  const lifestyleSignal =
    /(gift|decor|home|wear|wedding|baby|kitchen|office|wall|room)/.test(titleText) && imagesCount >= 5;
  if (lifestyleSignal) imagesScore += 10;
  if (imagesCount >= 10) imagesScore += 10;
  if (isPartialData && imagesCount <= 1) imagesScore = Math.max(imagesScore, 70);
  const imagesImprovements: string[] = [];
  if (imagesCount < 5) imagesImprovements.push('Ajoute au moins 5 visuels pour rassurer et convertir.');
  if (imagesCount < 10) imagesImprovements.push('Approche les 10 images pour couvrir usages et détails.');
  if (!lifestyleSignal)
    imagesImprovements.push('Ajoute des photos lifestyle pour montrer le produit en contexte.');
  const imagesDetail = detail(
    imagesScore,
    `${imagesCount} image(s) détectée(s)${lifestyleSignal ? ', avec signal lifestyle.' : ', signal lifestyle faible.'}`,
    imagesImprovements
  );

  // PRICE
  const price = listing.price || 0;
  const shopAvg = context.shopAveragePrice || 0;
  let priceScore = 65;
  if (price > 0 && shopAvg > 0) {
    const delta = Math.abs(price - shopAvg) / shopAvg;
    if (delta <= 0.15) priceScore = 95;
    else if (delta <= 0.3) priceScore = 80;
    else if (delta <= 0.5) priceScore = 65;
    else priceScore = 45;
  } else if (price > 0) {
    priceScore = 70;
  } else {
    priceScore = 30;
  }
  const priceImprovements: string[] = [];
  if (price <= 0) priceImprovements.push('Renseigne un prix valide pour pouvoir optimiser ce listing.');
  if (price > 0 && shopAvg > 0) {
    const delta = Math.abs(price - shopAvg) / shopAvg;
    if (delta > 0.3) priceImprovements.push('Rapproche le prix de la moyenne boutique pour réduire le risque d’outlier.');
  }
  priceImprovements.push('Teste 1 à 2 variantes de prix et compare le taux de conversion.');
  const priceDeltaPct = price > 0 && shopAvg > 0 ? Math.round((Math.abs(price - shopAvg) / shopAvg) * 100) : 0;
  const priceDetail = detail(
    priceScore,
    shopAvg > 0
      ? `Prix ${price.toFixed(2)} vs moyenne boutique ${shopAvg.toFixed(2)} (écart ${priceDeltaPct}%).`
      : `Prix ${price.toFixed(2)} détecté, moyenne boutique non disponible.`,
    priceImprovements
  );

  // COMPLETENESS
  let completenessScore = 20;
  const hasDescription = Boolean((listing.description || '').trim());
  const hasMaterials = Boolean(listing.materials && listing.materials.length > 0);
  const hasVideo = Boolean(listing.hasVideo);
  const descriptionLength = (listing.description || '').trim().length;
  const descriptionParagraphs = (listing.description || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean).length;
  const descriptionStructured =
    descriptionParagraphs >= 3 || /[-•]\s+/.test(listing.description || '');
  const materialsCount = listing.materials?.length || 0;

  // Règle user: description longue + structurée
  if (hasDescription && descriptionLength >= 450) completenessScore += 25;
  else if (hasDescription && descriptionLength >= 250) completenessScore += 12;
  if (descriptionStructured) completenessScore += 15;

  // Règle user: vidéo obligatoire
  if (hasVideo) completenessScore += 30;
  else completenessScore -= 20;

  // Règle user: environ 3 matériaux
  if (hasMaterials) {
    const gapMaterials = Math.abs(materialsCount - 3);
    completenessScore += Math.max(0, 20 - gapMaterials * 6);
  }
  if (isPartialData && !hasDescription && !hasMaterials && !hasVideo) {
    completenessScore = Math.max(completenessScore, 60);
  }

  const completenessImprovements: string[] = [];
  if (!hasDescription || descriptionLength < 450)
    completenessImprovements.push('Rédige une description longue (idéalement 450+ caractères).');
  if (!descriptionStructured)
    completenessImprovements.push('Structure la description en sections ou puces claires.');
  if (!hasVideo) completenessImprovements.push('Ajoute une vidéo: elle est obligatoire pour un score fort.');
  if (!hasMaterials || materialsCount !== 3)
    completenessImprovements.push('Renseigne environ 3 matériaux précis.');
  const completenessDetail = detail(
    completenessScore,
    `Description ${descriptionLength} caractères (${descriptionStructured ? 'structurée' : 'peu structurée'}), vidéo ${
      hasVideo ? 'oui' : 'non'
    }, matériaux ${materialsCount}.`,
    completenessImprovements
  );

  // FRESHNESS
  const now = context.now || new Date();
  const refDate = toDate(listing.updatedAt) || toDate(listing.createdAt);
  let freshnessScore = 60;
  if (refDate) {
    const ageDays = Math.max(0, (now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
    if (ageDays <= 30) freshnessScore = 95;
    else if (ageDays <= 90) freshnessScore = 85;
    else if (ageDays <= 180) freshnessScore = 75;
    else if (ageDays <= 365) freshnessScore = 65;
    else freshnessScore = 50;
  }
  if (isPartialData && !refDate) freshnessScore = Math.max(freshnessScore, 65);
  const freshnessImprovements: string[] = [];
  if (!refDate) freshnessImprovements.push('Renseigne ou synchronise les dates de création/mise à jour.');
  if (freshnessScore < 75)
    freshnessImprovements.push('Mets à jour le listing (titre, tags, visuels) pour envoyer un signal de fraîcheur.');
  const freshnessDetail = detail(
    freshnessScore,
    refDate
      ? `Dernière date détectée: ${refDate.toISOString().slice(0, 10)}.`
      : 'Aucune date fiable détectée pour le listing.',
    freshnessImprovements
  );

  let globalScore =
    titleDetail.score * LISTING_WEIGHTS.title +
    tagsDetail.score * LISTING_WEIGHTS.tags +
    imagesDetail.score * LISTING_WEIGHTS.images +
    priceDetail.score * LISTING_WEIGHTS.price +
    completenessDetail.score * LISTING_WEIGHTS.completeness +
    freshnessDetail.score * LISTING_WEIGHTS.freshness;

  // Ne pas afficher une note "D" si Etsy bloque les données listing détaillées.
  if (isPartialData && globalScore < 62) {
    globalScore = 62;
  }

  return {
    global: {
      score: round(globalScore),
      grade: gradeFromScore(globalScore),
    },
    subScores: {
      title: titleDetail,
      tags: tagsDetail,
      images: imagesDetail,
      price: priceDetail,
      completeness: completenessDetail,
      freshness: freshnessDetail,
    },
  };
}

export function computeShopScore(shop: ShopScoreInput): ShopScoreBreakdown {
  const listings = shop.listings || [];
  const listingCount = listings.length;
  const titlesTokens = listings.map((l) => tokenize(l.title || ''));
  const titlesRoots = titlesTokens.map((tokens) => unique(tokens.map(rootWord)));
  const flatRoots = titlesRoots.flat();
  const uniqueRoots = unique(flatRoots);

  // SEO
  let seoScore = 45;
  if (listingCount > 0) {
    const frequency: Record<string, number> = {};
    titlesRoots.forEach((roots) => {
      roots.forEach((r) => {
        frequency[r] = (frequency[r] || 0) + 1;
      });
    });
    const topRoots = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);
    const consistency =
      listingCount > 0 ? topRoots.reduce((acc, r) => acc + (frequency[r] || 0), 0) / listingCount : 0;
    seoScore = 55 + Math.min(30, consistency * 2.5);
    if (uniqueRoots.length < 20) seoScore -= 10;
  }
  const seoDetail = detail(
    seoScore,
    `${listingCount} listings analysés, ${uniqueRoots.length} racines de mots-clés, cohérence ${Math.round(
      Math.min(100, (seoScore / 100) * 100)
    )}%.`,
    [
      'Aligne les mots-clés principaux sur tes meilleurs listings.',
      'Maintiens une cohérence de vocabulaire sur le même segment.',
      'Ajoute des variantes long-tail pour élargir le trafic.',
    ]
  );

  // BRANDING
  const titlePrefixes = listings.map((l) => tokenize(l.title || '').slice(0, 2).join(' ')).filter(Boolean);
  const uniquePrefixes = unique(titlePrefixes);
  const avgImages = listingCount
    ? listings.reduce((sum, l) => sum + (l.images?.length || 0), 0) / listingCount
    : 0;
  let brandingScore = 55;
  if (listingCount > 0) {
    const prefixConsistency = 1 - uniquePrefixes.length / Math.max(1, listingCount);
    brandingScore += clamp(prefixConsistency * 30, 0, 30);
    if (avgImages >= 6) brandingScore += 10;
  }
  const brandingDetail = detail(
    brandingScore,
    `Cohérence titres ${Math.round(
      (1 - uniquePrefixes.length / Math.max(1, listingCount)) * 100
    ) || 0}% et moyenne ${avgImages.toFixed(1)} image(s)/listing.`,
    [
      'Uniformise la structure de titres pour renforcer la marque.',
      'Garde un style visuel constant entre les listings.',
      'Ajoute une signature visuelle (angles, ambiance, mise en scène).',
    ]
  );

  // CATALOG
  let catalogScore = 40;
  if (listingCount >= 50) catalogScore = 90;
  else if (listingCount >= 25) catalogScore = 80;
  else if (listingCount >= 12) catalogScore = 70;
  else if (listingCount >= 6) catalogScore = 60;
  const nicheFocus =
    flatRoots.length > 0 ? uniqueRoots.length / Math.max(1, flatRoots.length) : 1;
  if (nicheFocus > 0.8) catalogScore -= 8;
  if (nicheFocus < 0.4) catalogScore += 8;
  const catalogDetail = detail(
    catalogScore,
    `Catalogue de ${listingCount} listings, focus niche ${Math.round((1 - nicheFocus) * 100)}%.`,
    [
      'Ajoute des listings autour de ta niche principale.',
      'Évite de disperser le catalogue sur des thèmes trop éloignés.',
      'Crée des variations de tes meilleures offres.',
    ]
  );

  // PRICING
  const prices = listings.map((l) => l.price || 0).filter((p) => p > 0);
  let pricingScore = 50;
  if (prices.length > 1) {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((acc, p) => acc + (p - avg) ** 2, 0) / prices.length;
    const sd = Math.sqrt(variance);
    const cv = avg > 0 ? sd / avg : 1;
    if (cv <= 0.25) pricingScore = 92;
    else if (cv <= 0.4) pricingScore = 80;
    else if (cv <= 0.6) pricingScore = 68;
    else pricingScore = 52;
  } else if (prices.length === 1) {
    pricingScore = 65;
  }
  const pricingDetail = detail(
    pricingScore,
    prices.length > 1
      ? `Cohérence prix calculée sur ${prices.length} listing(s).`
      : 'Pas assez de prix fiables pour une distribution robuste.',
    [
      'Évite des écarts de prix trop extrêmes entre listings proches.',
      'Crée 2 ou 3 paliers de prix lisibles (entrée, coeur, premium).',
      'Réalise des tests A/B sur les listings avec faible conversion.',
    ]
  );

  // TRUST
  const rating = shop.rating || 0;
  const reviews = shop.reviewsCount || 0;
  const sales = shop.salesCount || 0;
  let trustScore = 35;
  if (rating > 0) trustScore += clamp((rating / 5) * 40, 0, 40);
  if (reviews > 0) trustScore += Math.min(20, Math.log10(reviews + 1) * 8);
  if (sales > 0 && reviews > 0) {
    const ratio = reviews / sales;
    if (ratio >= 0.02 && ratio <= 0.3) trustScore += 10;
  }
  const trustDetail = detail(
    trustScore,
    `Note ${rating.toFixed(1)}/5, ${reviews} avis, ${sales} ventes, ratio avis/ventes ${
      sales > 0 ? (reviews / sales).toFixed(3) : 'n/a'
    }.`,
    [
      'Encourage les avis post-achat avec une expérience client irréprochable.',
      'Améliore les fiches qui génèrent des retours négatifs récurrents.',
      'Maintiens une note > 4.6 pour maximiser la confiance.',
    ]
  );

  const globalScore =
    seoDetail.score * SHOP_WEIGHTS.seo +
    brandingDetail.score * SHOP_WEIGHTS.branding +
    catalogDetail.score * SHOP_WEIGHTS.catalog +
    pricingDetail.score * SHOP_WEIGHTS.pricing +
    trustDetail.score * SHOP_WEIGHTS.trust;

  return {
    global: {
      score: round(globalScore),
      grade: gradeFromScore(globalScore),
    },
    subScores: {
      seo: seoDetail,
      branding: brandingDetail,
      catalog: catalogDetail,
      pricing: pricingDetail,
      trust: trustDetail,
    },
  };
}
