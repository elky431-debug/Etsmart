'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Store, Sparkles, Clock, ArrowRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function ShopAnalyzePageComingSoon() {
  const searchParams = useSearchParams();
  const analyzingParam = searchParams.get('analyzing');
  const shopUrl = searchParams.get('shop') || '';

  // Si l'extension essaie d'ouvrir la page d'analyse, on affiche un message adapté
  const isFromExtension = analyzingParam === 'true';

  // Extraire le nom de la boutique depuis l'URL
  const shopName = shopUrl ? shopUrl.split('/shop/')[1]?.split('?')[0] || 'cette boutique' : 'cette boutique';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Logo className="w-8 h-8" />
              <span className="text-xl font-bold text-white">Etsmart</span>
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Retour au dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] mb-6 sm:mb-8">
            <Store className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
            Analyse de Boutique
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-300 mb-8 sm:mb-12 max-w-2xl mx-auto">
            {isFromExtension && shopUrl ? (
              <>
                Nous préparons une analyse détaillée de <span className="text-[#00d4ff] font-semibold">"{shopName}"</span>.
                Cette fonctionnalité arrive très bientôt !
              </>
            ) : (
              <>
                Analysez en profondeur n'importe quelle boutique Etsy pour découvrir ses secrets de succès.
                Cette fonctionnalité arrive très bientôt !
              </>
            )}
          </p>

          {/* Features Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-12 sm:mb-16">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 sm:p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#00d4ff]/10 mb-4">
                <TrendingUp className="w-6 h-6 text-[#00d4ff]" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Métriques Détaillées</h3>
              <p className="text-sm text-slate-400">
                Ventes, revenus, croissance et performance
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 sm:p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#00c9b7]/10 mb-4">
                <Sparkles className="w-6 h-6 text-[#00c9b7]" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Analyse des Listings</h3>
              <p className="text-sm text-slate-400">
                Découvrez les produits les plus performants
              </p>
            </div>
          </div>

          {/* Coming Soon Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-full mb-8">
            <Clock className="w-4 h-4 text-[#00d4ff]" />
            <span className="text-sm font-medium text-slate-300">
              Disponible très prochainement
            </span>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-full hover:opacity-90 transition-opacity shadow-lg shadow-[#00d4ff]/20"
            >
              Retour au dashboard
            </Link>
            <Link
              href="/dashboard?section=analyse-simulation"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 border border-slate-700/50 text-white font-semibold rounded-full hover:bg-slate-800 transition-colors"
            >
              Voir les tarifs
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Extension Info */}
          {isFromExtension && (
            <div className="mt-12 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg max-w-2xl mx-auto">
              <p className="text-sm text-blue-300">
                <strong>Extension Chrome détectée</strong> - Votre analyse de "{shopName}" sera disponible dès que cette fonctionnalité sera lancée. 
                Vous recevrez une notification dès qu'elle sera prête !
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

