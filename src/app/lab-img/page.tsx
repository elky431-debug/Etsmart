import { Suspense } from 'react';
import LabImgClient from './LabImgClient';

/** Évite le prérendu statique qui exécute du code navigateur (Image/canvas) et casse le build Netlify. */
export const dynamic = 'force-dynamic';

export default function LabImgPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center text-sm text-zinc-400">
          Chargement du lab image…
        </div>
      }
    >
      <LabImgClient />
    </Suspense>
  );
}
