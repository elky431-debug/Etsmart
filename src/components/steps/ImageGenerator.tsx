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

interface ImageGeneratorProps {
  analysis: ProductAnalysis;
}

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

interface GeneratedImage {
  url: string;
  id: string;
}

export function ImageGenerator({ analysis }: ImageGeneratorProps) {
  // Clé unique pour ce produit dans sessionStorage
  const productId = analysis.product.id || analysis.product.url || `product-${Date.now()}`;
  const storageKey = `etsmart-image-generated-${productId}`;

  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(
    analysis.product.images[0] || null
  );
  const [customInstructions, setCustomInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasGeneratedImage, setHasGeneratedImage] = useState(false);

  // Vérifier au montage si une image a déjà été générée pour ce produit
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(storageKey);
      if (saved === 'true') {
        setHasGeneratedImage(true);
        // Si on a des images sauvegardées, les restaurer aussi
        const savedImages = sessionStorage.getItem(`${storageKey}-images`);
        if (savedImages) {
          try {
            const images = JSON.parse(savedImages);
            setGeneratedImages(images);
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

  const generateImages = async () => {
    if (!sourceImagePreview) {
      alert('Veuillez sélectionner une image source');
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);
    setError(null);

    try {
      // Convertir l'image en base64 si c'est un File
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

      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceImage: imageBase64,
          customInstructions: customInstructions.trim() || undefined,
          quantity,
          aspectRatio,
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
      
      if (!data.images || data.images.length === 0) {
        throw new Error('Aucune image générée. Vérifiez votre clé API OpenAI (OPENAI_API_KEY) et les logs du serveur.');
      }
      
      // Filtrer les images avec erreur
      const validImages = data.images.filter((img: any) => !img.error);
      const failedImages = data.images.filter((img: any) => img.error);
      
      if (validImages.length === 0) {
        throw new Error('Toutes les générations ont échoué. Vérifiez votre clé API et les logs du serveur.');
      }
      
      setGeneratedImages(validImages);
      setHasGeneratedImage(true);
      
      // Sauvegarder dans sessionStorage que l'image a été générée
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, 'true');
        sessionStorage.setItem(`${storageKey}-images`, JSON.stringify(validImages));
      }
      
      if (failedImages.length > 0) {
        setError(`${failedImages.length} image(s) n'ont pas pu être générée(s). ${validImages.length} image(s) générée(s) avec succès.`);
      }
      
      if (data.warning) {
        console.warn('[IMAGE GENERATION]', data.warning);
      }
    } catch (error: any) {
      console.error('Error generating images:', error);
      setError(error.message || 'Erreur lors de la génération des images');
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Full Width Layout */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Paramètres en haut */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Génération d'images</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* A. Input Source */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-3">
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
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50'
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
                    <Upload size={32} className="mx-auto mb-3 text-slate-400" />
                    <p className="text-sm text-slate-600 mb-1">
                      Glissez-déposez une image ou cliquez pour sélectionner
                    </p>
                    <p className="text-xs text-slate-400">
                      JPG / PNG • Max 10MB
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* B. Custom Instructions */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">
                Instructions personnalisées (optionnel)
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Describe specific details (optional)"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 outline-none resize-none text-sm"
                rows={3}
              />
            </div>

            {/* C. Quantity */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-3">
                Quantité
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  className="py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg cursor-default"
                  disabled
                >
                  1
                </button>
              </div>
            </div>

            {/* D. Aspect Ratio */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-3">
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
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
              <label className="block text-sm font-bold text-slate-900 mb-3">
                Moteur
              </label>
              <div className="p-4 rounded-lg bg-slate-100 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Nanonbanana</p>
                    <p className="text-xs text-slate-500">Image-to-Image • Génération</p>
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
                    GENERATE {quantity} IMAGE
                  </>
                )}
              </button>
              {!isGenerating && !hasGeneratedImage && generatedImages.length === 0 && (
                <p className="text-xs text-center text-slate-500 mt-2">
                  Coût : -{quantity} crédit
                </p>
              )}
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-6">
            {/* Message d'erreur */}
            {error && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-800">{error}</p>
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
                  <p className="text-lg font-semibold text-slate-900">
                    Génération des images...
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
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
                    <h3 className="text-xl font-bold text-slate-900">
                      {generatedImages.length} image{generatedImages.length > 1 ? 's' : ''} générée{generatedImages.length > 1 ? 's' : ''}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {generatedImages.map((img, index) => (
                      <motion.div
                        key={img.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="group relative bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
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
                          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setFullscreenImage(img.url)}
                              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
                            >
                              <Maximize2 size={16} className="text-slate-700" />
                            </button>
                            <button
                              onClick={() => downloadImage(img.url, index)}
                              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
                            >
                              <Download size={16} className="text-slate-700" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
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

