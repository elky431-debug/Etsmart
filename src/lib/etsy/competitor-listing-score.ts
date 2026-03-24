import { clampScore, letterGradeVerbal, scoreToLetterGrade } from '@/lib/etsy/listing-letter-grade';

export type CompetitorCardListingInput = {
  title: string;
  price: number;
  images?: string[];
  tags?: string[];
  description?: string;
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

function scoreTitleLength(title: string): number {
  const t = title.trim();
  if (!t) return 0;
  const len = t.length;
  if (len >= 70 && len <= 140) return 92;
  if (len >= 40 && len < 70) return 78;
  if (len > 140) return 68;
  return 52;
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
  return clampScore(Math.round(lenScore * 0.52 + uniq * 0.48));
}

function scoreTags(tags: string[] | undefined): number {
  const n = tags?.length ?? 0;
  if (n >= 11) return 95;
  if (n >= 7) return 82;
  if (n >= 3) return 68;
  if (n >= 1) return 58;
  return 72;
}

function scoreImages(images: string[] | undefined): number {
  const n = images?.filter(Boolean).length ?? 0;
  if (n >= 8) return 100;
  if (n >= 4) return 82;
  if (n >= 2) return 65;
  if (n === 1) return 48;
  return 28;
}

function scoreDescription(desc: string | undefined): number {
  const len = (desc || '').trim().length;
  if (len >= 400) return 95;
  if (len >= 150) return 78;
  if (len >= 50) return 58;
  if (len > 0) return 42;
  return 22;
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
 * Score 0–100 + note lettre : chaque fiche diffère (prix vs médiane, similarité des titres, images réelles du JSON, social Etsy).
 */
export function scoreCompetitorListingCard(
  l: CompetitorCardListingInput,
  ctx?: CompetitorCardContext
): {
  score100: number;
  grade: string;
  verbal: string;
} {
  const t = combinedTitleScore(l.title, ctx);
  const g = scoreTags(l.tags);
  const i = scoreImages(l.images);
  const d = scoreDescription(l.description);
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
  const lenScore = scoreTitleLength(l.title);
  const uniqScore = scoreTitleUniqueness(l.title, ctx?.peerTitlesInSample);
  const titleScore = combinedTitleScore(l.title, ctx);
  const len = l.title.trim().length;
  const titleDetail = `Longueur ${lenScore}/100 + différenciation vs les autres fiches ${uniqScore}/100 (moyenne pondérée ${titleScore}/100). ${len} car. dans le titre.`;

  const g = scoreTags(l.tags);
  const nTags = l.tags?.length ?? 0;
  const tagsDetail =
    nTags >= 11
      ? 'Beaucoup de tags (bon pour la couverture SEO).'
      : nTags >= 1
        ? `${nTags} tag(s) : vise 11–13 tags complémentaires.`
        : 'Aucun tag dans les données : complète avec des intentions de recherche.';

  const i = scoreImages(l.images);
  const nImg = l.images?.filter(Boolean).length ?? 0;
  const imagesDetail =
    nImg >= 8
      ? `Galerie riche : ${nImg} image(s) détectée(s) dans le JSON.`
      : nImg >= 2
        ? `${nImg} image(s) dans le JSON : Etsy performe souvent avec 8–10 photos.`
        : nImg === 1
          ? 'Une seule URL image dans les données : le scraper peut en cacher d’autres.'
          : 'Pas d’URL image extraite du JSON.';

  const d = scoreDescription(l.description);
  const dlen = (l.description || '').trim().length;
  const descDetail =
    dlen >= 400
      ? `Description longue (~${dlen} car.).`
      : dlen >= 80
        ? `~${dlen} car. : développe bénéfices, dimensions, livraison.`
        : dlen > 0
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
