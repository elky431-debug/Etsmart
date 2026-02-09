'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Package, 
  Loader2,
  AlertCircle,
  X,
  Upload,
  Image as ImageIcon,
  Eye,
  Zap
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { SupplierProduct } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DashboardListing } from './DashboardListing';
import { DashboardImage } from './DashboardImage';
import type { ProductAnalysis } from '@/types';
import { Sparkles } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

interface ListingProductImportProps {
  onProductImported?: (product: SupplierProduct) => void;
  mode?: 'listing' | 'images'; // Mode pour déterminer quel composant afficher après l'import
}

// Fonction pour générer un titre SEO basique à partir du titre du produit
function generateBasicSEOTitle(title: string): string {
  // Générer un titre SEO long et viral (minimum 100 caractères, idéalement 120-140)
  const words = title.split(' ').filter(w => w.length > 2).slice(0, 12);
  let seoTitle = words.join(' ');
  
  // Ajouter des adjectifs viraux puissants
  const viralAdjectives = ['Stunning', 'Exquisite', 'Premium', 'Beautiful', 'Handcrafted', 'Luxury'];
  for (const adj of viralAdjectives) {
    if (seoTitle.length >= 140) break;
    if (!seoTitle.toLowerCase().includes(adj.toLowerCase())) {
      seoTitle = `${adj} ${seoTitle}`;
      if (seoTitle.length >= 100) break;
    }
  }
  
  // Ajouter des caractéristiques premium
  const premiumFeatures = ['Handmade', 'Custom', 'Personalized', 'Premium Quality', 'Artisan Made'];
  for (const feature of premiumFeatures) {
    if (seoTitle.length >= 140) break;
    if (!seoTitle.toLowerCase().includes(feature.toLowerCase())) {
      seoTitle += ` ${feature}`;
      if (seoTitle.length >= 100 && seoTitle.length <= 140) break;
    }
  }
  
  // Ajouter des contextes d'usage si nécessaire (minimum 100 caractères)
  if (seoTitle.length < 100) {
    const usageContexts = ['Perfect Gift', 'for Her', 'for Him', 'Home Decor', 'Thoughtful Present'];
    for (const context of usageContexts) {
      if (seoTitle.length >= 140) break;
      if (!seoTitle.toLowerCase().includes(context.toLowerCase())) {
        seoTitle += ` ${context}`;
        if (seoTitle.length >= 100 && seoTitle.length <= 140) break;
      }
    }
  }
  
  // Si toujours trop court, ajouter des mots-clés génériques
  if (seoTitle.length < 100) {
    const genericKeywords = ['Unique Design', 'Memorable Keepsake', 'Gift Idea', 'Special Occasion', 'Premium Quality'];
    for (const keyword of genericKeywords) {
      if (seoTitle.length >= 140) break;
      if (!seoTitle.toLowerCase().includes(keyword.toLowerCase())) {
        seoTitle += ` ${keyword}`;
        if (seoTitle.length >= 100 && seoTitle.length <= 140) break;
      }
    }
  }
  
  // Limiter à 140 caractères maximum
  if (seoTitle.length > 140) {
    seoTitle = seoTitle.substring(0, 137) + '...';
  }
  
  // Vérification finale - garantir au minimum 100 caractères
  if (seoTitle.length < 100) {
    seoTitle += ' Premium Quality Handcrafted Gift Unique Design Perfect Present';
    if (seoTitle.length > 140) {
      seoTitle = seoTitle.substring(0, 137) + '...';
    }
  }
  
  return seoTitle;
}

// Fonction pour générer des tags SEO basiques - GARANTIT TOUJOURS 13 TAGS
function generateBasicSEOTags(title: string, category?: string): string[] {
  const REQUIRED_TAG_COUNT = 13;
  const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3 && w.length < 20);
  const tags: string[] = [];
  
  // Ajouter des mots du titre
  words.slice(0, 8).forEach(word => {
    if (word.length <= 20 && !tags.includes(word)) {
      tags.push(word);
    }
  });
  
  // Ajouter la catégorie si disponible
  if (category && category.length <= 20 && !tags.includes(category.toLowerCase())) {
    tags.push(category.toLowerCase());
  }
  
  // Tags génériques pour compléter jusqu'à 13
  const genericTags = [
    'handmade', 'gift', 'unique', 'etsy', 'custom', 'personalized', 'vintage', 'modern',
    'artisan', 'quality', 'premium', 'special', 'original', 'trendy', 'stylish', 'elegant',
    'beautiful', 'perfect', 'lovely', 'charming', 'cute', 'minimalist', 'bohemian', 'rustic'
  ];
  
  // Ajouter des tags génériques jusqu'à atteindre 13
  for (const tag of genericTags) {
    if (tags.length >= REQUIRED_TAG_COUNT) break;
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  // Si on n'a toujours pas 13 tags, compléter avec des tags numérotés
  while (tags.length < REQUIRED_TAG_COUNT) {
    tags.push(`tag${tags.length + 1}`);
  }
  
  // Retourner exactement 13 tags
  return tags.slice(0, REQUIRED_TAG_COUNT);
}

