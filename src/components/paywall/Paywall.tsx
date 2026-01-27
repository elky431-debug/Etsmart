'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Zap, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { PLANS, getUpgradeSuggestion, type PlanId } from '@/types/subscription';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

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
  title = 'Unlock product analysis',
  message = 'To analyze products and access full results, you need an active subscription.',
  currentPlan = 'FREE',
  quotaReached = false,
  used,
  quota,
  requiresUpgrade,
  onUpgrade,
}: PaywallProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const upgradePlan = requiresUpgrade || getUpgradeSuggestion(currentPlan);
  const upgradePlanData = upgradePlan ? PLANS.find(p => p.id === upgradePlan) : null;

  const handleSubscribe = async (planId: PlanId) => {
    if (!user) {
      router.push(`/login?redirect=/pricing&plan=${planId}`);
      return;
    }

    setLoadingPlan(planId);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      alert(error.message || 'Failed to start checkout. Please try again.');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center p-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl w-full"
      >
        <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] p-6 sm:p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4"
            >
              <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 break-words">{title}</h1>
            <p className="text-white/90 text-base sm:text-lg break-words px-2">{message}</p>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 lg:p-8">
            {quotaReached && used !== undefined && quota !== undefined && (
              <div className="mb-6 p-4 sm:p-6 rounded-xl bg-amber-50 border-2 border-amber-200">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <h3 className="font-bold text-amber-900 text-sm sm:text-base">Quota Reached</h3>
                </div>
                <p className="text-amber-800 mb-3 text-sm sm:text-base break-words">
                  You have used <strong>{used} / {quota}</strong> analyses this month.
                </p>
                {upgradePlanData && (
                  <p className="text-amber-700 text-sm sm:text-base break-words">
                    Upgrade to <strong>{upgradePlanData.name}</strong> to unlock{' '}
                    <strong>{upgradePlanData.analysesPerMonth} analyses per month</strong>.
                  </p>
                )}
              </div>
            )}

            {/* All Plans Grid */}
            <div className="mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6 text-center">
                Choose Your Plan
              </h3>
              <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
                {PLANS.map((plan, index) => (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className={`
                      bg-white rounded-2xl shadow-lg border-2 p-4 sm:p-6 relative flex flex-col
                      ${plan.popular
                        ? 'border-[#00d4ff] shadow-2xl shadow-[#00d4ff]/20 scale-105'
                        : 'border-slate-200'
                      }
                    `}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-1 rounded-full whitespace-nowrap">
                          Most Popular
                        </span>
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <h4 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 break-words">
                        {plan.name}
                      </h4>
                      <p className="text-sm sm:text-base text-slate-600 mb-4 break-words min-h-[3rem]">
                        {plan.description}
                      </p>
                      
                      <div className="mb-6">
                        <div className="text-3xl sm:text-4xl font-bold text-[#00d4ff] mb-1">
                          ${plan.price}
                          <span className="text-lg sm:text-xl text-slate-600">/mo</span>
                        </div>
                      </div>

                      <div className="space-y-2 mb-6">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-[#00c9b7] flex-shrink-0 mt-0.5" />
                          <span className="text-sm sm:text-base text-slate-700 break-words">
                            <strong>{plan.analysesPerMonth} analyses</strong> per month
                          </span>
                        </div>
                        {plan.features.slice(0, 3).map((feature) => (
                          <div key={feature.id} className="flex items-start gap-2">
                            <CheckCircle2 className="w-5 h-5 text-[#00c9b7] flex-shrink-0 mt-0.5" />
                            <span className="text-sm sm:text-base text-slate-700 break-words">
                              {feature.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={loadingPlan === plan.id}
                      className={`
                        w-full py-3 sm:py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm sm:text-base
                        ${plan.popular
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg hover:shadow-xl'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }
                        ${loadingPlan === plan.id ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {loadingPlan === plan.id ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          {plan.popular ? 'Upgrade Now' : 'Choose Plan'}
                          {plan.popular && <ArrowRight className="w-5 h-5" />}
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 p-4 sm:p-6 border-t border-slate-200 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Logo size="sm" showText={false} />
              <span className="text-xs sm:text-sm text-slate-600">Etsmart</span>
            </div>
            <p className="text-xs text-slate-500 break-words px-2">
              All subscriptions provide analyses and recommendations only.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}


