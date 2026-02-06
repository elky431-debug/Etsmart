'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import { ProductImport } from '@/components/steps/ProductImport';
import { AnalysisStep } from '@/components/steps/AnalysisStep';
import { ResultsStep } from '@/components/steps/ResultsStep';
import { useSubscriptionProtection } from '@/hooks/useSubscriptionProtection';

export default function AnalyzePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { currentStep, setStep, analyses } = useStore();
  const { isLoading: subscriptionLoading } = useSubscriptionProtection();

  // Rediriger vers login si pas connecté
  useEffect(() => {
    if (!loading && !subscriptionLoading && !user) {
      router.push('/login');
    }
  }, [user, loading, subscriptionLoading, router]);

  // ⚠️ CRITICAL: SUPPRIMÉ COMPLÈTEMENT - Ne JAMAIS réinitialiser automatiquement l'étape
  // La transition vers l'étape 4 est gérée UNIQUEMENT par AnalysisStep
  // AUCUN useEffect ne doit interférer avec les transitions d'étapes

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

