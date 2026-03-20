/**
 * Paramètres de polling Nanobanana (tâches async) — alignés génération rapide + onglet Image.
 */
export function getImagePollDeadlineMs(quantity: number): number {
  if (quantity >= 7) return 120_000;
  if (quantity >= 5) return 85_000;
  return 65_000;
}

export function getImagePollIntervalMs(quantity: number): number {
  return quantity >= 6 ? 850 : 1000;
}

/** Nombre de tentatives = deadline / interval (+ marge). */
export function getImagePollMaxAttempts(quantity: number): number {
  const interval = getImagePollIntervalMs(quantity);
  const deadline = getImagePollDeadlineMs(quantity);
  return Math.max(24, Math.ceil(deadline / interval) + 4);
}
