'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Check, Crown, Zap, TrendingUp, AlertCircle, RefreshCw, XCircle, Sparkles, Star, Rocket, AlertTriangle } from 'lucide-react';
import { PLANS, type Plan, type Subscription, type PlanId } from '@/types/subscription';
import { getUserSubscription, getUsageStats } from '@/lib/subscriptions';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';
import { Paywall } from '@/components/paywall/Paywall';

interface DashboardSubscriptionProps {
  user: any;
}

export function DashboardSubscription({ user }: DashboardSubscriptionProps) {
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
  const [canceling, setCanceling] = useState(false);

  const loadSubscription = async () => {
    if (!authUser?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Force sync with Stripe first to ensure we have latest data
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          const syncResponse = await fetch('/api/sync-subscription', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (syncResponse.ok) {
            console.log('[Dashboard] Subscription synced from Stripe');
          }
        }
      } catch (syncError) {
        console.error('Error syncing subscription:', syncError);
      }
      
      // Force direct Stripe check first to get latest data (bypasses cache)
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          const stripeCheck = await fetch(`/api/check-stripe-subscription?t=${Date.now()}`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Cache-Control': 'no-cache',
            },
          });
          
          if (stripeCheck.ok) {
            const stripeData = await stripeCheck.json();
            if (stripeData.hasSubscription) {
              // Use Stripe data directly - it's the source of truth
              const usedValue = parseFloat(String(stripeData.used)) || 0;
              const quotaValue = stripeData.quota || 100;
              const remainingValue = parseFloat(String(stripeData.remaining)) || (quotaValue - usedValue);
              const percentage = quotaValue > 0 ? (usedValue / quotaValue) * 100 : 0;
              
              setUsageStats({
                used: usedValue,
                limit: quotaValue,
                remaining: remainingValue,
                percentage: percentage,
                resetDate: stripeData.periodEnd ? new Date(stripeData.periodEnd) : null,
              });
              
              // Also update subscription
              const sub = await getUserSubscription(authUser.id);
              if (sub) {
                setSubscription({
                  ...sub,
                  analyses_used_current_month: usedValue,
                });
              } else {
                setSubscription(sub);
              }
              
              return; // Exit early, we have the data
            }
          }
        }
      } catch (stripeErr) {
        console.error('[Dashboard] Error checking Stripe directly:', stripeErr);
      }
      
      // Fallback to normal load
      const sub = await getUserSubscription(authUser.id);
      setSubscription(sub);
      
      const stats = await getUsageStats(authUser.id);
      setUsageStats(stats);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Force check Stripe on every load
    const checkStripe = async () => {
      if (!authUser?.id) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          // Check Stripe directly
          const stripeCheck = await fetch('/api/check-stripe-subscription', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });
          
          if (stripeCheck.ok) {
            const stripeData = await stripeCheck.json();
            console.log('[Dashboard] Stripe check result:', stripeData);
            
            if (stripeData.hasSubscription) {
              // USE STRIPE DATA DIRECTLY - don't rely on database
              const planId = (stripeData.plan || 'SCALE').toUpperCase() as PlanId;
              const plan = PLANS.find(p => p.id === planId);
              
              if (plan) {
                setSubscription({
                  id: stripeData.subscriptionId || `sub_${authUser.id}`,
                  user_id: authUser.id,
                  plan_id: planId,
                  plan_name: plan.name,
                  price: plan.price,
                  currency: 'USD',
                  status: stripeData.status || 'active',
                  analyses_used_current_month: stripeData.used || 0,
                  current_period_start: stripeData.periodStart || new Date().toISOString(),
                  current_period_end: stripeData.periodEnd || new Date().toISOString(),
                  month_reset_date: stripeData.periodEnd || new Date().toISOString(),
                  cancel_at_period_end: stripeData.cancelAtPeriodEnd || false,
                  stripe_subscription_id: stripeData.subscriptionId,
                  stripe_customer_id: stripeData.customerId,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                } as Subscription);
                
                // Ensure we parse as float to support decimal values (0.5, 0.25, etc.)
                const usedValue = parseFloat(String(stripeData.used)) || 0;
                const remainingValue = parseFloat(String(stripeData.remaining)) || (stripeData.quota - usedValue);
                const quotaValue = stripeData.quota || plan.analysesPerMonth;
                
                setUsageStats({
                  used: usedValue,
                  limit: quotaValue,
                  remaining: remainingValue,
                  percentage: quotaValue ? (usedValue / quotaValue) * 100 : 0,
                  resetDate: stripeData.periodEnd ? new Date(stripeData.periodEnd) : null,
                });
                
                setLoading(false);
                console.log('[Dashboard] ✅ Using Stripe data directly - subscription active!');
                return;
              }
            }
          }
        }
        
        // Fallback to normal load
        await loadSubscription();
      } catch (error) {
        console.error('Error checking Stripe:', error);
        await loadSubscription();
      }
    };
    
    checkStripe();
  }, [authUser]);

  // Refresh subscription when returning from payment (check URL params)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const success = params.get('success');
      
      if (success === 'true') {
        // Wait a bit for webhook to process, then refresh
        setTimeout(() => {
          loadSubscription();
        }, 2000);
        
        // Clean up URL
        const newUrl = window.location.pathname + (params.get('section') ? `?section=${params.get('section')}` : '');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  // Refresh subscription when window regains focus (after returning from Stripe)
  useEffect(() => {
    if (!authUser?.id) return;
    
    const handleFocus = () => {
      loadSubscription();
    };
    
    // Listen for custom event to refresh subscription (triggered after analysis/listing/image generation)
    const handleRefreshEvent = () => {
      console.log('[Dashboard] 🔄 Refresh event received, reloading subscription IMMEDIATELY');
      // Force immediate reload - NO DELAY
      loadSubscription();
    };
    
    // Listen for credits-updated event (more specific)
    const handleCreditsUpdated = async (event: any) => {
      console.log('[Dashboard] 💰 Credits updated event received:', event.detail);
      console.log('[Dashboard] 📊 Current usageStats before update:', usageStats);
      
      // If event contains quota data, update immediately without fetching
      if (event.detail?.quota) {
        console.log('[Dashboard] ⚡ IMMEDIATE UPDATE from event:', event.detail.quota);
        const usedValue = parseFloat(String(event.detail.quota.used)) || 0;
        const quotaValue = event.detail.quota.quota || usageStats.limit || 100;
        const remainingValue = parseFloat(String(event.detail.quota.remaining)) || (quotaValue - usedValue);
        const percentage = quotaValue > 0 ? (usedValue / quotaValue) * 100 : 0;
        
        console.log('[Dashboard] 📈 Updating usageStats with:', {
          used: usedValue,
          limit: quotaValue,
          remaining: remainingValue,
          percentage: percentage,
        });
        
        setUsageStats(prev => {
          const newStats = {
            used: usedValue,
            limit: quotaValue,
            remaining: remainingValue,
            percentage: percentage,
            resetDate: prev.resetDate,
          };
          console.log('[Dashboard] ✅ New usageStats set:', newStats);
          return newStats;
        });
        
        // Also update subscription object if it exists
        if (subscription) {
          setSubscription({
            ...subscription,
            analyses_used_current_month: usedValue,
          });
        }
      }
      
      // Force multiple reloads to ensure update is visible (even if immediate update worked)
      console.log('[Dashboard] 🔄 Forcing loadSubscription() calls...');
      loadSubscription();
      setTimeout(() => {
        console.log('[Dashboard] 🔄 loadSubscription() call 1 (100ms)');
        loadSubscription();
      }, 100);
      setTimeout(() => {
        console.log('[Dashboard] 🔄 loadSubscription() call 2 (300ms)');
        loadSubscription();
      }, 300);
      setTimeout(() => {
        console.log('[Dashboard] 🔄 loadSubscription() call 3 (600ms)');
        loadSubscription();
      }, 600);
      setTimeout(() => {
        console.log('[Dashboard] 🔄 loadSubscription() call 4 (1000ms)');
        loadSubscription();
      }, 1000);
      setTimeout(() => {
        console.log('[Dashboard] 🔄 loadSubscription() call 5 (2000ms)');
        loadSubscription();
      }, 2000);
    };
    
    window.addEventListener('subscription-refresh', handleRefreshEvent);
    window.addEventListener('credits-updated', handleCreditsUpdated as EventListener);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('subscription-refresh', handleRefreshEvent);
      window.removeEventListener('credits-updated', handleCreditsUpdated as EventListener);
      window.removeEventListener('focus', handleFocus);
    };
  }, [authUser]);

  // Get current plan info - normalize plan_id to uppercase
  const normalizedPlanId = subscription?.plan_id 
    ? subscription.plan_id.toUpperCase() as PlanId 
    : null;
  const currentPlan: Plan | null = normalizedPlanId
    ? PLANS.find(p => p.id === normalizedPlanId) || null
    : null;

  // Filter other plans (exclude current plan)
  const otherPlans = PLANS.filter(p => p.id !== normalizedPlanId);

  const handleCancelSubscription = async () => {
    if (!confirm('Êtes-vous sûr de vouloir annuler votre abonnement ? Vous perdrez l\'accès à toutes les fonctionnalités premium à la fin de votre période de facturation.')) {
      return;
    }

    setCanceling(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        alert('Please sign in to cancel your subscription');
        return;
      }

      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      alert('Abonnement annulé avec succès. Vous conserverez l\'accès jusqu\'à la fin de votre période de facturation.');
      loadSubscription();
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      alert(error.message || 'Failed to cancel subscription. Please try again.');
    } finally {
      setCanceling(false);
    }
  };

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
    const subscriptionStatus = subscription?.subscription_status || subscription?.status;
    const periodEnd = subscription?.current_period_end || subscription?.periodEnd;
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
                      <span className="text-2xl font-bold text-[#00d4ff]">{plan.analysesPerMonth}</span>
                      <span className="text-[#00c9b7] text-sm ml-1">crédits/mois</span>
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

              {/* Cancel/Resubscribe Button */}
              <div className="pt-6 border-t border-white/10">
                {subscription.cancel_at_period_end ? (
                  <Link
                    href="/dashboard?section=analyse-simulation"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] rounded-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                  >
                    <CreditCard className="w-4 h-4" />
                    Subscribe again
                  </Link>
                ) : (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={canceling}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-red-400 hover:text-white hover:bg-red-500 rounded-lg border border-red-500/30 hover:border-red-500 transition-all disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    {canceling ? 'Annulation...' : 'Annuler l\'abonnement'}
                  </button>
                )}
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
                      <span className="text-xl font-bold text-[#00d4ff]">{plan.analysesPerMonth}</span>
                      <span className="text-[#00c9b7] text-sm ml-1">crédits/mois</span>
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
