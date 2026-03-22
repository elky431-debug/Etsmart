import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OpportunityMapAnalysis } from '@/types/opportunityMap';

interface OpportunityMapStore {
  lastAnalysis: OpportunityMapAnalysis | null;
  setLastAnalysis: (a: OpportunityMapAnalysis | null) => void;
}

export const useOpportunityMapStore = create<OpportunityMapStore>()(
  persist(
    (set) => ({
      lastAnalysis: null,
      setLastAnalysis: (lastAnalysis) => set({ lastAnalysis }),
    }),
    { name: 'etsmart-opportunity-map-v1' }
  )
);
