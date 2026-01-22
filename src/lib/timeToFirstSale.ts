/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MODULE D'ESTIMATION DU DÉLAI AVANT LA PREMIÈRE VENTE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Ce module calcule le délai estimé avant la première vente sur Etsy
 * basé UNIQUEMENT sur la note de lancement du produit (Launch Potential Score 0-10).
 * 
 * Cahier des charges:
 * - Note 0-3: > 20 days
 * - Note 4-7: 3 to 10 weeks (21 to 70 days)
 * - Note 8-10: 1 to 5 days
 */

export interface TimeToFirstSaleEstimate {
  min: number; // in days
  max: number; // in days
  expected: number; // in days (valeur attendue)
  range: string; // Format d'affichage (ex: "3-5 days", "More than 20 days")
  explanation: string; // Texte explicatif
}

/**
 * Calcule le délai estimé avant la première vente basé sur la note (0-10)
 * 
 * @param score - Launch Potential Score (0-10, peut être décimal)
 * @returns Estimation du délai avec min, max, expected et format d'affichage
 */
export function estimateTimeToFirstSaleFromScore(score: number): TimeToFirstSaleEstimate {
  // Clamp le score entre 0 et 10
  const clampedScore = Math.max(0, Math.min(10, score));
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // TRANche 0-3: Marché saturé - 20 jours
  // ═══════════════════════════════════════════════════════════════════════════════
  if (clampedScore <= 3) {
    return {
      min: 18, // Plage autour de 20 jours
      max: 25,
      expected: 20, // Exactement 20 jours comme demandé
      range: '20 days',
      explanation: 'This estimate is based on the product\'s launch potential score and reflects typical Etsy market behavior without paid advertising. Market conditions indicate high saturation.',
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // TRANche 4-7: Marché concurrentiel - 10 jours
  // ═══════════════════════════════════════════════════════════════════════════════
  if (clampedScore <= 7) {
    // Délai fixe de 10 jours pour toute la tranche 4-7
    return {
      min: 8, // Plage autour de 10 jours
      max: 12,
      expected: 10, // Exactement 10 jours comme demandé
      range: '10 days',
      explanation: 'This estimate is based on the product\'s launch potential score and reflects typical Etsy market behavior without paid advertising. Competitive market conditions require strategic positioning.',
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // TRANche 8-10: Marché favorable - 5 jours ou moins
  // ═══════════════════════════════════════════════════════════════════════════════
  // Mapping détaillé:
  // Note 8.0 → 5 days
  // Note 8.5 → 4 days
  // Note 9.0 → 3 days
  // Note 9.5 → 2 days
  // Note 10.0 → 1 day
  
  // Interpolation linéaire entre 8 et 10
  const daysAt8 = 5;
  const daysAt10 = 1;
  const expectedDays = Math.max(1, Math.min(5, Math.round(
    daysAt8 - ((clampedScore - 8) / (10 - 8)) * (daysAt8 - daysAt10)
  )));
  
  // Plage étroite pour le marché favorable
  const minDays = Math.max(1, expectedDays - 1);
  const maxDays = Math.min(5, expectedDays + 1);
  
  return {
    min: minDays,
    max: maxDays,
    expected: expectedDays,
    range: minDays === maxDays 
      ? `${minDays} ${minDays === 1 ? 'day' : 'days'}`
      : `${minDays}-${maxDays} days`,
    explanation: 'This estimate is based on the product\'s launch potential score and reflects typical Etsy market behavior without paid advertising. Favorable market conditions suggest quick visibility.',
  };
}

/**
 * Calcule le délai avec Etsy Ads activées
 * Les Ads réduisent généralement le délai de 30-50%
 * 
 * @param withoutAds - Estimation sans publicité
 * @returns Estimation avec Etsy Ads
 */
export function estimateTimeToFirstSaleWithAds(
  withoutAds: TimeToFirstSaleEstimate
): TimeToFirstSaleEstimate {
  // Réduction de 40% en moyenne avec les Ads
  const reductionFactor = 0.6; // 60% du temps original = 40% de réduction
  
  const expectedWithAds = Math.max(1, Math.round(withoutAds.expected * reductionFactor));
  const minWithAds = Math.max(1, Math.round(withoutAds.min * reductionFactor));
  const maxWithAds = Math.max(1, Math.round(withoutAds.max * reductionFactor));
  
  return {
    min: minWithAds,
    max: maxWithAds,
    expected: expectedWithAds,
    range: minWithAds === maxWithAds 
      ? `${minWithAds} ${minWithAds === 1 ? 'day' : 'days'}`
      : `${minWithAds}-${maxWithAds} days`,
    explanation: 'This estimate includes the impact of Etsy Ads, which typically accelerate first sale by increasing product visibility. Actual results may vary based on ad budget and optimization.',
  };
}

