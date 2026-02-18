'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Download, 
  Maximize2, 
  Loader2,
  Image as ImageIcon,
  X,
  Sparkles
} from 'lucide-react';
import type { ProductAnalysis } from '@/types';
import { supabase } from '@/lib/supabase';
import { useSubscription } from '@/hooks/useSubscription';

// ⚠️ Utility: Compress image on frontend using Canvas to stay under Netlify 6MB body limit
const compressImageToBase64 = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
        if (h > maxHeight) { w = (maxHeight / h) * w; h = maxHeight; }
        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context failed')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
};

interface ImageGeneratorProps {
  analysis: ProductAnalysis;
  hasListing?: boolean; // Indique si le listing est déjà généré (pour affichage uniquement, n'affecte pas la génération)
}

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

interface GeneratedImage {
  url: string;
  id: string;
}

export function ImageGenerator({ analysis, hasListing = false }: ImageGeneratorProps) {
  const { refreshSubscription } = useSubscription();
  // Clé unique pour ce produit dans sessionStorage
  const productId = analysis.product.id || analysis.product.url || `product-${Date.now()}`;
  const storageKey = `etsmart-image-generated-${productId}`;

  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(
    analysis.product.images[0] || null
  );
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [backgroundImagePreview, setBackgroundImagePreview] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasGeneratedImage, setHasGeneratedImage] = useState(false);

  // Vérifier au montage si une image a déjà été générée pour ce produit
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setError((prev) => {
        if (!prev) return null;
        const isTechnical = /failedImages is not defined|Can't find variable|is not defined|ReferenceError/i.test(prev);
        return isTechnical ? null : prev;
      });
      const saved = sessionStorage.getItem(storageKey);
      if (saved === 'true') {
        setHasGeneratedImage(true);
        const savedImages = sessionStorage.getItem(`${storageKey}-images`);
        if (savedImages) {
          try {
            const images = JSON.parse(savedImages);
            setGeneratedImages(Array.isArray(images) ? images : []);
          } catch (e) {
            console.error('Error parsing saved images:', e);
          }
        }
      }
    }
  }, [storageKey]);

  // Drag & Drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        handleFileSelect(file);
      }
    }
  }, []);

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('L\'image est trop grande. Taille maximum : 10MB');
      return;
    }

    if (!file.type.match(/^image\/(jpeg|jpg|png)$/i)) {
      alert('Format non supporté. Utilisez JPG ou PNG.');
      return;
    }

    setSourceImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSourceImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleBackgroundSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('L\'image de fond est trop grande. Taille maximum : 10MB');
      return;
    }
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/i)) {
      alert('Format non supporté. Utilisez JPG ou PNG.');
      return;
    }
    setBackgroundImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setBackgroundImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleBackgroundSelect(e.target.files[0]);
    }
  };

  const generateImages = async () => {
    if (!sourceImagePreview) {
      alert('Veuillez sélectionner une image source');
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);
    setError(null);

    try {
      // ⚠️ Compresser les images côté frontend pour rester sous la limite 6MB de Netlify
      let imageBase64: string;
      if (sourceImage) {
        imageBase64 = await compressImageToBase64(sourceImage, 1024, 1024, 0.7);
        console.log('[IMAGE GENERATION] ✅ Source image compressed:', Math.round(imageBase64.length / 1024), 'KB');
      } else {
        imageBase64 = sourceImagePreview!;
      }

      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentification requise');
      }

      // ⚠️ CRITICAL: Image generation is now INDEPENDENT from listing
      // We ALWAYS generate only the image (0.25 credit), regardless of whether listing exists
      // The listing can be generated separately in the "Listing" tab
      // This allows users to generate images without needing a listing first
      
      // Compresser le fond si présent (512x512 car utilisé uniquement pour description GPT-4o)
      let backgroundBase64: string | undefined;
      if (backgroundImage) {
        backgroundBase64 = await compressImageToBase64(backgroundImage, 512, 512, 0.6);
        console.log('[IMAGE GENERATION] ✅ Background image compressed:', Math.round(backgroundBase64.length / 1024), 'KB');
      }

      console.log('[IMAGE GENERATION] 📊 Generating image independently (0.25 credit)', backgroundBase64 ? '(with custom background)' : '');
      
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceImage: imageBase64,
          backgroundImage: backgroundBase64,
          customInstructions: customInstructions.trim() || undefined,
          quantity,
          aspectRatio,
          skipListingGeneration: true, // ⚠️ ALWAYS true - Image generation is independent, always 0.25 credit
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        const errorMessage = errorData.error || errorData.message || `Erreur ${response.status}`;
        console.error('[IMAGE GENERATION] API Error:', response.status, errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[IMAGE GENERATION] Response:', data);
      
      if (data.error) {
        const details = data.details ? ` Détails: ${Array.isArray(data.details) ? data.details.join(', ') : data.details}` : '';
        throw new Error(`${data.error}${details}`);
      }
      
      // New flow: API returns taskIds, poll for results client-side
      const taskIds: string[] = data.imageTaskIds || [];
      
      if (taskIds.length === 0) {
        throw new Error('Aucune image soumise. Réessayez.');
      }
      
      console.log('[IMAGE GENERATION] Polling for', taskIds.length, 'image(s)...');
      
      const pollResults = await Promise.all(
        taskIds.map(async (taskId: string) => {
          for (let attempt = 0; attempt < 20; attempt++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
              const res = await fetch(`/api/check-image-status?taskId=${encodeURIComponent(taskId)}`, {
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (!res.ok) continue;
              const s = await res.json();
              if (s.status === 'ready' && s.url) return s.url;
              if (s.status === 'error') return null;
            } catch { /* retry */ }
          }
          return null;
        })
      );
      
      const validImages = pollResults
        .filter((url): url is string => !!url)
        .map((url, i) => ({ id: `img-${Date.now()}-${i}`, url }));
      
      if (validImages.length === 0) {
        throw new Error('Aucune image générée. Réessayez.');
      }
      
      setGeneratedImages(validImages);
      setHasGeneratedImage(true);
      
      // ⚠️ CRITICAL: Refresh subscription to update credit count
      // Wait for database to sync, then refresh multiple times to ensure the update is picked up
      const refreshCredits = async () => {
        try {
          console.log('[IMAGE GENERATION] 🔄 Refreshing subscription credits...');
          await refreshSubscription(true);
          // Dispatch event to notify DashboardSubscription to refresh
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('subscription-refresh'));
          }
          console.log('[IMAGE GENERATION] ✅ Subscription refreshed');
        } catch (err) {
          console.error('❌ [IMAGE GENERATION] Error refreshing subscription after image generation:', err);
        }
      };
      
      // Wait 3 seconds for database to sync, then refresh multiple times
      console.log('[IMAGE GENERATION] ⏳ Waiting 3 seconds for database sync before refreshing credits...');
      setTimeout(() => {
        console.log('[IMAGE GENERATION] 🔄 Starting credit refresh sequence...');
        refreshCredits();
        setTimeout(refreshCredits, 1000);
        setTimeout(refreshCredits, 2000);
        setTimeout(refreshCredits, 3000);
      }, 3000);
      
      // Sauvegarder dans sessionStorage que l'image a été générée
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, 'true');
        sessionStorage.setItem(`${storageKey}-images`, JSON.stringify(validImages));
      }
      
      if (failedCount > 0) {
        setError(`${failedCount} image(s) n'ont pas pu être générée(s). ${validImages.length} image(s) générée(s) avec succès.`);
      }
      
      if (data.warning) {
        console.warn('[IMAGE GENERATION]', data.warning);
      }
    } catch (error: any) {
      console.error('Error generating images:', error);
      const rawMessage = error?.message || 'Erreur lors de la génération des images';
      // Ne pas afficher les erreurs techniques (ReferenceError, failedImages, etc.) à l'utilisateur
      const isTechnicalError =
        /Can't find variable|is not defined|ReferenceError|failedImages is not defined/i.test(rawMessage);
      setError(
        isTechnicalError
          ? 'Erreur technique lors de la génération. Veuillez rafraîchir la page (Ctrl+F5) et réessayer.'
          : rawMessage
      );
      setGeneratedImages([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = async (imageUrl: string, index: number) => {
    try {
      console.log('[DOWNLOAD] Starting download for image:', imageUrl.substring(0, 50) + '...');
      
      // Méthode 1: Essayer fetch direct avec gestion CORS
      let blob: Blob | null = null;
      
      try {
        const response = await fetch(imageUrl, {
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-cache',
        });
        
        if (response.ok) {
          blob = await response.blob();
          console.log('[DOWNLOAD] Direct fetch successful');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (fetchError: any) {
        console.log('[DOWNLOAD] Direct fetch failed, trying proxy:', fetchError.message);
        
        // Méthode 2: Utiliser le proxy si fetch direct échoue
        try {
          const proxyResponse = await fetch('/api/download-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl }),
          });
          
          if (proxyResponse.ok) {
            blob = await proxyResponse.blob();
            console.log('[DOWNLOAD] Proxy fetch successful');
          } else {
            throw new Error(`Proxy HTTP ${proxyResponse.status}`);
          }
        } catch (proxyError: any) {
          console.error('[DOWNLOAD] Proxy also failed:', proxyError);
          throw proxyError;
        }
      }
      
      if (!blob) {
        throw new Error('Impossible de récupérer l\'image');
      }
      
      // Créer l'URL du blob et télécharger
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etsmart-image-${index + 1}.png`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Nettoyer après un court délai
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        window.URL.revokeObjectURL(url);
      }, 100);
      
      console.log('[DOWNLOAD] Download initiated successfully');
    } catch (error: any) {
      console.error('[DOWNLOAD] Error downloading image:', error);
      
      // Méthode de fallback : ouvrir dans un nouvel onglet pour que l'utilisateur puisse télécharger manuellement
      const fallback = window.confirm(
        `Erreur lors du téléchargement automatique.\n\n` +
        `Souhaitez-vous ouvrir l'image dans un nouvel onglet pour la télécharger manuellement ?`
      );
      
      if (fallback) {
        window.open(imageUrl, '_blank');
      } else {
        alert(`Erreur: ${error.message || 'Impossible de télécharger l\'image'}`);
      }
    }
  };

  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const downloadAllImages = async () => {
    if (generatedImages.length === 0) return;
    setIsDownloadingAll(true);
    try {
      for (let i = 0; i < generatedImages.length; i++) {
        const img = generatedImages[i];
        if (!img.url || !img.url.startsWith('http')) continue;
        await downloadImage(img.url, i);
        // Small delay between downloads to avoid browser blocking
        if (i < generatedImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('[DOWNLOAD ALL] Error:', error);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Full Width Layout */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Paramètres en haut */}
        <div className="bg-black rounded-xl border border-white/10 mb-6">
          <div className="p-6">
            <h2 className="text-xl font-bold text-white mb-6">Génération d'images</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* A. Input Source */}
            <div>
              <label className="block text-sm font-bold text-white mb-3">
                Image source
              </label>
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#00d4ff] bg-[#00d4ff]/5'
                    : 'border-slate-300 hover:border-slate-400 bg-black'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                {sourceImagePreview ? (
                  <div className="relative">
                    <img
                      src={sourceImagePreview}
                      alt="Source"
                      className="w-full h-48 object-cover rounded-lg mb-3"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceImage(null);
                        setSourceImagePreview(null);
                        setGeneratedImages([]); // Supprimer aussi les images générées
                        setError(null); // Supprimer les erreurs
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                      title="Supprimer l'image source"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto mb-3 text-white/60" />
                    <p className="text-sm text-white/80 mb-1">
                      Glissez-déposez une image ou cliquez pour sélectionner
                    </p>
                    <p className="text-xs text-white/60">
                      JPG / PNG • Max 10MB
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* B. Custom Instructions + Background */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  Instructions personnalisées <span className="text-white/40 font-normal">(optionnel)</span>
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Describe specific details (optional)"
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black text-white placeholder-white/40 focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 outline-none resize-none text-sm"
                  rows={3}
                />
              </div>
              
              {/* Background Image Upload */}
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  Fond personnalisé <span className="text-white/40 font-normal">(optionnel)</span>
                </label>
                <div
                  onClick={() => backgroundInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                    backgroundImagePreview
                      ? 'border-[#00d4ff]/40 bg-[#00d4ff]/5'
                      : 'border-white/15 hover:border-white/30 bg-white/[0.02]'
                  }`}
                >
                  <input
                    ref={backgroundInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={handleBackgroundInputChange}
                    className="hidden"
                  />
                  {backgroundImagePreview ? (
                    <div className="relative">
                      <img
                        src={backgroundImagePreview}
                        alt="Fond"
                        className="w-full h-20 object-cover rounded-lg"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBackgroundImage(null);
                          setBackgroundImagePreview(null);
                        }}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                        title="Supprimer le fond"
                      >
                        <X size={12} />
                      </button>
                      <div className="absolute bottom-1 left-1 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white/80">
                        Fond personnalisé ✓
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 justify-center py-1">
                      <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                        <ImageIcon size={14} className="text-white/40" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-white/60">
                          Cliquez pour ajouter un fond
                        </p>
                        <p className="text-[10px] text-white/30">
                          Le produit sera placé sur ce fond
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* C. Quantity */}
            <div>
              <label className="block text-sm font-bold text-white mb-3">
                Quantité
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((qty) => (
                  <button
                    key={qty}
                    onClick={() => setQuantity(qty)}
                    className={`py-2.5 rounded-lg font-semibold text-sm transition-all ${
                      quantity === qty
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg'
                        : 'bg-black border border-white/10 text-white hover:border-white/20'
                    }`}
                  >
                    {qty}
                  </button>
                ))}
              </div>
            </div>

            {/* D. Aspect Ratio */}
            <div>
              <label className="block text-sm font-bold text-white mb-3">
                Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['1:1', '16:9', '9:16', '4:3', '3:4'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-3 rounded-lg font-semibold text-sm transition-all ${
                      aspectRatio === ratio
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg'
                        : 'bg-black border border-white/10 text-white hover:border-white/20'
                    }`}
                  >
                    {ratio}
                    {ratio === '1:1' && ' (Etsy)'}
                  </button>
                ))}
              </div>
            </div>

            {/* F. Engine (Nanonbanana) */}
            <div>
              <label className="block text-sm font-bold text-white mb-3">
                Moteur
              </label>
              <div className="p-4 rounded-lg bg-black border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Nanonbanana</p>
                    <p className="text-xs text-white/70">Image-to-Image • Génération</p>
                  </div>
                  <Sparkles size={20} className="text-[#00d4ff]" />
                </div>
              </div>
            </div>
            </div>

            {/* G. Bouton principal - Full width */}
            <div className="lg:col-span-2 xl:col-span-3">
              <button
                onClick={generateImages}
                disabled={isGenerating || !sourceImagePreview || hasGeneratedImage || generatedImages.length > 0}
                className="w-full py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#00d4ff]/30 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Génération en cours...
                  </>
                ) : hasGeneratedImage || generatedImages.length > 0 ? (
                  <>
                    <Sparkles size={20} />
                    Image déjà générée
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    GÉNÉRER {quantity} IMAGE{quantity > 1 ? 'S' : ''}
                  </>
                )}
              </button>
              {!isGenerating && (hasGeneratedImage || generatedImages.length > 0) && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs text-center text-amber-800 font-medium">
                    ⚠️ Il n'est plus possible de générer d'autres images pour ce produit.
                  </p>
                  <p className="text-xs text-center text-amber-700 mt-1">
                    Pour générer d'autres variations, utilisez le prompt avec une IA externe.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RÉSULTATS - Full width en dessous */}
        <div className="bg-black rounded-xl border border-white/10">
          <div className="p-6">
            {/* Message d'erreur */}
            {error && (
              <div className="mb-4 p-4 rounded-lg bg-black border border-red-500/50">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="min-h-[400px] flex flex-col items-center justify-center py-12"
                >
                  <Loader2 size={48} className="text-[#00d4ff] animate-spin mb-4" />
                  <p className="text-lg font-semibold text-white">
                    Génération des images...
                  </p>
                  <p className="text-sm text-white/70 mt-2">
                    Cela peut prendre quelques secondes
                  </p>
                </motion.div>
              ) : hasGeneratedImage || generatedImages.length > 0 ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">
                      {generatedImages.length > 0
                        ? `${generatedImages.length} image${generatedImages.length > 1 ? 's' : ''} générée${generatedImages.length > 1 ? 's' : ''}`
                        : 'Aucune image à afficher'}
                    </h3>
                  </div>
                  {generatedImages.length === 0 ? (
                    <p className="text-sm text-white/60 py-4">Les images n’ont pas été enregistrées. Vous pouvez relancer une génération ci-dessus.</p>
                  ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {generatedImages.map((img, index) => (
                      <motion.div
                        key={img.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="group relative bg-black rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-all"
                      >
                        <div className="aspect-square relative">
                          <img
                            src={img.url}
                            alt={`Generated ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error('Error loading image:', img.url);
                              // Afficher un placeholder en cas d'erreur
                              const target = e.target as HTMLImageElement;
                              target.src = `https://via.placeholder.com/1024x1024?text=Image+Error`;
                            }}
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                          <div className="absolute top-2 right-2 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setFullscreenImage(img.url)}
                              className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-black/80 border border-white/20 flex items-center justify-center hover:bg-black transition-colors"
                            >
                              <Maximize2 size={18} className="text-white sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => downloadImage(img.url, index)}
                              className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-black/80 border border-white/20 flex items-center justify-center hover:bg-black transition-colors"
                            >
                              <Download size={18} className="text-white sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Download All Button */}
                  {generatedImages.length > 1 && (
                    <div className="mt-6">
                      <button
                        onClick={downloadAllImages}
                        disabled={isDownloadingAll}
                        className="w-full py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:from-[#00bfe6] hover:to-[#00b5a5] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDownloadingAll ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Téléchargement en cours...
                          </>
                        ) : (
                          <>
                            <Download size={18} />
                            Tout télécharger ({generatedImages.length} images)
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="min-h-[400px] flex flex-col items-center justify-center py-12"
                >
                  <ImageIcon size={64} className="text-slate-300 mb-4" />
                  <p className="text-lg font-semibold text-slate-900 mb-2">
                    Ready to create
                  </p>
                  <p className="text-sm text-slate-500 text-center max-w-md">
                    Upload a product image and select a style
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setFullscreenImage(null)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={fullscreenImage}
              alt="Fullscreen"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute top-4 right-4 flex gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = generatedImages.findIndex(img => img.url === fullscreenImage);
                  downloadImage(fullscreenImage!, idx >= 0 ? idx : 0);
                }}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <Download size={22} />
              </button>
              <button
                onClick={() => setFullscreenImage(null)}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

