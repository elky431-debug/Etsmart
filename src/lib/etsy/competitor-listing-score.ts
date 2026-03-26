import { clampScore, letterGradeVerbal, scoreToLetterGrade } from '@/lib/etsy/listing-letter-grade';

export type CompetitorCardListingInput = {
  title: string;
  price: number;
  images?: string[];
  tags?: string[];
  description?: string;
  materials?: string[];
  sales?: number;
  /** Note moyenne Etsy (0–5) si présente dans le JSON */
  listingStars?: number;
  /** Nombre d’avis sur la fiche */
  listingReviews?: number;
};

export type CompetitorCardContext = {
  /** Médiane des prix de l’échantillon boutique (positionnement relatif). */
  shopMedianPrice?: number;
  /** Titres des autres fiches du même bloc (ex. les 2 autres du top 3) pour mesurer la similarité. */
  peerTitlesInSample?: string[];
};

const STOP_TITLE = new Set(
  [
    'the',
    'and',
    'for',
    'with',
    'your',
    'from',
    'this',
    'that',
    'vous',
    'pour',
    'avec',
    'dans',
    'une',
    'des',
    'les',
    'aux',
    'sur',
    'sans',
    'plus',
    'très',
    'petit',
    'grand',
  ].map((w) => w.toLowerCase())
);

/** Mots-clés distincts dans le titre (proxy quand les tags ne sont pas scrapés). */
function distinctTitleTokens(title: string): number {
  const raw = title.toLowerCase().match(/[a-zàâäéèêëïîôùûüç0-9]{3,}/g) || [];
  const filtered = raw.filter((w) => !STOP_TITLE.has(w));
  return new Set(filtered).size;
}

function effectiveTagCount(tags: string[] | undefined, title: string): { n: number; fromTitleFallback: boolean } {
  const tn = tags?.filter(Boolean).length ?? 0;
  if (tn > 0) return { n: tn, fromTitleFallback: false };
  const pseudo = distinctTitleTokens(title);
  return { n: Math.min(13, Math.max(0, pseudo)), fromTitleFallback: true };
}

function effectiveDescriptionLength(
  desc: string | undefined,
  materials: string[] | undefined,
  tags: string[] | undefined
): { len: number; usedFallback: boolean } {
  const d = (desc || '').trim().length;
  if (d > 0) return { len: d, usedFallback: false };
  const m = (materials || []).join(' ').trim().length;
  const t = (tags?.filter(Boolean).length ?? 0) * 14;
  const fallback = m + t;
  return { len: fallback, usedFallback: fallback > 0 };
}

function scoreTitleLength(title: string): number {
  const t = title.trim();
  if (!t) return 0;
  const len = t.length;
  if (len >= 70 && len <= 140) return 92;
  if (len >= 40 && len < 70) return 78;
  if (len > 140) return 68;
  return 52;
}

/** Densité / diversité des mots (varie beaucoup d’une fiche à l’autre même avec même tranche de longueur). */
function scoreTitleWordMetrics(title: string): number {
  const t = title.trim();
  if (!t) return 25;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 25;
  const norm = words.map((w) => w.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüç0-9-]/gi, '')).filter(Boolean);
  const uniq = new Set(norm).size;
  const ratio = uniq / norm.length;
  let s = 58;
  if (words.length >= 6 && words.length <= 16) s += 18;
  else if (words.length >= 4 && words.length <= 20) s += 10;
  else if (words.length > 22) s -= 12;
  if (ratio >= 0.82) s += 14;
  else if (ratio >= 0.65) s += 6;
  else if (ratio < 0.45) s -= 10;
  const digits = (t.match(/\d/g) || []).length;
  if (digits >= 2 && digits <= 14) s += 6;
  return clampScore(s);
}

