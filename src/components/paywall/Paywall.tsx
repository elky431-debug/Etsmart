'use client';

import { motion } from 'framer-motion';
import { Lock, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { PLANS, getUpgradeSuggestion, type PlanId } from '@/types/subscription';

interface PaywallProps {
  title?: string;
  message?: string;
  currentPlan?: PlanId;
  quotaReached?: boolean;
  used?: number;
  quota?: number;
  requiresUpgrade?: PlanId;
  onUpgrade?: () => void;
}

export function Paywall({
  title = 'Subscription Required',
  message = 'Subscribe to start analyzing products.',
  currentPlan = 'FREE',
  quotaReached = false,
  used,
  quota,
  requiresUpgrade,
  onUpgrade,
}: PaywallProps) {
  const upgradePlan = requiresUpgrade || getUpgradeSuggestion(currentPlan);
  const upgradePlanData = upgradePlan ? PLANS.find(p => p.id === upgradePlan) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4"
            >
              <Lock className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
            <p className="text-white/90 text-lg">{message}</p>
          </div>

          {/* Content */}
          <div className="p-8">
            {quotaReached && used !== undefined && quota !== undefined && (
              <div className="mb-6 p-6 rounded-xl bg-amber-50 border-2 border-amber-200">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-amber-900">Quota Reached</h3>
                </div>
                <p className="text-amber-800 mb-3">
                  You have used <strong>{used} / {quota}</strong> analyses this month.
                </p>
                {upgradePlanData && (
                  <p className="text-amber-700">
                    Upgrade to <strong>{upgradePlanData.name}</strong> to unlock{' '}
                    <strong>{upgradePlanData.analysesPerMonth} analyses per month</strong>.
                  </p>
                )}
              </div>
            )}

            {/* Upgrade suggestion */}
            {upgradePlanData && (
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">
                  Recommended Plan
                </h3>
                <div className="bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/10 rounded-2xl p-6 border-2 border-[#00d4ff]/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-2xl font-bold text-slate-900">
                        {upgradePlanData.name}
                      </h4>
                      <p className="text-slate-600">{upgradePlanData.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-[#00d4ff]">
                        ${upgradePlanData.price}
                        <span className="text-lg text-slate-600">/mo</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-[#00c9b7]" />
                      <span className="text-slate-700">
                        <strong>{upgradePlanData.analysesPerMonth} analyses</strong> per month
                      </span>
                    </div>
                    {upgradePlanData.features.slice(0, 3).map((feature) => (
                      <div key={feature.id} className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-[#00c9b7]" />
                        <span className="text-slate-700">{feature.name}</span>
                      </div>
                    ))}
                  </div>

                  <Link href="/pricing">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onUpgrade}
                      className="w-full py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                      Upgrade Now
                      <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  </Link>
                </div>
              </div>
            )}

            {/* All plans */}
            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4 text-center">
                View All Plans
              </h3>
              <Link href="/pricing">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
                >
                  See Pricing Plans
                </motion.button>
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 p-6 border-t border-slate-200 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Logo size="sm" showText={false} />
              <span className="text-sm text-slate-600">Etsmart</span>
            </div>
            <p className="text-xs text-slate-500">
              All subscriptions provide analyses and recommendations only.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

