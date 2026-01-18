'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Link2, 
  Package, 
  Trash2, 
  ExternalLink,
  Plus,
  Loader2,
  Edit3,
  DollarSign,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
  Zap,
  Sparkles,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { parseProductUrl } from '@/lib/mockAnalysis';
import { formatCurrency } from '@/lib/utils';
import { niches } from '@/lib/niches';
import type { SupplierProduct } from '@/types';

export function ProductImport() {
  const { selectedNiche, products, addProduct, removeProduct, setStep } = useStore();
  
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [error, setError] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [manualProduct, setManualProduct] = useState({
    title: '',
    price: '',
    imageUrl: '',
  });

  const currentNiche = niches.find(n => n.id === selectedNiche);

  const handleAddProduct = async () => {
    if (!url.trim()) return;

    const isValidUrl = url.includes('aliexpress.com') || url.includes('alibaba.com') || url.includes('aliexpress.us');
    if (!isValidUrl) {
      setError('Entrez une URL AliExpress ou Alibaba valide');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const product = await parseProductUrl(url);
      if (product && product.title && product.title !== 'Produit AliExpress') {
        addProduct(product);
        setUrl('');
      } else {
        // Try to get fallback info from API
        try {
          const response = await fetch('/api/parse-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          });
          const data = await response.json();
          
          if (data.fallback) {
            // Pre-fill manual entry with extracted info
            setManualProduct({
              title: data.fallback.titleHint || '',
              price: '',
              imageUrl: data.fallback.url || url,
            });
          }
        } catch (e) {
          // Ignore fallback errors, still show manual entry
        }
        
        setError('AliExpress bloque le scraping automatique. Utilisez l\'ajout manuel ci-dessous (champs pré-remplis).');
        setShowManualEntry(true);
      }
    } catch (error: any) {
      // Try to get fallback info from API
      try {
        const response = await fetch('/api/parse-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await response.json();
        
        if (data.fallback) {
          // Pre-fill manual entry with extracted info
          setManualProduct({
            title: data.fallback.titleHint || '',
            price: '',
            imageUrl: data.fallback.url || url,
          });
        }
      } catch (e) {
        // Ignore fallback errors
      }
      
      setError('AliExpress bloque le scraping automatique. Utilisez l\'ajout manuel ci-dessous.');
      setShowManualEntry(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier que c'est une image
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image (PNG, JPG, etc.)');
      return;
    }

    // Limiter la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('L\'image est trop grande (max 10MB)');
      return;
    }

    setIsLoadingImage(true);
    setError('');
    setUploadedImage(null);

    try {
      // Créer une preview de l'image
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Envoyer l'image à l'API
      const formData = new FormData();
      formData.append('image', file);

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
        const errorMessage = data.message || data.error || 'Impossible d\'extraire les informations du screenshot. Essayez de prendre une photo plus claire de la page produit.';
        setError(errorMessage);
        
        // Si on a quand même des données partielles, proposer l'ajout manuel
        if (data.extracted && data.extracted.title) {
          setManualProduct({
            title: data.extracted.title || '',
            price: String(data.extracted.price || ''),
            imageUrl: uploadedImage || '',
          });
        }
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      setError('Erreur lors de l\'upload de l\'image. Réessayez.');
    } finally {
      setIsLoadingImage(false);
    }
  };


  const handleManualSubmit = () => {
    if (!manualProduct.title.trim() || !manualProduct.price.trim()) return;

    const price = parseFloat(manualProduct.price) || 0;
    const product: SupplierProduct = {
      id: `manual-${Date.now()}`,
      url: url || 'https://www.aliexpress.com',
      source: url.includes('alibaba') ? 'alibaba' : 'aliexpress',
      title: manualProduct.title,
      description: manualProduct.title,
      images: manualProduct.imageUrl ? [manualProduct.imageUrl] : [],
      price: price,
      currency: 'USD',
      variants: [{ id: 'v1', name: 'Standard', price }],
      category: 'General',
      shippingTime: '15-30 days',
      minOrderQuantity: 1,
      supplierRating: 4.5,
      createdAt: new Date(),
    };

    addProduct(product);
    setUrl('');
    setManualProduct({ title: '', price: '', imageUrl: '' });
    setShowManualEntry(false);
    setError('');
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00d4ff]/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#00c9b7]/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-7xl mx-auto px-6 py-16"
      >
        {/* Header Section */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/80 backdrop-blur-xl border-2 border-[#00d4ff]/20 shadow-lg mb-8"
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
            className="text-6xl md:text-7xl font-black mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-slate-900">Import</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
              your products
            </span>
          </motion.h1>
          
          <motion.p 
            className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Importez vos produits depuis AliExpress ou Alibaba via URL ou screenshot
          </motion.p>
        </motion.div>

        {/* Image Upload Section */}
        <motion.div 
          className="max-w-3xl mx-auto mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00c9b7] to-[#00d4ff] rounded-3xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
            <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl border-2 border-slate-200 shadow-2xl p-8">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00c9b7]/10 to-[#00d4ff]/10 flex items-center justify-center mx-auto mb-4 border-2 border-[#00c9b7]/20"
                >
                  <ImageIcon className="w-10 h-10 text-[#00c9b7]" />
                </motion.div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  Prendre un screenshot
                </h3>
                <p className="text-slate-600 mb-6">
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
                  whileHover={!isLoadingImage ? { scale: 1.02 } : {}}
                  whileTap={!isLoadingImage ? { scale: 0.98 } : {}}
                  className={`
                    inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg cursor-pointer transition-all
                    ${isLoadingImage
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
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

        {/* Divider */}
        <div className="max-w-3xl mx-auto mb-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Ou</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
        </div>

        {/* Import Bar - Large and prominent */}
        <motion.div 
          className="max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] rounded-3xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
            <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl border-2 border-slate-200 shadow-2xl p-2">
              <div className="flex items-center gap-4 px-6">
                <Link2 size={24} className="text-[#00d4ff] flex-shrink-0" />
                <input
                  type="text"
                  placeholder="https://aliexpress.com/item/..."
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAddProduct()}
                  disabled={isLoading}
                  className="flex-1 py-5 text-lg bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none disabled:opacity-50"
                />
                {url && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => setUrl('')}
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <X size={18} className="text-slate-400" />
                  </motion.button>
                )}
                <motion.button
                  onClick={handleAddProduct}
                  disabled={isLoading || !url.trim()}
                  whileHover={!isLoading && url.trim() ? { scale: 1.05 } : {}}
                  whileTap={!isLoading && url.trim() ? { scale: 0.95 } : {}}
                  className={`
                    flex items-center gap-2 px-8 py-5 rounded-2xl font-bold text-lg transition-all
                    ${isLoading || !url.trim()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-xl shadow-[#00d4ff]/30 hover:shadow-[#00d4ff]/50'
                    }
                  `}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      Ajouter
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-4 rounded-2xl bg-red-50 border-2 border-red-200"
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

        </motion.div>

        {/* Products List */}
        <motion.div 
          className="mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              Products to analyze
            </h2>
            <span className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#00d4ff]/10 to-[#00c9b7]/10 border-2 border-[#00d4ff]/20 text-[#00d4ff] font-bold text-sm shadow-sm">
              {products.length} product{products.length !== 1 ? 's' : ''}
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
              <p className="text-sm text-slate-500">Collez un lien AliExpress ci-dessus pour commencer</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    transition={{ 
                      delay: index * 0.05,
                      type: 'spring',
                      stiffness: 100
                    }}
                    layout
                    className="group relative p-6 rounded-3xl bg-white border-2 border-slate-200 hover:border-[#00d4ff]/50 hover:shadow-xl hover:shadow-[#00d4ff]/10 transition-all duration-300 overflow-hidden"
                  >
                    {/* Shine effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: 'linear-gradient(110deg, transparent 40%, rgba(0,212,255,0.1) 50%, transparent 60%)',
                      }}
                    />

                    <div className="relative z-10 flex items-center gap-6">
                      {/* Image */}
                      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 border-2 border-slate-200 shadow-sm">
                        {product.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.images[0]}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-10 h-10 text-slate-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 truncate mb-2">
                          {product.title}
                        </h3>
                        <div className="flex items-center gap-4">
                          {product.price === 0 ? (
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  const newPrice = prompt('Enter the product price (USD):', '');
                                  if (newPrice && !isNaN(parseFloat(newPrice)) && parseFloat(newPrice) > 0) {
                                    const updatedProduct = { ...product, price: parseFloat(newPrice) };
                                    removeProduct(product.id);
                                    addProduct(updatedProduct);
                                  } else if (newPrice) {
                                    alert('Veuillez entrer un prix valide supérieur à 0');
                                  }
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors font-semibold text-sm"
                              >
                                <AlertCircle size={16} />
                                Price required - Click to add
                              </button>
                              <p className="text-xs text-amber-600">Price is required to continue</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">
                                {formatCurrency(product.price)}
                              </span>
                              <button
                                onClick={() => {
                                  const newPrice = prompt('Edit product price (USD):', product.price.toString());
                                  if (newPrice && !isNaN(parseFloat(newPrice)) && parseFloat(newPrice) > 0) {
                                    const updatedProduct = { ...product, price: parseFloat(newPrice) };
                                    removeProduct(product.id);
                                    addProduct(updatedProduct);
                                  } else if (newPrice) {
                                    alert('Veuillez entrer un prix valide supérieur à 0');
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-[#00d4ff] hover:bg-[#00d4ff]/10 rounded-lg transition-all"
                                title="Edit price"
                              >
                                <Edit3 size={14} />
                              </button>
                            </div>
                          )}
                          <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600">
                            {product.source === 'aliexpress' ? 'AliExpress' : 'Alibaba'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 text-slate-400 hover:text-[#00d4ff] hover:bg-[#00d4ff]/10 rounded-xl transition-all border-2 border-transparent hover:border-[#00d4ff]/20"
                        >
                          <ExternalLink size={20} />
                        </a>
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border-2 border-transparent hover:border-red-200"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
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
            className="flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-semibold transition-all shadow-sm hover:shadow-md"
          >
            <ArrowLeft size={20} />
            Retour
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
              whileHover={products.length > 0 && !products.some(p => p.price === 0) ? { scale: 1.05, y: -2 } : {}}
              whileTap={products.length > 0 && !products.some(p => p.price === 0) ? { scale: 0.95 } : {}}
              className={`
                group relative px-16 py-6 text-xl font-bold rounded-2xl transition-all duration-300 overflow-hidden
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
                Analyze {products.length > 0 && `(${products.length})`}
                <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {showManualEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowManualEntry(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-[#00d4ff]/5 to-[#00c9b7]/5">
                <h3 className="text-2xl font-bold text-slate-900">Ajouter manuellement</h3>
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={22} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">Product title</label>
                  <input
                    type="text"
                    placeholder="Product name..."
                    value={manualProduct.title}
                    onChange={(e) => setManualProduct({ ...manualProduct, title: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 focus:outline-none transition-all text-lg"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">Price (USD)</label>
                  <div className="relative">
                    <DollarSign size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="5.99"
                      value={manualProduct.price}
                      onChange={(e) => setManualProduct({ ...manualProduct, price: e.target.value })}
                      className="w-full pl-14 pr-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 focus:outline-none transition-all text-lg"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">URL de l&apos;image (optionnel)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={manualProduct.imageUrl}
                    onChange={(e) => setManualProduct({ ...manualProduct, imageUrl: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 focus:outline-none transition-all text-lg"
                  />
                </div>
              </div>
              
              <div className="px-8 pb-8 flex gap-4">
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="flex-1 px-6 py-4 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold transition-colors border-2 border-slate-200"
                >
                  Annuler
                </button>
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualProduct.title.trim() || !manualProduct.price.trim()}
                  className="flex-1 px-6 py-4 text-white bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:from-[#00b8e6] hover:to-[#00a89a] rounded-2xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  Ajouter
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