/** Plus les titres du même lot se ressemblent au début, plus le score baisse (vraie différenciation). */
function scoreTitleUniqueness(title: string, peers: string[] | undefined): number {
  if (!peers?.length) return 72;
  const t = title.trim().toLowerCase();
  if (!t) return 40;
  let worstOverlapRatio = 0;
  for (const p of peers) {
    const pl = p.trim().toLowerCase();
    if (!pl || pl === t) continue;
    let i = 0;
    const maxLen = Math.min(t.length, pl.length, 90);
    while (i < maxLen && t[i] === pl[i]) i++;
    const ratio = i / t.length;
    worstOverlapRatio = Math.max(worstOverlapRatio, ratio);
  }
  if (worstOverlapRatio < 0.22) return 94;
  if (worstOverlapRatio < 0.38) return 82;
  if (worstOverlapRatio < 0.52) return 70;
  if (worstOverlapRatio < 0.68) return 58;
  return 46;
}

function combinedTitleScore(title: string, ctx?: CompetitorCardContext): number {
  const lenScore = scoreTitleLength(title);
  const uniq = scoreTitleUniqueness(title, ctx?.peerTitlesInSample);
  const wordM = scoreTitleWordMetrics(title);
  return clampScore(Math.round(lenScore * 0.34 + uniq * 0.32 + wordM * 0.34));
}

function scoreTagsEffective(n: number, fromFallback: boolean): number {
  let s: number;
  if (n >= 11) s = 95;
  else if (n >= 7) s = 82;
  else if (n >= 4) s = 72;
  else if (n >= 2) s = 62;
  else if (n >= 1) s = 52;
  else s = 38;
  if (fromFallback) s = clampScore(Math.round(s * 0.88));
  return clampScore(s);
}

/** Richesse des URLs (chemins différents = fiches différentes même avec 1 vignette scrapée). */
function imageSetRichness(urls: string[]): { n: number; uniqueRoots: number; pathScore: number } {
  const clean = urls.map((u) => u.trim().split('?')[0].toLowerCase()).filter(Boolean);
  const n = clean.length;
  const uniqueRoots = new Set(clean).size;
  let pathScore = 0;
  for (const u of clean) {
    try {
      const path = new URL(u.startsWith('http') ? u : `https:${u}`).pathname;
      const segs = path.split('/').filter(Boolean).length;
      const digits = (path.match(/\d/g) || []).length;
      pathScore += Math.min(18, segs * 2 + Math.min(8, digits));
    } catch {
      pathScore += Math.min(12, u.length / 25);
    }
  }
  return { n, uniqueRoots, pathScore: Math.round(pathScore / Math.max(1, n)) };
}

function scoreImages(images: string[] | undefined): number {
  const raw = images?.filter(Boolean) ?? [];
  if (raw.length === 0) return 28;
  const { n, uniqueRoots, pathScore } = imageSetRichness(raw);
  let base: number;
  if (n >= 8) base = 100;
  else if (n >= 4) base = 82;
  else if (n >= 2) base = 68;
  else base = 52;
  if (n === 1) {
    base = 48 + Math.min(22, pathScore);
  }
  if (uniqueRoots > 1) base += Math.min(10, (uniqueRoots - 1) * 4);
  return clampScore(base);
}

function scoreDescriptionEffective(len: number, usedFallback: boolean): number {
  let s: number;
  if (len >= 400) s = 95;
  else if (len >= 150) s = 78;
  else if (len >= 50) s = 58;
  else if (len > 0) s = 44;
  else s = 22;
  if (usedFallback && len > 0) s = clampScore(Math.round(s * 0.9));
  return clampScore(s);
}

function scoreSalesSignal(sales: number | undefined): number {
  if (sales == null || !Number.isFinite(sales) || sales <= 0) return 55;
  if (sales >= 500) return 100;
  if (sales >= 200) return 90;
  if (sales >= 80) return 80;
  if (sales >= 25) return 70;
  if (sales >= 10) return 62;
  return 56;
}

