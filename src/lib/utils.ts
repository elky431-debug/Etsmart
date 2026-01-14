import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

export function formatPercentage(num: number): string {
  return `${Math.round(num)}%`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getVerdictColor(verdict: 'launch' | 'test' | 'avoid'): string {
  switch (verdict) {
    case 'launch':
      return 'text-[#00c9b7]';
    case 'test':
      return 'text-amber-400';
    case 'avoid':
      return 'text-rose-400';
  }
}

export function getVerdictBg(verdict: 'launch' | 'test' | 'avoid'): string {
  switch (verdict) {
    case 'launch':
      return 'bg-[#00d4ff]/10 border-[#00d4ff]/30';
    case 'test':
      return 'bg-amber-500/10 border-amber-500/30';
    case 'avoid':
      return 'bg-rose-500/10 border-rose-500/30';
  }
}

// Removed emoji function - use icons instead
export function getVerdictIcon(verdict: 'launch' | 'test' | 'avoid'): 'check' | 'alert' | 'x' {
  switch (verdict) {
    case 'launch':
      return 'check';
    case 'test':
      return 'alert';
    case 'avoid':
      return 'x';
  }
}

export function getVerdictLabel(verdict: 'launch' | 'test' | 'avoid', competitors?: number): string {
  // Si on a le nombre de concurrents, utiliser les nouveaux labels
  if (competitors !== undefined) {
    if (competitors <= 80) {
      return 'LANCER RAPIDEMENT';
    } else if (competitors <= 130) {
      return 'LANCER MAIS OPTIMISER';
    } else {
      return 'NE PAS LANCER';
    }
  }
  
  // Fallback sur les anciens labels si pas de nombre de concurrents
  switch (verdict) {
    case 'launch':
      return 'LANCER RAPIDEMENT';
    case 'test':
      return 'LANCER MAIS OPTIMISER';
    case 'avoid':
      return 'NE PAS LANCER';
  }
}

export function getPhaseLabel(phase: 'launch' | 'growth' | 'saturation' | 'decline'): string {
  switch (phase) {
    case 'launch':
      return 'Lancement';
    case 'growth':
      return 'Croissance';
    case 'saturation':
      return 'Saturation';
    case 'decline':
      return 'Déclin';
  }
}

export function getPhaseColor(phase: 'launch' | 'growth' | 'saturation' | 'decline'): string {
  switch (phase) {
    case 'launch':
      return 'text-cyan-400';
    case 'growth':
      return 'text-[#00c9b7]';
    case 'saturation':
      return 'text-amber-400';
    case 'decline':
      return 'text-rose-400';
  }
}

export function getMarketStructureLabel(structure: 'dominated' | 'fragmented' | 'open'): string {
  switch (structure) {
    case 'dominated':
      return 'Dominé';
    case 'fragmented':
      return 'Fragmenté';
    case 'open':
      return 'Ouvert';
  }
}

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
