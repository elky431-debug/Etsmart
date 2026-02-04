'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePageVisibility } from './usePageVisibility';
import type { PlanId } from '@/types/subscription';

interface SubscriptionInfo {
  plan: PlanId;
  status: string;
  used: number;
  quota: number;
  remaining: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  requiresUpgrade?: PlanId;
}

export function useSubscription() {
  const { user } = useAuth();
  const isVisible = usePageVisibility();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchTime = useRef<number>(0);
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes de cache

  const fetchSubscription = useCallback(async (forceSync = false) => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    // Ne pas faire de requête si l'onglet n'est pas visible (sauf si forceSync)
    if (!forceSync && !isVisible) {
      console.log('[useSubscription] Tab not visible, skipping fetch');
      return;
    }

    // Vérifier le cache (ne pas re-fetch si récent)
    const now = Date.now();
    if (!forceSync && subscription && (now - lastFetchTime.current) < CACHE_DURATION) {
      console.log('[useSubscription] Using cached subscription data');
      return;
    }

    try {
      setLoading(true);
      
      // Get auth token from Supabase
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Always check Stripe directly first
      console.log('[useSubscription] Checking Stripe directly...');
      try {
        const stripeCheck = await fetch('/api/check-stripe-subscription', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        
        const stripeData = await stripeCheck.json();
        console.log('[useSubscription] Stripe direct check:', stripeData);
        
        if (stripeData.hasSubscription) {
          // Use Stripe data directly - this is the source of truth
          setSubscription({
            plan: stripeData.plan,
            status: 'active',
            used: stripeData.used || 0,
            quota: stripeData.quota,
            remaining: stripeData.remaining || stripeData.quota,
            periodStart: stripeData.periodStart ? new Date(stripeData.periodStart) : null,
            periodEnd: stripeData.periodEnd ? new Date(stripeData.periodEnd) : null,
          });
          setError(null);
          setLoading(false);
          return;
        }
      } catch (stripeErr) {
        console.error('[useSubscription] Stripe direct check failed:', stripeErr);
      }
      
      // Fallback to regular subscription endpoint
      const response = await fetch('/api/user/subscription', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }
      
      const data = await response.json();
      console.log('[useSubscription] Subscription data:', data);
      setSubscription(data);
      setError(null);
      lastFetchTime.current = Date.now(); // Mettre à jour le timestamp du cache
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setError(err.message);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user, isVisible, subscription]);

  useEffect(() => {
    // Always force sync on initial load to check Stripe directly
    fetchSubscription(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Refresh subscription when returning from payment
  useEffect(() => {
    if (!user) return;

    // Check URL params for success
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const success = params.get('success');
      if (success === 'true') {
        // Multiple refresh attempts to catch webhook updates
        setTimeout(() => fetchSubscription(true), 2000);
        setTimeout(() => fetchSubscription(true), 5000);
        setTimeout(() => fetchSubscription(true), 10000);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Refresh when tab becomes visible (only if hidden for more than 5 minutes)
  useEffect(() => {
    if (!user) return;

    let hiddenTime: number | null = null;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenTime = Date.now();
      } else if (hiddenTime && Date.now() - hiddenTime > 5 * 60 * 1000) {
        // Seulement rafraîchir si l'onglet était caché plus de 5 minutes
        fetchSubscription(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Periodic refresh to sync with Stripe (only when tab is visible, every 2 minutes)
  useEffect(() => {
    if (!user || !isVisible) return;
    
    const interval = setInterval(() => {
      // Ne rafraîchir que si l'onglet est visible et le cache est expiré
      if (isVisible && (Date.now() - lastFetchTime.current) > CACHE_DURATION) {
        fetchSubscription(false);
      }
    }, 120000); // Every 2 minutes (réduit pour moins de requêtes)
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isVisible]);

  const hasActiveSubscription = subscription?.status === 'active';
  const hasQuota = subscription ? subscription.remaining > 0 : false;
  const canAnalyze = hasActiveSubscription && hasQuota;
  const quotaPercentage = subscription && subscription.quota > 0
    ? (subscription.used / subscription.quota) * 100
    : 0;
  const requiresUpgrade = subscription?.requiresUpgrade;

  // Expose refresh function for manual sync
  const refreshSubscription = useCallback((forceSync = true) => {
    return fetchSubscription(forceSync);
  }, [fetchSubscription]);

  return {
    subscription,
    loading,
    error,
    hasActiveSubscription,
    hasQuota,
    canAnalyze,
    quotaPercentage,
    requiresUpgrade,
    refreshSubscription,
  };
}

