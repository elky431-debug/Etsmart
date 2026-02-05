'use client';

import { useState, useEffect, useRef } from 'react';
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
  Eye,
  Home
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { formatCurrency } from '@/lib/utils';
import { niches } from '@/lib/niches';
import type { SupplierProduct } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import { Paywall } from '@/components/paywall/Paywall';

export function ProductImport() {
  const { selectedNiche, products, addProduct, removeProduct, setStep } = useStore();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { user } = useAuth();
  const { subscription, loading: subscriptionLoading, canAnalyze, hasActiveSubscription, hasQuota, refreshSubscription } = useSubscription();
  const quotaReached = subscription ? subscription.remaining === 0 && subscription.status === 'active' : false;
  
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [error, setError] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(true); // Visible par défaut

  const currentNiche = niches.find(n => n.id === selectedNiche);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Force sync subscription on mount only once (avoid infinite loop)
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (user && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      // Don't wait for subscriptionLoading, just sync once
      refreshSubscription(true).catch(err => {
        console.error('Error syncing subscription:', err);
      });
    }
  }, [user?.id]); // Only depend on user.id to avoid re-triggering

  // ⚠️ NOTE: Le lancement automatique de l'analyse a été retiré
  // L'utilisateur doit maintenant cliquer sur le bouton "Analyser" pour démarrer l'analyse

  // Handle Analyze button click - check quota and deduct credits before proceeding
  const handleAnalyzeClick = async () => {
    // Check if user is authenticated
    if (!user) {
      setError('Veuillez vous connecter pour analyser des produits');
      return;
    }

    // Vérifier qu'on a un produit avec un prix
    if (products.length === 0 || products[0].price === 0) {
      setError('Veuillez ajouter un produit avec un prix pour continuer');
      return;
    }

    // ⚠️ CRITICAL: Vérifier le quota et déduire les crédits AVANT de passer à l'étape d'analyse
    try {
      const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
      const quotaInfo = await getUserQuotaInfo(user.id);
      
      if (quotaInfo.status !== 'active') {
        setError('Un abonnement actif est requis pour analyser des produits');
        return;
      }

      // Vérifier si l'utilisateur a assez de quota (0.5 crédit nécessaire)
      const creditNeeded = 0.5;
      if (quotaInfo.remaining < creditNeeded) {
        setError(`Quota insuffisant. Vous avez besoin de ${creditNeeded} crédit(s) pour analyser un produit.`);
        return;
      }

      // Déduire les crédits AVANT de démarrer l'analyse
      console.log('[ProductImport] ⚠️ About to decrement 0.5 credit for analysis (user:', user.id, ')');
      const quotaResult = await incrementAnalysisCount(user.id, creditNeeded);
      
      if (!quotaResult.success) {
        console.error('❌ [ProductImport] Failed to decrement quota:', quotaResult.error);
        setError('Erreur lors de la déduction des crédits. Veuillez réessayer.');
        return;
      }

      console.log('✅ [ProductImport] Quota decremented successfully:', {
        used: quotaResult.used,
        quota: quotaResult.quota,
        remaining: quotaResult.remaining,
        amount: creditNeeded,
      });

      // Rafraîchir l'affichage des crédits
      await refreshSubscription(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('subscription-refresh'));
      }

      // Maintenant passer à l'étape d'analyse
      setStep(3);
    } catch (error: any) {
      console.error('❌ [ProductImport] Error checking quota:', error);
      setError('Erreur lors de la vérification du quota. Veuillez réessayer.');
    }
  };

  // Refresh subscription after payment and close paywall if subscription is active
  useEffect(() => {
    // Check if we're returning from payment
    const handleFocus = async () => {
      // Force refresh subscription when window regains focus
      await refreshSubscription(true);
    };
    
    // Also check URL params for success
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const success = params.get('success');
      if (success === 'true') {
        // Force sync with Stripe immediately
        refreshSubscription(true);
        // Clean up URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshSubscription]);


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
      setError('Veuillez sélectionner une image (PNG, JPG, etc.)');
      return;
    }

    // Limiter la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('L\'image est trop grande (max 10 Mo)');
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

      // Get auth token for API call - rafraîchir si nécessaire
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Si pas de session ou erreur, essayer de rafraîchir
      if (!session || sessionError) {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshedSession) {
          session = refreshedSession;
        } else if (refreshError) {
          setError('Session expirée. Veuillez vous reconnecter.');
          setIsLoadingImage(false);
          // Rediriger vers la page de connexion après 2 secondes
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }
      }
      
      const token = session?.access_token;
      
      if (!token) {
        setError('Authentification requise. Veuillez vous reconnecter.');
        setIsLoadingImage(false);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      const response = await fetch('/api/parse-product-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Gérer les erreurs HTTP
        const errorMessage = data.message || data.error || `Erreur ${response.status}`;
        
        // Si le token est expiré, rafraîchir et réessayer une fois
        if (response.status === 401 && (errorMessage.includes('token') || errorMessage.includes('expired'))) {
          console.log('🔄 Token expiré, tentative de rafraîchissement...');
          const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (newSession?.access_token && !refreshError) {
            // Réessayer avec le nouveau token
            const retryResponse = await fetch('/api/parse-product-image', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${newSession.access_token}`,
              },
              body: formData,
            });
            
            const retryData = await retryResponse.json();
            
            if (retryResponse.ok && retryData.success && retryData.product) {
              addProduct(retryData.product);
              setUploadedImage(null);
              setError('');
              e.target.value = '';
              setIsLoadingImage(false);
              return;
            }
          }
          
          // Si le rafraîchissement échoue, rediriger vers la connexion
          setError('Session expirée. Redirection vers la page de connexion...');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          setIsLoadingImage(false);
          return;
        }
        
        setError(errorMessage);
        console.error('API Error:', response.status, data);
        setIsLoadingImage(false);
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
        
        // ⚠️ AUTO-LAUNCH: Si le produit a un prix, lancer automatiquement l'analyse
        if (data.product.price > 0) {
          // Attendre un court délai pour que le produit soit bien ajouté au store
          setTimeout(() => {
            setStep(3); // Passer à l'étape d'analyse qui lancera automatiquement l'analyse
          }, 500);
        }
        // Si le prix est 0, on attendra que l'utilisateur l'ajoute (voir useEffect ci-dessous)
      } else {
        // Extraire le message d'erreur
        const errorMessage = data.message || data.error || 'Impossible d\'extraire les informations de la capture d\'écran. Essayez de prendre une photo plus claire de la page produit.';
        setError(errorMessage);
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      setError('Erreur lors du téléchargement de l\'image. Veuillez réessayer.');
    } finally {
      setIsLoadingImage(false);
    }
  };

  // ⚠️ CRITICAL: Afficher le paywall si l'utilisateur n'a pas d'abonnement actif
  // Vérification simple : si le chargement est terminé ET l'utilisateur est connecté
  if (user && !subscriptionLoading) {
    // Vérifier directement le statut de l'abonnement
    const subscriptionStatus = subscription?.status;
    const isSubscriptionActive = subscriptionStatus === 'active' || (subscription?.periodEnd && new Date(subscription.periodEnd) > new Date());
    
    // Si pas d'abonnement OU abonnement non actif, afficher le paywall
    if (!subscription || !isSubscriptionActive) {
      console.log('[ProductImport] 🚧 PAYWALL AFFICHÉ - user:', user?.id, 'subscription:', subscription, 'isSubscriptionActive:', isSubscriptionActive, 'hasActiveSubscription:', hasActiveSubscription);
      return (
        <div className="min-h-screen w-full relative overflow-hidden bg-black">
          <Paywall 
            hasActiveSubscription={false}
            title="Débloquer l'import de produits"
            message="Choisissez votre plan et commencez à importer des produits depuis AliExpress"
          />
        </div>
      );
    }
  }

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
        className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10"
      >
        {/* Header Section */}
        <motion.div 
          className="text-center mb-6 sm:mb-10"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-black border-2 border-white/10 mb-3 sm:mb-5 text-xs sm:text-sm"
          >
            <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
            <span className="text-sm font-bold text-[#00d4ff]">ÉTAPE 2 SUR 3</span>
            {currentNiche && (
              <>
                <span className="text-white/40">•</span>
                <span className="text-sm font-bold text-white">{currentNiche.name}</span>
              </>
            )}
            <Zap size={16} className="text-[#00c9b7]" />
          </motion.div>
          
          {/* Quota Indicator */}
          {subscription && subscription.status === 'active' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#00d4ff]/10 to-[#00c9b7]/10 border border-[#00d4ff]/30 mb-4"
            >
              <Zap size={14} className="text-[#00d4ff]" />
              <span className="text-sm font-semibold text-white">
                {subscription.used % 1 === 0 ? subscription.used : subscription.used.toFixed(1)} / {subscription.quota} analyses
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                subscription.remaining > subscription.quota * 0.5 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : subscription.remaining > subscription.quota * 0.2 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {subscription.remaining} restantes
              </span>
            </motion.div>
          )}
          
          <motion.h1 
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-3 sm:mb-4"
            initial={isMobile ? undefined : { opacity: 0, y: 20 }}
            animate={isMobile ? undefined : { opacity: 1, y: 0 }}
            transition={isMobile ? undefined : { delay: 0.3 }}
          >
            <span className="text-white">Importez</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
              vos produits
            </span>
          </motion.h1>
          
          <motion.p 
            className="text-sm sm:text-base text-white/70 max-w-2xl mx-auto leading-relaxed px-2 sm:px-0"
            initial={isMobile ? undefined : { opacity: 0 }}
            animate={isMobile ? undefined : { opacity: 1 }}
            transition={isMobile ? undefined : { delay: 0.4 }}
          >
            Prenez une capture d'écran de la page produit AliExpress/Alibaba et nous extrairons automatiquement toutes les informations
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
                    inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base cursor-pointer transition-all w-full sm:w-auto justify-center btn-mobile
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
                          <p className="text-xs text-white/70 leading-relaxed">
                            Prenez une capture d'écran de la page produit AliExpress ou Alibaba montrant l'image du produit, le titre et le prix.
                            <br />
                            <span className="text-white/50 italic">Cet exemple est donné à titre indicatif uniquement.</span>
                          </p>
                        </div>
                        <div className="relative rounded-xl overflow-hidden border-2 border-white/20 shadow-lg bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
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
                        </div>
                        <p className="mt-4 text-xs text-white/50 text-center">
                          📸 Capture d'écran d'une page produit AliExpress avec le produit "Etsmart Cup"
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
                      className="max-w-full h-auto max-h-64 rounded-2xl border-2 border-white/20 shadow-lg mx-auto"
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
              className="max-w-3xl mx-auto mt-4 p-4 rounded-2xl bg-red-500/10 border-2 border-red-500/30 backdrop-blur-sm"
            >
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-400 mb-1">{error}</p>
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
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Produits à analyser
            </h2>
          </div>

          {products.length === 0 ? (
            <div className="py-24 text-center border-2 border-dashed border-white/20 rounded-3xl bg-black backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/20 flex items-center justify-center mx-auto mb-6 border-2 border-[#00d4ff]/30 shadow-lg shadow-[#00d4ff]/20"
              >
                <Package className="w-12 h-12 text-[#00d4ff]" />
              </motion.div>
              <p className="text-lg font-bold text-white mb-2">Aucun produit ajouté</p>
              <p className="text-sm text-white/60">Prenez une capture d'écran de la page produit AliExpress/Alibaba ci-dessus pour commencer</p>
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
                  className="group relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-black backdrop-blur-xl border-2 border-white/10 hover:border-[#00d4ff]/50 hover:shadow-xl hover:shadow-[#00d4ff]/20 transition-all duration-300 overflow-hidden"
                >
                    {/* Shine effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: 'linear-gradient(110deg, transparent 40%, rgba(0,212,255,0.1) 50%, transparent 60%)',
                      }}
                    />

                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                      {/* Image */}
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-black flex-shrink-0 border-2 border-white/10 shadow-sm">
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
                            <Package className="w-8 h-8 sm:w-10 sm:h-10 text-white/40" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <h3 className="text-base sm:text-lg font-bold text-white mb-2 line-clamp-2 sm:line-clamp-1">
                          {products[0].title}
                        </h3>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                          {products[0].price === 0 ? (
                            <div className="flex flex-col gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => {
                                  const newPrice = prompt('Entrez le prix du produit (USD) :', '');
                                  if (newPrice && !isNaN(parseFloat(newPrice)) && parseFloat(newPrice) > 0) {
                                    const updatedProduct = { ...products[0], price: parseFloat(newPrice) };
                                    addProduct(updatedProduct);
                                  } else if (newPrice) {
                                    alert('Veuillez entrer un prix valide supérieur à 0');
                                  }
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-colors font-semibold text-xs sm:text-sm"
                              >
                                <AlertCircle size={14} className="sm:w-4 sm:h-4" />
                                <span className="whitespace-nowrap">Prix requis - Cliquez pour ajouter</span>
                              </button>
                              <p className="text-xs text-amber-400/80">Le prix est requis pour continuer</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 sm:gap-3">
                              <span className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">
                                {formatCurrency(products[0].price)}
                              </span>
                              <button
                                onClick={() => {
                                  const newPrice = prompt('Modifier le prix du produit (USD) :', products[0].price.toString());
                                  if (newPrice && !isNaN(parseFloat(newPrice)) && parseFloat(newPrice) > 0) {
                                    const updatedProduct = { ...products[0], price: parseFloat(newPrice) };
                                    addProduct(updatedProduct);
                                  } else if (newPrice) {
                                    alert('Veuillez entrer un prix valide supérieur à 0');
                                  }
                                }}
                                className="p-1.5 text-white/60 hover:text-[#00d4ff] hover:bg-[#00d4ff]/10 rounded-lg transition-all"
                                title="Edit price"
                              >
                                <Edit3 size={14} />
                              </button>
                            </div>
                          )}
                          <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-black border border-white/10 text-[10px] sm:text-xs font-bold text-white/80 whitespace-nowrap">
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
                          className="p-3 text-white/60 hover:text-[#00d4ff] hover:bg-[#00d4ff]/10 rounded-xl transition-all border-2 border-transparent hover:border-[#00d4ff]/20"
                        >
                          <ExternalLink size={20} />
                        </a>
                        <button
                          onClick={() => removeProduct(products[0].id)}
                          className="p-3 text-white/60 hover:text-red-400 hover:bg-red-500/20 rounded-xl transition-all border-2 border-transparent hover:border-red-500/30"
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
            className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-black hover:bg-black border-2 border-white/10 hover:border-white/20 text-white font-semibold text-sm sm:text-base transition-all shadow-sm hover:shadow-md btn-mobile"
          >
            <ArrowLeft size={20} />
            Retour
          </motion.button>

          <div className="flex flex-col items-end gap-3">
            {products.some(p => p.price === 0) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium"
              >
                <AlertCircle size={16} />
                Tous les produits doivent avoir un prix renseigné
              </motion.div>
            )}
            <motion.button
              onClick={handleAnalyzeClick}
              disabled={products.length === 0 || products.some(p => p.price === 0) || subscriptionLoading}
              whileHover={products.length > 0 && !products.some(p => p.price === 0) && !subscriptionLoading && !isMobile ? { scale: 1.05, y: -2 } : {}}
              whileTap={products.length > 0 && !products.some(p => p.price === 0) && !subscriptionLoading && !isMobile ? { scale: 0.95 } : {}}
              className={`
                group relative w-full sm:w-auto px-6 sm:px-12 py-2.5 sm:py-3 md:py-4 text-sm sm:text-base md:text-lg font-bold rounded-xl transition-all duration-300 overflow-hidden btn-mobile
                ${products.length === 0 || products.some(p => p.price === 0) || subscriptionLoading
                  ? 'bg-black text-white/40 cursor-not-allowed border-2 border-white/5'
                  : 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-2xl shadow-[#00d4ff]/40 hover:shadow-[#00d4ff]/60 border-2 border-transparent'
                }
              `}
            >
              {products.length > 0 && !products.some(p => p.price === 0) && !subscriptionLoading && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-[#00c9b7] to-[#00d4ff] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                {subscriptionLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Chargement...
                  </>
                ) : (
                  <>
                    Analyser
                    <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </motion.button>
          </div>
        </motion.div>

        {/* Home Button - Small at bottom */}
        <motion.div 
          className="flex justify-center mt-8 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <motion.a
            href="/"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black hover:bg-black border border-white/10 hover:border-white/20 text-white hover:text-white transition-all text-xs font-medium"
          >
            <Home size={12} />
            <span>Accueil</span>
          </motion.a>
        </motion.div>
      </motion.div>

    </div>
  );
}
