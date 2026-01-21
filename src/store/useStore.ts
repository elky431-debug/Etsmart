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
    (set) => ({
      ...initialState,
      
      setStep: (step) => set({ currentStep: step }),
      
      setNiche: (niche) => set({ selectedNiche: niche }),
      
      setCustomNiche: (niche) => set({ customNiche: niche }),
      
      addProduct: (product) => 
        set((state) => ({ 
          // ⚠️ LIMITATION : Un seul produit à la fois - remplacer au lieu d'ajouter
          products: [product] 
        })),
      
      removeProduct: (productId) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== productId),
          analyses: state.analyses.filter((a) => a.product.id !== productId),
        })),
      
      updateProduct: (productId, updates) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, ...updates } : p
          ),
        })),
      
      setAnalyses: (analyses) => set({ analyses }),
      
      addAnalysis: (analysis) =>
        set((state) => ({
          analyses: [...state.analyses.filter(a => a.product.id !== analysis.product.id), analysis],
        })),
      
      setBoutiqueAnalysis: (analysis) => set({ boutiqueAnalysis: analysis }),
      
      setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
      
      setError: (error) => set({ error }),
      
      reset: () => set(initialState),
    }),
    {
      name: 'etsmart-storage',
      partialize: (state) => ({
        selectedNiche: state.selectedNiche,
        customNiche: state.customNiche,
        products: state.products,
        analyses: state.analyses,
        boutiqueAnalysis: state.boutiqueAnalysis,
      }),
    }
  )
);

