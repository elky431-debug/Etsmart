import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  AppState, 
  Niche, 
  SupplierProduct, 
  ProductAnalysis, 
  BoutiqueAnalysis 
} from '@/types';

interface AppActions {
  setStep: (step: 1 | 2 | 3 | 4) => void;
  setNiche: (niche: Niche | null) => void;
  setCustomNiche: (niche: string) => void;
  addProduct: (product: SupplierProduct) => void;
  removeProduct: (productId: string) => void;
  updateProduct: (productId: string, updates: Partial<SupplierProduct>) => void;
  setAnalyses: (analyses: ProductAnalysis[]) => void;
  addAnalysis: (analysis: ProductAnalysis) => void;
  setBoutiqueAnalysis: (analysis: BoutiqueAnalysis | null) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: AppState = {
  currentStep: 1,
  selectedNiche: null,
  customNiche: '',
  products: [],
  analyses: [],
  boutiqueAnalysis: null,
  isAnalyzing: false,
  error: null,
};

export const useStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setStep: (step) => {
        console.log('[Store] setStep:', step);
        set({ currentStep: step });
      },
      
      setNiche: (niche) => {
        console.log('[Store] setNiche:', niche);
        set({ selectedNiche: niche });
      },
      
      setCustomNiche: (niche) => {
        console.log('[Store] setCustomNiche:', niche);
        set({ customNiche: niche });
      },
      
      addProduct: (product) => {
        console.log('[Store] addProduct:', product.title);
        set((state) => ({ 
          // ⚠️ LIMITATION : Un seul produit à la fois - remplacer au lieu d'ajouter
          products: [product] 
        }));
      },
      
      removeProduct: (productId) => {
        console.log('[Store] removeProduct:', productId);
        set((state) => ({
          products: state.products.filter((p) => p.id !== productId),
          analyses: state.analyses.filter((a) => a.product.id !== productId),
        }));
      },
      
      updateProduct: (productId, updates) => {
        console.log('[Store] updateProduct:', productId, updates);
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, ...updates } : p
          ),
        }));
      },
      
      setAnalyses: (analyses) => {
        console.log('[Store] setAnalyses:', analyses.length);
        set({ analyses });
      },
      
      addAnalysis: (analysis) => {
        console.log('[Store] addAnalysis:', analysis.product.title);
        set((state) => ({
          analyses: [...state.analyses.filter(a => a.product.id !== analysis.product.id), analysis],
        }));
      },
      
      setBoutiqueAnalysis: (analysis) => {
        console.log('[Store] setBoutiqueAnalysis');
        set({ boutiqueAnalysis: analysis });
      },
      
      setIsAnalyzing: (isAnalyzing) => {
        console.log('[Store] setIsAnalyzing:', isAnalyzing);
        set({ isAnalyzing });
      },
      
      setError: (error) => {
        console.log('[Store] setError:', error);
        set({ error });
      },
      
      reset: () => {
        console.log('[Store] ⚠️ RESET appelé - réinitialisation complète');
        // Nettoyer aussi localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('analysis-state');
        }
        set(initialState);
      },
    }),
    {
      name: 'etsmart-storage',
      // Utiliser localStorage au lieu de sessionStorage pour persister même après fermeture
      storage: typeof window !== 'undefined' ? {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          try {
            return JSON.parse(str);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      } : undefined,
      partialize: (state) => ({
        currentStep: state.currentStep,
        selectedNiche: state.selectedNiche,
        customNiche: state.customNiche,
        products: state.products,
        analyses: state.analyses,
        boutiqueAnalysis: state.boutiqueAnalysis,
        isAnalyzing: state.isAnalyzing, // Persister l'état d'analyse
      }),
      // Ne pas réinitialiser si les données sont corrompues
      skipHydration: false,
      onRehydrateStorage: () => (state) => {
        console.log('[Store] ✅ Réhydratation terminée:', {
          currentStep: state?.currentStep,
          productsCount: state?.products.length,
          analysesCount: state?.analyses.length,
          isAnalyzing: state?.isAnalyzing,
        });
      },
    }
  )
);

