'use client';

import { useState, useEffect } from 'react';
import {
  PenTool,
  FileText,
  Hash,
  Copy,
  Check,
  Zap,
  Sparkles,
  Package,
  ArrowRight,
  ImageIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ProductAnalysis, Niche } from '@/types';
import { useSubscription } from '@/hooks/useSubscription';
import { useStore } from '@/store/useStore';

interface DashboardListingProps {
  analysis: ProductAnalysis;
  isFreeUser?: boolean;
  onUpgrade?: () => void;
}

export function DashboardListing({ analysis, isFreeUser, onUpgrade }: DashboardListingProps) {
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
  const [etsyTitle, setEtsyTitle] = useState<string | null>(null);
  const [etsyTags, setEtsyTags] = useState<string[] | null>(null);
  const [etsyMaterials, setEtsyMaterials] = useState<string | null>(null);
  const [listingKeywordHints, setListingKeywordHints] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [copiedDescription, setCopiedDescription] = useState(false);
  // Initialiser la niche depuis l'analyse si disponible
  useEffect(() => {
    if (analysis.niche && !selectedNiche) {
      setNiche(analysis.niche as Niche);
    }
  }, [analysis.niche, selectedNiche, setNiche]);
  
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
    setIsGeneratingDescription(true);
    try {
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
          sourceTitle: analysis.product?.title || '',
          niche: selectedNiche === 'custom' ? customNiche : (selectedNiche || analysis.niche || ''),
          positioning: analysis.marketing?.strategic?.positioning?.mainPositioning,
          psychologicalTriggers: analysis.marketing?.strategic?.psychologicalTriggers,
          buyerMirror: undefined,
          recommendedPrice: analysis.pricing?.recommendedPrice?.optimal || 0,
          skipCreditDeduction: false,
          ...(listingKeywordHints.trim() ? { listingKeywordHints: listingKeywordHints.trim() } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate description');
      }

      const data = await response.json();
      // Mettre à jour la description, le titre et les tags (remplace l'ancienne si elle existe)
      setEtsyDescription(data.description);
      if (data.title) {
        setEtsyTitle(data.title);
      }
      if (data.tags && Array.isArray(data.tags)) {
        setEtsyTags(data.tags);
      } else if (data.tags && typeof data.tags === 'string') {
        // Parse comma-separated tags
        const parsedTags = data.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
        setEtsyTags(parsedTags);
      }
      
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

  // ⚠️ Timeout pour éviter le chargement infini
  useEffect(() => {
    if (isGeneratingDescription) {
      const timeout = setTimeout(() => {
        console.warn('[DashboardListing] Generation timeout, stopping loader');
        setIsGeneratingDescription(false);
      }, 30000); // 30 secondes max
      return () => clearTimeout(timeout);
    }
  }, [isGeneratingDescription]);

  return (
    <div className="space-y-6">
      {/* KEYWORD HINTS + GENERATE — toujours visible avant et après génération */}
      <div className="p-5 rounded-xl bg-black border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {etsyDescription ? 'Régénérer le listing' : 'Générer le listing'}
            </h2>
            <p className="text-xs text-white/50">
              {etsyDescription ? 'Modifie les mots-clés puis régénère (1 crédit)' : 'Ajoute des mots-clés optionnels puis génère (1 crédit)'}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={listingKeywordHints}
            onChange={e => setListingKeywordHints(e.target.value)}
            placeholder="Mots-clés à intégrer (ex: boho, gift for her, handmade…)"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#00d4ff]/50 focus:outline-none transition"
          />
          <button
            type="button"
            onClick={() => generateEtsyDescription(true)}
            disabled={isGeneratingDescription}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#00d4ff]/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isGeneratingDescription ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Génération en cours…
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {etsyDescription ? 'Régénérer le listing (1 crédit)' : 'Générer le listing (1 crédit)'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* CREDITS DISPLAY */}
      {subscription && (
        <div className="p-5 rounded-xl bg-black border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
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
            <p className="text-xs text-white/40 mt-1">Listing = 1 crédit</p>
          </div>
        </div>
      )}

      {/* TITLE */}
      {(etsyTitle || analysis.verdict.viralTitleEN) && (
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
              onClick={() => copyToClipboard(etsyTitle || analysis.verdict?.viralTitleEN || '', 'title')}
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
              <span className="text-xs text-white/60">{(etsyTitle || analysis.verdict?.viralTitleEN || '').length}/140</span>
            </div>
            <p className="text-sm font-medium text-white">{etsyTitle || analysis.verdict?.viralTitleEN || ''}</p>
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

          {etsyDescription && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-black border border-white/10">
                <p className="text-sm text-white/70 mb-2">
                  Vous pouvez copier et utiliser directement dans votre fiche produit.
                </p>
                <div className="custom-scrollbar max-h-96 overflow-y-auto rounded-lg border border-white/10 bg-black p-4">
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
          // Priorité: tags générés par l'API > tags de l'analyse
          if (etsyTags && etsyTags.length > 0) {
            return etsyTags;
          }
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

      {/* CTA IMAGES — visible uniquement pour les utilisateurs gratuits */}
      {isFreeUser && (
        <div className="rounded-xl border border-[#00d4ff]/30 bg-gradient-to-br from-[#00d4ff]/8 to-[#00c9b7]/5 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] shadow-lg shadow-[#00d4ff]/20">
              <ImageIcon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white mb-1">Génère aussi les 7 visuels produit</h3>
              <p className="text-xs text-white/60 leading-relaxed mb-4">
                Avec un plan payant, génère 7 photos produit IA stylisées (lifestyle, porté, macro texture…) directement à partir de ce listing — en un clic.
              </p>
              <button
                type="button"
                onClick={onUpgrade}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#00d4ff]/20 transition hover:opacity-90"
              >
                Passer au plan payant
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MATÉRIAUX */}
      {etsyMaterials && (
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
                <Package size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Matériaux</h3>
                <p className="text-xs text-white/70">Matériaux utilisés (en anglais)</p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(etsyMaterials, 'description')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                copiedDescription 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-black border border-white/10 text-white hover:bg-white/10'
              }`}
            >
              {copiedDescription ? <Check size={14} /> : <Copy size={14} />}
              {copiedDescription ? 'Copié' : 'Copier'}
            </button>
          </div>
          <div className="p-4 rounded-lg bg-black border border-white/10">
            <p className="text-sm font-medium text-white whitespace-pre-wrap">{etsyMaterials}</p>
          </div>
        </div>
      )}
    </div>
  );
}

