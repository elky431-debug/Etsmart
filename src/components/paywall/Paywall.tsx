'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Zap, Loader2, Home, Check, Crown, Rocket, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { PLANS, getUpgradeSuggestion, type PlanId } from '@/types/subscription';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';

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
  title = 'Unlock Product Analysis',
  message = 'Choose your plan and start analyzing products with AI-powered insights',
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
  const [hoveredPlan, setHoveredPlan] = useState<PlanId | null>(null);
  const upgradePlan = requiresUpgrade || getUpgradeSuggestion(currentPlan);

  const handleSubscribe = async (planId: PlanId) => {
    if (!user) {
      router.push(`/login?redirect=/pricing&plan=${planId}`);
      return;
    }

    setLoadingPlan(planId);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      alert(error.message || 'Failed to start checkout. Please try again.');
      setLoadingPlan(null);
    }
  };

  // Hide Header/Stepper/Footer
  useEffect(() => {
    const header = document.querySelector('header.fixed.top-12');
    const stepperContainer = Array.from(document.querySelectorAll('div')).find(el => 
      el.classList.contains('fixed') && el.classList.contains('top-0') && el.classList.contains('border-b')
    );
    const footer = document.querySelector('footer');

    if (header) (header as HTMLElement).style.display = 'none';
    if (stepperContainer) (stepperContainer as HTMLElement).style.display = 'none';
    if (footer) (footer as HTMLElement).style.display = 'none';

    return () => {
      if (header) (header as HTMLElement).style.display = '';
      if (stepperContainer) (stepperContainer as HTMLElement).style.display = '';
      if (footer) (footer as HTMLElement).style.display = '';
    };
  }, []);

  const getPlanIcon = (planId: PlanId) => {
    switch (planId) {
      case 'SMART': return Zap;
      case 'PRO': return Crown;
      case 'SCALE': return Rocket;
      default: return Zap;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 flex items-center justify-center px-4 py-8 sm:py-12 relative overflow-hidden">
      {/* Etsmart Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Primary gradient orb */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/10 rounded-full blur-[100px]" />
        
        {/* Secondary gradient orb */}
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-gradient-to-br from-[#00c9b7]/15 to-[#00d4ff]/5 rounded-full blur-[120px]" />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #00d4ff 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
        
        {/* Decorative floating elements */}
        <motion.div 
          className="absolute top-20 left-[15%] w-3 h-3 rounded-full bg-[#00d4ff]/40"
          animate={{ y: [0, -20, 0], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div 
          className="absolute top-40 right-[20%] w-2 h-2 rounded-full bg-[#00c9b7]/50"
          animate={{ y: [0, -15, 0], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, delay: 1 }}
        />
        <motion.div 
          className="absolute bottom-32 left-[25%] w-2.5 h-2.5 rounded-full bg-[#00d4ff]/30"
          animate={{ y: [0, -25, 0], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, delay: 2 }}
        />
      </div>

      {/* Top Navigation */}
      <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 flex items-center justify-between z-20">
        <Link href="/">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2"
          >
            <Logo size="sm" />
          </motion.div>
        </Link>
        
        <Link href="/">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-sm text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm transition-all"
          >
            <Home size={16} />
            <span className="hidden sm:inline">Return home</span>
          </motion.button>
        </Link>
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-5xl w-full relative z-10 pt-16 sm:pt-8"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center mb-8 sm:mb-12"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] shadow-xl shadow-[#00d4ff]/25 mb-6"
          >
            <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </motion.div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
            {title}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 max-w-md mx-auto">
            {message}
          </p>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {PLANS.map((plan, index) => {
            const Icon = getPlanIcon(plan.id);
            const isHovered = hoveredPlan === plan.id;
            const isPopular = plan.popular;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                className={`relative ${isPopular ? 'md:-mt-4 md:mb-4' : ''}`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"
                  >
                    <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-[#00d4ff]/30">
                      <Sparkles size={12} />
                      Popular
                    </span>
                  </motion.div>
                )}

                {/* Card */}
                <motion.div
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`
                    relative overflow-hidden rounded-2xl p-6 sm:p-8 h-full
                    bg-white border-2 transition-all duration-300
                    ${isPopular 
                      ? 'border-[#00d4ff] shadow-xl shadow-[#00d4ff]/10' 
                      : 'border-slate-200 hover:border-[#00d4ff]/50 hover:shadow-lg hover:shadow-slate-200/50'
                    }
                  `}
                >
                  {/* Gradient background for popular */}
                  {isPopular && (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#00d4ff]/5 via-transparent to-[#00c9b7]/5 pointer-events-none" />
                  )}

                  {/* Plan content */}
                  <div className="relative text-center">
                    {/* Icon */}
                    <div className={`
                      inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4
                      ${isPopular 
                        ? 'bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] shadow-lg shadow-[#00d4ff]/25' 
                        : 'bg-slate-100'
                      }
                    `}>
                      <Icon className={`w-7 h-7 ${isPopular ? 'text-white' : 'text-slate-600'}`} />
                    </div>

                    {/* Plan name */}
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      {plan.name.replace('Etsmart ', '')}
                    </h3>

                    {/* MAIN INFO: Analyses count - PROMINENT */}
                    <div className={`
                      py-4 px-4 mb-4 rounded-2xl
                      ${isPopular ? 'bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/10' : 'bg-slate-50'}
                    `}>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Zap className={`w-5 h-5 ${isPopular ? 'text-[#00d4ff]' : 'text-slate-500'}`} />
                        <span className={`text-4xl sm:text-5xl font-bold ${isPopular ? 'text-[#00d4ff]' : 'text-slate-900'}`}>
                          {plan.analysesPerMonth}
                        </span>
                      </div>
                      <span className="text-slate-500 text-sm font-medium">analyses per month</span>
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline justify-center gap-1 mb-6">
                      <span className={`text-2xl font-bold ${isPopular ? 'text-[#00c9b7]' : 'text-slate-700'}`}>
                        ${plan.price}
                      </span>
                      <span className="text-slate-400 text-sm">/month</span>
                    </div>

                    {/* CTA Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={loadingPlan === plan.id}
                      className={`
                        w-full py-3.5 font-semibold rounded-xl transition-all 
                        flex items-center justify-center gap-2 text-sm
                        ${isPopular
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-lg shadow-[#00d4ff]/25 hover:shadow-xl hover:shadow-[#00d4ff]/30'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                        }
                        ${loadingPlan === plan.id ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {loadingPlan === plan.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <span>{isPopular ? 'Get Started Now' : 'Choose Plan'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-10 sm:mt-12"
        >
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="p-1.5 rounded-full bg-slate-100">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <span>Secure payment</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="p-1.5 rounded-full bg-slate-100">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span>Instant access</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="p-1.5 rounded-full bg-slate-100">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Cancel anytime</span>
            </div>
          </div>
        </motion.div>

        {/* Bottom home link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-8"
        >
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-[#00d4ff] transition-colors"
          >
            <Home size={14} />
            <span>Back to home</span>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
