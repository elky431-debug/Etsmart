'use client';

import { useState, useEffect } from 'react';
import type { ProductAnalysis, Niche } from '@/types';
import { ImageGenerator } from '@/components/steps/ImageGenerator';
import { useSubscription } from '@/hooks/useSubscription';
import { useStore } from '@/store/useStore';
import { niches } from '@/lib/niches';
import { Zap, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

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
  const { selectedNiche, setNiche, customNiche, setCustomNiche } = useStore();
  const [showNicheSelection, setShowNicheSelection] = useState(false);
  
  // Initialiser la niche depuis l'analyse si disponible
  useEffect(() => {
    if (analysis.niche && !selectedNiche) {
      setNiche(analysis.niche as Niche);
    }
  }, [analysis.niche, selectedNiche, setNiche]);
  
  const currentNiche = selectedNiche ? niches.find(n => n.id === selectedNiche) : null;

  return (
    <div className="space-y-6">
      {/* NICHE SELECTION */}
      <div className="p-5 rounded-xl bg-black border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              typeof window !== 'undefined' && (
                window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1'
              )
                ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
                : 'bg-cyan-500'
            }`}>
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Niche du produit</h2>
              <p className="text-sm text-white/60">Sélectionnez la niche pour optimiser l'image</p>
            </div>
          </div>
          {currentNiche && (
            <div className="px-4 py-2 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/30">
              <span className="text-sm font-medium text-[#00d4ff]">{currentNiche.name}</span>
            </div>
          )}
        </div>
        
        {!showNicheSelection && !selectedNiche ? (
          <button
            onClick={() => setShowNicheSelection(true)}
            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-medium hover:opacity-90 transition-all"
          >
            Sélectionner une niche
          </button>
        ) : showNicheSelection ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {niches.map((niche) => {
                const IconComponent = niche.icon === 'sparkles' ? Sparkles : Sparkles;
                const isSelected = selectedNiche === niche.id;
                return (
                  <motion.button
                    key={niche.id}
                    onClick={() => {
                      setNiche(niche.id);
                      setCustomNiche('');
                      setShowNicheSelection(false);
                    }}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] border-[#00d4ff] text-white'
                        : 'bg-black border-white/10 hover:border-[#00d4ff]/50 text-white'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <IconComponent size={24} className="mb-2" />
                    <p className="text-sm font-medium">{niche.name}</p>
                  </motion.button>
                );
              })}
            </div>
            <div className="pt-4 border-t border-white/10">
              <label className="block text-sm font-medium text-white mb-2">Ou entrez une niche personnalisée</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customNiche}
                  onChange={(e) => setCustomNiche(e.target.value)}
                  placeholder="Ex: bijoux personnalisés"
                  className="flex-1 px-4 py-2 rounded-lg bg-black border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-[#00d4ff]"
                />
                <button
                  onClick={() => {
                    if (customNiche.trim()) {
                      setNiche('custom');
                      setShowNicheSelection(false);
                    }
                  }}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-medium hover:opacity-90 transition-all"
                >
                  Valider
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowNicheSelection(false)}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNicheSelection(true)}
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all"
          >
            Changer de niche
          </button>
        )}
      </div>
      
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
          // - Images can be generated without a listing → 1 crédit
          // - Listing can be generated separately in the "Listing" section → 1 crédit
          // - Each generation costs 1 credit independently
        />
      </div>
    </div>
  );
}

