'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Download, AlertCircle, CheckCircle2, Loader2, ExternalLink, Store, Sparkles, Coins, ChevronDown, Chrome, Check } from 'lucide-react';
import { niches } from '@/lib/niches';
import { motion, AnimatePresence } from 'framer-motion';

// ID réel de l'extension publiée sur le Chrome Web Store
const EXTENSION_ID = 'daenliioilkcdiaagbpieblmphfpgfff';
const CHROME_WEB_STORE_URL =
  'https://chromewebstore.google.com/detail/etsmart-analyseur-de-bout/daenliioilkcdiaagbpieblmphfpgfff';
const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://etsmart.app';

interface CompetitorFinderProps {
  onAnalysisComplete?: (data: any) => void;
}

export function CompetitorFinder({ onAnalysisComplete }: CompetitorFinderProps) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [extensionChecked, setExtensionChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Détecter l'extension Chrome
  useEffect(() => {
    if (typeof window === 'undefined' || typeof chrome === 'undefined') {
      setExtensionChecked(true);
      return;
    }

    const checkExtension = () => {
      try {
        // Essayer d'envoyer un message à l'extension
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          { type: 'PING' },
          (response) => {
            if (chrome.runtime.lastError) {
              // Extension non trouvée
              setExtensionDetected(false);
            } else {
              // Extension trouvée
              setExtensionDetected(true);
            }
            setExtensionChecked(true);
          }
        );
      } catch (error) {
        console.log('[CompetitorFinder] Extension non détectée:', error);
        setExtensionDetected(false);
        setExtensionChecked(true);
      }
    };

    checkExtension();
  }, []);

  // Construire l'URL de recherche Etsy
  const buildEtsySearchUrl = (category: string, nicheValue: string): string => {
    const query = nicheValue || category;
    const encodedQuery = encodeURIComponent(query);
    return `https://www.etsy.com/fr/search?q=${encodedQuery}&ref=search_bar`;
  };

  // Démarrer l'import via l'extension
  const handleStartImport = async () => {
    if (!selectedCategory && !niche) {
      setError('Veuillez sélectionner une catégorie ou saisir une niche');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchUrl = buildEtsySearchUrl(selectedCategory, niche);
      const searchNiche = niche || selectedCategory;

      if (extensionDetected && !manualMode) {
        // Mode extension
        try {
          chrome.runtime.sendMessage(
            EXTENSION_ID,
            {
              type: 'START_IMPORT',
              niche: searchNiche,
              searchUrl: searchUrl,
              apiUrl: API_BASE_URL,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.log('[CompetitorFinder] Erreur extension:', chrome.runtime.lastError);
                setError('Extension non disponible. Utilisez le mode manuel.');
                setLoading(false);
              } else {
                console.log('[CompetitorFinder] Import démarré via extension');
                // L'extension va ouvrir Etsy et scraper automatiquement
              }
            }
          );
        } catch (error) {
          console.log('[CompetitorFinder] Erreur communication extension:', error);
          setError('Erreur de communication avec l\'extension');
          setLoading(false);
        }
      } else {
        // Mode manuel : ouvrir Etsy dans un nouvel onglet
        window.open(searchUrl, '_blank');
        setError('Mode manuel activé. Veuillez installer l\'extension Chrome pour l\'import automatique.');
        setLoading(false);
      }
    } catch (error: any) {
      console.log('[CompetitorFinder] Erreur:', error);
      setError(error.message || 'Une erreur est survenue');
      setLoading(false);
    }
  };

  // Forcer le mode manuel (pour développeurs)
  const handleManualMode = () => {
    setManualMode(true);
    setExtensionDetected(false);
  };

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Glow effect behind card */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[#00d4ff]/20 via-[#00c9b7]/10 to-[#00d4ff]/20 rounded-3xl blur-xl opacity-60" />

      <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header gradient accent */}
        <div className="h-1 bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]" />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/20 border border-[#00d4ff]/20 mb-4">
              <Store className="w-7 h-7 text-[#00d4ff]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Trouver les boutiques dominantes
            </h2>
            <p className="text-white/50 text-sm sm:text-base max-w-md mx-auto">
              Analysez automatiquement les meilleures boutiques Etsy de votre niche avec l&apos;IA
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/25 text-[#00d4ff] text-sm font-medium mt-4">
              <Coins size={14} />
              4 crédits par analyse
            </div>
          </div>

          {/* Formulaire */}
          <div className="space-y-5 mb-6">
            {/* Catégorie - Dropdown personnalisé */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Catégorie <span className="text-white/30">(optionnel)</span>
              </label>
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white text-left flex items-center justify-between transition-all ${
                    isCategoryOpen
                      ? 'border-[#00d4ff]/50 ring-2 ring-[#00d4ff]/30 bg-white/10'
                      : 'border-white/10 hover:border-[#00d4ff]/30'
                  }`}
                >
                  <span className={selectedCategory ? 'text-white' : 'text-white/50'}>
                    {selectedCategory || 'Sélectionner une catégorie'}
                  </span>
                  <ChevronDown 
                    className={`w-5 h-5 text-[#00d4ff] transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {isCategoryOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-50 w-full mt-2 bg-black/95 backdrop-blur-xl border border-[#00d4ff]/20 rounded-xl shadow-2xl shadow-[#00d4ff]/10 overflow-hidden"
                    >
                      {/* Header avec gradient */}
                      <div className="px-4 py-3 bg-gradient-to-r from-[#00d4ff]/10 to-[#00c9b7]/10 border-b border-[#00d4ff]/20 flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#00d4ff]" />
                        <span className="text-sm font-semibold text-white">Sélectionner une catégorie</span>
                      </div>

                      {/* Liste des catégories */}
                      <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('');
                            setIsCategoryOpen(false);
                          }}
                          className={`w-full px-4 py-3 text-left transition-all flex items-center justify-between ${
                            selectedCategory === ''
                              ? 'bg-gradient-to-r from-[#00d4ff]/20 to-[#00c9b7]/20 text-white'
                              : 'text-white/70 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className="text-sm">Aucune catégorie</span>
                          {selectedCategory === '' && <Check className="w-4 h-4 text-[#00d4ff]" />}
                        </button>

                        {niches.map((nicheItem, index) => (
                          <motion.button
                            key={nicheItem.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(nicheItem.name);
                              setIsCategoryOpen(false);
                            }}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={`w-full px-4 py-3 text-left transition-all flex items-center justify-between border-t border-white/5 ${
                              selectedCategory === nicheItem.name
                                ? 'bg-gradient-to-r from-[#00d4ff]/20 to-[#00c9b7]/20 text-white'
                                : 'text-white/80 hover:bg-gradient-to-r hover:from-[#00d4ff]/10 hover:to-[#00c9b7]/10 hover:text-white'
                            }`}
                          >
                            <span className="text-sm font-medium">{nicheItem.name}</span>
                            {selectedCategory === nicheItem.name && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center"
                              >
                                <Check className="w-3 h-3 text-white" />
                              </motion.div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Niche */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Niche ou mot-clé <span className="text-[#00d4ff]">*</span>
              </label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5 group-focus-within:text-[#00d4ff] transition-colors" />
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStartImport()}
                  placeholder="Ex: montres minimalistes, bijoux personnalisés..."
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50 focus:border-[#00d4ff]/50 transition-all hover:border-white/20"
                />
              </div>
            </div>
          </div>

          {/* Statut extension */}
          {extensionChecked && (
            <div className={`mb-5 p-4 rounded-xl flex items-start gap-3 ${
              extensionDetected && !manualMode
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'bg-amber-500/10 border border-amber-500/20'
            }`}>
              {extensionDetected && !manualMode ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-300">
                      Extension détectée
                    </p>
                    <p className="text-xs text-emerald-400/70 mt-0.5">
                      L&apos;import automatique est disponible
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-300">
                      Extension non détectée
                    </p>
                    <p className="text-xs text-amber-400/70 mt-0.5">
                      {manualMode 
                        ? 'Mode développeur activé'
                        : 'Installez l\'extension Chrome pour l\'import automatique'
                      }
                    </p>
                    {!manualMode && (
                      <button
                        onClick={handleManualMode}
                        className="mt-1.5 text-xs text-amber-400/60 underline hover:text-amber-300 transition-colors"
                      >
                        Mode développeur : Oui, elle est installée
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tutoriel installation extension via Chrome Web Store */}
          {!extensionDetected && !manualMode && extensionChecked && (
            <div className="mb-5 p-5 bg-white/[0.03] border border-white/10 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4ff]/15 to-[#00c9b7]/15 border border-[#00d4ff]/15 flex items-center justify-center flex-shrink-0">
                  <Chrome className="w-5 h-5 text-[#00d4ff]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Installer l&apos;extension Etsmart
                  </h3>
                  <p className="text-xs text-white/40 mb-3">
                    Pour activer l&apos;import automatique, installez l&apos;extension gratuite depuis le Chrome Web Store.
                  </p>
                  <a
                    href={CHROME_WEB_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-semibold hover:bg-white/15 transition-colors"
                  >
                    Installer l&apos;extension
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <p className="mt-2.5 text-[11px] text-white/30">
                    Une fois installée, rechargez cette page pour que Etsmart détecte automatiquement l&apos;extension.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-300 flex-1">{error}</p>
            </div>
          )}

          {/* Bouton CTA */}
          <button
            onClick={handleStartImport}
            disabled={loading || (!selectedCategory && !niche)}
            className="group relative w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-[#00d4ff]/20 transition-all overflow-hidden"
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analyse en cours...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Analyser les boutiques concurrentes</span>
              </>
            )}
          </button>

          {/* Info footer */}
          <p className="mt-4 text-xs text-white/25 text-center">
            L&apos;extension va ouvrir Etsy, scraper les boutiques et les analyser automatiquement avec GPT-4o
          </p>
        </div>
      </div>
    </div>
  );
}
