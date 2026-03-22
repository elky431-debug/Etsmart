'use client';

import { Globe, Sparkles } from 'lucide-react';

/**
 * Teaser Carte des Opportunités — affiché depuis l’onglet Analyse du dashboard.
 */
export function OpportunityMapComingSoon() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-8 bg-black">
      <div className="max-w-lg w-full text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] shadow-xl shadow-[#00d4ff]/25">
          <Globe className="h-10 w-10 text-white" aria-hidden />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Carte des Opportunités</h1>
        <p className="text-white/70 text-sm sm:text-base leading-relaxed mb-6">
          Visualise où ton produit a le plus de potentiel sur les marchés mondiaux — carte interactive,
          scores par pays et insights pour cibler tes campagnes.
        </p>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#00BFA5]/40 bg-[#00BFA5]/10 px-4 py-2 text-sm font-medium text-[#00BFA5]">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          <span>Arrive très bientôt sur Etsmart</span>
        </div>
        <p className="mt-8 text-xs text-white/40">
          On finalise l’expérience pour qu’elle soit fiable et utile au quotidien. Reste connecté !
        </p>
      </div>
    </div>
  );
}