// Fonction pour créer une analyse minimale à partir d'un produit
function createMinimalAnalysis(product: SupplierProduct): ProductAnalysis {
  const seoTitle = generateBasicSEOTitle(product.title || 'Product');
  const seoTags = generateBasicSEOTags(product.title || 'Product', product.category);
  
  return {
    product: {
      ...product,
      id: product.id || `temp-${Date.now()}`,
    },
    niche: product.category || 'custom',
    verdict: {
      verdict: 'test' as const,
      confidenceScore: 50,
      summary: 'Produit importé pour création de listing',
      productVisualDescription: product.title || '',
      etsySearchQuery: product.title?.substring(0, 50) || '',
      viralTitleEN: seoTitle,
      seoTags: seoTags,
      estimatedSupplierPrice: product.price || 0,
      estimatedShippingCost: 0,
    },
    pricing: {
      recommendedPrice: product.price ? product.price * 2.5 : 0,
      premiumPrice: product.price ? product.price * 3 : 0,
      minPrice: product.price ? product.price * 1.5 : 0,
    },
    competitors: {
      count: 0,
      averageMarketPrice: product.price ? product.price * 2.5 : 0,
      launchPotentialScore: 5,
    },
    saturation: {
      phase: 'competitive' as const,
      level: 50,
    },
    marketing: {
      strategic: {
        positioning: {
          mainPositioning: '',
        },
        psychologicalTriggers: [],
        competitorMistakes: [],
      },
    },
    dataSource: 'imported' as const,
  };
}

// Les boutons "Générer" ont été supprimés - redirection automatique après upload d'image
// En mode 'images', après upload, l'image est parsée automatiquement et l'utilisateur est redirigé vers la page de génération

