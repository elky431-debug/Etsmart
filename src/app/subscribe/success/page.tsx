import { Suspense } from 'react';
import SuccessContent from './SuccessContent';
import { Loader2 } from 'lucide-react';

// Désactiver complètement le prerendering pour cette page
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const dynamicParams = true;

// Empêcher le prerendering en retournant un tableau vide
export function generateStaticParams() {
  return [];
}

export default function SubscribeSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-12 w-12 text-cyan-400 animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
