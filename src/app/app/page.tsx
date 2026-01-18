'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Stepper } from '@/components/layout/Stepper';
import { Footer } from '@/components/layout/Footer';
import { NicheSelection } from '@/components/steps/NicheSelection';
import { ProductImport } from '@/components/steps/ProductImport';
import { AnalysisStep } from '@/components/steps/AnalysisStep';
import { ResultsStep } from '@/components/steps/ResultsStep';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/contexts/AuthContext';

export default function AppPage() {
  const { currentStep } = useStore();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff]"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  if (currentStep === 4) {
    return <ResultsStep />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Stepper en haut - très fin */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-100">
        <Stepper />
      </div>
      
      <Header />
      
      <main className="flex-1 pt-36 pb-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            {currentStep === 1 && <NicheSelection key="niche" />}
            {currentStep === 2 && <ProductImport key="products" />}
            {currentStep === 3 && <AnalysisStep key="analysis" />}
          </AnimatePresence>
        </div>
      </main>

      <Footer />
    </div>
  );
}
