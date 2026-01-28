'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Zap, Loader2, Home, Sparkles, Check, Crown, Star } from 'lucide-react';
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
  title = 'Unlock Your Potential',
  message = 'Get unlimited access to powerful product analysis tools',
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
      case 'SCALE': return Star;
      default: return Zap;
    }
  };

  const getPlanGradient = (planId: PlanId, isHovered: boolean) => {
    const gradients = {
      SMART: isHovered 
        ? 'from-violet-500 via-purple-500 to-fuchsia-500' 
        : 'from-violet-400 via-purple-400 to-fuchsia-400',
      PRO: isHovered 
        ? 'from-cyan-400 via-teal-400 to-emerald-400' 
        : 'from-cyan-300 via-teal-300 to-emerald-300',
      SCALE: isHovered 
        ? 'from-amber-400 via-orange-400 to-rose-400' 
        : 'from-amber-300 via-orange-300 to-rose-300',
    };
    return gradients[planId] || gradients.SMART;
  };

  const getPlanShadow = (planId: PlanId) => {
    const shadows = {
      SMART: 'shadow-violet-500/25',
      PRO: 'shadow-cyan-500/25',
      SCALE: 'shadow-amber-500/25',
    };
    return shadows[planId] || shadows.SMART;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-8 sm:py-16 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient orbs */}
        <motion.div 
          className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-violet-600/20 to-transparent rounded-full blur-[100px]"
          animate={{ 
            x: [0, 50, 0], 
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div 
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-cyan-600/20 to-transparent rounded-full blur-[100px]"
          animate={{ 
            x: [0, -40, 0], 
            y: [0, -40, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-emerald-600/10 to-transparent rounded-full blur-[120px]"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Home Button */}
      <Link href="/" className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          <Home size={16} />
          <span className="hidden sm:inline">Home</span>
        </motion.button>
      </Link>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="max-w-6xl w-full relative z-10"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-center mb-8 sm:mb-16"
        >
          {/* Floating sparkles icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="relative inline-block mb-6"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-violet-500/30 rotate-3">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <motion.div 
              className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-400 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div 
              className="absolute -bottom-1 -left-1 w-3 h-3 bg-emerald-400 rounded-full"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
            />
          </motion.div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              {title}
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-white/50 max-w-xl mx-auto">
            {message}
          </p>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {PLANS.map((plan, index) => {
            const Icon = getPlanIcon(plan.id);
            const isHovered = hoveredPlan === plan.id;
            const gradient = getPlanGradient(plan.id, isHovered);
            const shadow = getPlanShadow(plan.id);

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                className={`relative ${plan.popular ? 'md:-mt-4 md:mb-4' : ''}`}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 }}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"
                  >
                    <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 text-black text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                      ⭐ MOST POPULAR
                    </span>
                  </motion.div>
                )}

                {/* Card */}
                <motion.div
                  whileHover={{ y: -8, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className={`
                    relative overflow-hidden rounded-2xl sm:rounded-3xl p-6 sm:p-8 h-full
                    bg-gradient-to-b from-white/[0.08] to-white/[0.02]
                    border border-white/10 backdrop-blur-xl
                    ${plan.popular ? `shadow-2xl ${shadow}` : 'hover:border-white/20'}
                    transition-all duration-300
                  `}
                >
                  {/* Gradient overlay on hover */}
                  <motion.div
                    className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition-opacity duration-300`}
                    animate={{ opacity: isHovered ? 0.05 : 0 }}
                  />

                  {/* Plan icon */}
                  <div className={`
                    w-12 h-12 sm:w-14 sm:h-14 rounded-xl mb-4 sm:mb-6 flex items-center justify-center
                    bg-gradient-to-br ${gradient} shadow-lg ${shadow}
                  `}>
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>

                  {/* Plan name */}
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                    {plan.name.replace('Etsmart ', '')}
                  </h3>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-4xl sm:text-5xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                        ${plan.price}
                      </span>
                      <span className="text-white/40 text-sm">/month</span>
                    </div>
                  </div>

                  {/* Analyses count */}
                  <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient}/20`}>
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-white">{plan.analysesPerMonth}</span>
                      <span className="text-white/50 text-sm ml-1">analyses/month</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.slice(0, 4).map((feature, i) => (
                      feature.available && (
                        <motion.li 
                          key={i} 
                          className="flex items-start gap-3"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                        >
                          <div className={`mt-0.5 p-1 rounded-full bg-gradient-to-br ${gradient}`}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-sm text-white/70">{feature.name}</span>
                        </motion.li>
                      )
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loadingPlan === plan.id}
                    className={`
                      w-full py-3.5 sm:py-4 font-semibold rounded-xl transition-all 
                      flex items-center justify-center gap-2
                      ${plan.popular
                        ? `bg-gradient-to-r ${gradient} text-white shadow-lg ${shadow} hover:shadow-xl`
                        : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'
                      }
                      ${loadingPlan === plan.id ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {loadingPlan === plan.id ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <span>{plan.popular ? 'Get Started' : 'Choose Plan'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 text-center"
        >
          <div className="flex flex-wrap items-center justify-center gap-6 text-white/30 text-sm">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>Secure payment</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Instant access</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
