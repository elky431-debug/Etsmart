/**
 * Crédits : génération rapide (listing + images) et onglet Image.
 * Ajustés pour mieux couvrir le coût API (Gemini / génération) tout en restant raisonnables pour l’utilisateur.
 */
export const QUICK_GENERATE_LISTING_CREDITS = 1.25;

/** Par image générée (Gemini image — flash vs pro) */
export function perImageCredits(engine: 'flash' | 'pro'): number {
  return engine === 'pro' ? 0.5 : 0.25;
}

export const roundCreditsToTenth = (n: number) => Math.round(n * 10) / 10;

export function quickGenerateTotalCredits(quantity: number, engine: 'flash' | 'pro'): number {
  return roundCreditsToTenth(QUICK_GENERATE_LISTING_CREDITS + quantity * perImageCredits(engine));
}

export function imagesOnlyTotalCredits(quantity: number, engine: 'flash' | 'pro'): number {
  return roundCreditsToTenth(quantity * perImageCredits(engine));
}
