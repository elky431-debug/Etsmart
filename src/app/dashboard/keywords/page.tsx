import { Suspense } from 'react';
import KeywordsAnalyzeClient from './KeywordsAnalyzeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DashboardKeywordsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white/60">
          Chargement…
        </div>
      }
    >
      <div className="min-h-screen bg-black">
        <KeywordsAnalyzeClient />
      </div>
    </Suspense>
  );
}
