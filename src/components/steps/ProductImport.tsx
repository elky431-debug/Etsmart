'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Package, 
  Trash2, 
  ExternalLink,
  Loader2,
  Edit3,
  ChevronRight,
  AlertCircle,
  X,
  Zap,
  Upload,
  Image as ImageIcon,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { formatCurrency } from '@/lib/utils';
import { niches } from '@/lib/niches';
import type { SupplierProduct } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';

export function ProductImport() {
  const { selectedNiche, products, addProduct, removeProduct, setStep } = useStore();
  const isMobile = useIsMobile();
  
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [error, setError] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(true); // Visible par défaut

  const currentNiche = niches.find(n => n.id === selectedNiche);

  // Fonction pour compresser l'image (optimisée pour tenir dans 26 secondes)
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

          // Redimensionner si nécessaire
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

    // Vérifier que c'est une image
    if (!file.type.startsWith('image/')) {
      setError('Please select an image (PNG, JPG, etc.)');
      return;
    }

    // Limiter la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image is too large (max 10MB)');
      return;
    }

    setIsLoadingImage(true);
    setError('');
    setUploadedImage(null);

    try {
      // Compresser l'image avant l'envoi (max 800px de largeur, qualité 60% pour tenir dans 26s)
      console.log('📸 Original image size:', (file.size / 1024).toFixed(2), 'KB');
      const compressedFile = await compressImage(file, 800, 0.6);
      console.log('📸 Compressed image size:', (compressedFile.size / 1024).toFixed(2), 'KB');
      console.log('📸 Compression ratio:', ((1 - compressedFile.size / file.size) * 100).toFixed(1), '% reduction');

      // Créer une preview de l'image originale
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Envoyer l'image compressée à l'API
      const formData = new FormData();
      formData.append('image', compressedFile);

      const response = await fetch('/api/parse-product-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Gérer les erreurs HTTP
        const errorMessage = data.message || data.error || `Erreur ${response.status}`;
        setError(errorMessage);
        console.error('API Error:', response.status, data);
        return;
      }

      if (data.success && data.product) {
        addProduct(data.product);
        setUploadedImage(null);
        
        // Afficher un warning si présent, mais ne pas bloquer
        if (data.warning) {
          setError(data.warning);
          // Effacer le warning après 5 secondes
          setTimeout(() => setError(''), 5000);
        } else {
          setError('');
        }
        
        // Reset file input
        e.target.value = '';
      } else {
        // Extraire le message d'erreur
        const errorMessage = data.message || data.error || 'Unable to extract information from the screenshot. Try taking a clearer photo of the product page.';
        setError(errorMessage);
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      setError('Error uploading image. Please try again.');
    } finally {
      setIsLoadingImage(false);
    }
  };



  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00d4ff]/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#00c9b7]/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div
        initial={isMobile ? undefined : { opacity: 0 }}
        animate={isMobile ? undefined : { opacity: 1 }}
        exit={isMobile ? undefined : { opacity: 0 }}
        className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16"
      >
        {/* Header Section */}
        <motion.div 
          className="text-center mb-8 sm:mb-16"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-white/80 backdrop-blur-xl border-2 border-[#00d4ff]/20 shadow-lg mb-4 sm:mb-8 text-xs sm:text-sm"
          >
            <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
            <span className="text-sm font-bold text-[#00d4ff]">STEP 2 OF 3</span>
            {currentNiche && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-sm font-bold text-slate-700">{currentNiche.name}</span>
              </>
            )}
            <Zap size={16} className="text-[#00c9b7]" />
          </motion.div>
          
          <motion.h1 
            className="text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-3 sm:mb-6"
            initial={isMobile ? undefined : { opacity: 0, y: 20 }}
            animate={isMobile ? undefined : { opacity: 1, y: 0 }}
            transition={isMobile ? undefined : { delay: 0.3 }}
          >
            <span className="text-slate-900">Import</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
              your products
            </span>
          </motion.h1>
          
          <motion.p 
            className="text-sm sm:text-base md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed px-2 sm:px-0"
            initial={isMobile ? undefined : { opacity: 0 }}
            animate={isMobile ? undefined : { opacity: 1 }}
            transition={isMobile ? undefined : { delay: 0.4 }}
          >
            Take a screenshot of the AliExpress/Alibaba product page and we will automatically extract all information
          </motion.p>
        </motion.div>

        {/* Image Upload Section */}
        <motion.div 
          className="max-w-3xl mx-auto mb-8"
          initial={isMobile ? undefined : { opacity: 0, y: 20 }}
          animate={isMobile ? undefined : { opacity: 1, y: 0 }}
          transition={isMobile ? undefined : { delay: 0.5 }}
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00c9b7] to-[#00d4ff] rounded-3xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
            <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl border-2 border-slate-200 shadow-2xl p-4 sm:p-8">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00c9b7]/10 to-[#00d4ff]/10 flex items-center justify-center mx-auto mb-4 border-2 border-[#00c9b7]/20"
                >
                  <ImageIcon className="w-10 h-10 text-[#00c9b7]" />
                </motion.div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                  Take a screenshot
                </h3>
                <p className="text-sm sm:text-base text-slate-600 mb-4 sm:mb-6 px-2 sm:px-0">
                  Take a photo of the AliExpress/Alibaba product page and we will automatically extract all information
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
                    inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-8 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-lg cursor-pointer transition-all w-full sm:w-auto justify-center btn-mobile
                    ${isLoadingImage
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#00c9b7] to-[#00d4ff] text-white shadow-xl shadow-[#00c9b7]/30 hover:shadow-[#00c9b7]/50'
                    }
                  `}
                >
                  {isLoadingImage ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Upload size={20} />
                      Choose an image
                    </>
                  )}
                </motion.label>

                {/* Example Section */}
                <div className="mt-8 pt-8 border-t border-slate-200">
                  <button
                    onClick={() => setShowExample(!showExample)}
                    className="flex items-center gap-2 mx-auto text-sm font-semibold text-[#00d4ff] hover:text-[#00c9b7] transition-colors"
                  >
                    <Eye size={16} />
                    {showExample ? 'Hide example' : 'Show example of valid screenshot'}
                  </button>
                  
                  {showExample && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6"
                    >
                      <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200">
                        <div className="mb-4">
                          <h4 className="text-sm font-bold text-slate-900 mb-2">
                            Example of valid screenshot
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Take a screenshot of the AliExpress or Alibaba product page showing the product image, title, and price.
                            <br />
                            <span className="text-slate-500 italic">This example is for illustrative purposes only.</span>
                          </p>
                        </div>
                        <div className="relative rounded-xl overflow-hidden border-2 border-slate-300 shadow-lg bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/examples/screenshot-example.png"
                            alt="Example screenshot of AliExpress product page"
                            className="w-full h-auto"
                            onError={(e) => {
                              // Fallback si l'image n'existe pas encore
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="p-12 text-center text-slate-400">
                                    <p class="text-sm mb-2">Example image to add</p>
                                    <p class="text-xs">Place your screenshot in /public/examples/screenshot-example.png</p>
                                  </div>
                                `;
                              }
                            }}
                          />
                        </div>
                        <p className="mt-4 text-xs text-slate-500 text-center">
                          📸 Screenshot of an AliExpress product page with the product "Etsmart Cup"
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {uploadedImage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6"
                  >
                    <img
                      src={uploadedImage}
                      alt="Uploaded product"
                      className="max-w-full h-auto max-h-64 rounded-2xl border-2 border-slate-200 shadow-lg mx-auto"
                    />
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mx-auto mt-4 p-4 rounded-2xl bg-red-50 border-2 border-red-200"
            >
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700 mb-1">{error}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Products List */}
        <motion.div 
          className="mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Products to analyze
            </h2>
            <span className="px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full bg-gradient-to-r from-[#00d4ff]/10 to-[#00c9b7]/10 border-2 border-[#00d4ff]/20 text-[#00d4ff] font-bold text-xs sm:text-sm shadow-sm whitespace-nowrap flex-shrink-0">
              Product
            </span>
          </div>

          {products.length === 0 ? (
            <div className="py-24 text-center border-2 border-dashed border-slate-300 rounded-3xl bg-white/50 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/10 flex items-center justify-center mx-auto mb-6 border-2 border-[#00d4ff]/20"
              >
                <Package className="w-12 h-12 text-[#00d4ff]" />
              </motion.div>
              <p className="text-lg font-bold text-slate-700 mb-2">No products added</p>
              <p className="text-sm text-slate-500">Take a screenshot of the AliExpress/Alibaba product page above to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {products[0] && (
                <motion.div
                  key={products[0].id}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ 
                    type: 'spring',
                    stiffness: 100
                  }}
                  className="group relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border-2 border-slate-200 hover:border-[#00d4ff]/50 hover:shadow-xl hover:shadow-[#00d4ff]/10 transition-all duration-300 overflow-hidden"
                >
                    {/* Shine effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: 'linear-gradient(110deg, transparent 40%, rgba(0,212,255,0.1) 50%, transparent 60%)',
                      }}
                    />

                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                      {/* Image */}
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 border-2 border-slate-200 shadow-sm">
                        {products[0].images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={products[0].images[0]}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2 line-clamp-2 sm:line-clamp-1">
                          {products[0].title}
                        </h3>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                          {products[0].price === 0 ? (
                            <div className="flex flex-col gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => {
                                  const newPrice = prompt('Enter the product price (USD):', '');
                                  if (newPrice && !isNaN(parseFloat(newPrice)) && parseFloat(newPrice) > 0) {
                                    const updatedProduct = { ...products[0], price: parseFloat(newPrice) };
                                    addProduct(updatedProduct);
                                  } else if (newPrice) {
                                    alert('Please enter a valid price greater than 0');
                                  }
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors font-semibold text-xs sm:text-sm"
                              >
                                <AlertCircle size={14} className="sm:w-4 sm:h-4" />
                                <span className="whitespace-nowrap">Price required - Click to add</span>
                              </button>
                              <p className="text-xs text-amber-600">Price is required to continue</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 sm:gap-3">
                              <span className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">
                                {formatCurrency(products[0].price)}
                              </span>
                              <button
                                onClick={() => {
                                  const newPrice = prompt('Edit product price (USD):', products[0].price.toString());
                                  if (newPrice && !isNaN(parseFloat(newPrice)) && parseFloat(newPrice) > 0) {
                                    const updatedProduct = { ...products[0], price: parseFloat(newPrice) };
                                    addProduct(updatedProduct);
                                  } else if (newPrice) {
                                    alert('Please enter a valid price greater than 0');
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-[#00d4ff] hover:bg-[#00d4ff]/10 rounded-lg transition-all"
                                title="Edit price"
                              >
                                <Edit3 size={14} />
                              </button>
                            </div>
                          )}
                          <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[10px] sm:text-xs font-bold text-slate-600 whitespace-nowrap">
                            {products[0].source === 'aliexpress' ? 'AliExpress' : 'Alibaba'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto mt-2 sm:mt-0">
                        <a
                          href={products[0].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 text-slate-400 hover:text-[#00d4ff] hover:bg-[#00d4ff]/10 rounded-xl transition-all border-2 border-transparent hover:border-[#00d4ff]/20"
                        >
                          <ExternalLink size={20} />
                        </a>
                        <button
                          onClick={() => removeProduct(products[0].id)}
                          className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border-2 border-transparent hover:border-red-200"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
            </div>
          )}
        </motion.div>

        {/* Footer with Navigation */}
        <motion.div 
          className="flex items-center justify-between gap-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <motion.button
            onClick={() => setStep(1)}
            whileHover={{ scale: 1.02, x: -2 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-semibold text-sm sm:text-base transition-all shadow-sm hover:shadow-md btn-mobile"
          >
            <ArrowLeft size={20} />
            Back
          </motion.button>

          <div className="flex flex-col items-end gap-3">
            {products.some(p => p.price === 0) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium"
              >
                <AlertCircle size={16} />
                All products must have a price entered
              </motion.div>
            )}
            <motion.button
              onClick={() => setStep(3)}
              disabled={products.length === 0 || products.some(p => p.price === 0)}
              whileHover={products.length > 0 && !products.some(p => p.price === 0) && !isMobile ? { scale: 1.05, y: -2 } : {}}
              whileTap={products.length > 0 && !products.some(p => p.price === 0) && !isMobile ? { scale: 0.95 } : {}}
              className={`
                group relative w-full sm:w-auto px-6 sm:px-16 py-2.5 sm:py-4 md:py-6 text-sm sm:text-lg md:text-xl font-bold rounded-xl sm:rounded-2xl transition-all duration-300 overflow-hidden btn-mobile
                ${products.length === 0 || products.some(p => p.price === 0)
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-2xl shadow-[#00d4ff]/40 hover:shadow-[#00d4ff]/60'
                }
              `}
            >
              {products.length > 0 && !products.some(p => p.price === 0) && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-[#00c9b7] to-[#00d4ff] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                Analyze
                <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

    </div>
  );
}
