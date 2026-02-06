'use client';

import { useState, useEffect } from 'react';
import { 
  PenTool, 
  FileText, 
  Hash, 
  Copy, 
  Check,
  Zap,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ProductAnalysis, Niche } from '@/types';
import { useSubscription } from '@/hooks/useSubscription';
import { useStore } from '@/store/useStore';
import { niches } from '@/lib/niches';
import { motion } from 'framer-motion';

interface DashboardListingProps {
  analysis: ProductAnalysis;
}

export function DashboardListing({ analysis }: DashboardListingProps) {
  // Vérifier que analysis est valide avec toutes les propriétés nécessaires
  if (!analysis || !analysis.product || !analysis.verdict) {
    console.error('[DashboardListing] Invalid analysis prop:', analysis);
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/50">
        <p className="text-red-400">Erreur: Analyse invalide. Veuillez réessayer.</p>
      </div>
    );
  }

  const { subscription, refreshSubscription } = useSubscription();
  const { selectedNiche, setNiche, customNiche, setCustomNiche } = useStore();
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);
  const [etsyDescription, setEtsyDescription] = useState<string | null>(null);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [copiedDescription, setCopiedDescription] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render when credits update
  const [showNicheSelection, setShowNicheSelection] = useState(false);
  
  // Initialiser la niche depuis l'analyse si disponible
  useEffect(() => {
    if (analysis.niche && !selectedNiche) {
      setNiche(analysis.niche as Niche);
    }
  }, [analysis.niche, selectedNiche, setNiche]);
  
  const currentNiche = selectedNiche ? niches.find(n => n.id === selectedNiche) : null;

  const copyToClipboard = async (text: string, type: 'title' | 'tags' | 'description') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'title') {
        setCopiedTitle(true);
        setTimeout(() => setCopiedTitle(false), 2000);
      } else if (type === 'tags') {
        setCopiedTags(true);
        setTimeout(() => setCopiedTags(false), 2000);
      } else {
        setCopiedDescription(true);
        setTimeout(() => setCopiedDescription(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const generateEtsyDescription = async (forceRegenerate = false) => {
    // Si une description existe déjà et qu'on ne force pas la régénération, ne rien faire
    if (etsyDescription && !forceRegenerate) return;
    
    setIsGeneratingDescription(true);
    try {
      // Get auth token for API call
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const response = await fetch('/api/generate-etsy-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          productVisualDescription: analysis.verdict?.productVisualDescription || analysis.product?.title || '',
          niche: selectedNiche === 'custom' ? customNiche : (selectedNiche || analysis.niche || ''),
          positioning: analysis.marketing?.strategic?.positioning?.mainPositioning,
          psychologicalTriggers: analysis.marketing?.strategic?.psychologicalTriggers,
          buyerMirror: undefined, // buyerMirror not available in current structure
          recommendedPrice: analysis.pricing?.recommendedPrice?.optimal || 0,
          skipCreditDeduction: true, // ⚠️ CRITICAL: true = les crédits sont déjà déduits lors du parsing de l'image (0.5 crédit)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate description');
      }

      const data = await response.json();
      // Mettre à jour la description (remplace l'ancienne si elle existe)
      setEtsyDescription(data.description);
      
      // ⚠️ CRITICAL: Refresh subscription to update credit count
      // Wait for database to sync, then refresh multiple times to ensure the update is picked up
      const refreshCredits = async () => {
        try {
          console.log('[LISTING GENERATION] 🔄 Refreshing subscription credits...');
          await refreshSubscription(true);
          // Dispatch event to notify DashboardSubscription to refresh
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('subscription-refresh'));
          }
          console.log('[LISTING GENERATION] ✅ Subscription refreshed');
        } catch (err) {
          console.error('❌ [LISTING GENERATION] Error refreshing subscription after listing generation:', err);
        }
      };
      
      // Wait 3 seconds for database to sync, then refresh multiple times
      console.log('[LISTING GENERATION] ⏳ Waiting 3 seconds for database sync before refreshing credits...');
      setTimeout(() => {
        console.log('[LISTING GENERATION] 🔄 Starting credit refresh sequence...');
        refreshCredits();
        setTimeout(refreshCredits, 1000);
        setTimeout(refreshCredits, 2000);
        setTimeout(refreshCredits, 3000);
      }, 3000);
    } catch (error) {
      console.error('Error generating description:', error);
      alert('Erreur lors de la génération de la description. Veuillez réessayer.');
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  // Debug: Log subscription state changes to help troubleshoot
  useEffect(() => {
    if (subscription) {
      const used = typeof subscription.used === 'number' ? subscription.used : parseFloat(String(subscription.used)) || 0;
      const remaining = typeof subscription.remaining === 'number' ? subscription.remaining : parseFloat(String(subscription.remaining)) || 0;
      console.log('[DashboardListing] 💰 Subscription state updated:', {
        used,
        remaining,
        quota: subscription.quota,
        usedFormatted: used % 1 === 0 ? used : used.toFixed(1),
        remainingFormatted: remaining % 1 === 0 ? remaining : remaining.toFixed(1),
      });
    }
  }, [subscription]);

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
              <p className="text-sm text-white/60">Sélectionnez la niche pour optimiser le listing</p>
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

      {/* TITLE */}
      {analysis.verdict.viralTitleEN && (
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
                <PenTool size={20} className="text-white" />
              </div>
              <h2 className="text-base font-bold text-white">Titre SEO optimisé</h2>
            </div>
            <button
              onClick={() => copyToClipboard(analysis.verdict?.viralTitleEN || '', 'title')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                copiedTitle 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-black border border-white/10 text-white hover:bg-white/10'
              }`}
            >
              {copiedTitle ? <Check size={14} /> : <Copy size={14} />}
              {copiedTitle ? 'Copié' : 'Copier'}
            </button>
          </div>
          <div className="p-4 rounded-lg bg-black border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                typeof window !== 'undefined' && (
                  window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1'
                )
                  ? 'bg-black border border-[#00d4ff] text-[#00d4ff]'
                  : 'text-[#00d4ff]'
              }`}>Anglais</span>
              <span className="text-xs text-white/60">{(analysis.verdict?.viralTitleEN || '').length}/140</span>
            </div>
            <p className="text-sm font-medium text-white">{analysis.verdict?.viralTitleEN || ''}</p>
          </div>
        </div>
      )}

      {/* DESCRIPTION ETSY */}
      {analysis.verdict?.verdict && analysis.verdict.verdict !== 'avoid' && (
        <div className="p-5 rounded-xl bg-black border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <FileText size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Description Etsy</h3>
                <p className="text-xs text-white/70">Description optimisée pour Etsy (en anglais)</p>
              </div>
            </div>
            {etsyDescription && (
              <button
                onClick={() => copyToClipboard(etsyDescription, 'description')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  copiedDescription 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-black border border-white/10 text-white hover:bg-white/10'
                }`}
              >
                {copiedDescription ? <Check size={14} /> : <Copy size={14} />}
                {copiedDescription ? 'Copié' : 'Copier'}
              </button>
            )}
          </div>

          {!etsyDescription ? (
            <div className="text-center py-8">
              <p className="text-sm text-white/70 mb-4">
                Cette description est générée par l&apos;IA à partir de l&apos;analyse du produit et des comportements d&apos;achat sur Etsy.
              </p>
              <button
                onClick={generateEtsyDescription}
                disabled={isGeneratingDescription}
                className="px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingDescription ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Génération en cours...
                  </span>
                ) : (
                  'Générer la description'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-black border border-white/10">
                <p className="text-sm text-white/70 mb-2">
                  Vous pouvez copier et utiliser directement dans votre fiche produit.
                </p>
                <div className="p-4 bg-black rounded-lg border border-white/10 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-white whitespace-pre-wrap font-sans leading-relaxed">
                    {etsyDescription}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAGS */}
      {(() => {
        // Helper function to get tags as array and ensure 13 tags
        const getTagsArray = () => {
          if (!analysis.verdict?.seoTags) return [];
          if (Array.isArray(analysis.verdict.seoTags)) return analysis.verdict.seoTags;
          if (typeof analysis.verdict.seoTags === 'string' && analysis.verdict.seoTags) {
            return analysis.verdict.seoTags.split(',').map(t => t.trim()).filter(t => t);
          }
          return [];
        };
        
        // Helper function to ensure exactly 13 tags
        const ensure13Tags = (tags: string[]): string[] => {
          const REQUIRED_COUNT = 13;
          if (tags.length >= REQUIRED_COUNT) {
            return tags.slice(0, REQUIRED_COUNT);
          }
          
          // Compléter avec des tags génériques si nécessaire
          const genericTags = [
            'handmade', 'gift', 'unique', 'custom', 'personalized', 'etsy', 'artisan',
            'quality', 'premium', 'special', 'original', 'trendy', 'stylish', 'modern',
            'vintage', 'elegant', 'beautiful', 'perfect', 'lovely', 'charming'
          ];
          
          const result = [...tags];
          for (const tag of genericTags) {
            if (result.length >= REQUIRED_COUNT) break;
            if (!result.includes(tag)) {
              result.push(tag);
            }
          }
          
          // Si on n'a toujours pas 13 tags, compléter avec des tags numérotés
          while (result.length < REQUIRED_COUNT) {
            result.push(`tag${result.length + 1}`);
          }
          
          return result.slice(0, REQUIRED_COUNT);
        };
        
        const rawTags = getTagsArray();
        const tags = ensure13Tags(rawTags);
        return tags.length > 0 ? (
        <div className="p-5 rounded-xl bg-black border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Hash size={20} className={`${
                typeof window !== 'undefined' && (
                  window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1'
                )
                  ? 'text-[#00d4ff]'
                  : 'text-cyan-500'
              }`} />
              <h3 className="text-base font-bold text-white">Tags Etsy ({tags.length}/13)</h3>
            </div>
            <button
              onClick={() => copyToClipboard(tags.join(', '), 'tags')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copiedTags 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-black border border-white/10 text-white hover:bg-white/10'
              }`}
            >
              {copiedTags ? <Check size={14} /> : <Copy size={14} />}
              {copiedTags ? 'Copié' : 'Copier'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1.5 rounded-lg bg-black border border-white/10 text-sm text-white/80"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        ) : null;
      })()}
    </div>
  );
}

