'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Trash2 } from 'lucide-react';
import type { ProductAnalysis } from '@/types';
import { ProductAnalysisView } from '@/components/steps/ResultsStep';

interface DashboardAnalysisDetailProps {
  analysis: ProductAnalysis;
  onBack: () => void;
  onDelete: () => void;
}

export function DashboardAnalysisDetail({ 
  analysis, 
  onBack, 
  onDelete 
}: DashboardAnalysisDetailProps) {
  return (
    <div className="p-4 md:p-8 bg-black min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/10"
          >
            <ArrowLeft size={20} />
            <span>Retour à l'historique</span>
          </button>

          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20"
          >
            <Trash2 size={18} />
            <span>Supprimer</span>
          </button>
        </div>

        {/* Full analysis with all tabs - Analyse et Simulation / Listing et Images */}
        <ProductAnalysisView analysis={analysis} hideTitle={true} />
      </div>
    </div>
  );
}

