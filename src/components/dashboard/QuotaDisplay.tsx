'use client';

import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';

export function QuotaDisplay() {
  const { subscription, loading, quotaPercentage, canAnalyze, requiresUpgrade, refreshSubscription } = useSubscription();
  
  // Listen for credits-updated event and force refresh
  useEffect(() => {
    const handleCreditsUpdated = () => {
      console.log('[QuotaDisplay] 💰 Credits updated event received, forcing refresh');
      refreshSubscription(true);
    };
    
    window.addEventListener('credits-updated', handleCreditsUpdated);
    window.addEventListener('subscription-refresh', handleCreditsUpdated);
    
    return () => {
      window.removeEventListener('credits-updated', handleCreditsUpdated);
      window.removeEventListener('subscription-refresh', handleCreditsUpdated);
    };
  }, [refreshSubscription]);

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-xl border-2 border-slate-200 animate-pulse">
        <div className="h-6 bg-slate-200 rounded mb-2"></div>
        <div className="h-4 bg-slate-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const isLow = quotaPercentage >= 80;
  const isMedium = quotaPercentage >= 50 && quotaPercentage < 80;
  const isHigh = quotaPercentage < 50;

  const progressColor = isLow
    ? 'bg-red-500'
    : isMedium
    ? 'bg-amber-500'
    : 'bg-[#00c9b7]';

  const textColor = isLow
    ? 'text-red-700'
    : isMedium
    ? 'text-amber-700'
    : 'text-slate-700';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-white rounded-xl border-2 border-slate-200 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Quota d'analyses</h3>
            <p className="text-sm text-slate-600">
              Plan {subscription.plan}
            </p>
          </div>
        </div>
        {canAnalyze ? (
          <CheckCircle2 className="w-6 h-6 text-[#00c9b7]" />
        ) : (
          <AlertTriangle className="w-6 h-6 text-amber-500" />
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-semibold ${textColor}`}>
            {subscription.used % 1 === 0 ? subscription.used : subscription.used.toFixed(1)} / {subscription.quota} utilisées
          </span>
          <span className={`text-sm font-semibold ${textColor}`}>
            {subscription.remaining % 1 === 0 ? subscription.remaining : subscription.remaining.toFixed(1)} restantes
          </span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${quotaPercentage}%` }}
            transition={{ duration: 0.5 }}
            className={`h-full ${progressColor} rounded-full`}
          />
        </div>
      </div>

      {/* Warning or Upgrade CTA */}
      {!canAnalyze && (
        <div className={`p-4 rounded-lg ${
          subscription.remaining === 0
            ? 'bg-red-50 border-2 border-red-200'
            : 'bg-amber-50 border-2 border-amber-200'
        }`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              subscription.remaining === 0 ? 'text-red-600' : 'text-amber-600'
            }`} />
            <div className="flex-1">
              <p className={`text-sm font-semibold mb-1 ${
                subscription.remaining === 0 ? 'text-red-900' : 'text-amber-900'
              }`}>
                {subscription.remaining === 0
                  ? 'Quota atteint'
                  : 'Abonnement inactif'}
              </p>
              <p className={`text-sm mb-3 ${
                subscription.remaining === 0 ? 'text-red-700' : 'text-amber-700'
              }`}>
                {subscription.remaining === 0
                  ? `Vous avez utilisé vos ${subscription.quota} analyses ce mois-ci.`
                  : 'Votre abonnement n\'est pas actif. Veuillez le renouveler pour continuer à analyser.'}
              </p>
              {subscription.requiresUpgrade && (
                <Link href="/dashboard?section=analyse-simulation">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-2 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                  >
                    Passer à {subscription.requiresUpgrade}
                  </motion.button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Date */}
      {subscription.periodEnd && (
        <p className="text-xs text-slate-500 text-center mt-4">
          Réinitialisation le {new Date(subscription.periodEnd).toLocaleDateString('fr-FR')}
        </p>
      )}
    </motion.div>
  );
}


