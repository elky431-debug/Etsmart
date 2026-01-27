'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Zap, Loader2, Home } from 'lucide-react';
import Link from 'next/link';
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

  // Hide Footer when paywall is displayed
  useEffect(() => {
    const footer = document.querySelector('footer');
    if (footer) {
      (footer as HTMLElement).style.display = 'none';
    }

    return () => {
      if (footer) {
        (footer as HTMLElement).style.display = '';
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-1.5 sm:px-4 pt-6 sm:pt-16 pb-12 sm:pb-12 relative overflow-hidden" style={{ fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}>
      {/* Subtle background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00d4ff]/3 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00c9b7]/3 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Home Button - Floating pill */}
      <Link 
        href="/"
        className="absolute top-1.5 left-1.5 sm:top-6 sm:left-6 z-10"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-0.5 sm:gap-2 px-1.5 sm:px-4 py-0.5 sm:py-2 bg-white/80 backdrop-blur-md border border-slate-200/50 rounded-full shadow-sm hover:shadow-md transition-all text-[10px] sm:text-sm text-slate-700 hover:text-slate-900"
        >
          <Home size={10} className="sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Home</span>
        </motion.button>
      </Link>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-6xl w-full relative z-10"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-3 sm:mb-12 md:mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="w-8 h-8 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mx-auto mb-1.5 sm:mb-6 shadow-lg shadow-[#00d4ff]/30"
          >
            <Lock className="w-4 h-4 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white" />
          </motion.div>
          <h1 className="text-base sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-0.5 sm:mb-3 tracking-tight px-1">{title}</h1>
          <p className="text-[10px] sm:text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-tight sm:leading-relaxed px-1">{message}</p>
        </motion.div>

        {/* Plans Grid - Floating Bubble Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-6 md:gap-8 mb-3 sm:mb-12">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 + index * 0.1, ease: 'easeOut' }}
              className={`
                relative flex flex-col
                ${plan.popular ? 'md:-mt-2' : ''}
              `}
            >
              {/* Floating Badge */}
              {plan.popular && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  className="absolute -top-1.5 sm:-top-4 left-1/2 transform -translate-x-1/2 z-20"
                >
                  <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-[8px] sm:text-xs font-semibold px-2 sm:px-5 py-0.5 sm:py-2 rounded-full shadow-lg shadow-[#00d4ff]/40 whitespace-nowrap backdrop-blur-sm">
                    Most Popular
                  </span>
                </motion.div>
              )}
              
              {/* Card */}
              <motion.div
                whileHover={{ 
                  scale: plan.popular ? 1.03 : 1.05, 
                  y: -8,
                  transition: { duration: 0.2 }
                }}
                className={`
                  bg-gradient-to-br from-white to-cyan-50/30 rounded-xl sm:rounded-3xl p-2.5 sm:p-8 md:p-10 relative flex flex-col items-center text-center
                  transition-all duration-300
                  ${plan.popular
                    ? 'shadow-2xl shadow-[#00d4ff]/20 border border-[#00d4ff]/20'
                    : 'shadow-xl shadow-slate-200/50 border border-slate-100/50 hover:border-[#00d4ff]/30 hover:shadow-2xl hover:shadow-[#00d4ff]/10'
                  }
                `}
              >
                {/* Plan Name */}
                <h3 className="text-xs sm:text-xl md:text-2xl font-bold text-slate-900 mb-1 sm:mb-4 tracking-tight">
                  {plan.name}
                </h3>

                {/* Price */}
                <div className="mb-2 sm:mb-8">
                  <div className="text-base sm:text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff] mb-0 sm:mb-2 leading-none tracking-tight">
                    ${plan.price}
                  </div>
                  <div className="text-[8px] sm:text-sm text-slate-500 font-medium">per month</div>
                </div>

                {/* Number of Analyses */}
                <div className="mb-3 sm:mb-10 flex items-center justify-center gap-0.5 sm:gap-3">
                  <div className="p-0.5 sm:p-2.5 rounded-md sm:rounded-xl bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/10">
                    <Zap className="w-2.5 h-2.5 sm:w-5 sm:h-5 text-[#00c9b7]" />
                  </div>
                  <div className="flex items-baseline gap-0.5 sm:gap-2">
                    <span className="text-sm sm:text-2xl md:text-3xl font-bold text-slate-900">
                      {plan.analysesPerMonth}
                    </span>
                    <span className="text-[9px] sm:text-base md:text-lg text-slate-600 font-medium">analyses</span>
                  </div>
                </div>

                {/* CTA Button - Pill Shaped */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loadingPlan === plan.id}
                  className={`
                    w-full py-1.5 sm:py-4 font-semibold rounded-full transition-all flex items-center justify-center gap-0.5 sm:gap-2 text-[9px] sm:text-base
                    ${plan.popular
                      ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg shadow-[#00d4ff]/30 hover:shadow-xl hover:shadow-[#00d4ff]/40'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border-2 border-slate-200 hover:border-[#00d4ff]/50 shadow-sm hover:shadow-md'
                    }
                    ${loadingPlan === plan.id ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 sm:w-4 sm:h-4 animate-spin" />
                      <span className="text-[9px] sm:text-sm">Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-center text-[9px] sm:text-base">{plan.popular ? 'Subscribe Now' : 'Choose Plan'}</span>
                      {plan.popular && <ArrowRight className="w-2.5 h-2.5 sm:w-4 sm:h-4 flex-shrink-0" />}
                    </>
                  )}
                </motion.button>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Footer with Home Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-4 sm:mt-8"
        >
          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-full shadow-sm hover:shadow-md transition-all text-xs text-slate-600 hover:text-slate-900 mx-auto"
            >
              <Home size={12} />
              <span>Home</span>
            </motion.button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}


