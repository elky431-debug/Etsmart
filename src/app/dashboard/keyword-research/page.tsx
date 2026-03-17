import { Suspense } from 'react';
import KeywordResearchClient from './KeywordResearchClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function KeywordResearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-white/70">Chargement Keyword Research...</div>
        </div>
      }
    >
      <KeywordResearchClient />
    </Suspense>
  );
}
