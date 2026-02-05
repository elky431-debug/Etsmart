'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionProtection } from '@/hooks/useSubscriptionProtection';

export default function AppPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // 🔒 Protect this page - redirects blocked (no pricing page)
  const { isLoading: subscriptionLoading } = useSubscriptionProtection();

  // ⚠️ CRITICAL: Rediriger automatiquement vers la page d'analyse pour démarrer le processus
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Attendre que le chargement soit terminé avant de rediriger
    if (loading || subscriptionLoading) return;
    
    // Si l'utilisateur est connecté, rediriger vers la page d'analyse pour démarrer le processus
    if (user) {
      console.log('[AppPage] Redirecting to analyze page to start analysis process');
      router.push('/analyze');
      return;
    }
    
    // Si pas d'utilisateur, rediriger vers login
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, subscriptionLoading, router]);

  // ⚠️ CRITICAL: Afficher un loader pendant la redirection
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center px-4">
        <div className="inline-block animate-spin rounded-full h-8 w-8 sm:h-12 sm:h-12 border-b-2 border-[#00d4ff]"></div>
        <p className="mt-4 text-sm sm:text-base text-slate-600">
          {loading || subscriptionLoading 
            ? 'Chargement...' 
            : user 
              ? 'Redirection vers Analyse et Simulation...' 
              : 'Redirection vers la connexion...'}
        </p>
      </div>
    </div>
  );
}
