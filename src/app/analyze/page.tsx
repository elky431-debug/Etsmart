'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import { ProductImport } from '@/components/steps/ProductImport';
import { AnalysisStep } from '@/components/steps/AnalysisStep';
import { ResultsStep } from '@/components/steps/ResultsStep';
import { useSubscription } from '@/hooks/useSubscription';

export default function AnalyzePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { currentStep, setStep, analyses } = useStore();
  const { hasActiveSubscription, loading: subscriptionLoading } = useSubscription();
  const [hasCheckedSubscription, setHasCheckedSubscription] = useState(false);

  // Rediriger vers login si pas connecté
  useEffect(() => {
    if (!loading && !subscriptionLoading && !user) {
      router.push('/login');
    }
  }, [user, loading, subscriptionLoading, router]);

  // Vérifier l'abonnement et rediriger si nécessaire
  useEffect(() => {
    // Attendre que les chargements soient terminés
    if (loading || subscriptionLoading || !user) {
      return;
    }

    // Si on a déjà vérifié, ne pas re-vérifier
    if (hasCheckedSubscription) {
      return;
    }

    // Marquer comme vérifié
    setHasCheckedSubscription(true);

    // Si pas d'abonnement actif, rediriger vers le dashboard (qui affiche le paywall)
    if (!hasActiveSubscription) {
      console.log('[AnalyzePage] Pas d\'abonnement actif, redirection vers le dashboard (paywall)');
      router.push('/dashboard');
    } else {
      console.log('[AnalyzePage] Abonnement actif détecté, accès autorisé');
    }
  }, [user, loading, subscriptionLoading, hasActiveSubscription, hasCheckedSubscription, router]);

  // ⚠️ CRITICAL: Au montage, si on est à l'étape 1 ou 2 (nouvelle analyse),
  // s'assurer que les anciens produits et analyses sont bien nettoyés
  useEffect(() => {
    if (currentStep <= 2 && analyses.length === 0) {
      const state = useStore.getState();
      if (state.products.length > 0) {
        console.log('[AnalyzePage] ⚠️ Stale products detected at step', currentStep, '- clearing...');
        useStore.getState().reset();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Afficher un loader pendant le chargement
  if (loading || subscriptionLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center px-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 sm:h-12 sm:h-12 border-b-2 border-[#00d4ff]"></div>
          <p className="mt-4 text-sm sm:text-base text-slate-600">
            {loading || subscriptionLoading 
              ? 'Chargement...' 
              : 'Redirection vers la connexion...'}
          </p>
        </div>
      </div>
    );
  }

  // Si pas d'abonnement actif ET que la vérification est terminée, rediriger
  if (hasCheckedSubscription && !hasActiveSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center px-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 sm:h-12 sm:h-12 border-b-2 border-[#00d4ff]"></div>
          <p className="mt-4 text-sm sm:text-base text-slate-600">
            Redirection vers l'abonnement...
          </p>
        </div>
      </div>
    );
  }

  // ⚠️ PROTECTION ABSOLUE: Si on a des analyses, FORCER l'affichage de l'étape 4 (résultats)
  // Ne JAMAIS permettre d'afficher une autre étape si on a des analyses
  // Cette protection est CRITIQUE et ne peut JAMAIS être contournée
  const forcedStep = analyses.length > 0 ? 4 : currentStep;
  
  // Log pour débogage
  if (analyses.length > 0 && currentStep !== 4) {
    console.warn('[AnalyzePage] ⚠️ FORCAGE: Analyses présentes mais étape incorrecte, forçage vers étape 4');
  }

  // Afficher le step approprié
  // ⚠️ MODIFIÉ: L'étape 1 (choix de la niche) a été supprimée
  // Le processus commence directement à l'étape 2 (import du produit)
  return (
    <div className="min-h-screen bg-black">
      {forcedStep === 1 && <ProductImport />}
      {forcedStep === 2 && <ProductImport />}
      {forcedStep === 3 && <AnalysisStep />}
      {forcedStep === 4 && <ResultsStep />}
    </div>
  );
}

