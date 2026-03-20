'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  Maximize2, 
  Loader2,
  Image as ImageIcon,
  X,
  Sparkles,
  FileText,
  Copy,
  Check,
  Hash,
  Package,
  Zap,
  RotateCcw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSubscription } from '@/hooks/useSubscription';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageAltTextPanel } from '@/components/dashboard/ImageAltTextPanel';
import { getImagePollDeadlineMs, getImagePollIntervalMs } from '@/lib/image-gen-polling';
import {
  imagesOnlyTotalCredits,
  quickGenerateTotalCredits,
  roundCreditsToTenth,
} from '@/lib/image-listing-credits';

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
type ImageEngine = 'flash' | 'pro';
type ImageStyle = 'realistic' | 'studio' | 'lifestyle' | 'illustration';

interface GeneratedImage {
  url: string;
  id: string;
}

interface ListingData {
  title: string;
  description: string;
  tags: string[];
  materials: string;
}

const QUOTA_MESSAGE_FR = 'Crédits insuffisants. Passe à un plan supérieur ou attends le prochain cycle.';
function normalizeQuotaMessage(msg: string | undefined | null): string {
  if (!msg) return QUOTA_MESSAGE_FR;
  if (/the quota has been exceeded|quota.*exceeded|crédits.*insuffisant/i.test(msg)) return QUOTA_MESSAGE_FR;
  return msg;
}

// Tarifs : src/lib/image-listing-credits.ts (listing + prix / image flash ou pro)
const roundToTenth = roundCreditsToTenth;
const formatCredits = (n: number) => {
  const rounded = roundToTenth(n);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded.toFixed(1)).replace(/\.0$/, '');
};
const creditLabel = (n: number) => (roundToTenth(n) === 1 ? 'crédit' : 'crédits');

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

