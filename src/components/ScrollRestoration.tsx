'use client';

import { useScrollRestoration } from '@/hooks/useScrollRestoration';

/**
 * Composant pour restaurer automatiquement la position de scroll
 * quand on revient sur l'onglet
 */
export function ScrollRestoration() {
  useScrollRestoration();
  return null; // Ce composant ne rend rien
}



