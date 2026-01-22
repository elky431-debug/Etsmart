'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Stepper } from '@/components/layout/Stepper';
import { Footer } from '@/components/layout/Footer';
import dynamic from 'next/dynamic';

// Lazy loading des composants lourds pour améliorer le chargement initial
// Skeletons simples et légers pour mobile
const NicheSelection = dynamic(() => import('@/components/steps/NicheSelection').then(mod => ({ default: mod.NicheSelection })), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-[#00d4ff]"></div>
        <p className="mt-4 text-sm text-slate-600">Loading...</p>
      </div>
    </div>
  ),
  ssr: false,
});

const ProductImport = dynamic(() => import('@/components/steps/ProductImport').then(mod => ({ default: mod.ProductImport })), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-[#00d4ff]"></div>
        <p className="mt-4 text-sm text-slate-600">Loading...</p>
      </div>
    </div>
  ),
  ssr: false,
});

const AnalysisStep = dynamic(() => import('@/components/steps/AnalysisStep').then(mod => ({ default: mod.AnalysisStep })), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-[#00d4ff]"></div>
        <p className="mt-4 text-sm text-slate-600">Loading...</p>
      </div>
    </div>
  ),
  ssr: false,
});

const ResultsStep = dynamic(() => import('@/components/steps/ResultsStep').then(mod => ({ default: mod.ResultsStep })), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-[#00d4ff]"></div>
        <p className="mt-4 text-sm text-slate-600">Loading...</p>
      </div>
    </div>
  ),
  ssr: false,
});
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
        <div className="text-center px-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-[#00d4ff]"></div>
          <p className="mt-4 text-sm sm:text-base text-slate-600">Loading...</p>
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
      
      <main className="flex-1 pt-24 sm:pt-32 md:pt-36 pb-8 sm:pb-12 relative z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
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
