'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Zap, Loader2, Home, Check, Crown, Rocket, Sparkles, LogOut } from 'lucide-react';
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
  hasActiveSubscription?: boolean;
}

export function Paywall({
  title = 'Débloquer l\'analyse de produits',
  message = 'Choisissez votre plan et commencez à analyser des produits avec l\'IA',
  currentPlan = 'FREE',
  quotaReached = false,
  used,
  quota,
  requiresUpgrade,
  onUpgrade,
  hasActiveSubscription = false,
}: PaywallProps) {
  // ⚠️ CRITICAL: Ne JAMAIS afficher le paywall si l'utilisateur a un abonnement actif
  if (hasActiveSubscription) {
    console.log('[Paywall] ❌ Paywall masqué - hasActiveSubscription est true');
    return null;
  }

  console.log('[Paywall] ✅ Affichage du paywall - hasActiveSubscription:', hasActiveSubscription);

  // ⚠️ CRITICAL: En localhost, on peut afficher le paywall si pas d'abonnement actif
  // (la vérification hasActiveSubscription a déjà été faite avant)
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0'
  );
  
  if (isLocalhost) {
    console.log('[Paywall] ⚠️ Paywall affiché en localhost (pas d\'abonnement actif)');
  }

  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [hoveredPlan, setHoveredPlan] = useState<PlanId | null>(null);
  const upgradePlan = requiresUpgrade || getUpgradeSuggestion(currentPlan);

  const handleSubscribe = async (planId: PlanId) => {
    if (!user) {
      router.push(`/login?redirect=/dashboard?section=analyse-simulation&plan=${planId}`);
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
        throw new Error(data.error || 'Échec de la création de la session de paiement');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      alert(error.message || 'Échec du démarrage du paiement. Veuillez réessayer.');
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
      case 'INFINITY': return Sparkles;
      default: return Zap;
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-8 sm:py-12 relative overflow-hidden">
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
        
        <div className="flex items-center gap-2">
          {user && (
            <motion.button
              onClick={async () => {
                await signOut();
                router.push('/login');
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm text-white/90 hover:text-white hover:border-white/30 hover:shadow-sm transition-all"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Déconnexion</span>
            </motion.button>
          )}
          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm text-white/90 hover:text-white hover:border-white/30 hover:shadow-sm transition-all"
            >
              <Home size={16} />
              <span className="hidden sm:inline">Retour à l'accueil</span>
            </motion.button>
          </Link>
        </div>
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
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-center mb-5 sm:mb-10"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] shadow-lg shadow-[#00d4ff]/25 mb-4 sm:mb-5"
          >
            <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </motion.div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-white/70 max-w-sm mx-auto px-4">
            {message}
          </p>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {PLANS.filter(p => p.id !== 'FREE').map((plan, index) => {
            const Icon = getPlanIcon(plan.id);
            const isHovered = hoveredPlan === plan.id;
            const isPopular = plan.popular;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + index * 0.08 }}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                className={`relative ${isPopular ? 'order-first md:order-none md:-mt-3 md:mb-3' : ''}`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10"
                  >
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-[10px] sm:text-xs font-bold px-3 py-1 sm:px-4 sm:py-1.5 rounded-full shadow-lg shadow-[#00d4ff]/30">
                      <Sparkles size={10} className="sm:w-3 sm:h-3" />
                      Populaire
                    </span>
                  </motion.div>
                )}

                {/* Card */}
                <motion.div
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`
                    relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-6 h-full
                    bg-black border-2 transition-all duration-300
                    ${isPopular 
                      ? 'border-[#00d4ff] shadow-lg shadow-[#00d4ff]/10' 
                      : 'border-white/10 hover:border-[#00d4ff]/50 hover:shadow-md'
                    }
                  `}
                >
                  {/* Gradient background for popular */}
                  {isPopular && (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#00d4ff]/5 via-transparent to-[#00c9b7]/5 pointer-events-none" />
                  )}

                  {/* Plan content - Horizontal on mobile, vertical on desktop */}
                  <div className="relative flex items-center gap-4 sm:block sm:text-center">
                    {/* Icon */}
                    <div className={`
                      flex-shrink-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl sm:mx-auto sm:mb-3
                      ${isPopular 
                        ? 'bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] shadow-md shadow-[#00d4ff]/25' 
                        : 'bg-white/10'
                      }
                    `}>
                      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${isPopular ? 'text-white' : 'text-white/80'}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 sm:text-center">
                      {/* Plan name */}
                      <h3 className="text-base sm:text-lg font-bold text-white sm:mb-2">
                        {plan.name.replace('Etsmart ', '')}
                      </h3>

                      {/* Price */}
                      <div className="flex items-baseline gap-0.5 sm:justify-center sm:mb-3">
                        {plan.price === 0 ? (
                          <span className={`text-lg sm:text-xl font-bold ${isPopular ? 'text-[#00d4ff]' : 'text-white'}`}>
                            Sur devis
                          </span>
                        ) : (
                          <>
                            <span className={`text-xl sm:text-2xl font-bold ${isPopular ? 'text-[#00d4ff]' : 'text-white'}`}>
                              €{plan.price.toFixed(2)}
                            </span>
                            <span className="text-white/60 text-[10px] sm:text-xs">/mois</span>
                          </>
                        )}
                      </div>

                      {/* Crédits count - Hidden on mobile, visible on sm+ */}
                      <div className={`
                        hidden sm:block py-2 px-3 mb-4 rounded-lg
                        ${isPopular ? 'bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/10' : 'bg-white/5'}
                      `}>
                        <div className="flex items-center justify-center gap-1.5">
                          <Zap className={`w-3.5 h-3.5 ${isPopular ? 'text-[#00d4ff]' : 'text-white/70'}`} />
                          <span className={`text-base font-bold ${isPopular ? 'text-[#00c9b7]' : 'text-white'}`}>
                            {plan.analysesPerMonth === -1 ? '∞' : plan.analysesPerMonth}
                          </span>
                          <span className="text-white/60 text-xs">
                            {plan.analysesPerMonth === -1 ? 'crédits illimités' : 'crédits/mois'}
                          </span>
                        </div>
                      </div>

                      {/* Crédits - Inline on mobile */}
                      <div className="flex sm:hidden items-center gap-1 text-white/70 text-xs">
                        <Zap className="w-3 h-3" />
                        <span className="font-medium">
                          {plan.analysesPerMonth === -1 ? 'Crédits illimités' : `${plan.analysesPerMonth} crédits/mois`}
                        </span>
                      </div>
                    </div>

                    {/* CTA Button */}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={loadingPlan === plan.id}
                      className={`
                        flex-shrink-0 sm:w-full px-4 py-2 sm:py-3 font-semibold rounded-lg sm:rounded-xl transition-all 
                        flex items-center justify-center gap-1.5 text-xs sm:text-sm
                        ${isPopular
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-md shadow-[#00d4ff]/20'
                          : 'bg-slate-900 text-white'
                        }
                        ${loadingPlan === plan.id ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {loadingPlan === plan.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span className="hidden sm:inline">{isPopular ? 'Commencer' : 'Choisir'}</span>
                          <span className="sm:hidden">Go</span>
                          <ArrowRight className="w-3.5 h-3.5" />
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
          transition={{ delay: 0.6 }}
          className="mt-6 sm:mt-10"
        >
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 text-white/60 text-xs sm:text-sm">
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Sécurisé</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/60 text-xs sm:text-sm">
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Instantané</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/60 text-xs sm:text-sm">
              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Annulez à tout moment</span>
            </div>
          </div>
        </motion.div>

        {/* Bottom home link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-5 sm:mt-8"
        >
          <Link 
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-white/60 hover:text-[#00d4ff] transition-colors"
          >
            <Home size={12} className="sm:w-3.5 sm:h-3.5" />
            <span>Retour à l'accueil</span>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
