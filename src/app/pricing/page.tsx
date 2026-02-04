'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Zap, Loader2, LogOut } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { PLANS, type Plan, type PlanId } from '@/types/subscription';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const handleSubscribe = async (planId: PlanId) => {
    // Check if user is logged in
    if (!user) {
      // Redirect to login with return URL
      router.push(`/login?redirect=/pricing&plan=${planId}`);
      return;
    }

    setLoadingPlan(planId);

    try {
      // Create Stripe Checkout Session
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

      // Redirect to Stripe Checkout
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Logout Button - Top Right */}
      {user && (
        <div className="absolute top-4 right-4 z-50">
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl border border-slate-200 shadow-sm transition-all"
          >
            <LogOut size={18} />
            <span className="font-medium">Déconnexion</span>
          </motion.button>
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Choisissez votre plan
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Des tarifs simples et progressifs pour analyser vos produits et prendre de meilleures décisions sur Etsy
          </p>
        </motion.div>

        {/* Plans Overview */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`
                bg-white rounded-2xl shadow-lg border-2 p-8 relative
                ${plan.popular
                  ? 'border-[#00d4ff] shadow-2xl shadow-[#00d4ff]/20 scale-105'
                  : 'border-slate-200'
                }
              `}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-sm font-bold px-4 py-1 rounded-full">
                    Le plus populaire
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-slate-900">{plan.name}</h2>
                  {plan.id === 'PRO' ? (
                    <Crown className="w-8 h-8 text-[#00d4ff]" />
                  ) : plan.id === 'SCALE' ? (
                    <Zap className="w-8 h-8 text-[#00d4ff]" />
                  ) : (
                    <Logo size="sm" showText={false} className="opacity-50" />
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-5xl font-bold text-slate-900">
                    €{plan.price}
                  </span>
                  <span className="text-slate-600">/mois</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {plan.description}
                </p>
              </div>

              {/* Key Features */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Check className="w-5 h-5 text-[#00c9b7]" />
                  <span className="font-semibold text-slate-900">
                    {plan.analysesPerMonth} analyses par mois
                  </span>
                </div>
                <ul className="space-y-3">
                  {plan.features
                    .filter(f => f.available)
                    .slice(0, 5)
                    .map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-[#00c9b7] mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600">{feature.name}</span>
                      </li>
                    ))}
                </ul>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan === plan.id}
                className={`
                  w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2
                  ${plan.popular
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white hover:shadow-lg hover:shadow-[#00d4ff]/30 disabled:opacity-70'
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:opacity-70'
                  }
                `}
              >
                {loadingPlan === plan.id ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Chargement...</span>
                  </>
                ) : (
                  <span>{plan.popular ? 'Commencer' : 'Choisir ce plan'}</span>
                )}
              </button>

              {/* Limitations */}
              {plan.limitations && plan.limitations.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                    Limitations
                  </p>
                  <ul className="space-y-1">
                    {plan.limitations.map((limitation, idx) => (
                      <li key={idx} className="text-xs text-slate-500">
                        • {limitation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          ))}
        </div>


        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-slate-50 rounded-2xl border border-slate-200 p-8 max-w-4xl mx-auto"
        >
          <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">
            Notice importante
          </h3>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span>Tous les abonnements fournissent uniquement des analyses et des recommandations. Ils ne garantissent aucun résultat financier.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span>Toutes les analyses sont des estimations et des simulations basées sur des données publiques disponibles.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span>Les fonctionnalités concernent la profondeur d'analyse, pas des promesses de performance.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span>La responsabilité finale des décisions produits incombe à l'utilisateur.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span>Etsmart n'automatise aucune action sur Etsy. Toutes les analyses utilisent uniquement des données publiques.</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}

