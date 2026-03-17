import { DifficultyLevel, KeywordVerdict, SaturationLevel } from './types';

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'N/A';
  return `$${value.toFixed(2)}`;
}

export function saturationBadgeClass(level: SaturationLevel): string {
  if (level === 'High') return 'bg-red-500/20 text-red-300 border-red-400/40';
  if (level === 'Medium') return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
  return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
}

export function difficultyBadgeClass(level: DifficultyLevel): string {
  if (level === 'Hard') return 'bg-red-500/20 text-red-300 border-red-400/40';
  if (level === 'Medium') return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
  return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
}

export function verdictBadgeClass(verdict: KeywordVerdict): string {
  if (verdict === 'Avoid') return 'bg-red-500/20 text-red-300 border-red-400/40';
  if (verdict === 'Test') return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
  return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
}
