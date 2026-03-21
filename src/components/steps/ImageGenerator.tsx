'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
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
import { ImageAltTextPanel } from '@/components/dashboard/ImageAltTextPanel';
import { ImageStyleCards } from '@/components/dashboard/ImageStyleCards';
import type { ImageStyleId } from '@/lib/image-style-presets';
import { DEFAULT_IMAGE_STYLE } from '@/lib/image-style-presets';
import { getImagePollMaxAttempts, getImagePollIntervalMs } from '@/lib/image-gen-polling';
import { imagesOnlyTotalCredits, roundCreditsToTenth } from '@/lib/image-listing-credits';

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

// Tarifs images : src/lib/image-listing-credits.ts
const roundToTenth = roundCreditsToTenth;
const formatCredits = (n: number) => {
  const rounded = roundToTenth(n);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded.toFixed(1)).replace(/\.0$/, '');
};
const creditLabel = (n: number) => (roundToTenth(n) === 1 ? 'crédit' : 'crédits');

interface ImageGeneratorProps {
  analysis: ProductAnalysis;
  hasListing?: boolean; // Indique si le listing est déjà généré (pour affichage uniquement, n'affecte pas la génération)
}

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
type ImageEngine = 'flash' | 'pro';

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
  const [extraSourceImages, setExtraSourceImages] = useState<File[]>([]);
  const [extraSourcePreviews, setExtraSourcePreviews] = useState<string[]>([]);
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [backgroundImagePreview, setBackgroundImagePreview] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [engine, setEngine] = useState<ImageEngine>('flash');
  const [style, setStyle] = useState<ImageStyleId>(DEFAULT_IMAGE_STYLE);
  const creditsToDeduct = imagesOnlyTotalCredits(quantity, engine);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extraSourceInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasGeneratedImage, setHasGeneratedImage] = useState(false);

  // Ne jamais afficher les erreurs techniques (ex: failedImages/failedCount is not defined)
  const isTechnicalError = (msg: string | null) => {
    if (!msg || typeof msg !== 'string') return false;
    const s = msg.trim();
    return (
      /failedImages\s+is\s+not\s+defined/i.test(s) ||
      /failedCount\s+is\s+not\s+defined/i.test(s) ||
      /Can't find variable/i.test(s) ||
      /is not defined/i.test(s) ||
      /ReferenceError/i.test(s)
    );
  };
  const displayError = error && !isTechnicalError(error) ? error : null;

  // sessionStorage quota is very small. For some engines (Gemini/Imagen) we may receive
  // `data:image/...` URLs (base64). Persisting those blobs will quickly exceed quota and crash.
  const persistGeneratedImages = (images: GeneratedImage[]) => {
    if (typeof window === 'undefined') return;
    try {
      // Never persist base64/data URLs into sessionStorage.
      const safeImages = images.filter((img) => !img.url.startsWith('data:image/'));
      if (safeImages.length === 0) return;
      const payload = JSON.stringify(safeImages);

      sessionStorage.setItem(storageKey, 'true');
      // Avoid quota issues even for signed URLs.
      if (payload.length <= 15_000) {
        sessionStorage.setItem(`${storageKey}-images`, payload);
      } else {
        sessionStorage.setItem(`${storageKey}-images`, JSON.stringify([]));
      }
    } catch (e) {
      // Quota exceeded or blocked storage: silently ignore to avoid breaking the client.
      console.warn('[IMAGE GENERATION] sessionStorage persist skipped:', e);
      try {
        sessionStorage.setItem(storageKey, 'true');
        sessionStorage.setItem(`${storageKey}-images`, JSON.stringify([]));
      } catch {
        /* ignore */
      }
    }
  };

  // Nettoyer toute erreur technique AVANT le premier affichage (évite flash avec cache ancien)
  useLayoutEffect(() => {
    setError((prev) => {
      if (!prev) return prev;
      if (isTechnicalError(prev)) return null;
      return prev;
    });
  }, []);

  // Vérifier au montage si une image a déjà été générée pour ce produit
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Ne jamais garder une erreur technique (ex: failedImages is not defined)
      setError((prev) => {
        if (!prev) return null;
        const isTechnical = isTechnicalError(prev);
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

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });

  const handleExtraSourceInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const valid = files
      .filter((f) => /^image\/(jpeg|jpg|png)$/i.test(f.type))
      .filter((f) => f.size <= 10 * 1024 * 1024);

    const remaining = Math.max(0, 2 - extraSourceImages.length); // total 3 refs = 1 source + 2 extras
    const selected = valid.slice(0, remaining);
    if (!selected.length) return;

    try {
      const previews = await Promise.all(selected.map((f) => fileToDataUrl(f)));
      setExtraSourceImages((prev) => [...prev, ...selected]);
      setExtraSourcePreviews((prev) => [...prev, ...previews]);
    } catch (err) {
      console.error('[IMAGE GENERATION] Failed to read extra references:', err);
    } finally {
      e.target.value = '';
    }
  };

  const removeExtraSourceAt = (index: number) => {
    setExtraSourceImages((prev) => prev.filter((_, i) => i !== index));
    setExtraSourcePreviews((prev) => prev.filter((_, i) => i !== index));
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

      // Deduct credits côté client (pricing dépend engine + quantity)
      const quotaCheck = await fetch('/api/deduct-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: creditsToDeduct, reason: 'image-generate' }),
      });

      if (!quotaCheck.ok) {
        const fallbackMessage = 'Crédits insuffisants. Passe à un plan supérieur ou attends le prochain cycle.';
        try {
          const err = await quotaCheck.json().catch(() => null);
          const code = err?.error;
          const msg = err?.message;
          if (code === 'SUBSCRIPTION_REQUIRED' || code === 'QUOTA_EXCEEDED') {
            const quotaMsg =
              /quota|exceeded|crédits|insuffisant/i.test(String(msg || ''))
                ? (msg || fallbackMessage)
                : fallbackMessage;
            throw new Error(quotaMsg);
          }
          throw new Error(msg || fallbackMessage);
        } catch (e) {
          throw new Error(fallbackMessage);
        }
      }

      // ⚠️ CRITICAL: Image generation is now INDEPENDENT from listing
      // The listing can be generated separately in the "Listing" tab
      // This allows users to generate images without needing a listing first
      
      // Compresser le fond si présent (512x512 car utilisé uniquement pour description GPT-4o)
      let backgroundBase64: string | undefined;
      if (backgroundImage) {
        backgroundBase64 = await compressImageToBase64(backgroundImage, 512, 512, 0.6);
        console.log('[IMAGE GENERATION] ✅ Background image compressed:', Math.round(backgroundBase64.length / 1024), 'KB');
      }

      // Up to 2 extra references (total 3 with source) to mimic quick-generate flow.
      const extraReferenceImages: string[] = [];
      for (let i = 0; i < Math.min(extraSourceImages.length, 2); i++) {
        try {
          const compressed = await compressImageToBase64(extraSourceImages[i], 512, 512, 0.6);
          extraReferenceImages.push(compressed);
        } catch {
          const fallbackPreview = extraSourcePreviews[i];
          if (fallbackPreview && fallbackPreview.startsWith('data:image/')) {
            extraReferenceImages.push(fallbackPreview);
          }
        }
      }

      console.log('[IMAGE GENERATION] 📊 Generating images independently', creditsToDeduct, 'crédits', backgroundBase64 ? '(with custom background)' : '');
      
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
          engine,
          style,
          productTitle: analysis.product.title || undefined,
          productContext: {
            title: analysis.product.title || '',
            referenceImages: extraReferenceImages,
          },
          skipCreditDeduction: true,
          skipListingGeneration: true, // ⚠️ ALWAYS true — crédits déduits côté client (voir image-listing-credits)
        }),
      });

      if (!response.ok) {
        // Some Next/Netlify failures may return HTML (not JSON). In that case, response.json()
        // would throw and we'd lose the real reason. We fallback to response.text().
        let errorMessage = `Erreur ${response.status}`;
        let errorData: any = null;
        let rawText = '';

        try {
          rawText = await response.text();
          if (rawText) {
            // Try parse JSON from the returned body (sometimes it is JSON with non-2xx).
            try {
              errorData = JSON.parse(rawText);
            } catch {
              // keep errorData null
            }
          }
        } catch {
          // ignore - we'll use status only
        }

        if (errorData && typeof errorData === 'object') {
          // Prefer human-readable messages over error codes.
          errorMessage =
            (typeof errorData.message === 'string' && errorData.message) ||
            (typeof errorData.detail === 'string' && errorData.detail) ||
            (typeof errorData.error === 'string' && errorData.error) ||
            `Erreur ${response.status}`;
        } else if (response.status === 413) {
          errorMessage = "Image trop lourde (payload trop grand). Essaie avec une image plus petite.";
        } else if (rawText && rawText.trim().length > 0) {
          // Keep it short to avoid dumping HTML.
          const snippet = rawText.trim().slice(0, 180);
          errorMessage = `Erreur ${response.status}: ${snippet}`;
        }

        console.error('[IMAGE GENERATION] API Error:', response.status, errorData || rawText || '(empty)');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[IMAGE GENERATION] Response:', data);
      
      if (data.error) {
        const details = data.details ? ` Détails: ${Array.isArray(data.details) ? data.details.join(', ') : data.details}` : '';
        throw new Error(`${data.error}${details}`);
      }
      
      // Gemini/Imagen : l’API renvoie directement imageDataUrls (pas de polling)
      const imageDataUrls: string[] = data.imageDataUrls || [];
      if (imageDataUrls.length > 0) {
        const validImages = imageDataUrls.map((url, i) => ({ id: `img-${Date.now()}-${i}`, url }));
        setGeneratedImages(validImages);
        setHasGeneratedImage(true);
        const refreshCredits = async () => {
          try {
            await refreshSubscription(true);
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('subscription-refresh'));
          } catch (err) {
            console.error('[IMAGE GENERATION] Refresh subscription error:', err);
          }
        };
        setTimeout(() => { refreshCredits(); setTimeout(refreshCredits, 1000); setTimeout(refreshCredits, 2000); }, 3000);
        persistGeneratedImages(validImages);
        if (data.warning) console.warn('[IMAGE GENERATION]', data.warning);
        return;
      }
      
      // NanoBanana : API renvoie taskIds.
      // On ne doit pas "bloquer" l'UI en attendant que tout soit prêt.
      // Ici on poll en background et on affiche dès qu'une image est prête.
      const taskIds: string[] = data.imageTaskIds || [];
      if (taskIds.length === 0) {
        throw new Error('Aucune image soumise. Réessayez.');
      }

      console.log('[IMAGE GENERATION] Polling (background) for', taskIds.length, 'image(s)...');

      const POLL_INTERVAL_MS = getImagePollIntervalMs(quantity);
      const MAX_POLL_ATTEMPTS = getImagePollMaxAttempts(quantity);

      const refreshCredits = async () => {
        try {
          console.log('[IMAGE GENERATION] 🔄 Refreshing subscription credits...');
          await refreshSubscription(true);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('subscription-refresh'));
          }
          console.log('[IMAGE GENERATION] ✅ Subscription refreshed');
        } catch (err) {
          console.error('❌ [IMAGE GENERATION] Error refreshing subscription after image generation:', err);
        }
      };

      const readyImages: { id: string; url: string }[] = [];
      let completedCount = 0;

      // Start pollers without awaiting them.
      for (const taskId of taskIds) {
        (async () => {
          for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            try {
              const res = await fetch(`/api/check-image-status?taskId=${encodeURIComponent(taskId)}`, {
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (!res.ok) continue;
              const s = await res.json();

              if (s.status === 'ready' && s.url) {
                const img = {
                  id: `img-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                  url: s.url as string,
                };
                readyImages.push(img);
                setGeneratedImages([...readyImages]);
                setHasGeneratedImage(true);
                setError(null);
                persistGeneratedImages([...readyImages]);
                return;
              }

              if (s.status === 'error') return;
            } catch {
              // retry
            }
          }

          // Task not ready within attempts
          completedCount += 1;
          if (completedCount === taskIds.length) {
            const failedCount = taskIds.length - readyImages.length;
            if (readyImages.length === 0) {
              setError('Aucune image générée. Réessayez.');
            } else if (failedCount > 0) {
              setError(`${failedCount} image(s) n'ont pas pu être générée(s). ${readyImages.length} image(s) générée(s) avec succès.`);
            }
          }
        })();
      }

      // Wait 3 seconds for database sync, then refresh multiple times
      console.log('[IMAGE GENERATION] ⏳ Waiting 3 seconds for database sync before refreshing credits...');
      setTimeout(() => {
        console.log('[IMAGE GENERATION] 🔄 Starting credit refresh sequence...');
        refreshCredits();
        setTimeout(refreshCredits, 1000);
        setTimeout(refreshCredits, 2000);
        setTimeout(refreshCredits, 3000);
      }, 3000);

      if (data.warning) console.warn('[IMAGE GENERATION]', data.warning);
    } catch (err: any) {
      console.error('Error generating images:', err);
      const rawMessage = (err?.message || 'Erreur lors de la génération des images') as string;
      if (isTechnicalError(rawMessage)) {
        setError(null);
      } else {
        setError(rawMessage);
      }
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
                      alt="Image source"
                      className="w-full h-48 object-cover rounded-lg mb-3 bg-white/5"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const t = e.target as HTMLImageElement;
                        t.onerror = null;
                        t.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect fill="%231a1a1a" width="400" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23666" font-size="14">Image source</text></svg>');
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceImage(null);
                        setSourceImagePreview(null);
                        setExtraSourceImages([]);
                        setExtraSourcePreviews([]);
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

              {/* Extra reference images (up to 2) */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-white/60">
                    Références supplémentaires (optionnel) - max 2
                  </p>
                  <button
                    type="button"
                    onClick={() => extraSourceInputRef.current?.click()}
                    disabled={extraSourceImages.length >= 2}
                    className="text-xs px-2 py-1 rounded border border-white/20 text-white/80 disabled:opacity-40"
                  >
                    + Ajouter
                  </button>
                  <input
                    ref={extraSourceInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    multiple
                    onChange={handleExtraSourceInputChange}
                    className="hidden"
                  />
                </div>
                {extraSourcePreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {extraSourcePreviews.map((preview, idx) => (
                      <div key={`extra-ref-${idx}`} className="relative rounded-lg overflow-hidden border border-white/10">
                        <img src={preview} alt={`Référence ${idx + 1}`} className="w-full h-20 object-cover bg-white/5" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeExtraSourceAt(idx);
                          }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                          title="Supprimer la référence"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
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
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 5, 7].map((qty) => (
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
                    <p className="text-xs text-white/70">
                      Image-to-Image • {engine === 'flash' ? 'Flash (rapide)' : 'Pro (qualité maximale)'}
                    </p>
                  </div>
                  <Sparkles size={20} className="text-[#00d4ff]" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEngine('flash')}
                    className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      engine === 'flash'
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg'
                        : 'bg-black border border-white/10 text-white hover:border-white/20'
                    }`}
                    type="button"
                  >
                    Flash
                  </button>
                  <button
                    onClick={() => setEngine('pro')}
                    className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      engine === 'pro'
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg'
                        : 'bg-black border border-white/10 text-white hover:border-white/20'
                    }`}
                    type="button"
                  >
                    Pro
                  </button>
                </div>
              </div>
            </div>

            {/* G. Image Style */}
            <div>
              <label className="mb-1 block text-sm font-bold text-white">Style d&apos;image</label>
              <p className="mb-3 text-xs text-zinc-500">
                « Aucun style » = sans preset d’ambiance. Sinon 11 thèmes — comme la génération rapide (scroll si besoin).
              </p>
              <ImageStyleCards value={style} onChange={setStyle} variant="compact" />
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
                    <span className="ml-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">
                      {formatCredits(creditsToDeduct)} {creditLabel(creditsToDeduct)}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RÉSULTATS - Full width en dessous */}
        <div className="bg-black rounded-xl border border-white/10">
          <div className="p-6">
            {/* Message d'erreur — jamais afficher les erreurs techniques (failedImages/failedCount is not defined) */}
            {displayError && !isTechnicalError(displayError) && (
              <div className="mb-4 p-4 rounded-lg bg-black border border-red-500/50">
                <p className="text-sm text-red-400">{displayError}</p>
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
                    <p className="text-sm text-white/60 py-4">Les images n'ont pas été enregistrées. Vous pouvez relancer une génération ci-dessus.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {generatedImages.map((img, index) => (
                        <motion.div
                          key={img.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="group relative flex flex-col rounded-xl border border-white/10 bg-black transition-all hover:border-white/20"
                        >
                          <div className="relative aspect-square overflow-hidden rounded-t-xl">
                            <img
                              src={img.url}
                              alt={`Image ${index + 1} générée`}
                              className="h-full w-full bg-white/5 object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                console.error('Error loading image:', img.url);
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="%231a1a1a" width="400" height="400"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23666" font-family="sans-serif" font-size="16">Image indisponible</text></svg>');
                              }}
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                            <div className="absolute right-2 top-2 flex gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                              <button
                                onClick={() => setFullscreenImage(img.url)}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/80 transition-colors hover:bg-black sm:h-8 sm:w-8"
                              >
                                <Maximize2 size={18} className="text-white sm:h-4 sm:w-4" />
                              </button>
                              <button
                                onClick={() => downloadImage(img.url, index)}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/80 transition-colors hover:bg-black sm:h-8 sm:w-8"
                              >
                                <Download size={18} className="text-white sm:h-4 sm:w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="rounded-b-xl bg-black px-2 pb-2">
                            <ImageAltTextPanel imageUrl={img.url} />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

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
                  <ImageIcon size={64} className="text-white/40 mb-4" />
                  <p className="text-lg font-semibold text-white mb-2">
                    Prêt à créer
                  </p>
                  <p className="text-sm text-white/60 text-center max-w-md">
                    Uploadez une image produit et choisissez un format
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
              alt="Agrandir"
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
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

