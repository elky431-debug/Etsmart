'use client';

import { motion } from 'framer-motion';
import { CreditCard, Check, Crown, Zap, TrendingUp } from 'lucide-react';

interface DashboardSubscriptionProps {
  user: any;
}

export function DashboardSubscription({ user }: DashboardSubscriptionProps) {
  const currentPlan = {
    name: 'Gratuit',
    price: 0,
    features: [
      '5 analyses par mois',
      'Accès aux analyses de base',
      'Support par email',
    ],
    limits: {
      analyses: 5,
      used: 0,
    },
  };

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 9.99,
      period: 'mois',
      features: [
        '20 analyses par mois',
        'Analyses avancées',
        'Support prioritaire',
        'Export des données',
      ],
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 19.99,
      period: 'mois',
      features: [
        'Analyses illimitées',
        'Analyses avancées',
        'Support prioritaire',
        'Export des données',
        'API access',
      ],
      popular: true,
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Abonnement</h1>
          </div>
          <p className="text-slate-600">
            Gérez votre abonnement et accédez à plus de fonctionnalités
          </p>
        </div>

        {/* Current Plan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Plan actuel
              </h2>
              <p className="text-slate-600">{currentPlan.name}</p>
            </div>
            <div className="px-4 py-2 bg-slate-100 rounded-lg">
              <span className="text-2xl font-bold text-slate-900">
                {currentPlan.price}€
              </span>
              <span className="text-slate-600 text-sm">/mois</span>
            </div>
          </div>

          {/* Usage */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                Analyses utilisées ce mois
              </span>
              <span className="text-sm font-bold text-slate-900">
                {currentPlan.limits.used} / {currentPlan.limits.analyses}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(currentPlan.limits.used / currentPlan.limits.analyses) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] h-2.5 rounded-full"
              />
            </div>
          </div>

          {/* Features */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Fonctionnalités incluses
            </h3>
            <div className="space-y-2">
              {currentPlan.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c9b7]" />
                  <span className="text-sm text-slate-600">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Available Plans */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Plans disponibles
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <motion.div
                key={plan.id}
                whileHover={{ y: -4 }}
                className={`
                  bg-white rounded-2xl shadow-sm border-2 p-6 relative
                  ${plan.popular
                    ? 'border-[#00d4ff] shadow-lg shadow-[#00d4ff]/20'
                    : 'border-slate-200'
                  }
                `}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-xs font-bold px-3 py-1 rounded-full">
                      Populaire
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-bold text-slate-900">
                        {plan.price}€
                      </span>
                      <span className="text-slate-600">/{plan.period}</span>
                    </div>
                  </div>
                  {plan.id === 'pro' ? (
                    <Crown className="w-8 h-8 text-[#00d4ff]" />
                  ) : (
                    <Zap className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-[#00c9b7] mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`
                    w-full py-3 rounded-xl font-semibold transition-all
                    ${plan.popular
                      ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white hover:shadow-lg hover:shadow-[#00d4ff]/30'
                      : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                    }
                  `}
                >
                  {plan.popular ? 'Choisir ce plan' : 'En savoir plus'}
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-[#00d4ff] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-900 mb-1">
                Besoin d'aide ?
              </p>
              <p className="text-sm text-slate-600">
                Contactez notre équipe pour des questions sur votre abonnement ou pour un plan personnalisé.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

