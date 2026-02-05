'use client';

import type { ProductAnalysis } from '@/types';
import { ImageGenerator } from '@/components/steps/ImageGenerator';
import { useSubscription } from '@/hooks/useSubscription';
import { Zap } from 'lucide-react';

interface DashboardImageProps {
  analysis: ProductAnalysis;
}

export function DashboardImage({ analysis }: DashboardImageProps) {
  // Vérifier que analysis est valide avec toutes les propriétés nécessaires
  if (!analysis || !analysis.product || !analysis.verdict) {
    console.error('[DashboardImage] Invalid analysis prop:', analysis);
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/50">
        <p className="text-red-400">Erreur: Analyse invalide. Veuillez réessayer.</p>
      </div>
    );
  }

  const { subscription } = useSubscription();

  return (
    <div className="space-y-6">
      {/* CREDITS DISPLAY */}
      {subscription && (
        <div className="p-5 rounded-xl bg-black border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              typeof window !== 'undefined' && (
                window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1'
              )
                ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
                : 'bg-cyan-500'
            }`}>
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm text-white/60">Crédits disponibles</p>
              <p className="text-2xl font-bold text-white">
                {subscription.remaining % 1 === 0 ? subscription.remaining : subscription.remaining.toFixed(1)}
                <span className="text-base font-normal text-white/60 ml-1">
                  / {subscription.quota}
                </span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/60">Utilisés</p>
            <p className="text-lg font-semibold text-white">
              {subscription.used % 1 === 0 ? subscription.used : subscription.used.toFixed(1)}
            </p>
          </div>
        </div>
      )}

      {/* IMAGE GENERATOR */}
      <div className="space-y-6">
        <ImageGenerator 
          analysis={analysis} 
          hasListing={false}
          // ⚠️ CRITICAL: Image generation is completely independent from listing
          // - Images can be generated without a listing → 0.5 crédit
          // - Listing can be generated separately in the "Listing" section → 0.5 crédit
          // - Each generation costs 0.5 credit independently
        />
      </div>
    </div>
  );
}

