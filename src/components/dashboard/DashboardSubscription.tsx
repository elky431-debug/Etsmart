'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Check, Crown, Zap, TrendingUp, AlertCircle, RefreshCw, XCircle } from 'lucide-react';
import { PLANS, type Plan, type Subscription, type PlanId } from '@/types/subscription';
import { getUserSubscription, getUsageStats } from '@/lib/subscriptions';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface DashboardSubscriptionProps {
  user: any;
}

export function DashboardSubscription({ user }: DashboardSubscriptionProps) {
  const { user: authUser } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usageStats, setUsageStats] = useState({
    used: 0,
    limit: 0,
    remaining: 0,
    percentage: 0,
    resetDate: null as Date | null,
  });
  const [loading, setLoading] = useState(true);

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
      
      // Then load subscription data (which will also check Stripe)
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
                  status: 'active',
                  analyses_used_current_month: stripeData.used || 0,
                  current_period_start: stripeData.periodStart || new Date().toISOString(),
                  current_period_end: stripeData.periodEnd || new Date().toISOString(),
                  month_reset_date: stripeData.periodEnd || new Date().toISOString(),
                  cancel_at_period_end: false,
                  stripe_subscription_id: stripeData.subscriptionId,
                  stripe_customer_id: stripeData.customerId,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                } as Subscription);
                
                setUsageStats({
                  used: stripeData.used || 0,
                  limit: stripeData.quota || plan.analysesPerMonth,
                  remaining: stripeData.remaining || plan.analysesPerMonth,
                  percentage: stripeData.quota ? ((stripeData.used || 0) / stripeData.quota) * 100 : 0,
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
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [authUser]);

  // Get current plan info - normalize plan_id to uppercase
  const normalizedPlanId = subscription?.plan_id 
    ? subscription.plan_id.toUpperCase() as PlanId 
    : null;
  const currentPlan: Plan | null = normalizedPlanId
    ? PLANS.find(p => p.id === normalizedPlanId) || null
    : null;
  
  console.log('[DashboardSubscription] subscription:', subscription);
  console.log('[DashboardSubscription] normalizedPlanId:', normalizedPlanId);
  console.log('[DashboardSubscription] currentPlan:', currentPlan);

  // Free plan (no subscription)
  if (!subscription && !loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900">Subscription</h1>
              </div>
              <button
                onClick={loadSubscription}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh subscription"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
            <p className="text-slate-600">
              Manage your subscription and access more features
            </p>
          </div>

          {/* Free Plan Notice */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  No active subscription
                </h2>
                <p className="text-slate-600 mb-4">
                  You are currently on the free plan. Subscribe to one of our plans to start analyzing products.
                </p>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                >
                  View Plans
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Preview of Plans */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Available Plans
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {PLANS.map((plan) => (
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
                        Popular
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
                          ${plan.price}
                        </span>
                        <span className="text-slate-600">/month</span>
                      </div>
                    </div>
                    {plan.id === 'PRO' ? (
                      <Crown className="w-8 h-8 text-[#00d4ff]" />
                    ) : plan.id === 'SCALE' ? (
                      <Zap className="w-8 h-8 text-[#00d4ff]" />
                    ) : (
                      <Zap className="w-8 h-8 text-slate-400" />
                    )}
                  </div>

                  <p className="text-sm text-slate-600 mb-4">{plan.description}</p>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-[#00c9b7] flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-900">
                        {plan.analysesPerMonth} analyses/month
                      </span>
                    </li>
                    {plan.features.slice(0, 4).map((feature, index) => (
                      feature.available && (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-[#00c9b7] mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-slate-600">{feature.name}</span>
                        </li>
                      )
                    ))}
                  </ul>

                  <Link
                    href="/pricing"
                    className={`
                      w-full py-3 rounded-xl font-semibold transition-all text-center block
                      ${plan.popular
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white hover:shadow-lg hover:shadow-[#00d4ff]/30'
                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                      }
                    `}
                  >
                    {plan.popular ? 'Choose this plan' : 'Learn more'}
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!currentPlan) {
    return null;
  }

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
            <h1 className="text-3xl font-bold text-slate-900">Subscription</h1>
          </div>
          <p className="text-slate-600">
            Manage your subscription and access more features
          </p>
        </div>

        {/* Current Plan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Current Plan
              </h2>
              <p className="text-slate-600">{currentPlan.name}</p>
            </div>
            <div className="px-4 py-2 bg-slate-100 rounded-lg">
              <span className="text-2xl font-bold text-slate-900">
                ${currentPlan.price}
              </span>
              <span className="text-slate-600 text-sm">/month</span>
            </div>
          </div>

          {/* Usage */}
          {usageStats.limit > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">
                  Analyses used this month
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {usageStats.used} / {usageStats.limit}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usageStats.percentage}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-2.5 rounded-full ${
                    usageStats.percentage >= 90
                      ? 'bg-red-500'
                      : usageStats.percentage >= 70
                      ? 'bg-amber-500'
                      : 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]'
                  }`}
                />
              </div>
              {usageStats.resetDate && (
                <p className="text-xs text-slate-500 mt-2">
                  Resets on {usageStats.resetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          )}

          {/* Features */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Included Features
            </h3>
            <div className="space-y-2">
              {currentPlan.features
                .filter(f => f.available)
                .map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#00c9b7]" />
                    <span className="text-sm text-slate-600">{feature.name}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Cancel Subscription */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <button
              onClick={async () => {
                if (!confirm('Are you sure you want to cancel your subscription? You will lose access to all premium features at the end of your billing period.')) {
                  return;
                }

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

                  alert('Subscription canceled successfully. You will retain access until the end of your billing period.');
                  // Refresh subscription data
                  loadSubscription();
                } catch (error: any) {
                  console.error('Error canceling subscription:', error);
                  alert(error.message || 'Failed to cancel subscription. Please try again.');
                }
              }}
              className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancel subscription
            </button>
          </div>

          {/* Upgrade CTA */}
          {subscription?.plan_id !== 'SCALE' && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#00d4ff] hover:text-[#00c9b7] transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                Upgrade plan for more features
              </Link>
            </div>
          )}
        </div>

        {/* Other Plans */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Other Plans
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.filter(p => p.id !== subscription?.plan_id).map((plan) => (
              <motion.div
                key={plan.id}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 p-6 relative"
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-xs font-bold px-3 py-1 rounded-full">
                      Popular
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
                        ${plan.price}
                      </span>
                      <span className="text-slate-600">/month</span>
                    </div>
                  </div>
                  {plan.id === 'PRO' ? (
                    <Crown className="w-8 h-8 text-[#00d4ff]" />
                  ) : plan.id === 'SCALE' ? (
                    <Zap className="w-8 h-8 text-[#00d4ff]" />
                  ) : (
                    <Zap className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.slice(0, 5).map((feature, index) => (
                    feature.available && (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-[#00c9b7] mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600">{feature.name}</span>
                      </li>
                    )
                  ))}
                </ul>

                <Link
                  href="/pricing"
                  className="w-full py-3 rounded-xl font-semibold transition-all text-center block bg-slate-100 text-slate-900 hover:bg-slate-200"
                >
                  Learn more
                </Link>
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
                Need help?
              </p>
              <p className="text-sm text-slate-600">
                Contact our team for questions about your subscription or for a custom plan.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
