/**
 * Notes lettres A+ → D- (aligné analyseur de listing Etsmart).
 * Utilisable avec un score 0–100 ou une note Etsy 0–5 étoiles.
 */

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Convertit une moyenne Etsy 0–5 étoiles en score 0–100 pour les lettres. */
export function etsyStarsToScore100(stars: number): number {
  if (!Number.isFinite(stars) || stars <= 0) return 0;
  return clampScore((stars / 5) * 100);
}

/**
 * Note lettre pour la synthèse : A+ → D- (pas de F).
 * Tranches larges (~8 points) pour des notes plus lisibles.
 */
export function scoreToLetterGrade(score: number): string {
  const s = clampScore(score);
  if (s >= 88) return 'A+';
  if (s >= 80) return 'A';
  if (s >= 72) return 'A-';
  if (s >= 64) return 'B+';
  if (s >= 56) return 'B';
  if (s >= 48) return 'B-';
  if (s >= 40) return 'C+';
  if (s >= 32) return 'C';
  if (s >= 24) return 'C-';
  if (s >= 16) return 'D+';
  if (s >= 8) return 'D';
  return 'D-';
}

export function letterGradeVerbal(grade: string): string {
  if (grade.startsWith('A')) return 'Excellent';
  if (grade.startsWith('B')) return 'Très bon';
  if (grade.startsWith('C')) return 'Correct';
  if (grade === 'D+') return 'Insuffisant';
  if (grade === 'D') return 'Faible';
  return 'À revoir';
}

export function scoreBadgeClasses(score: number): string {
  if (score >= 80) return 'text-cyan-300 border-cyan-400/45 bg-cyan-500/15';
  if (score >= 60) return 'text-sky-300 border-sky-300/40 bg-sky-400/10';
  return 'text-rose-400 border-rose-400/40 bg-rose-400/10';
}

export function scoreBarClass(score: number): string {
  if (score >= 80) return 'bg-cyan-500';
  if (score >= 60) return 'bg-sky-400';
  return 'bg-rose-500';
}
