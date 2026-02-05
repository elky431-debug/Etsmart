import { Suspense } from 'react';
import AuthCallbackClient from './AuthCallbackClient';

// Désactiver le prerendering pour cette page (nécessite des headers dynamiques)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff] mb-4"></div>
          <p className="text-white">Chargement...</p>
        </div>
      </div>
    }>
      <AuthCallbackClient />
    </Suspense>
  );
}
