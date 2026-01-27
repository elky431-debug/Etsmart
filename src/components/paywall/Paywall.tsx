'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Zap, CheckCircle2, Loader2, Home } from 'lucide-react';
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

  // Hide Header and Stepper when paywall is displayed
  useEffect(() => {
    // Hide Header (fixed top-12)
    const header = document.querySelector('header.fixed.top-12');
    if (header) {
      (header as HTMLElement).style.display = 'none';
    }

    // Hide Stepper (fixed top-0 with border-b)
    const stepperContainer = Array.from(document.querySelectorAll('div')).find(el => 
      el.classList.contains('fixed') && 
      el.classList.contains('top-0') && 
      el.classList.contains('border-b')
    );
    if (stepperContainer) {
      (stepperContainer as HTMLElement).style.display = 'none';
    }

    return () => {
      // Restore Header
      if (header) {
        (header as HTMLElement).style.display = '';
      }
      // Restore Stepper
      if (stepperContainer) {
        (stepperContainer as HTMLElement).style.display = '';
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 py-8 sm:py-12 relative">
      {/* Subtle glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#00d4ff]/10 rounded-full blur-[120px]" />
      </div>

      {/* Home Button - Small, top left */}
      <Link 
        href="/"
        className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-lg hover:bg-white/20 transition-all text-sm text-white"
        >
          <Home size={16} />
          <span className="hidden sm:inline">Home</span>
        </motion.button>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl w-full"
      >
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#00d4ff]/50"
          >
            <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </motion.div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3">{title}</h1>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">{message}</p>
        </div>

        {/* Plans Grid - Premium Design */}
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8 mb-8">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`
                relative flex flex-col
                ${plan.popular
                  ? 'md:-mt-4 md:mb-4'
                  : ''
                }
              `}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-xs font-bold px-5 py-2 rounded-full shadow-lg shadow-[#00d4ff]/50 whitespace-nowrap">
                    Most Popular
                  </span>
                </div>
              )}
              
              <motion.div
                whileHover={{ scale: plan.popular ? 1.02 : 1.05, y: plan.popular ? 0 : -5 }}
                className={`
                  bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border-2 p-6 sm:p-8 relative flex flex-col items-center text-center
                  transition-all duration-300
                  ${plan.popular
                    ? 'border-[#00d4ff] shadow-2xl shadow-[#00d4ff]/30'
                    : 'border-slate-700 hover:border-[#00d4ff]/50'
                  }
                `}
              >
                {/* Plan Name */}
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 mt-2">
                  {plan.name}
                </h3>

                {/* Price */}
                <div className="mb-8 mt-4">
                  <div className="text-5xl sm:text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] mb-2 leading-none">
                    ${plan.price}
                  </div>
                  <div className="text-sm text-slate-400 font-medium">per month</div>
                </div>

                {/* Number of Analyses */}
                <div className="mb-10 flex items-center justify-center gap-3">
                  <div className="p-2 rounded-lg bg-[#00d4ff]/10">
                    <Zap className="w-6 h-6 text-[#00c9b7]" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-bold text-white">
                      {plan.analysesPerMonth}
                    </span>
                    <span className="text-lg sm:text-xl text-slate-400">analyses</span>
                  </div>
                </div>

                {/* CTA Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loadingPlan === plan.id}
                  className={`
                    w-full py-4 sm:py-5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-base sm:text-lg
                    ${plan.popular
                      ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg shadow-[#00d4ff]/50 hover:shadow-xl hover:shadow-[#00d4ff]/60'
                      : 'bg-slate-700/50 text-white hover:bg-slate-700 border-2 border-slate-600 hover:border-[#00d4ff]/50'
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
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Logo size="sm" showText={false} />
            <span className="text-sm text-slate-400">Etsmart</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}


