'use client';

import { motion } from 'framer-motion';
import { Check, X, Crown, Zap, Sparkles } from 'lucide-react';
import { PLANS, type Plan } from '@/types/subscription';
import Link from 'next/link';

export default function PricingPage() {
  // Feature comparison table data
  const featureComparison = [
    { id: 'analyses', name: 'Analyses / month', smart: '15', pro: '30', scale: '100' },
    { id: 'competition', name: 'Competition & saturation analysis', smart: true, pro: true, scale: true },
    { id: 'basic_sim', name: 'Simplified launch simulation', smart: true, pro: true, scale: true },
    { id: 'full_sim', name: 'Complete launch simulation', smart: false, pro: true, scale: true },
    { id: 'advanced_sim', name: 'Advanced simulation (risk / effort)', smart: false, pro: false, scale: true },
    { id: 'basic_sheet', name: 'Basic product sheet', smart: true, pro: false, scale: false },
    { id: 'full_sheet', name: 'Complete product sheet', smart: false, pro: true, scale: true },
    { id: 'advanced_marketing', name: 'Advanced marketing', smart: false, pro: true, scale: true },
    { id: 'tiktok_ideas', name: 'TikTok ideas & ad channel', smart: false, pro: true, scale: true },
    { id: 'ad_prompt', name: 'AI ad image prompt', smart: false, pro: true, scale: true },
    { id: 'extended_market', name: 'Extended market analysis', smart: false, pro: false, scale: true },
    { id: 'advanced_history', name: 'Advanced history organization', smart: false, pro: false, scale: true },
    { id: 'beta_access', name: 'Early access to new features (beta)', smart: false, pro: false, scale: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Simple, progressive pricing to help you analyze products and make better decisions on Etsy
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
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-slate-900">{plan.name}</h2>
                  {plan.id === 'pro' ? (
                    <Crown className="w-8 h-8 text-[#00d4ff]" />
                  ) : plan.id === 'scale' ? (
                    <Zap className="w-8 h-8 text-[#00d4ff]" />
                  ) : (
                    <Sparkles className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-5xl font-bold text-slate-900">
                    ${plan.price}
                  </span>
                  <span className="text-slate-600">/month</span>
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
                    {plan.analysesPerMonth} analyses per month
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
              <Link
                href="/dashboard?tab=subscription"
                className={`
                  w-full py-4 rounded-xl font-semibold transition-all text-center block
                  ${plan.popular
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white hover:shadow-lg hover:shadow-[#00d4ff]/30'
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  }
                `}
              >
                {plan.popular ? 'Get Started' : 'Choose Plan'}
              </Link>

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

        {/* Feature Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-16"
        >
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            Feature Comparison
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-4 px-4 font-semibold text-slate-900">Features</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-900">Smart</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-900">Pro</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-900">Scale</th>
                </tr>
              </thead>
              <tbody>
                {featureComparison.map((feature, index) => (
                  <tr
                    key={feature.id}
                    className={index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}
                  >
                    <td className="py-4 px-4 text-sm text-slate-700 font-medium">
                      {feature.name}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {typeof feature.smart === 'boolean' ? (
                        feature.smart ? (
                          <Check className="w-5 h-5 text-[#00c9b7] mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-slate-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">
                          {feature.smart}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {typeof feature.pro === 'boolean' ? (
                        feature.pro ? (
                          <Check className="w-5 h-5 text-[#00c9b7] mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-slate-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">
                          {feature.pro}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {typeof feature.scale === 'boolean' ? (
                        feature.scale ? (
                          <Check className="w-5 h-5 text-[#00c9b7] mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-slate-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">
                          {feature.scale}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-slate-50 rounded-2xl border border-slate-200 p-8 max-w-4xl mx-auto"
        >
          <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">
            Important Notice
          </h3>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span>All subscriptions provide analyses and recommendations only. They do not guarantee any financial results.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span>All analyses are estimates and simulations based on available public data.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span>Features are related to analysis depth, not performance promises.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span>Final responsibility for product decisions remains with the user.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span>Etsmart does not automate any actions on Etsy. All analyses use public data only.</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}

