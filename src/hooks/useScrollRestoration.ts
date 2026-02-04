'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook pour sauvegarder et restaurer la position de scroll
 * quand on change d'onglet et qu'on revient
 */
export function useScrollRestoration() {
  const scrollPositionRef = useRef<number>(0);
  const isRestoringRef = useRef<boolean>(false);

  useEffect(() => {
    // Sauvegarder la position de scroll quand l'onglet devient caché
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Sauvegarder la position actuelle
        scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
        console.log('[SCROLL RESTORE] Saved scroll position:', scrollPositionRef.current);
      } else {
        // Restaurer la position quand l'onglet redevient visible
        isRestoringRef.current = true;
        
        // Utiliser plusieurs requestAnimationFrame pour s'assurer que le DOM est complètement prêt
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const savedPosition = scrollPositionRef.current;
              if (savedPosition > 0) {
                // Essayer plusieurs méthodes pour s'assurer que ça fonctionne
                window.scrollTo({
                  top: savedPosition,
                  behavior: 'instant' // Pas d'animation pour que ce soit instantané
                });
                
                // Fallback pour les navigateurs qui ne supportent pas behavior: 'instant'
                if (window.scrollY !== savedPosition) {
                  document.documentElement.scrollTop = savedPosition;
                  document.body.scrollTop = savedPosition;
                }
                
                console.log('[SCROLL RESTORE] Restored scroll position:', savedPosition);
              }
              // Réinitialiser le flag après un court délai
              setTimeout(() => {
                isRestoringRef.current = false;
              }, 200);
            });
          });
        });
      }
    };

    // Sauvegarder aussi quand on quitte la page (au cas où)
    const handleBeforeUnload = () => {
      scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
      sessionStorage.setItem('etsmart-scroll-position', scrollPositionRef.current.toString());
    };

    // Restaurer depuis sessionStorage au chargement (si disponible)
    const savedPosition = sessionStorage.getItem('etsmart-scroll-position');
    if (savedPosition) {
      const position = parseInt(savedPosition, 10);
      if (position > 0) {
        scrollPositionRef.current = position;
        // Restaurer après un court délai pour laisser le DOM se charger
        setTimeout(() => {
          window.scrollTo({
            top: position,
            behavior: 'instant'
          });
          sessionStorage.removeItem('etsmart-scroll-position');
        }, 100);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Sauvegarder la position de scroll périodiquement (toutes les 500ms pour plus de précision)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden && !isRestoringRef.current) {
        const currentScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
        if (currentScroll > 0) {
          scrollPositionRef.current = currentScroll;
        }
      }
    }, 500);

    // Sauvegarder aussi au scroll pour une meilleure précision
    const handleScroll = () => {
      if (!document.hidden && !isRestoringRef.current) {
        const currentScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
        scrollPositionRef.current = currentScroll;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
}

