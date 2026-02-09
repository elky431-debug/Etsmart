'use client';

import { useState } from 'react';
import { 
  PenTool,
  FileText,
  Hash,
  Copy,
  Check,
  Info,
  Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ProductAnalysis } from '@/types';
import { ImageGenerator } from '@/components/steps/ImageGenerator';
import { Logo } from '@/components/ui';
import { useSubscription } from '@/hooks/useSubscription';

interface PromptGeneratorProps {
  productDescription?: string;
  niche?: string;
  positioning?: string;
  psychologicalTriggers?: string[];
  competitorMistakes?: string[];
}

function getUniversalImagePrompt(): string {
  return `You are a professional lifestyle photographer specialized in high-converting product images for Etsy.

REFERENCE PRODUCT
Use the provided product image as the ONLY reference. The generated image must faithfully represent the exact same product.

CRITICAL RULE – EXACT PRODUCT FIDELITY
The product in the generated image must be IDENTICAL to the product shown in the reference image
Reproduce the product exactly as it appears: shape, proportions, colors, materials, textures, finishes, and details
If the product contains any writing, text, symbols, engravings, or markings, they must be reproduced EXACTLY as shown
Do NOT modify, enhance, stylize, or reinterpret the product in any way
The product must remain the central focus of the image

SCENE & CONTEXT
Create a realistic, natural lifestyle scene that shows the product in its ideal real-world usage context.
The environment must feel authentic, credible, and appropriate for the type of product.

BACKGROUND & DEPTH (MANDATORY)
The scene must include a natural background with visible depth
Use foreground and background separation to create a sense of space
The background should be softly blurred or naturally out of focus (depth of field)
Avoid flat, empty, or plain backgrounds

MOOD & EMOTION
Calm, pleasant, and inviting atmosphere
Emotion to convey: comfort, trust, and desirability
Style: premium Etsy lifestyle photography (authentic, warm, aspirational, not commercial or artificial)

PHOTOGRAPHY STYLE
Soft natural lighting only (no artificial flash)
Ultra-realistic photo rendering
Natural depth of field
Balanced, harmonious colors
Clean and engaging camera angle

ABSOLUTE PROHIBITIONS (outside of the product itself)
NO added text
NO added logos
NO brand names
NO watermarks
NO price tags
NO badges, stickers, or icons
NO artificial marketing elements
NO frames, borders, overlays, or graphic elements
NO flat catalog-style photography

The final image should look like a high-quality Etsy listing photo and naturally make people want to click and buy.`;
}

