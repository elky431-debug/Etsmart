'use client';

import { useState, useEffect } from 'react';

/**
 * Hook SSR-safe pour détecter si on est sur mobile
 * Évite les erreurs d'hydration en initialisant à false côté serveur
 */
export function useIsMobile(): boolean {
  // Initialiser avec une valeur sûre pour éviter les erreurs SSR
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768; // Breakpoint cohérent avec page.tsx
  });

  useEffect(() => {
    // Vérifier uniquement côté client
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768); // Breakpoint cohérent avec page.tsx
    };
    
    checkMobile();
    const handleResize = () => checkMobile();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

/**
 * Hook pour détecter si on est sur tablette
 */
export function useIsTablet(): boolean {
  // Initialiser avec une valeur sûre pour éviter les erreurs SSR
  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === 'undefined') return false;
    const width = window.innerWidth;
    return width >= 640 && width < 1024;
  });

  useEffect(() => {
    // Vérifier uniquement côté client
    if (typeof window === 'undefined') return;
    
    const checkTablet = () => {
      const width = window.innerWidth;
      setIsTablet(width >= 640 && width < 1024);
    };
    
    checkTablet();
    const handleResize = () => checkTablet();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isTablet;
}




