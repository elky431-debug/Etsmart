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
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Retour à l'historique</span>
          </button>

          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={18} />
            <span>Supprimer</span>
          </button>
        </div>

        {/* Full analysis with all tabs */}
        <ProductAnalysisView analysis={analysis} />
      </div>
    </div>
  );
}