export function ListingProductImport({ onProductImported, mode = 'listing' }: ListingProductImportProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [error, setError] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [importedProduct, setImportedProduct] = useState<SupplierProduct | null>(null);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [showExample, setShowExample] = useState(false);
  
  // Debug logs
  console.log('[ListingProductImport] Render - mode:', mode, 'uploadedImage:', uploadedImage ? 'exists' : 'null');

  // Fonction pour compresser l'image
  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.6): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Cannot create canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Image compression failed'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image (PNG, JPG, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('L\'image est trop grande (max 10 Mo)');
      return;
    }

    setIsLoadingImage(true);
    setError('');

    try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const imageData = event.target?.result as string;
          console.log('[ListingProductImport] Image uploaded, setting uploadedImage:', imageData ? 'Image data received' : 'No image data');
          setUploadedImage(imageData);

          // ⚠️ CRITICAL: Parser automatiquement l'image pour les deux modes ('listing' et 'images')
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            
            if (!token) {
              throw new Error('Authentication required');
            }

            // Compresser l'image
            const compressedFile = await compressImage(file, 800, 0.6);
            const formData = new FormData();
            formData.append('image', compressedFile);

            // Parser l'image pour extraire les infos du produit
            const parseResponse = await fetch('/api/parse-product-image', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
              body: formData,
            });

            const parseData = await parseResponse.json();

            if (!parseResponse.ok) {
              throw new Error(parseData.message || parseData.error || 'Erreur lors de l\'analyse de l\'image');
            }

            if (!parseData.success || !parseData.product) {
              throw new Error('Impossible de parser le produit depuis l\'image');
            }

            const product = parseData.product;

            // Créer une analyse minimale pour la génération (listing ou images)
            const minimalAnalysis = createMinimalAnalysis(product);
            
            // Mettre à jour l'analyse et le produit pour afficher la page de génération
            setAnalysis(minimalAnalysis);
            setImportedProduct(product);
            
            if (onProductImported) {
              onProductImported(product);
            }
            
            // ⚠️ NOTE: Les crédits ne sont PAS déduits lors du parsing
            // Ils seront déduits uniquement lors du clic sur "GENERATE 1 IMAGE"
            
            console.log('[ListingProductImport] ✅ Produit parsé avec succès, analyse minimale créée');
          } catch (parseError: any) {
            console.error('[ListingProductImport] ❌ Error parsing image:', parseError);
            setError(parseError.message || 'Erreur lors de l\'analyse de l\'image');
            setIsLoadingImage(false);
          }
        };
        reader.readAsDataURL(file);

      e.target.value = '';
      // Ne pas mettre setIsLoadingImage(false) ici car le parsing est asynchrone
      // setIsLoadingImage sera mis à false dans le catch du parsing
    } catch (err: any) {
      console.error('[ListingProductImport] ❌ Error uploading image:', err);
      setError(err.message || 'Erreur lors de l\'upload de l\'image');
      setIsLoadingImage(false);
    }
  };

  // Si un produit est importé, afficher le listing ou les images selon le mode
  if (analysis && importedProduct) {
    return (
      <div className="p-4 md:p-8 bg-black min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Nom de l'onglet en haut */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">
              {mode === 'images' ? 'Images' : 'Listing'}
            </h1>
          </div>
          
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => {
                setImportedProduct(null);
                setAnalysis(null);
                setUploadedImage(null);
                setError('');
              }}
              className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/10"
            >
              <ArrowLeft size={20} />
              <span>Importer un autre produit</span>
            </button>
          </div>

          {/* Product Info */}
          <div className="mb-6 p-4 rounded-lg bg-black border border-white/10">
            <div className="flex items-center gap-4">
              {importedProduct.images && importedProduct.images[0] && (
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-black border border-white/10 flex-shrink-0">
                  <img 
                    src={importedProduct.images[0]} 
                    alt={importedProduct.title || ''} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate mb-1">
                  {importedProduct.title || 'Produit importé'}
                </h3>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded-md bg-black border border-white/10 text-white/80 text-xs font-medium">
                    AliExpress
                  </span>
                  {importedProduct.price > 0 && (
                    <span className="text-[#00d4ff] font-bold text-sm">
                      {formatCurrency(importedProduct.price)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contenu selon le mode - Listing ou Images séparés */}
          {mode === 'images' ? (
            <DashboardImage analysis={analysis} />
          ) : (
            <DashboardListing analysis={analysis} />
          )}
        </div>
      </div>
    );
  }

  // Écran d'import
  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Nom de l'onglet en haut */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {mode === 'images' ? 'Images' : 'Listing'}
        </h1>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#00d4ff]/30">
            <Package className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">
            Importez vos produits
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-4">
            Prenez une capture d'écran de la page produit AliExpress/Alibaba et nous extrairons automatiquement toutes les informations
          </p>
          <div className="flex items-center justify-center gap-2 text-[#00d4ff] mb-8">
            <Zap size={18} />
            <span className="text-sm font-medium">
              {mode === 'images' ? '1 crédit par génération d\'images' : '1 crédit par génération de listing'}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400 mb-1">Erreur</p>
              <p className="text-sm text-red-300">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}

        {/* Image Upload Section */}
        <motion.div 
          className="max-w-3xl mx-auto mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00c9b7] to-[#00d4ff] rounded-3xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
            <div className="relative bg-black backdrop-blur-xl rounded-2xl border-2 border-white/10 shadow-xl p-4 sm:p-6 group-hover:border-[#00d4ff]/30 transition-all duration-300">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00c9b7]/20 to-[#00d4ff]/20 flex items-center justify-center mx-auto mb-3 border-2 border-[#00c9b7]/30 shadow-lg shadow-[#00c9b7]/20"
                >
                  <ImageIcon className="w-8 h-8 text-[#00c9b7]" />
                </motion.div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                  Prenez une capture d'écran
                </h3>
                <p className="text-sm text-white/70 mb-4 sm:mb-5 px-2 sm:px-0">
                  Prenez une photo de la page produit AliExpress/Alibaba et nous extrairons automatiquement toutes les informations
                </p>
                
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isLoadingImage}
                  className="hidden"
                />
                
                <motion.label
                  htmlFor="image-upload"
                  whileHover={!isLoadingImage && !isMobile ? { scale: 1.02 } : {}}
                  whileTap={!isLoadingImage && !isMobile ? { scale: 0.98 } : {}}
                  className={`
                    inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base cursor-pointer transition-all w-full sm:w-auto justify-center
                    ${isLoadingImage
                      ? 'bg-black text-white/40 cursor-not-allowed border-2 border-white/5'
                      : 'bg-gradient-to-r from-[#00c9b7] to-[#00d4ff] text-white shadow-xl shadow-[#00c9b7]/30 hover:shadow-[#00c9b7]/50'
                    }
                  `}
                >
                  {isLoadingImage ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <Upload size={20} />
                      Choisir une image
                    </>
                  )}
                </motion.label>

                {/* Screenshot Display - Plus de bouton générer */}
                {uploadedImage && mode !== 'images' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-4 rounded-lg bg-black border border-white/10"
                  >
                    <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black mb-4">
                      <img 
                        src={uploadedImage} 
                        alt="Screenshot du produit" 
                        className="w-full h-auto max-h-96 object-contain"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Example Section */}
                <div className="mt-8 pt-8 border-t border-white/10">
                  <button
                    onClick={() => setShowExample(!showExample)}
                    className="flex items-center gap-2 mx-auto text-sm font-semibold text-[#00d4ff] hover:text-[#00c9b7] transition-colors"
                  >
                    <Eye size={16} />
                    {showExample ? 'Masquer l\'exemple' : 'Voir un exemple de capture d\'écran valide'}
                  </button>
                  
                  {showExample && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6"
                    >
                      <div className="bg-black rounded-2xl p-6 border-2 border-white/10 backdrop-blur-sm">
                        <div className="mb-4">
                          <h4 className="text-sm font-bold text-white mb-2">
                            Exemple de capture d'écran valide
                          </h4>
                          {mode === 'images' ? (
                            <p className="text-xs text-white/70 leading-relaxed">
                              Prenez une capture d'écran de la page produit AliExpress ou Alibaba en zoomant uniquement sur la photo du produit.
                              <br />
                              <span className="text-white/50 italic">Seule la photo du produit est nécessaire, pas les autres informations.</span>
                            </p>
                          ) : (
                            <p className="text-xs text-white/70 leading-relaxed">
                              Prenez une capture d'écran de la page produit AliExpress ou Alibaba montrant l'image du produit, le titre et le prix.
                              <br />
                              <span className="text-white/50 italic">Cet exemple est donné à titre indicatif uniquement.</span>
                            </p>
                          )}
                        </div>
                        <div className={`relative rounded-xl overflow-hidden border-2 border-white/20 shadow-lg bg-black ${mode === 'images' ? 'aspect-square' : ''}`}>
                          {mode === 'images' ? (
                            <div className="relative w-full h-full overflow-hidden bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src="/examples/product-image-example.png"
                                alt="Exemple de photo produit - Tasse Etsmart"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  // Fallback: utiliser screenshot-example.png avec zoom sur la tasse
                                  const target = e.target as HTMLImageElement;
                                  target.src = '/examples/screenshot-example.png';
                                  target.className = 'absolute inset-0 w-full h-full';
                                  target.style.objectFit = 'cover';
                                  target.style.objectPosition = 'left center';
                                  target.style.transform = 'scale(3)';
                                  target.style.transformOrigin = 'left center';
                                }}
                              />
                            </div>
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src="/examples/screenshot-example.png"
                              alt="Exemple de capture d'écran d'une page produit AliExpress"
                              className="w-full h-auto"
                              onError={(e) => {
                                // Fallback si l'image n'existe pas encore
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="p-12 text-center text-white/50">
                                      <p class="text-sm mb-2">Image d'exemple à ajouter</p>
                                      <p class="text-xs">Placez votre capture d'écran dans /public/examples/screenshot-example.png</p>
                                    </div>
                                  `;
                                }
                              }}
                            />
                          )}
                        </div>
                        <p className="mt-4 text-xs text-white/50 text-center">
                          {mode === 'images' 
                            ? '📸 Zoom sur la photo du produit uniquement' 
                            : '📸 Capture d\'écran d\'une page produit AliExpress avec le produit "Etsmart Cup"'}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

