'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import { NicheSelection } from '@/components/steps/NicheSelection';
import { ProductImport } from '@/components/steps/ProductImport';
import { AnalysisStep } from '@/components/steps/AnalysisStep';
import { ResultsStep } from '@/components/steps/ResultsStep';
import { useSubscriptionProtection } from '@/hooks/useSubscriptionProtection';

export default function AnalyzePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { currentStep, setStep } = useStore();
  const { isLoading: subscriptionLoading } = useSubscriptionProtection();

  // Rediriger vers login si pas connecté
  useEffect(() => {
    if (!loading && !subscriptionLoading && !user) {
      router.push('/login');
    }
  }, [user, loading, subscriptionLoading, router]);

  // Initialiser le step à 1 (sélection de niche) si on démarre une nouvelle analyse
  useEffect(() => {
    if (user && !loading && !subscriptionLoading) {
      // Si on est à l'étape 0 ou si on vient de la page d'accueil, démarrer à l'étape 1
      if (currentStep === 0 || currentStep > 4) {
        setStep(1);
      }
    }
  }, [user, loading, subscriptionLoading, currentStep, setStep]);

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

  // Afficher le step approprié
  return (
    <div className="min-h-screen bg-black">
      {currentStep === 1 && <NicheSelection />}
      {currentStep === 2 && <ProductImport />}
      {currentStep === 3 && <AnalysisStep />}
      {currentStep === 4 && <ResultsStep />}
    </div>
  );
}

