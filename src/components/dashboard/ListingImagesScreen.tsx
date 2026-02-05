'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText,
  ArrowLeft,
  Package
} from 'lucide-react';
import type { ProductAnalysis } from '@/types';
import { DashboardListing } from './DashboardListing';
import { DashboardImage } from './DashboardImage';
import { ListingProductImport } from './ListingProductImport';

interface ListingImagesScreenProps {
  analyses?: ProductAnalysis[];
  onAnalysisSelect?: (analysis: ProductAnalysis) => void;
  onBack?: () => void;
  initialAnalysis?: ProductAnalysis | null;
  mode?: 'listing' | 'images';
}

export function ListingImagesScreen({ 
  analyses = [],
  onAnalysisSelect,
  onBack,
  initialAnalysis = null,
  mode = 'listing' // Par défaut, afficher le listing
}: ListingImagesScreenProps) {
  const [localSelectedAnalysis, setLocalSelectedAnalysis] = useState<ProductAnalysis | null>(initialAnalysis);
  
  // Mettre à jour si initialAnalysis change
  useEffect(() => {
    if (initialAnalysis) {
      setLocalSelectedAnalysis(initialAnalysis);
    }
  }, [initialAnalysis]);

  const handleProductImported = (product: any) => {
    // Le produit est déjà géré par ListingProductImport
    // Cette fonction est optionnelle
  };

  // Si une analyse est sélectionnée, afficher le contenu selon le mode
  if (localSelectedAnalysis) {
    try {
      return (
        <div className="p-4 md:p-8 bg-black min-h-screen">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => {
                  setLocalSelectedAnalysis(null);
                  if (onBack) {
                    onBack();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/10"
              >
                <ArrowLeft size={20} />
                <span>Retour à l'import</span>
              </button>
            </div>

            {/* Contenu selon le mode */}
            {mode === 'images' ? (
              <DashboardImage analysis={localSelectedAnalysis} />
            ) : (
              <DashboardListing analysis={localSelectedAnalysis} />
            )}
          </div>
        </div>
      );
    } catch (error) {
      console.error('[ListingImagesScreen] Error rendering:', error);
      return (
        <div className="p-4 md:p-8 bg-black min-h-screen">
          <div className="max-w-7xl mx-auto">
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-400">Erreur lors du chargement. Veuillez réessayer.</p>
            </div>
          </div>
        </div>
      );
    }
  }

  // Afficher l'écran d'import de produit avec le mode approprié
  return <ListingProductImport onProductImported={handleProductImported} mode={mode} />;
}

