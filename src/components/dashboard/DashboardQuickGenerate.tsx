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
  Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSubscription } from '@/hooks/useSubscription';
import { motion, AnimatePresence } from 'framer-motion';

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

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

export function DashboardQuickGenerate() {
  const { refreshSubscription } = useSubscription();
  // Clé unique pour la génération rapide dans sessionStorage
  const storageKey = 'etsmart-quick-generate-completed';
  
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [listingData, setListingData] = useState<ListingData | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);
  const [copiedDescription, setCopiedDescription] = useState(false);
  const [copiedMaterials, setCopiedMaterials] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

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
            const images = JSON.parse(savedImages);
            setGeneratedImages(images);
          } catch (e) {
            console.error('Error parsing saved images:', e);
          }
        }
        if (savedListing) {
          try {
            const listing = JSON.parse(savedListing);
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

  const generateEverything = async () => {
    if (!sourceImagePreview) {
      alert('Veuillez sélectionner une image source');
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);
    setListingData(null);
    setError(null);

    try {
      // Convertir l'image en base64
      let imageBase64 = sourceImagePreview;
      if (sourceImage) {
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(sourceImage);
        });
      }

      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentification requise');
      }

      console.log('[QUICK GENERATE] 📊 Generating listing and images together...');
      
      const response = await fetch('/api/generate-listing-and-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceImage: imageBase64,
          quantity,
          aspectRatio,
        }),
      });

      if (!response.ok) {
        let errorData: any;
        try {
          const text = await response.text();
          errorData = text ? JSON.parse(text) : { error: 'Erreur inconnue' };
        } catch (parseError) {
          errorData = { error: `Erreur ${response.status}: ${response.statusText}` };
        }
        const errorMessage = errorData.error || errorData.message || `Erreur ${response.status}`;
        const errorDetails = errorData.details ? ` Détails: ${typeof errorData.details === 'string' ? errorData.details : JSON.stringify(errorData.details)}` : '';
        console.error('[QUICK GENERATE] API Error:', response.status, errorData);
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      const data = await response.json();
      console.log('[QUICK GENERATE] Response:', data);
      
      if (data.error) {
        const details = data.details ? ` Détails: ${Array.isArray(data.details) ? data.details.join(', ') : data.details}` : '';
        throw new Error(`${data.error}${details}`);
      }
      
      // Mettre à jour les images générées
      let validImages: GeneratedImage[] = [];
      if (data.images && data.images.length > 0) {
        validImages = data.images.filter((img: any) => !img.error && img.url && img.url.trim() !== '');
        console.log('[QUICK GENERATE] Valid images received:', validImages.length, 'out of', data.images.length);
        if (validImages.length > 0) {
          setGeneratedImages(validImages);
        } else {
          console.warn('[QUICK GENERATE] No valid images found in response');
        }
      } else {
        console.warn('[QUICK GENERATE] No images in response or empty array');
      }
      
      // Mettre à jour les données du listing
      let listing: ListingData | null = null;
      if (data.listing) {
        listing = {
          title: data.listing.title || '',
          description: data.listing.description || '',
          tags: data.listing.tags || [],
          materials: data.listing.materials || '',
        };
        setListingData(listing);
      }
      
      // Marquer comme généré et sauvegarder dans sessionStorage
      setHasGenerated(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, 'true');
        if (validImages.length > 0) {
          sessionStorage.setItem(`${storageKey}-images`, JSON.stringify(validImages));
        }
        if (listing) {
          sessionStorage.setItem(`${storageKey}-listing`, JSON.stringify(listing));
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
      console.error('Error generating listing and images:', error);
      setError(error.message || 'Erreur lors de la génération');
      setGeneratedImages([]);
      setListingData(null);
    } finally {
      setIsGenerating(false);
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

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Génération rapide</h1>
          <p className="text-white/70 text-sm">Générez le listing et les images en une seule fois avec un seul screenshot</p>
        </div>

        {/* Upload Section */}
        <div className="bg-black rounded-xl border border-white/10 mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-bold text-white mb-3">
                  Screenshot du produit
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
                      <Upload size={32} className="mx-auto mb-3 text-white/60" />
                      <p className="text-sm text-white/80 mb-1">
                        Glissez-déposez un screenshot ou cliquez pour sélectionner
                      </p>
                      <p className="text-xs text-white/60">
                        JPG / PNG • Max 10MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-white mb-3">
                    Quantité d'images
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
              </div>
            </div>

            {/* Generate Button */}
            <div className="mt-6">
              <button
                onClick={generateEverything}
                disabled={isGenerating || !sourceImagePreview || hasGenerated || (generatedImages.length > 0 && listingData)}
                className="w-full py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#00d4ff]/30 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Génération en cours...
                  </>
                ) : hasGenerated || (generatedImages.length > 0 && listingData) ? (
                  <>
                    <Sparkles size={20} />
                    Génération déjà effectuée
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    GÉNÉRER LE LISTING ET LES IMAGES
                  </>
                )}
              </button>
              {!isGenerating && (hasGenerated || (generatedImages.length > 0 && listingData)) && (
                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-center text-amber-400 font-medium">
                    ⚠️ Il n'est plus possible de générer un nouveau listing et de nouvelles images sur cette page.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/50">
            <p className="text-sm text-red-400">{error}</p>
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
                Cela peut prendre quelques secondes
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
                      <div className="p-4 rounded-lg bg-black border border-white/10 max-h-96 overflow-y-auto">
                        <pre className="text-sm text-white whitespace-pre-wrap font-sans leading-relaxed">
                          {listingData.description}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {listingData.tags && listingData.tags.length > 0 && (
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

              {/* Images Section */}
              {generatedImages.length > 0 && (
                <div className="bg-black rounded-xl border border-white/10 p-6">
                  <h3 className="text-xl font-bold text-white mb-6">
                    {generatedImages.length} image{generatedImages.length > 1 ? 's' : ''} générée{generatedImages.length > 1 ? 's' : ''}
                  </h3>
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
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setFullscreenImage(img.url)}
                              className="w-8 h-8 rounded-full bg-black/80 border border-white/20 flex items-center justify-center hover:bg-black transition-colors"
                            >
                              <Maximize2 size={16} className="text-white" />
                            </button>
                            <button
                              onClick={() => downloadImage(img.url, index)}
                              className="w-8 h-8 rounded-full bg-black/80 border border-white/20 flex items-center justify-center hover:bg-black transition-colors"
                            >
                              <Download size={16} className="text-white" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
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