/** Étoiles + avis Etsy quand le JSON les fournit ; sinon ventes listing. */
function scoreSocial(l: CompetitorCardListingInput): number {
  const stars = l.listingStars;
  const rev = l.listingReviews;
  if (stars != null && stars > 0 && stars <= 5) {
    let base = (stars / 5) * 52;
    if (rev != null && rev > 0) {
      if (rev >= 500) base += 44;
      else if (rev >= 200) base += 38;
      else if (rev >= 80) base += 32;
      else if (rev >= 30) base += 26;
      else if (rev >= 10) base += 20;
      else base += 14;
    } else {
      base += 10;
    }
    return Math.min(100, Math.round(base));
  }
  return scoreSalesSignal(l.sales);
}

function scorePriceVsShop(price: number, median: number | undefined): number {
  if (!median || median <= 0 || !price || price <= 0) return 58;
  const r = price / median;
  if (r >= 0.92 && r <= 1.08) return 88;
  if (r >= 0.8 && r <= 1.2) return 80;
  if (r < 0.8) return 72;
  return 76;
}

/**
 * Score 0–100 + note lettre : chaque fiche est comparée avec des signaux réels (titre, médias, texte, tags ou proxies).
 */
export function scoreCompetitorListingCard(
  l: CompetitorCardListingInput,
  ctx?: CompetitorCardContext
): {
  score100: number;
  grade: string;
  verbal: string;
} {
  const { n: effTags, fromTitleFallback: tagFb } = effectiveTagCount(l.tags, l.title);
  const { len: effDescLen, usedFallback: descFb } = effectiveDescriptionLength(
    l.description,
    l.materials,
    l.tags
  );

  const t = combinedTitleScore(l.title, ctx);
  const g = scoreTagsEffective(effTags, tagFb);
  const i = scoreImages(l.images);
  const d = scoreDescriptionEffective(effDescLen, descFb);
  const p = scorePriceVsShop(l.price, ctx?.shopMedianPrice);
  const soc = scoreSocial(l);

  const weighted = t * 0.2 + g * 0.15 + i * 0.2 + d * 0.18 + p * 0.12 + soc * 0.15;

  const score100 = clampScore(weighted);
  const grade = scoreToLetterGrade(score100);
  return { score100, grade, verbal: letterGradeVerbal(grade) };
}

export type CompetitorAxisScore = { score: number; detail: string };

