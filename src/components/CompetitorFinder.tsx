'use client';

import { useState, useEffect } from 'react';
import { Search, Download, AlertCircle, CheckCircle2, Loader2, ExternalLink, Sparkles, Clock } from 'lucide-react';
import { niches } from '@/lib/niches';

const EXTENSION_ID = 'YOUR_EXTENSION_ID'; // À remplacer par l'ID réel après installation
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

  return (
    <div className="relative w-full max-w-2xl mx-auto p-6 sm:p-8 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-lg">
      {/* Contenu avec flou */}
      <div className="blur-sm pointer-events-none select-none">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            Trouver les boutiques dominantes
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Analysez automatiquement les meilleures boutiques Etsy de votre niche
          </p>
        </div>

        {/* Formulaire */}
        <div className="space-y-4 mb-6">
        {/* Catégorie */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Catégorie (optionnel)
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00d4ff] focus:border-transparent"
          >
            <option value="">Sélectionner une catégorie</option>
            {niches.map((nicheItem) => (
              <option key={nicheItem.id} value={nicheItem.name}>
                {nicheItem.name}
              </option>
            ))}
          </select>
        </div>

        {/* Niche */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Niche ou mot-clé <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Ex: montres minimalistes, bijoux personnalisés..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00d4ff] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Statut extension */}
      {extensionChecked && (
        <div className={`mb-4 p-3 rounded-lg flex items-start gap-3 ${
          extensionDetected && !manualMode
            ? 'bg-green-50 border border-green-200'
            : 'bg-amber-50 border border-amber-200'
        }`}>
          {extensionDetected && !manualMode ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">
                  Extension détectée
                </p>
                <p className="text-xs text-green-700 mt-1">
                  L'import automatique est disponible
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">
                  Extension non détectée
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  {manualMode 
                    ? 'Mode développeur activé'
                    : 'Installez l\'extension Chrome pour l\'import automatique'
                  }
                </p>
                {!manualMode && (
                  <button
                    onClick={handleManualMode}
                    className="mt-2 text-xs text-amber-700 underline hover:text-amber-900"
                  >
                    Mode développeur : Oui, elle est installée
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tutoriel installation extension */}
      {!extensionDetected && !manualMode && extensionChecked && (
        <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            Comment installer l'extension
          </h3>
          <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
            <li>Ouvrez Chrome et allez dans <code className="bg-slate-200 px-1 rounded">chrome://extensions/</code></li>
            <li>Activez le "Mode développeur" (en haut à droite)</li>
            <li>Cliquez sur "Charger l'extension non empaquetée"</li>
            <li>Sélectionnez le dossier <code className="bg-slate-200 px-1 rounded">extension/</code> du projet</li>
            <li>Rechargez cette page</li>
          </ol>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-900 flex-1">{error}</p>
        </div>
      )}

      {/* Bouton CTA */}
      <button
        onClick={handleStartImport}
        disabled={loading || (!selectedCategory && !niche)}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-full shadow-lg shadow-[#00d4ff]/20 transition-all"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Analyse en cours...</span>
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            <span>Trouver les boutiques dominantes</span>
            <ExternalLink className="w-4 h-4" />
          </>
        )}
      </button>

        {/* Info */}
        <p className="mt-4 text-xs text-slate-500 text-center">
          L'extension va ouvrir Etsy, scraper les boutiques et les analyser automatiquement avec l'IA
        </p>
      </div>

      {/* Overlay avec message "Arrive très bientôt" */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-2xl sm:rounded-3xl z-10">
        <div className="text-center p-8 max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] mb-6 shadow-lg shadow-[#00d4ff]/30">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Arrive très bientôt
          </h3>
          <p className="text-white/80 text-sm sm:text-base mb-4">
            Cette fonctionnalité sera disponible dès que l'extension Chrome sera publiée sur le Chrome Web Store.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-full backdrop-blur-sm">
            <Clock className="w-4 h-4 text-[#00d4ff]" />
            <span className="text-sm font-medium text-white">
              Disponible prochainement
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