function CreativePromptGenerator({ 
  productDescription, 
  niche, 
  positioning, 
  psychologicalTriggers,
  competitorMistakes 
}: PromptGeneratorProps) {
  const [copiedMain, setCopiedMain] = useState(false);

  // ⚠️ PROMPT UNIQUE, FIXE ET IMMUTABLE - Pas de génération dynamique
  const prompt = getUniversalImagePrompt();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedMain(true);
      setTimeout(() => setCopiedMain(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-black border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            typeof window !== 'undefined' && (
              window.location.hostname === 'localhost' || 
              window.location.hostname === '127.0.0.1'
            )
              ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
              : 'bg-gradient-to-br from-violet-500 to-indigo-500'
          }`}>
            <Logo size="sm" showText={false} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Prompt IA pour images</h2>
            <p className="text-white/70 text-xs">Utilisez ce prompt avec votre photo de produit dans un outil de génération d'images IA pour créer des images produit réalistes et de haute qualité.</p>
          </div>
        </div>
      </div>

      {/* Prompt principal */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wide">Prompt IA universel</span>
          <button
            onClick={copyToClipboard}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              copiedMain 
                ? 'bg-emerald-500 text-white' 
                : typeof window !== 'undefined' && (
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1'
                  )
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white hover:opacity-90'
                    : 'bg-violet-500 text-white hover:bg-violet-600'
            }`}
          >
            {copiedMain ? <Check size={12} /> : <Copy size={12} />}
            {copiedMain ? 'Copié !' : 'Copier'}
          </button>
        </div>
        <div className="p-4 bg-black rounded-lg border border-white/10 max-h-64 overflow-y-auto">
          <pre className="text-xs text-white whitespace-pre-wrap font-mono leading-relaxed">
            {prompt}
          </pre>
        </div>
        <p className="mt-2 text-[10px] text-white/70 italic">
          ⚠️ Ce prompt universel et fixe fonctionne pour tous les produits. Utilisez-le avec votre photo de produit dans n'importe quel outil de génération d'images IA.
        </p>
      </div>

      {/* Instructions d'utilisation */}
      <div className="p-4 bg-black rounded-lg border border-white/10">
        <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
          <Info size={14} className="text-[#00d4ff]" />
          Comment utiliser ce prompt ?
        </h4>
        <ol className="space-y-2 text-xs text-white/80">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-black border border-[#00d4ff] text-[#00d4ff] flex items-center justify-center flex-shrink-0 font-bold text-[10px]">1</span>
            <span>Copiez le prompt ci-dessus</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-black border border-[#00d4ff] text-[#00d4ff] flex items-center justify-center flex-shrink-0 font-bold text-[10px]">2</span>
            <span>Ouvrez ChatGPT, Midjourney ou autre IA d'images</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-black border border-[#00d4ff] text-[#00d4ff] flex items-center justify-center flex-shrink-0 font-bold text-[10px]">3</span>
            <span>Importez votre photo de produit</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-black border border-[#00d4ff] text-[#00d4ff] flex items-center justify-center flex-shrink-0 font-bold text-[10px]">4</span>
            <span>Collez le prompt et générez l'image</span>
          </li>
        </ol>
        <p className="mt-3 text-[10px] text-white/70 italic">
          Ce prompt universel est conçu pour produire des images produit réalistes et de haute qualité style Etsy. 
          Le prompt est fixe et immuable - il fonctionne pour tous les produits sans modification. 
          Aucun texte ou logo ne sera ajouté à l'image générée.
        </p>
      </div>
    </div>
  );
}

interface DashboardListingImagesProps {
  analysis: ProductAnalysis;
}

export function DashboardListingImages({ analysis }: DashboardListingImagesProps) {
  // Vérifier que analysis est valide avec toutes les propriétés nécessaires
  if (!analysis || !analysis.product || !analysis.verdict) {
    console.error('[DashboardListingImages] Invalid analysis prop:', analysis);
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/50">
        <p className="text-red-400">Erreur: Analyse invalide. Veuillez réessayer.</p>
      </div>
    );
  }

  const { subscription, refreshSubscription } = useSubscription();
  const [activeTab, setActiveTab] = useState<'listing' | 'image'>('listing');
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);
  const [etsyDescription, setEtsyDescription] = useState<string | null>(null);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [copiedDescription, setCopiedDescription] = useState(false);

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

  const generateEtsyDescription = async () => {
    if (etsyDescription) return; // Already generated
    
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
          niche: analysis.niche || '',
          positioning: analysis.marketing?.strategic?.positioning?.mainPositioning,
          psychologicalTriggers: analysis.marketing?.strategic?.psychologicalTriggers,
          buyerMirror: undefined, // buyerMirror not available in current structure
          recommendedPrice: analysis.pricing?.recommendedPrice?.optimal || 0,
          skipCreditDeduction: false, // ⚠️ Explicitement false pour déduire 0.25 crédit quand on génère seulement le listing
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate description');
      }

      const data = await response.json();
      setEtsyDescription(data.description);
      
      // Log quota info if available from API response
      if (data.quota) {
        console.log('[LISTING GENERATION] 💰 Quota info from API:', data.quota);
      }
      
      // ⚠️ CRITICAL: AGGRESSIVE REFRESH STRATEGY - Refresh subscription IMMEDIATELY and repeatedly
      // The API has already deducted 0.25 credit, we MUST see it in the UI
      console.log('[LISTING GENERATION] ✅ Listing generated successfully, starting AGGRESSIVE credit refresh (0.25 credit deducted)...');
      
      // Function to refresh with detailed logging
      const doRefresh = async (attempt: number, source: string) => {
        try {
          console.log(`[LISTING GENERATION] 🔄 Refresh attempt ${attempt} (${source})...`);
          await refreshSubscription(true);
          console.log(`[LISTING GENERATION] ✅ Refresh attempt ${attempt} completed`);
          
          // Dispatch event to notify ALL components
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('subscription-refresh'));
            // Also dispatch a more specific event
            window.dispatchEvent(new CustomEvent('credits-updated', { detail: { source: 'listing-generation' } }));
          }
        } catch (err) {
          console.error(`[LISTING GENERATION] ❌ Error in refresh attempt ${attempt}:`, err);
        }
      };
      
      // IMMEDIATE refresh (0ms)
      doRefresh(1, 'immediate');
      
      // AGGRESSIVE polling: refresh every 200ms for 3 seconds (15 refreshes total)
      let pollingAttempt = 2;
      const startTime = Date.now();
      const pollingInterval = setInterval(() => {
        doRefresh(pollingAttempt++, 'polling');
      }, 200);
      
      // Stop polling after 3 seconds
      setTimeout(() => {
        clearInterval(pollingInterval);
        console.log('[LISTING GENERATION] ✅ Polling stopped after 3 seconds');
      }, 3000);
      
      // Additional one-time refreshes at key intervals
      let delayedAttempt = 20;
      [50, 100, 200, 300, 500, 800, 1200, 2000, 3000].forEach(delay => {
        setTimeout(() => doRefresh(delayedAttempt++, `delayed-${delay}ms`), delay);
      });
      
      // Force window focus to trigger any focus-based refresh mechanisms
      if (typeof window !== 'undefined') {
        window.focus();
        // Trigger visibility change event
        document.dispatchEvent(new Event('visibilitychange'));
      }
    } catch (error) {
      console.error('Error generating description:', error);
      alert('Erreur lors de la génération de la description. Veuillez réessayer.');
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* CREDITS DISPLAY */}
      {subscription && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-black border border-white/10">
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
      
      {/* TABS */}
      <div className="flex bg-white/5 rounded-t-lg border-b border-white/10">
        <button
          onClick={() => setActiveTab('listing')}
          className={`flex-1 py-4 text-center font-semibold transition-colors relative rounded-tl-lg ${
            activeTab === 'listing'
              ? 'text-[#00c9b7] bg-white/10'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          Listing
          {activeTab === 'listing' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00c9b7]"></div>
          )}
        </button>
        <div className="w-px bg-white/10"></div>
        <button
          onClick={() => setActiveTab('image')}
          className={`flex-1 py-4 text-center font-semibold transition-colors relative rounded-tr-lg ${
            activeTab === 'image'
              ? 'text-[#00c9b7] bg-white/10'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          Image
          {activeTab === 'image' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00c9b7]"></div>
          )}
        </button>
      </div>

      {/* CONTENT */}
      {activeTab === 'listing' && (
        <div className="space-y-6">
        
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
                {copiedTags ? <Check size={12} /> : <Copy size={12} />}
                {copiedTags ? 'Copié' : 'Copier'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    typeof window !== 'undefined' && (
                      window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1'
                    )
                      ? 'bg-black border-[#00d4ff] text-[#00d4ff]'
                      : 'bg-cyan-100 text-cyan-700 border-cyan-200'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          ) : null;
        })()}
        </div>
      )}

      {activeTab === 'image' && (
        <div className="space-y-6">
          {/* ⚠️ CRITICAL: Image generation is completely independent from listing */}
          {/* No listing content should be displayed in the Image tab */}
          <ImageGenerator 
            analysis={analysis} 
            hasListing={false}
            // ⚠️ CRITICAL: Image generation is completely independent from listing
            // - Images can be generated without a listing → 1 crédit
            // - Listing can be generated separately in the "Listing" tab → 1 crédit
            // - Each generation costs 1 credit independently
          />
        </div>
      )}
    </div>
  );
}

