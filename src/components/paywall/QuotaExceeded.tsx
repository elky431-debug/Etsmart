'use client';

import { motion } from 'framer-motion';
import { 
  Zap, 
  TrendingUp, 
  Sparkles, 
  ArrowRight, 
  Clock, 
  Crown,
  BarChart3,
  Rocket
} from 'lucide-react';
import { Button } from '@/components/ui';
import { PLAN_QUOTAS, PLAN_PRICES, type PlanId } from '@/types/subscription';

interface QuotaExceededProps {
  currentPlan: PlanId;
  used: number;
  quota: number;
  resetDate?: Date | null;
  onUpgrade: (plan: PlanId) => void;
  onClose?: () => void;
}

export function QuotaExceeded({ 
  currentPlan, 
  used, 
  quota, 
  resetDate,
  onUpgrade,
  onClose 
}: QuotaExceededProps) {
  // Determine upgrade suggestion
  const getUpgradePlan = (): PlanId | null => {
    if (currentPlan === 'SMART') return 'PRO';
    if (currentPlan === 'PRO') return 'SCALE';
    return null;
  };

  const upgradePlan = getUpgradePlan();
  const upgradeQuota = upgradePlan ? PLAN_QUOTAS[upgradePlan] : 0;
  const upgradePrice = upgradePlan ? PLAN_PRICES[upgradePlan] : 0;
  const extraAnalyses = upgradeQuota - quota;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
    }).format(date);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Header avec gradient */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 px-8 py-10 text-white">
          {/* Decorative elements */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm"
          >
            <BarChart3 className="h-10 w-10 text-white" />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-orange-500"
            >
              <span className="text-xs font-bold">!</span>
            </motion.div>
          </motion.div>

          {/* Title */}
          <h2 className="relative text-center text-2xl font-bold">
            Quota mensuel atteint
          </h2>
          <p className="relative mt-2 text-center text-white/80">
            Tu as utilisé toutes tes analyses ce mois-ci
          </p>

          {/* Usage counter */}
          <div className="relative mt-6 flex items-center justify-center gap-3">
            <div className="rounded-xl bg-white/20 px-4 py-2 backdrop-blur-sm">
              <span className="text-3xl font-bold">{used}</span>
              <span className="text-lg text-white/70"> / {quota}</span>
            </div>
            <span className="text-white/60">analyses</span>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          {/* Options */}
          <div className="space-y-4">
            {/* Option 1: Upgrade */}
            {upgradePlan && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onUpgrade(upgradePlan)}
                className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 p-1"
              >
                <div className="relative rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-5 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                        <Rocket className="h-6 w-6" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">Passer à {upgradePlan}</span>
                          <Crown className="h-4 w-4 text-yellow-300" />
                        </div>
                        <p className="text-sm text-white/80">
                          +{extraAnalyses} analyses/mois
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">€{upgradePrice}</div>
                      <div className="text-xs text-white/70">/mois</div>
                    </div>
                  </div>
                  
                  {/* Hover effect */}
                  <motion.div
                    className="absolute inset-0 bg-white/10"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </motion.button>
            )}

            {/* Option 2: Wait */}
            <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200">
                  <Clock className="h-6 w-6 text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-slate-700">Attendre le reset</p>
                  <p className="text-sm text-slate-500">
                    {resetDate 
                      ? `Ton quota se réinitialise le ${formatDate(resetDate)}`
                      : 'Ton quota se réinitialise chaque mois'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits of upgrading */}
          {upgradePlan && (
            <div className="mt-6 rounded-xl bg-gradient-to-r from-cyan-50 to-teal-50 p-4">
              <p className="mb-3 text-sm font-medium text-cyan-800">
                <Sparkles className="mr-1 inline h-4 w-4" />
                Avantages du plan {upgradePlan}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-cyan-700">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>{upgradeQuota} analyses/mois</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  <span>Analyse prioritaire</span>
                </div>
                <div className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  <span>Rapports détaillés</span>
                </div>
                <div className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Support prioritaire</span>
                </div>
              </div>
            </div>
          )}

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="mt-6 w-full py-3 text-center text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Retour au dashboard
            </button>
          )}
        </div>

        {/* Bottom decoration */}
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500" />
      </motion.div>
    </motion.div>
  );
}

