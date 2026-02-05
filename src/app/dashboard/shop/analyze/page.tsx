import { Suspense } from 'react';
import ShopAnalyzeClient from './ShopAnalyzeClient';

// Désactiver complètement le prerendering pour cette page
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const dynamicParams = true;

// Empêcher le prerendering en retournant un tableau vide
export function generateStaticParams() {
  return [];
}

export default function ShopAnalyzePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff] mb-4"></div>
          <p className="text-white">Chargement...</p>
        </div>
      </div>
    }>
      <ShopAnalyzeClient />
    </Suspense>
  );
}
