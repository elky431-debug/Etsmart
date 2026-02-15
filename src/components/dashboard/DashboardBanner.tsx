'use client';

import { motion } from 'framer-motion';
import { Loader2, Store } from 'lucide-react';

export function DashboardBanner() {

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Générer une bannière</h1>
              <p className="text-white/70 text-sm mt-1">
                Créez une bannière personnalisée pour votre boutique Etsy
              </p>
            </div>
          </div>
        </motion.div>

        {/* Maintenance Message */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center min-h-[60vh] text-center"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mb-6">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            En maintenance
          </h2>
          <p className="text-white/70 text-lg max-w-md">
            Cette fonctionnalité arrive bientôt ! Nous travaillons activement sur la génération de bannières personnalisées pour votre boutique Etsy.
          </p>
          <div className="mt-8 px-6 py-3 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/30">
            <p className="text-[#00d4ff] text-sm font-semibold">
              Restez connecté pour être informé de la sortie
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

