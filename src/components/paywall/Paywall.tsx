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
        className="max-w-5xl w-full"
      >
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mx-auto mb-4 shadow-lg"
          >
            <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-slate-600 text-sm sm:text-base">{message}</p>
        </div>

        {/* Plans Grid - Simplified */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6 mb-8">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`
                bg-white rounded-2xl shadow-lg border-2 p-6 sm:p-8 relative flex flex-col items-center text-center
                transition-all duration-300 hover:shadow-xl hover:scale-105
                ${plan.popular
                  ? 'border-[#00d4ff] shadow-2xl shadow-[#00d4ff]/30 scale-105'
                  : 'border-slate-200 hover:border-[#00d4ff]/50'
                }
              `}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}
              
              {/* Plan Name */}
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">
                {plan.name}
              </h3>

              {/* Price */}
              <div className="mb-6">
                <div className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] mb-1">
                  ${plan.price}
                </div>
                <div className="text-sm text-slate-500 font-medium">per month</div>
              </div>

              {/* Number of Analyses */}
              <div className="mb-8 flex items-center justify-center gap-2">
                <Zap className="w-5 h-5 text-[#00c9b7]" />
                <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {plan.analysesPerMonth}
                </span>
                <span className="text-base sm:text-lg text-slate-600">analyses</span>
              </div>

              {/* CTA Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan === plan.id}
                className={`
                  w-full py-3.5 sm:py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-base sm:text-lg
                  ${plan.popular
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg hover:shadow-xl'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-2 border-slate-200'
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
                    {plan.popular ? 'Subscribe Now' : 'Choose Plan'}
                    {plan.popular && <ArrowRight className="w-5 h-5" />}
                  </>
                )}
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Logo size="sm" showText={false} />
            <span className="text-sm text-slate-600">Etsmart</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}