export function DashboardQuickGenerate() {
  const { refreshSubscription } = useSubscription();
  // Clé unique pour la génération rapide dans sessionStorage
  const storageKey = 'etsmart-quick-generate-completed';
  
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(null);
  const [extraSourceImages, setExtraSourceImages] = useState<File[]>([]);
  const [extraSourcePreviews, setExtraSourcePreviews] = useState<string[]>([]);
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [backgroundImagePreview, setBackgroundImagePreview] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(5);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [engine, setEngine] = useState<ImageEngine>('flash');
  const [style, setStyle] = useState<ImageStyle>('realistic');
  const imagesOnlyCredits = imagesOnlyTotalCredits(quantity, engine);
  const quickGenerateCredits = quickGenerateTotalCredits(quantity, engine);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [listingData, setListingData] = useState<ListingData | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);
  const [copiedDescription, setCopiedDescription] = useState(false);
  const [copiedMaterials, setCopiedMaterials] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isRegeneratingImages, setIsRegeneratingImages] = useState(false);
  const [pendingImagesCount, setPendingImagesCount] = useState(0);

  // Éviter QuotaExceeded : ne pas sauver les images en base64 (trop lourd) dans sessionStorage
  const saveImagesToSession = useCallback((images: GeneratedImage[]) => {
    if (typeof window === 'undefined') return;
    try {
      const json = JSON.stringify(images);
      const maxBytes = 1.5 * 1024 * 1024; // ~1,5 Mo (sessionStorage ~5 Mo total)
      if (json.length > maxBytes) return; // images en data URL = trop volumineux, on ne persiste pas
      sessionStorage.setItem(`${storageKey}-images`, json);
    } catch {
      // QuotaExceededError ou autre : on ignore, les images restent en state
    }
  }, [storageKey]);

  // Vérifier au montage si une génération rapide a déjà été effectuée
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(storageKey);
      if (saved === 'true') {
        setHasGenerated(true);
        // Si on a des données sauvegardées, les restaurer aussi
        const savedImages = sessionStorage.getItem(`${storageKey}-images`);
        const savedListing = sessionStorage.getItem(`${storageKey}-listing`);
        if (savedImages) {
          try {
            const raw = JSON.parse(savedImages);
            const images: GeneratedImage[] = Array.isArray(raw)
              ? raw
                  .filter((img: any) => img && typeof img.url === 'string')
                  .map((img: any, i: number) => ({ id: img.id && typeof img.id === 'string' ? img.id : `saved-${i}`, url: img.url }))
              : [];
            setGeneratedImages(images);
          } catch (e) {
            console.error('Error parsing saved images:', e);
          }
        }
        if (savedListing) {
          try {
            const raw = JSON.parse(savedListing);
            const listing: ListingData = {
              title: typeof raw?.title === 'string' ? raw.title : '',
              description: typeof raw?.description === 'string' ? raw.description : '',
              tags: Array.isArray(raw?.tags) ? raw.tags : (typeof raw?.tags === 'string' ? raw.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []),
              materials: typeof raw?.materials === 'string' ? raw.materials : (raw?.materials != null ? String(raw.materials) : ''),
            };
            setListingData(listing);
          } catch (e) {
            console.error('Error parsing saved listing:', e);
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
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      if (files.length) handleFileSelect(files);
    }
  }, []);

  const handleFileSelect = (incoming: File | File[]) => {
    const files = Array.isArray(incoming) ? incoming : [incoming];
    const existing: File[] = sourceImage ? [sourceImage] : [];
    if (extraSourceImages.length) existing.push(...extraSourceImages);
    const merged = [...existing, ...files].filter((f) => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024).slice(0, 3);
    if (merged.length === 0) {
      alert('Ajoute au moins une image (JPG/PNG, max 10 Mo).');
      return;
    }
    const [main, ...rest] = merged;
    setSourceImage(main);
    const reader = new FileReader();
    reader.onload = (e) => setSourceImagePreview(e.target?.result as string);
    reader.readAsDataURL(main);
    setExtraSourceImages(rest);
    if (rest.length === 0) {
      setExtraSourcePreviews([]);
    } else {
      Promise.all(
        rest.map((file) => new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve((r.result as string) || '');
          r.readAsDataURL(file);
        }))
      ).then((urls) => setExtraSourcePreviews(urls));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(Array.from(e.target.files));
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

  const generateEverything = async () => {
    if (!sourceImagePreview) {
      alert('Veuillez sélectionner une image source');
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);
    setListingData(null);
    setError(null);
    setPendingImagesCount(0);

    try {
      let imageBase64: string;
      if (sourceImage) {
        imageBase64 = await compressImageToBase64(sourceImage, 512, 512, 0.6);
      } else {
        imageBase64 = sourceImagePreview!;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Authentification requise pour utiliser la génération rapide.');
        setIsGenerating(false);
        return;
      }

      // Vérifier quota via serveur
      const quotaCheck = await fetch('/api/deduct-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: quickGenerateCredits, reason: 'quick-generate' }),
      });
      if (!quotaCheck.ok) {
        let fallbackMessage = 'Crédits insuffisants ou erreur de quota.';
        try {
          const err = await quotaCheck.json();
          const code = err?.error;
          const msg = err?.message;
          if (code === 'SUBSCRIPTION_REQUIRED' || code === 'QUOTA_EXCEEDED') {
            const quotaMsg = /quota|exceeded|crédits|insuffisant/i.test(String(msg)) ? (msg || fallbackMessage) : 'Crédits insuffisants. Passe à un plan supérieur ou attends le prochain cycle.';
            setError(quotaMsg);
            setIsGenerating(false);
            return;
          }
          // Pour les autres erreurs (ex: INTERNAL_ERROR), on ignore simplement côté UI
        } catch {
          // ignore JSON parse error, continuer la génération
        }
      }

      console.log('[QUICK GENERATE] 🚀 Generating listing then images...');

      // 1) LISTING d'abord (pour avoir le type de produit et adapter le décor)
      const listingResponse = await fetch('/api/generate-listing-and-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sourceImage: imageBase64 }),
      });

      // Parser listing – si échec, on arrête tout (on ne génère PAS les images seules)
      let listing: ListingData | null = null;
      if (!listingResponse.ok) {
        let message = 'Erreur lors de la génération du listing. Réessayez.';
        try {
          const lr = await listingResponse.json();
          if (lr?.message || lr?.error) {
            message = lr.message || lr.error || message;
          }
        } catch {
          // ignore parse error, garder message par défaut
        }
        setError(message);
        setIsGenerating(false);
        return;
      } else {
        try {
          const lr = await listingResponse.json();
          if (lr?.listing) {
            listing = {
              title: lr.listing.title || '',
              description: lr.listing.description || '',
              tags: lr.listing.tags || [],
              materials: lr.listing.materials || '',
            };
          }
        } catch {
          setError('Réponse listing invalide. Réessayez.');
          setIsGenerating(false);
          return;
        }
      }

      if (!listing) {
        setError('Impossible de générer le listing. Réessayez dans quelques instants.');
        setIsGenerating(false);
        return;
      }

      // On n’affiche rien tant qu’on n’a pas listing + images (ou erreur) pour tout montrer en même temps
      // 2) Images via le backend
      const imagePayload = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
      const imagesResponse = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          sourceImage: imagePayload,
          quantity,
          aspectRatio,
          productTitle: listing.title || '',
          tags: listing.tags,
          materials: listing.materials,
          engine,
          style,
          skipCreditDeduction: true,
          productContext: {
            title: listing.title || '',
            category: '',
            niche: '',
            referenceImages: extraSourcePreviews.slice(0, 2),
          },
        }),
      });

      let imagesData: any = {};
      try {
        imagesData = await imagesResponse.json();
      } catch {
        imagesData = {};
      }
      const imageTaskIds: string[] = imagesData?.imageTaskIds ?? [];
      const imageDataUrls: string[] = imagesData?.imageDataUrls ?? [];
      const apiMessage = imagesData?.message;

      if (!imagesResponse.ok) {
        const code = imagesData?.error;
        const msg = apiMessage || 'Erreur lors de la soumission des images.';
        if (imagesResponse.status === 403 && (code === 'SUBSCRIPTION_REQUIRED' || code === 'QUOTA_EXCEEDED')) {
          const quotaMsg = /quota|exceeded|crédits|insuffisant/i.test(String(msg)) ? msg : 'Crédits insuffisants. Passe à un plan supérieur ou attends le prochain cycle.';
          setError(quotaMsg);
          setIsGenerating(false);
          return;
        }
        setListingData(listing);
        setGeneratedImages([]);
        setHasGenerated(true);
        setError(msg || 'La génération des images a échoué. Vous pouvez utiliser le listing et réessayer les images plus tard.');
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, 'true');
          sessionStorage.setItem(`${storageKey}-listing`, JSON.stringify(listing));
          sessionStorage.removeItem(`${storageKey}-images`);
        }
        return;
      }

      console.log(`[QUICK GENERATE] Listing OK, images submitted: ${imageTaskIds.length} taskIds, ${imageDataUrls.length} dataUrls`);

      if (imageDataUrls.length > 0) {
        const directImages: GeneratedImage[] = imageDataUrls.map((url, i) => ({ id: `img-${Date.now()}-${i}`, url }));
        setListingData(listing);
        setGeneratedImages(directImages);
        setHasGenerated(true);
        setError(directImages.length < quantity ? `Vous avez reçu ${directImages.length} image(s) sur ${quantity}.` : null);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, 'true');
          sessionStorage.setItem(`${storageKey}-listing`, JSON.stringify(listing));
          saveImagesToSession(directImages);
        }
        setTimeout(() => {
          refreshSubscription(true);
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('subscription-refresh'));
        }, 3000);
        return;
      }

      if (imageTaskIds.length === 0) {
        setListingData(listing);
        setGeneratedImages([]);
        setHasGenerated(true);
        setError(apiMessage || 'La génération des images a échoué. Aucun visuel n\'a pu être soumis. Utilisez le listing puis « Générer de nouvelles images » pour réessayer.');
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, 'true');
          sessionStorage.setItem(`${storageKey}-listing`, JSON.stringify(listing));
          sessionStorage.removeItem(`${storageKey}-images`);
        }
        return;
      }

      let allImages: GeneratedImage[] = [];
      setPendingImagesCount(imageTaskIds.length);
      const deadline = Date.now() + getImagePollDeadlineMs(quantity);
      const pollMs = getImagePollIntervalMs(quantity);

      const results = await Promise.all(imageTaskIds.map(async (taskId, idx) => {
        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, pollMs));
          if (Date.now() >= deadline) break;
          try {
            const res = await fetch(`/api/check-image-status?taskId=${encodeURIComponent(taskId)}`);
            if (!res.ok) continue;
            const data = await res.json();
            if (data.status === 'ready' && data.url && String(data.url).startsWith('http')) {
              setPendingImagesCount(c => Math.max(0, c - 1));
              return { id: `img-${Date.now()}-${idx}`, url: data.url } as GeneratedImage;
            }
            if (data.status === 'error') return null;
          } catch { /* retry */ }
        }
        return null;
      }));
      allImages = results.filter((r): r is GeneratedImage => r !== null);
      setPendingImagesCount(0);

      // Tout afficher en même temps : listing + images (ou message)
      setListingData(listing);
      if (allImages.length === 0) {
        setGeneratedImages([]);
        setHasGenerated(true);
        setError('La génération des images a échoué. Les visuels ne sont pas encore prêts. Cliquez sur « Générer de nouvelles images » pour relancer.');
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, 'true');
          sessionStorage.setItem(`${storageKey}-listing`, JSON.stringify(listing));
          sessionStorage.removeItem(`${storageKey}-images`);
        }
      } else {
        setGeneratedImages(allImages);
        setHasGenerated(true);
        setError(allImages.length < quantity ? `Vous avez reçu ${allImages.length} image${allImages.length > 1 ? 's' : ''} sur ${quantity}. Cliquez sur « Générer de nouvelles images » pour en ajouter.` : null);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, 'true');
          sessionStorage.setItem(`${storageKey}-listing`, JSON.stringify(listing));
          saveImagesToSession(allImages);
        }
      }

      setTimeout(() => {
        refreshSubscription(true);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('subscription-refresh'));
      }, 3000);
      
    } catch (error: any) {
      console.error('Error generating:', error);
      setError(error.message || 'Erreur lors de la génération');
      setGeneratedImages([]);
      setListingData(null);
    } finally {
      setIsGenerating(false);
    }
  };

  // Compteur de régénérations pour varier les scènes à chaque clic
  const regenCountRef = useRef(0);

  const regenerateImages = async () => {
    if (!sourceImagePreview || typeof sourceImagePreview !== 'string' || sourceImagePreview.length < 50) {
      setError('Aucune image source valide. Importe une photo du produit ci-dessus.');
      return;
    }

    setIsRegeneratingImages(true);
    setError(null);

    try {
      let imageBase64: string;
      if (sourceImage) {
        try {
          imageBase64 = await compressImageToBase64(sourceImage, 512, 512, 0.6);
        } catch (e) {
          setError('Impossible de lire l’image. Réimporte une photo.');
          setIsRegeneratingImages(false);
          return;
        }
      } else {
        imageBase64 = String(sourceImagePreview).trim();
      }
      if (!imageBase64 || imageBase64.length < 50) {
        setError('Image source invalide. Réimporte une photo du produit.');
        setIsRegeneratingImages(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setError('Authentification requise. Reconnecte-toi.');
        setIsRegeneratingImages(false);
        return;
      }

      // Deduct credits côté client (pricing dépend de engine + quantity)
      const creditsToDeduct = imagesOnlyCredits;
      const quotaCheck = await fetch('/api/deduct-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: creditsToDeduct, reason: 'quick-generate-images-only' }),
      });

      if (!quotaCheck.ok) {
        let fallbackMessage = 'Crédits insuffisants ou erreur de quota.';
        try {
          const err = await quotaCheck.json();
          const code = err?.error;
          const msg = err?.message;
          if (code === 'SUBSCRIPTION_REQUIRED' || code === 'QUOTA_EXCEEDED') {
            const quotaMsg =
              /quota|exceeded|crédits|insuffisant/i.test(String(msg)) ? (msg || fallbackMessage) : fallbackMessage;
            setError(normalizeQuotaMessage(quotaMsg));
            setIsRegeneratingImages(false);
            return;
          }
        } catch {
          // ignore JSON parse errors
        }
        setError(normalizeQuotaMessage(fallbackMessage));
        setIsRegeneratingImages(false);
        return;
      }

      // Compresser le fond si présent (512x512 car utilisé uniquement pour description)
      let bgBase64: string | undefined;
      if (backgroundImage) {
        try {
          bgBase64 = await compressImageToBase64(backgroundImage, 512, 512, 0.6);
        } catch {
          bgBase64 = undefined;
        }
      }

      const safeTags = listingData?.tags != null && Array.isArray(listingData.tags) ? listingData.tags : [];
      const safeMaterials = listingData?.materials != null ? String(listingData.materials) : '';

      regenCountRef.current++;
      console.log(`[QUICK GENERATE] 🔄 Regenerating images (round ${regenCountRef.current})...`, bgBase64 ? '(with custom background)' : '');

      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceImage: imageBase64,
          backgroundImage: bgBase64,
          quantity,
          aspectRatio,
          engine,
          style,
          productTitle: listingData?.title || undefined,
          tags: safeTags,
          materials: safeMaterials,
          skipCreditDeduction: true,
          productContext: {
            title: listingData?.title || '',
            category: '',
            niche: '',
            referenceImages: extraSourcePreviews.slice(0, 2),
          },
          customInstructions: bgBase64 
            ? `Use the provided custom background image as the ONLY background. Place the product naturally into this exact background scene. Try a different camera angle or product placement (variation seed: ${Date.now()}).`
            : `Each image MUST have a COMPLETELY DIFFERENT background from the others. The background MUST be appropriate for this specific product — choose a setting where this product would naturally be found or displayed. Every image must look unique. (variation seed: ${Date.now()})`,
        }),
      });

      if (!response.ok) {
        let errorData: any;
        try {
          const text = await response.text();
          errorData = text ? JSON.parse(text) : { error: 'Erreur inconnue' };
        } catch {
          errorData = { error: `Erreur ${response.status}: ${response.statusText}` };
        }
        const message =
          errorData.message ||
          (errorData.error === 'IMAGE_SUBMIT_FAILED'
            ? 'Le service d\'images n\'a pas accepté la requête. Vérifie GEMINI_API_KEY côté serveur (recommandé), ou la clé Nanobanana si tu forces ce fournisseur.'
            : errorData.error) || `Erreur ${response.status}`;
        setError(message);
        setIsRegeneratingImages(false);
        return;
      }

      let data: any = {};
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error('[QUICK GENERATE] Invalid JSON from generate-images:', parseErr);
        setError('Réponse du serveur invalide. Réessayez.');
        setIsRegeneratingImages(false);
        return;
      }
      console.log('[QUICK GENERATE] Regenerated images (tasks):', data);

      const taskIds: string[] = Array.isArray(data.imageTaskIds) ? data.imageTaskIds : [];
      const dataUrls: string[] = Array.isArray(data.imageDataUrls) ? data.imageDataUrls : [];

      if (dataUrls.length > 0) {
        const newImages: GeneratedImage[] = dataUrls
          .filter((url): url is string => typeof url === 'string' && url.length > 10)
          .map((url, i) => ({ id: `regen-${Date.now()}-${i}`, url }));
        setGeneratedImages(prev => {
          const next = [...prev, ...newImages];
          if (typeof window !== 'undefined') saveImagesToSession(next);
          return next;
        });
      } else if (taskIds.length === 0) {
        setError(data.message || data.error || 'La génération d\'images a échoué. Réessayez.');
      } else {
        const deadline = Date.now() + getImagePollDeadlineMs(quantity);
        const pollMs = getImagePollIntervalMs(quantity);

        const polled = await Promise.all(
          taskIds.map(async (taskId, idx) => {
            while (Date.now() < deadline) {
              await new Promise((r) => setTimeout(r, pollMs));
              try {
                const res = await fetch(`/api/check-image-status?taskId=${encodeURIComponent(taskId)}`);
                if (!res.ok) continue;
                const statusData = await res.json();
                if (statusData.status === 'ready' && statusData.url && String(statusData.url).startsWith('http')) {
                  return { id: `regen-${Date.now()}-${idx}`, url: statusData.url } as GeneratedImage;
                }
                if (statusData.status === 'error') return null;
              } catch {
                /* retry */
              }
            }
            return null;
          })
        );
        const newImages = polled.filter((r): r is GeneratedImage => r !== null);

        if (newImages.length > 0) {
          setGeneratedImages(prev => {
            const next = [...prev, ...newImages];
            if (typeof window !== 'undefined') saveImagesToSession(next);
            return next;
          });
        } else {
          setError('La génération d\'images a échoué. Réessayez.');
        }
      }

      // Refresh subscription
      setTimeout(() => {
        refreshSubscription(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('subscription-refresh'));
        }
      }, 3000);

    } catch (error: any) {
      console.error('Error regenerating images:', error);
      const msg = error?.message && typeof error.message === 'string' ? error.message : 'Erreur lors de la régénération des images';
      setError(normalizeQuotaMessage(msg));
    } finally {
      setIsRegeneratingImages(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'title' | 'tags' | 'description' | 'materials') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'title') {
        setCopiedTitle(true);
        setTimeout(() => setCopiedTitle(false), 2000);
      } else if (type === 'tags') {
        setCopiedTags(true);
        setTimeout(() => setCopiedTags(false), 2000);
      } else if (type === 'description') {
        setCopiedDescription(true);
        setTimeout(() => setCopiedDescription(false), 2000);
      } else if (type === 'materials') {
        setCopiedMaterials(true);
        setTimeout(() => setCopiedMaterials(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadImage = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etsmart-image-${index + 1}.png`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
          window.URL.revokeObjectURL(url);
        }, 100);
      } else {
        window.open(imageUrl, '_blank');
      }
    } catch (error: any) {
      console.error('[DOWNLOAD] Error downloading image:', error);
      window.open(imageUrl, '_blank');
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
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center shadow-lg shadow-[#00d4ff]/25 flex-shrink-0">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Génération rapide</h1>
            <p className="text-white/60 text-sm sm:text-base max-w-xl">
              Générez le listing et les images en une seule fois à partir d’un seul screenshot produit.
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] mb-6 overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Screenshot du produit
                </label>
                <p className="text-xs text-white/50 mb-2">
                  Jusqu&apos;à 3 images (elles s&apos;ajoutent) : 1 vue générale, 1 détail/intérieur, 1 avec dimensions si dispo.
                </p>
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? 'border-[#00d4ff] bg-[#00d4ff]/10'
                      : 'border-white/20 hover:border-[#00c9b7]/50 hover:bg-white/[0.02] bg-black/40'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
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
                      {extraSourcePreviews.length > 0 && (
                        <div className="flex gap-2 mb-3">
                          {extraSourcePreviews.slice(0, 2).map((preview, idx) => (
                            <img key={idx} src={preview} alt={`Ref ${idx + 2}`} className="w-16 h-16 object-cover rounded-md border border-white/10" />
                          ))}
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSourceImage(null);
                          setSourceImagePreview(null);
                          setExtraSourceImages([]);
                          setExtraSourcePreviews([]);
                          setGeneratedImages([]);
                          setListingData(null);
                          setError(null);
                          // Réinitialiser le statut de génération si on supprime l'image
                          setHasGenerated(false);
                          if (typeof window !== 'undefined') {
                            sessionStorage.removeItem(storageKey);
                            sessionStorage.removeItem(`${storageKey}-images`);
                            sessionStorage.removeItem(`${storageKey}-listing`);
                          }
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                        title="Supprimer l'image source"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                        <Upload size={28} className="text-[#00c9b7]" />
                      </div>
                      <p className="text-sm text-white/80 mb-1">
                        Glissez-déposez un screenshot ou cliquez pour sélectionner
                      </p>
                      <p className="text-xs text-white/50">
                        JPG / PNG • Max 10MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-5">
                {/* Background Image Upload (optionnel) */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Fond personnalisé <span className="text-white/40 font-normal">(optionnel)</span>
                  </label>
                  <p className="text-xs text-white/50 mb-3">
                    Uploadez une image de fond pour que le produit y soit intégré
                  </p>
                  <div
                    onClick={() => backgroundInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 ${
                      backgroundImagePreview
                        ? 'border-[#00d4ff]/50 bg-[#00d4ff]/10'
                        : 'border-white/15 hover:border-[#00c9b7]/40 hover:bg-white/[0.02] bg-black/40'
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
                          className="w-full h-24 object-cover rounded-lg"
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
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                          <ImageIcon size={20} className="text-[#00c9b7]" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-white/70">
                            Cliquez pour ajouter un fond
                          </p>
                          <p className="text-[10px] text-white/40">
                            JPG / PNG • Max 10MB
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-3">
                    Quantité d'images
                  </label>
                  <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
                    {[1, 2, 5, 7].map((qty) => (
                      <button
                        key={qty}
                        onClick={() => setQuantity(qty)}
                        className={`min-w-0 flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                          quantity === qty
                            ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg shadow-[#00d4ff]/25'
                            : 'bg-white/5 border border-white/10 text-white/80 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-white/45">
                    7 images : génération en parallèle côté serveur, attente max ~2 min si le fournisseur est lent.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-3">
                    Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['1:1', '16:9', '9:16', '4:3', '3:4'] as AspectRatio[]).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                          aspectRatio === ratio
                            ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg shadow-[#00d4ff]/25'
                            : 'bg-white/5 border border-white/10 text-white/80 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {ratio}
                        {ratio === '1:1' && ' (Etsy)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-3">
                    Moteur
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setEngine('flash')}
                      className={`py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                        engine === 'flash'
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg shadow-[#00d4ff]/25'
                          : 'bg-white/5 border border-white/10 text-white/80 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      Flash
                    </button>
                    <button
                      onClick={() => setEngine('pro')}
                      className={`py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                        engine === 'pro'
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg shadow-[#00d4ff]/25'
                          : 'bg-white/5 border border-white/10 text-white/80 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      Pro
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-3">
                    Style d'image
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'realistic', label: 'Photo réaliste' },
                      { id: 'studio', label: 'Studio produit' },
                      { id: 'lifestyle', label: 'Lifestyle' },
                      { id: 'illustration', label: 'Illustration' },
                    ] as { id: ImageStyle; label: string }[]).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setStyle(s.id)}
                        className={`py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                          style === s.id
                            ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg shadow-[#00d4ff]/25'
                            : 'bg-white/5 border border-white/10 text-white/80 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <button
                onClick={generateEverything}
                disabled={isGenerating || !sourceImagePreview || hasGenerated || (generatedImages.length > 0 && !!listingData)}
                className="w-full py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold rounded-2xl hover:opacity-95 hover:shadow-xl hover:shadow-[#00d4ff]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#00d4ff]/25 flex items-center justify-center gap-3"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Génération en cours...
                  </>
                ) : hasGenerated || (generatedImages.length > 0 && !!listingData) ? (
                  <>
                    <Sparkles size={20} />
                    Génération déjà effectuée
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    GÉNÉRER LE LISTING ET LES IMAGES
                    <span className="ml-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">
                      {formatCredits(quickGenerateCredits)} {creditLabel(quickGenerateCredits)}
                    </span>
                  </>
                )}
              </button>
              {!isGenerating && (hasGenerated || (generatedImages.length > 0 && listingData)) && (
                <button
                  onClick={() => {
                    // Reset tout l'état pour permettre une nouvelle génération
                    setHasGenerated(false);
                    setGeneratedImages([]);
                    setListingData(null);
                    setSourceImagePreview(null);
                    setError(null);
                    setPendingImagesCount(0);
                    // Nettoyer sessionStorage
                    if (typeof window !== 'undefined') {
                      Object.keys(sessionStorage).forEach(key => {
                        if (key.startsWith('etsmart-quick-generate-')) {
                          sessionStorage.removeItem(key);
                        }
                      });
                    }
                  }}
                  className="w-full mt-3 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-2xl border border-white/10 hover:border-[#00d4ff]/30 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} />
                  Nouvelle génération
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-xs font-semibold">
                    {formatCredits(quickGenerateCredits)} {creditLabel(quickGenerateCredits)}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error / Warning Message */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg ${
            listingData 
              ? 'bg-amber-500/10 border border-amber-500/50' 
              : 'bg-red-500/10 border border-red-500/50'
          }`}>
            <p className={`text-sm ${listingData ? 'text-amber-400' : 'text-red-400'}`}>{error}</p>
          </div>
        )}

        {/* Results */}
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
                Génération du listing et des images...
              </p>
              <p className="text-sm text-white/70 mt-2">
                Tout arrive en même temps dans quelques secondes
              </p>
            </motion.div>
          ) : (listingData || generatedImages.length > 0) ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Listing Section */}
              {listingData && (
                <div className="space-y-4">
                  {/* Title */}
                  {listingData.title && (
                    <div className="p-5 rounded-xl bg-black border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                            <FileText size={20} className="text-white" />
                          </div>
                          <h2 className="text-base font-bold text-white">Titre SEO optimisé</h2>
                        </div>
                        <button
                          onClick={() => copyToClipboard(listingData.title, 'title')}
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
                        <p className="text-sm font-medium text-white">{listingData.title}</p>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {listingData.description && (
                    <div className="p-5 rounded-xl bg-black border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                            <FileText size={20} className="text-white" />
                          </div>
                          <h3 className="text-base font-bold text-white">Description Etsy</h3>
                        </div>
                        <button
                          onClick={() => copyToClipboard(listingData.description, 'description')}
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
                      <div className="custom-scrollbar max-h-96 overflow-y-auto rounded-lg border border-white/10 bg-black p-4">
                        <pre className="text-sm text-white whitespace-pre-wrap font-sans leading-relaxed">
                          {listingData.description}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {Array.isArray(listingData.tags) && listingData.tags.length > 0 && (
                    <div className="p-5 rounded-xl bg-black border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Hash size={20} className="text-[#00d4ff]" />
                          <h3 className="text-base font-bold text-white">Tags Etsy ({listingData.tags.length}/13)</h3>
                        </div>
                        <button
                          onClick={() => copyToClipboard(listingData.tags.join(', '), 'tags')}
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
                        {listingData.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1.5 rounded-lg bg-black border border-white/10 text-sm text-white/80"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Materials */}
                  {listingData.materials && (
                    <div className="p-5 rounded-xl bg-black border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                            <Package size={20} className="text-white" />
                          </div>
                          <h3 className="text-base font-bold text-white">Matériaux</h3>
                        </div>
                        <button
                          onClick={() => copyToClipboard(listingData.materials, 'materials')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            copiedMaterials 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-black border border-white/10 text-white hover:bg-white/10'
                          }`}
                        >
                          {copiedMaterials ? <Check size={14} /> : <Copy size={14} />}
                          {copiedMaterials ? 'Copié' : 'Copier'}
                        </button>
                      </div>
                      <div className="p-4 rounded-lg bg-black border border-white/10">
                        <p className="text-sm font-medium text-white whitespace-pre-wrap">{listingData.materials}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Images Loading State (listing shown, images loading) */}
              {isGenerating && listingData && generatedImages.length === 0 && (
                <div className="bg-black rounded-xl border border-white/10 p-6">
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 size={36} className="text-[#00d4ff] animate-spin mb-4" />
                    <p className="text-base font-semibold text-white">Génération des images en cours...</p>
                    <p className="text-sm text-white/50 mt-2">Cela peut prendre 20 à 40 secondes</p>
                  </div>
                </div>
              )}

              {/* Listing OK but no images yet: force image generation CTA */}
              {!isGenerating && listingData && generatedImages.length === 0 && (
                <div className="bg-black rounded-xl border border-amber-500/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-2">Aucune image générée</h3>
                  <p className="text-sm text-white/70 mb-4">Le listing est prêt. Génère les images pour compléter.</p>
                  {!sourceImagePreview ? (
                    <>
                      <p className="text-sm text-amber-400/90 mb-4">L’image produit n’est plus disponible (page rechargée). Importe à nouveau une photo du produit ci-dessus pour débloquer le bouton.</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-4 bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold rounded-xl hover:bg-amber-500/30 flex items-center justify-center gap-2"
                      >
                        <Upload size={20} />
                        Importer une image produit
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          regenerateImages();
                        } catch (e) {
                          console.error('[QUICK GENERATE] Regenerate sync error:', e);
                          setError('Erreur inattendue. Réessayez.');
                        }
                      }}
                      disabled={isRegeneratingImages}
                      className="w-full py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold rounded-xl hover:opacity-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRegeneratingImages ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          Génération des images en cours...
                        </>
                      ) : (
                        <>
                          <ImageIcon size={20} />
                          Générer les images
                          <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-xs font-semibold">
                            {formatCredits(imagesOnlyCredits)} {creditLabel(imagesOnlyCredits)}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Images Section */}
              {generatedImages.length > 0 && (
                <div className="bg-black rounded-xl border border-white/10 p-6">
                  <h3 className="text-xl font-bold text-white mb-2">
                    {generatedImages.length} image{generatedImages.length > 1 ? 's' : ''} générée{generatedImages.length > 1 ? 's' : ''}
                  </h3>
                  {pendingImagesCount > 0 && (
                    <p className="text-sm text-[#00d4ff] mb-4 flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      {pendingImagesCount} image{pendingImagesCount > 1 ? 's' : ''} en cours de génération… (jusqu’à ~90 s)
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {generatedImages.filter((img) => img && typeof img.url === 'string' && img.url.length > 0).map((img, index) => (
                      <motion.div
                        key={img.id || `img-${index}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="group relative flex flex-col rounded-xl border border-white/10 bg-black transition-all hover:border-white/20"
                      >
                        <div className="relative aspect-square overflow-hidden rounded-t-xl">
                          <img
                            src={img.url}
                            alt={`Generated ${index + 1}`}
                            className="h-full w-full object-cover"
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

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 mt-6">
                    {/* Download All Button */}
                    {generatedImages.length > 1 && (
                      <button
                        onClick={downloadAllImages}
                        disabled={isDownloadingAll}
                        className="flex-1 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:from-[#00bfe6] hover:to-[#00b5a5] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    )}

                    {/* Regenerate Images Button */}
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          regenerateImages();
                        } catch (e) {
                          console.error('[QUICK GENERATE] Regenerate sync error:', e);
                          setError('Erreur inattendue. Réessayez.');
                        }
                      }}
                      disabled={isRegeneratingImages || !sourceImagePreview}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 hover:border-[#00d4ff]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRegeneratingImages ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Génération en cours...
                        </>
                      ) : (
                        <>
                          <ImageIcon size={18} />
                          Générer de nouvelles images
                          <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-xs font-semibold">
                            {formatCredits(imagesOnlyCredits)} {creditLabel(imagesOnlyCredits)}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
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
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

