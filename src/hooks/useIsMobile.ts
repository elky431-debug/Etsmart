'use client';

import { useState, useEffect } from 'react';

/**
 * Hook SSR-safe pour détecter si on est sur mobile
 * Évite les erreurs d'hydration en initialisant à false côté serveur
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Vérifier uniquement côté client
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 640); // Breakpoint mobile selon cahier des charges
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
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
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



