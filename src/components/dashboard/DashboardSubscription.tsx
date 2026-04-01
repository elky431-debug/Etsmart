'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Check, Crown, Zap, TrendingUp, AlertCircle, RefreshCw, Sparkles, Star, Rocket, AlertTriangle } from 'lucide-react';
import { PLANS, type Plan, type Subscription, type PlanId } from '@/types/subscription';
import { getUserSubscription, getUsageStats } from '@/lib/subscriptions';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';
import { Paywall } from '@/components/paywall/Paywall';

interface DashboardSubscriptionProps {
  user: any;
  isFreeUser?: boolean;
}

export function DashboardSubscription({ user, isFreeUser }: DashboardSubscriptionProps) {
  const { user: authUser } = useAuth();
  const { hasActiveSubscription, loading: subscriptionLoading } = useSubscription();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usageStats, setUsageStats] = useState({
    used: 0,
    limit: 0,
    remaining: 0,
    percentage: 0,
    resetDate: null as Date | null,
  });
  const [loading, setLoading] = useState(true);

  // Chargement initial : 1 seul appel à check-stripe-subscription (source de vérité)
  const loadSubscription = async () => {
    if (!authUser?.id) { setLoading(false); return; }
    try {
      setLoading(true);
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch('/api/check-stripe-subscription', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const stripeData = await res.json();
          if (stripeData.hasSubscription) {
            applyStripeData(stripeData);
            return;
          }
        }
      }
      // Fallback Supabase si pas de sub Stripe
      const sub = await getUserSubscription(authUser.id);
      setSubscription(sub);
      const stats = await getUsageStats(authUser.id);
      setUsageStats(stats);
    } catch (error) {
      console.error('[Subscription] load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyStripeData = (stripeData: any) => {
    const planId = (stripeData.plan || 'SCALE').toUpperCase() as PlanId;
    const plan = PLANS.find(p => p.id === planId);
    const usedValue = parseFloat(String(stripeData.used)) || 0;
    const quotaValue = (stripeData.quota != null) ? stripeData.quota : (plan?.analysesPerMonth ?? 100);
    const remainingValue = parseFloat(String(stripeData.remaining)) || Math.max(0, quotaValue - usedValue);
    setUsageStats({
      used: usedValue,
      limit: quotaValue,
      remaining: remainingValue,
      percentage: quotaValue > 0 ? (usedValue / quotaValue) * 100 : 0,
      resetDate: stripeData.periodEnd ? new Date(stripeData.periodEnd) : null,
    });
    if (plan) {
      setSubscription({
        id: stripeData.subscriptionId || `sub_${authUser?.id}`,
        user_id: authUser?.id || '',
        plan_id: planId,
        plan_name: plan.name,
        price: plan.price,
        currency: 'USD',
        status: stripeData.status || 'active',
        analyses_used_current_month: usedValue,
        current_period_start: stripeData.periodStart || new Date().toISOString(),
        current_period_end: stripeData.periodEnd || new Date().toISOString(),
        month_reset_date: stripeData.periodEnd || new Date().toISOString(),
        cancel_at_period_end: stripeData.cancelAtPeriodEnd || false,
        stripe_subscription_id: stripeData.subscriptionId,
        stripe_customer_id: stripeData.customerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Subscription);
    }
  };

  // Chargement initial
  useEffect(() => { loadSubscription(); }, [authUser]);

  // Retour depuis paiement Stripe (?success=true)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setTimeout(() => loadSubscription(), 2000);
      const newUrl = window.location.pathname + (params.get('section') ? `?section=${params.get('section')}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Événements crédits : mise à jour locale directe, 0 appel API
  useEffect(() => {
    if (!authUser?.id) return;

    const handleCreditsUpdated = (event: any) => {
      const quota = event.detail?.quota;
      if (!quota) return;
      const usedValue = parseFloat(String(quota.used)) || 0;
      const quotaValue = quota.quota || usageStats.limit || 100;
      const remainingValue = parseFloat(String(quota.remaining)) || Math.max(0, quotaValue - usedValue);
      setUsageStats(prev => ({
        used: usedValue,
        limit: quotaValue,
        remaining: remainingValue,
        percentage: quotaValue > 0 ? (usedValue / quotaValue) * 100 : 0,
        resetDate: prev.resetDate,
      }));
      setSubscription(prev => prev ? { ...prev, analyses_used_current_month: usedValue } : prev);
    };

    // subscription-refresh : rechargement complet (ex: retour onglet)
    const handleRefresh = () => loadSubscription();

    window.addEventListener('credits-updated', handleCreditsUpdated as EventListener);
    window.addEventListener('subscription-refresh', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('credits-updated', handleCreditsUpdated as EventListener);
      window.removeEventListener('subscription-refresh', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [authUser, usageStats.limit]);

  // Get current plan info - normalize plan_id to uppercase
  const normalizedPlanId = subscription?.plan_id 
    ? subscription.plan_id.toUpperCase() as PlanId 
    : null;
  const currentPlan: Plan | null = normalizedPlanId
    ? PLANS.find(p => p.id === normalizedPlanId) || null
    : null;

  // Filter other plans (exclude current plan)
  const otherPlans = PLANS.filter(p => p.id !== normalizedPlanId);

  // Plan icons
  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'SCALE':
        return <Rocket className="w-6 h-6" />;
      case 'PRO':
        return <Crown className="w-6 h-6" />;
      case 'SMART':
        return <Zap className="w-6 h-6" />;
      default:
        return <Star className="w-6 h-6" />;
    }
  };

  // Plan gradients
  const getPlanGradient = (planId: string) => {
    switch (planId) {
      case 'SCALE':
        return 'from-[#00d4ff] via-[#00c9b7] to-[#00b894]';
      case 'PRO':
        return 'from-[#667eea] via-[#764ba2] to-[#f093fb]';
      case 'SMART':
        return 'from-[#f093fb] via-[#f5576c] to-[#4facfe]';
      default:
        return 'from-slate-400 to-slate-600';
    }
  };

  // Free users: skip async fetch, show paywall immediately
  if (isFreeUser) {
    return (
      <div className="min-h-screen w-full relative overflow-hidden bg-black">
        <Paywall
          hasActiveSubscription={false}
          title="Débloquer l'analyse de produits"
          message="Choisissez votre plan et commencez à analyser des produits avec l'IA"
        />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-white/5 rounded-xl w-1/3"></div>
            <div className="h-64 bg-white/5 rounded-3xl"></div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-48 bg-white/5 rounded-2xl"></div>
              <div className="h-48 bg-white/5 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ⚠️ CRITICAL: Afficher le paywall si l'utilisateur n'a pas d'abonnement actif
  // Attendre que le chargement soit terminé
  if (!loading && !subscriptionLoading) {
    // Vérifier directement le statut de l'abonnement
    const subscriptionStatus = subscription?.status;
    const periodEnd = subscription?.current_period_end;
    const isSubscriptionActive = subscriptionStatus === 'active' || (periodEnd && new Date(periodEnd) > new Date());
    
    // Si pas d'abonnement OU abonnement non actif, afficher le paywall
    if (!subscription || !isSubscriptionActive) {
      console.log('[DashboardSubscription] 🚧 PAYWALL AFFICHÉ - subscription:', subscription, 'isSubscriptionActive:', isSubscriptionActive, 'hasActiveSubscription:', hasActiveSubscription);
      return (
        <div className="min-h-screen w-full relative overflow-hidden bg-black">
          <Paywall 
            hasActiveSubscription={false}
            title="Débloquer l'analyse de produits"
            message="Choisissez votre plan et commencez à analyser des produits avec l'IA"
          />
        </div>
      );
    }
  }

  // Free plan (no subscription)
  if (!subscription || !currentPlan) {
    return (
      <div className="min-h-screen bg-black p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <CreditCard className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">
                    Abonnement
                  </h1>
                  <p className="text-white/60 mt-1">Gérez votre plan et votre facturation</p>
                </div>
              </div>
              <button
                onClick={loadSubscription}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/90 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-white/20 transition-all shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </div>

            {/* No Subscription Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden bg-white/5 rounded-lg border border-white/10 p-8 mb-10"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative flex items-start gap-5">
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
                  <AlertCircle className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Aucun abonnement actif
                  </h2>
                  <p className="text-white/70 mb-6 text-lg">
                    Abonnez-vous pour débloquer l'analyse de produits Etsy et booster vos ventes.
                  </p>
                  <Link
                    href="/dashboard?section=analyse-simulation"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold rounded-lg hover:shadow-xl hover:shadow-cyan-500/30 transition-all hover:-translate-y-0.5 text-lg"
                  >
                    <Sparkles className="w-5 h-5" />
                    Voir les plans
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* Available Plans */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Star className="w-6 h-6 text-[#00d4ff]" />
                Plans disponibles
              </h2>
              <div className="grid md:grid-cols-3 gap-5">
                {PLANS.map((plan, index) => (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.1 }}
                    whileHover={{ y: -6, scale: 1.02 }}
                    className={`
                      relative bg-white/5 rounded-lg border p-6 overflow-hidden
                      ${plan.popular
                        ? 'border-[#00d4ff]/30 shadow-lg shadow-cyan-500/10'
                        : 'border-white/10'
                      }
                    `}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-xs font-bold px-4 py-1.5 rounded-bl-lg">
                          Popular
                        </div>
                      </div>
                    )}

                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getPlanGradient(plan.id)} flex items-center justify-center mb-4 shadow-lg`}>
                      <div className="text-white">
                        {getPlanIcon(plan.id)}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-1">
                      {plan.name}
                    </h3>
                    
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-4xl font-black text-white">
                        ${plan.price}
                      </span>
                      <span className="text-white/60 font-medium">/month</span>
                    </div>

                    <div className="bg-gradient-to-r from-[#00d4ff]/10 to-[#00c9b7]/10 rounded-lg px-4 py-3 mb-5 border border-[#00d4ff]/20">
                      {plan.analysesPerMonth === -1 ? (
                        <span className="text-2xl font-bold text-[#00d4ff]">Illimité</span>
                      ) : plan.bonusCredits ? (
                        <>
                          <span className="text-2xl font-bold text-[#00d4ff]">{plan.analysesPerMonth - plan.bonusCredits}</span>
                          <span className="text-[#00c9b7] text-sm ml-1">crédits</span>
                          <span className="ml-2 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 rounded-full px-2 py-0.5">+ {plan.bonusCredits} offerts</span>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl font-bold text-[#00d4ff]">{plan.analysesPerMonth}</span>
                          <span className="text-[#00c9b7] text-sm ml-1">crédits/mois</span>
                        </>
                      )}
                    </div>

                    <ul className="space-y-2.5 mb-6">
                      {plan.features.slice(0, 4).map((feature, idx) => (
                        feature.available && (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-[#00d4ff] mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-white/80">{feature.name}</span>
                          </li>
                        )
                      ))}
                    </ul>

                    <Link
                      href="/dashboard?section=analyse-simulation"
                      className={`
                        w-full py-3.5 rounded-lg font-bold transition-all text-center block
                        ${plan.popular
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white hover:shadow-lg hover:shadow-cyan-500/30 hover:-translate-y-0.5'
                          : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                        }
                      `}
                    >
                      Choisir ce plan
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Active subscription view
  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <CreditCard className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Subscription
                </h1>
                <p className="text-white/60 mt-1">Manage your plan and billing</p>
              </div>
            </div>
            <button
              onClick={loadSubscription}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/90 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-white/20 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Subscription Ending Warning */}
          {subscription.cancel_at_period_end && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden bg-white/5 rounded-lg border-2 border-amber-500/30 mb-6"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Abonnement en fin de période</h2>
                </div>

                <div className="bg-amber-500/10 rounded-lg p-4 mb-5 border border-amber-500/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-300 font-medium mb-1">
                        Votre abonnement a été annulé
                      </p>
                      <p className="text-sm text-amber-200/80">
                        Vous conserverez l'accès jusqu'à la fin de votre période de facturation
                        {subscription.current_period_end && (
                          <span className="font-semibold">
                            {' '}({new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})
                          </span>
                        )}.
                        Après cela, vous passerez au plan gratuit.
                      </p>
                    </div>
                  </div>
                </div>

                <Link
                  href="/dashboard?section=analyse-simulation"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                >
                  <CreditCard size={18} />
                  <span>Se réabonner</span>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Current Plan Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden bg-white/5 rounded-lg border border-white/10 mb-10"
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#00d4ff]/10 via-[#00c9b7]/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#00c9b7]/10 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
            
            <div className="relative p-8">
              {/* Plan Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-5">
                  <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${getPlanGradient(normalizedPlanId || 'SCALE')} flex items-center justify-center shadow-xl`}>
                    <div className="text-white">
                      {getPlanIcon(normalizedPlanId || 'SCALE')}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-white">
                        {currentPlan.name}
                      </h2>
                      <span className={`px-3 py-1 text-white text-xs font-bold rounded-full shadow-sm ${
                        subscription.cancel_at_period_end
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                          : 'bg-gradient-to-r from-emerald-400 to-green-500'
                      }`}>
                        {subscription.cancel_at_period_end ? 'Ending' : 'Active'}
                      </span>
                    </div>
                    <p className="text-white/60 mt-1">Votre plan d'abonnement actuel</p>
                  </div>
                </div>
                
                <div className="flex items-baseline gap-2 bg-white/5 px-6 py-4 rounded-lg border border-white/10">
                  <span className="text-4xl font-black text-[#00d4ff]">
                    ${currentPlan.price}
                  </span>
                  <span className="text-white/60 font-medium">/month</span>
                </div>
              </div>

              {/* Usage Stats */}
              <div className="bg-gradient-to-r from-[#00d4ff]/10 to-[#00c9b7]/10 rounded-lg p-6 mb-8 border border-[#00d4ff]/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-[#00d4ff]" />
                    <span className="font-semibold text-white">Utilisation mensuelle</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-[#00d4ff]">
                      {usageStats.used % 1 === 0 ? usageStats.used : usageStats.used.toFixed(1)}
                    </span>
                    <span className="text-white/60 font-medium">/ {usageStats.limit}</span>
                    <span className="text-white/40 text-sm ml-1">crédits</span>
                  </div>
                </div>
                
                <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden shadow-inner border border-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(usageStats.percentage, 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      usageStats.percentage >= 90
                        ? 'bg-gradient-to-r from-red-400 to-red-500'
                        : usageStats.percentage >= 70
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                        : 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
                    }`}
                  />
                </div>
                
                {usageStats.resetDate && (
                  <p className="text-sm text-[#00d4ff] mt-3 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Resets on {usageStats.resetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Features Grid */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#00d4ff]" />
                  Fonctionnalités incluses
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentPlan.features
                    .filter(f => f.available)
                    .map((feature, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + index * 0.03 }}
                        className="flex items-center gap-3 bg-white/5 px-4 py-3 rounded-lg border border-white/10"
                      >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-white/80">{feature.name}</span>
                      </motion.div>
                    ))}
                </div>
              </div>

            </div>
          </motion.div>

          {/* Other Plans */}
          {otherPlans.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Star className="w-6 h-6 text-[#00d4ff]" />
                Autres plans
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {otherPlans.map((plan, index) => (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    whileHover={{ y: -4 }}
                    className={`
                      relative bg-white/5 rounded-lg border p-6 overflow-hidden
                      ${plan.popular
                        ? 'border-[#00d4ff]/30 shadow-lg shadow-cyan-500/10'
                        : 'border-white/10'
                      }
                    `}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-xs font-bold px-4 py-1.5 rounded-bl-lg">
                          Popular
                        </div>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getPlanGradient(plan.id)} flex items-center justify-center shadow-lg`}>
                          <div className="text-white">
                            {getPlanIcon(plan.id)}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">
                            {plan.name}
                          </h3>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-3xl font-black text-white">
                              ${plan.price}
                            </span>
                            <span className="text-white/60">/month</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-[#00d4ff]/10 to-[#00c9b7]/10 rounded-lg px-4 py-3 mb-5 border border-[#00d4ff]/20">
                      {plan.analysesPerMonth === -1 ? (
                        <span className="text-xl font-bold text-[#00d4ff]">Illimité</span>
                      ) : plan.bonusCredits ? (
                        <>
                          <span className="text-xl font-bold text-[#00d4ff]">{plan.analysesPerMonth - plan.bonusCredits}</span>
                          <span className="text-[#00c9b7] text-sm ml-1">crédits</span>
                          <span className="ml-2 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 rounded-full px-2 py-0.5">+ {plan.bonusCredits} offerts</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xl font-bold text-[#00d4ff]">{plan.analysesPerMonth}</span>
                          <span className="text-[#00c9b7] text-sm ml-1">crédits/mois</span>
                        </>
                      )}
                    </div>

                    <ul className="space-y-2 mb-6">
                      {plan.features.slice(0, 4).map((feature, idx) => (
                        feature.available && (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-[#00d4ff] mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-white/80">{feature.name}</span>
                          </li>
                        )
                      ))}
                    </ul>

                    <Link
                      href="/dashboard?section=analyse-simulation"
                      className={`
                        w-full py-3.5 rounded-lg font-bold transition-all text-center block
                        ${plan.price > currentPlan.price
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white hover:shadow-lg hover:shadow-cyan-500/30'
                          : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                        }
                      `}
                    >
                      {plan.price > currentPlan.price ? 'Passer au supérieur' : 'Changer de plan'}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Help Section */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-10 p-6 bg-white/5 rounded-lg border border-white/10"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-[#00d4ff]" />
              </div>
              <div>
                <p className="font-semibold text-white mb-1">
                  Besoin d'aide ?
                </p>
                <p className="text-white/70">
                  Contactez notre équipe pour toute question sur votre abonnement ou pour un plan entreprise personnalisé.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