export function getCompetitorListingScoreBreakdown(
  l: CompetitorCardListingInput,
  ctx?: CompetitorCardContext
): {
  title: CompetitorAxisScore;
  tags: CompetitorAxisScore;
  images: CompetitorAxisScore;
  description: CompetitorAxisScore;
  price: CompetitorAxisScore;
  social: CompetitorAxisScore;
} {
  const { n: effTags, fromTitleFallback: tagFb } = effectiveTagCount(l.tags, l.title);
  const { len: effDescLen, usedFallback: descFb } = effectiveDescriptionLength(
    l.description,
    l.materials,
    l.tags
  );

  const lenScore = scoreTitleLength(l.title);
  const uniqScore = scoreTitleUniqueness(l.title, ctx?.peerTitlesInSample);
  const wordM = scoreTitleWordMetrics(l.title);
  const titleScore = combinedTitleScore(l.title, ctx);
  const len = l.title.trim().length;
  const titleDetail = `Longueur ${lenScore}/100 · différenciation vs les autres ${uniqScore}/100 · structure mots ${wordM}/100 → ${titleScore}/100 (${len} car.)`;

  const g = scoreTagsEffective(effTags, tagFb);
  const nTagsReal = l.tags?.filter(Boolean).length ?? 0;
  const tagsDetail = tagFb
    ? `Tags non scrapés : estimation ${effTags} « intentions » distinctes dans le titre (à confirmer sur Etsy).`
    : nTagsReal >= 11
      ? 'Beaucoup de tags (bon pour la couverture SEO).'
      : nTagsReal >= 1
        ? `${nTagsReal} tag(s) dans les données : vise 11–13 complémentaires.`
        : 'Aucun tag dans les données.';

  const i = scoreImages(l.images);
  const raw = l.images?.filter(Boolean) ?? [];
  const { n: nImg, uniqueRoots, pathScore } = raw.length ? imageSetRichness(raw) : { n: 0, uniqueRoots: 0, pathScore: 0 };
  const imagesDetail =
    nImg === 0
      ? 'Pas d’URL image extraite.'
      : nImg >= 8
        ? `Galerie riche : ${nImg} URL(s), ${uniqueRoots} distincte(s).`
        : `${nImg} URL(s) (${uniqueRoots} distincte(s)), richesse chemin ~${pathScore}/18 — le scraper peut en manquer.`;

  const d = scoreDescriptionEffective(effDescLen, descFb);
  const descDetail = descFb
    ? effDescLen > 0
      ? `Pas de description longue scrapée ; longueur proxy ${effDescLen} car. (matériaux + tags).`
      : 'Description absente dans les données.'
    : effDescLen >= 400
      ? `Description longue (~${effDescLen} car.).`
      : effDescLen >= 80
        ? `~${effDescLen} car. : développe bénéfices, dimensions, livraison.`
        : effDescLen > 0
          ? 'Description courte dans les données.'
          : 'Description absente ou non scrapée.';

  const p = scorePriceVsShop(l.price, ctx?.shopMedianPrice);
  let priceDetail: string;
  if (!ctx?.shopMedianPrice || ctx.shopMedianPrice <= 0 || !l.price) {
    priceDetail = 'Médiane boutique indisponible ou prix manquant — score neutre.';
  } else {
    const ratio = l.price / ctx.shopMedianPrice;
    priceDetail = `Prix ${l.price.toFixed(2)} vs médiane échantillon ${ctx.shopMedianPrice.toFixed(2)} (×${ratio.toFixed(2)}).`;
  }

  const soc = scoreSocial(l);
  let socialDetail: string;
  if (l.listingStars != null && l.listingStars > 0) {
    socialDetail = `${l.listingStars.toFixed(1)}★ sur 5`;
    if (l.listingReviews != null && l.listingReviews > 0) {
      socialDetail += ` · ${l.listingReviews} avis (données JSON).`;
    } else {
      socialDetail += ' · nombre d’avis non trouvé dans le JSON.';
    }
  } else if (l.sales != null && l.sales > 0) {
    socialDetail = `${l.sales} vente(s) sur la fiche (pas d’étoiles dans le JSON).`;
  } else {
    socialDetail = 'Pas d’étoiles / avis / ventes exploitables dans les données.';
  }

  return {
    title: { score: titleScore, detail: titleDetail },
    tags: { score: g, detail: tagsDetail },
    images: { score: i, detail: imagesDetail },
    description: { score: d, detail: descDetail },
    price: { score: p, detail: priceDetail },
    social: { score: soc, detail: socialDetail },
  };
}

/** Score boutique = moyenne des scores fiche (même pondération que l’onglet concurrent). */
export function computeShopListingQualityAggregate(listings: CompetitorCardListingInput[]): {
  score100: number;
  grade: string;
  verbal: string;
} {
  if (!listings.length) {
    return { score100: 0, grade: '—', verbal: 'Aucune fiche' };
  }
  const prices = listings.map((l) => l.price).filter((p) => p > 0);
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length === 0 ? undefined : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const titles = listings.map((l) => l.title || '');
  let sum = 0;
  for (let i = 0; i < listings.length; i++) {
    const peerTitles = titles.filter((_, j) => j !== i).slice(0, 25);
    const q = scoreCompetitorListingCard(listings[i], { shopMedianPrice: median, peerTitlesInSample: peerTitles });
    sum += q.score100;
  }
  const score100 = clampScore(Math.round(sum / listings.length));
  const grade = scoreToLetterGrade(score100);
  return { score100, grade, verbal: letterGradeVerbal(grade) };
}
