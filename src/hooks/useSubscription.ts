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
  const isFetchingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes de cache

  const fetchSubscription = useCallback(async (forceSync = false) => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    // Éviter les appels multiples simultanés
    if (isFetchingRef.current && !forceSync) {
      console.log('[useSubscription] Already fetching, skipping...');
      return;
    }

    // Ne pas faire de requête si l'onglet n'est pas visible (sauf si forceSync)
    if (!forceSync && !isVisible) {
      console.log('[useSubscription] Tab not visible, skipping fetch');
      return;
    }

    // Vérifier le cache (ne pas re-fetch si récent) - UNLESS forceSync is true
    const now = Date.now();
    if (!forceSync && subscription && (now - lastFetchTime.current) < CACHE_DURATION) {
      console.log('[useSubscription] Using cached subscription data');
      return;
    }
    
    // If forceSync, reset cache timestamp to force fresh fetch
    if (forceSync) {
      lastFetchTime.current = 0;
      console.log('[useSubscription] 🔄 Force sync requested, bypassing cache and clearing state');
      // Clear the subscription state to force a fresh fetch
      setSubscription(null);
      // Force loading state to show we're fetching
      setLoading(true);
    }

    isFetchingRef.current = true;

    try {
      setLoading(true);
      
      // Get auth token from Supabase
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Always check Stripe directly first
      // Add cache-busting query parameter when forceSync is true
      const cacheBuster = forceSync ? `?t=${Date.now()}` : '';
      console.log('[useSubscription] 🔄 Checking Stripe directly...', forceSync ? '(force sync)' : '');
      try {
        const stripeCheck = await fetch(`/api/check-stripe-subscription${cacheBuster}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Cache-Control': 'no-cache',
          },
        });
        
        const stripeData = await stripeCheck.json();
        console.log('[useSubscription] Stripe direct check:', stripeData);
        
        if (stripeData.hasSubscription) {
          // Use Stripe data directly - this is the source of truth
          // Vérifier si la période est toujours valide (même si cancel_at_period_end)
          const periodEnd = stripeData.periodEnd ? new Date(stripeData.periodEnd) : null;
          const now = new Date();
          const isPeriodValid = periodEnd && periodEnd > now;
          
          // Le statut est 'active' si la période est valide (même si cancel_at_period_end)
          // C'est la même logique que la version en ligne : si la période est valide, l'abonnement est actif
          const effectiveStatus = isPeriodValid ? 'active' : 'canceled';
          
          const usedValue = parseFloat(stripeData.used) || 0;
          const remainingValue = parseFloat(stripeData.remaining) || (stripeData.quota - usedValue);
          if (mountedRef.current) {
            setSubscription({
              plan: stripeData.plan,
              status: effectiveStatus,
              // Ensure we parse as float to support decimal values (0.5, 0.25, etc.)
              used: usedValue,
              quota: stripeData.quota,
              remaining: remainingValue,
              periodStart: stripeData.periodStart ? new Date(stripeData.periodStart) : null,
              periodEnd: periodEnd,
            });
            setError(null);
            setLoading(false);
            lastFetchTime.current = Date.now(); // Update cache timestamp
            console.log('[useSubscription] ✅ Subscription data updated from Stripe:', {
              status: effectiveStatus,
              cancelAtPeriodEnd: stripeData.cancelAtPeriodEnd,
              isPeriodValid,
              used: usedValue,
              remaining: remainingValue,
              quota: stripeData.quota,
              timestamp: new Date().toISOString(),
            });
          }
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
      // Ensure we parse as float to support decimal values (0.5, 0.25, etc.)
      if (mountedRef.current) {
        setSubscription({
          ...data,
          used: parseFloat(data.used) || 0,
          remaining: parseFloat(data.remaining) || 0,
        });
        setError(null);
        lastFetchTime.current = Date.now(); // Mettre à jour le timestamp du cache
        console.log('[useSubscription] ✅ Subscription data updated:', {
          used: parseFloat(data.used) || 0,
          remaining: parseFloat(data.remaining) || 0,
          quota: data.quota,
        });
      }
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      if (mountedRef.current) {
        setError(err.message);
        setSubscription(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [user, isVisible]); // Removed subscription from dependencies to avoid infinite loop

  useEffect(() => {
    mountedRef.current = true;
    
    // Reset fetching flag when user changes
    isFetchingRef.current = false;
    
    // Always force sync on initial load to check Stripe directly
    if (user) {
      fetchSubscription(true);
    } else {
      if (mountedRef.current) {
        setSubscription(null);
        setLoading(false);
      }
    }
    
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user.id to avoid re-triggering on user object changes

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

  // Listen for credits-updated events and update immediately if quota data is provided
  useEffect(() => {
    if (!user) return;
    
    const handleCreditsUpdated = (event: any) => {
      console.log('[useSubscription] 💰 Credits updated event received:', event.detail);
      
      // If event contains quota data, update immediately without fetching
      if (event.detail?.quota && event.detail.immediate) {
        console.log('[useSubscription] ⚡ IMMEDIATE UPDATE from event:', event.detail.quota);
        setSubscription(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            used: parseFloat(String(event.detail.quota.used)) || prev.used,
            remaining: parseFloat(String(event.detail.quota.remaining)) || prev.remaining,
            quota: event.detail.quota.quota || prev.quota,
          };
        });
        // Also force a refresh to ensure consistency
        setTimeout(() => fetchSubscription(true), 100);
      } else {
        // Otherwise, force a refresh
        console.log('[useSubscription] 🔄 Forcing refresh from credits-updated event');
        fetchSubscription(true);
      }
    };
    
    const handleSubscriptionRefresh = () => {
      console.log('[useSubscription] 🔄 Subscription refresh event received');
      fetchSubscription(true);
    };
    
    window.addEventListener('credits-updated', handleCreditsUpdated as EventListener);
    window.addEventListener('subscription-refresh', handleSubscriptionRefresh);
    
    return () => {
      window.removeEventListener('credits-updated', handleCreditsUpdated as EventListener);
      window.removeEventListener('subscription-refresh', handleSubscriptionRefresh);
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

  // Vérifier si l'abonnement est actif
  // Un abonnement est actif si :
  // 1. Le statut est 'active' OU
  // 2. La période est toujours valide (current_period_end > now) - même si cancel_at_period_end
  // C'est la même logique que la version en ligne : si la période est valide, l'abonnement est actif
  const periodEnd = subscription?.periodEnd;
  const now = new Date();
  const isPeriodValid = periodEnd ? periodEnd > now : false;
  // Un abonnement est actif si le statut est 'active' OU si la période est encore valide
  const hasActiveSubscription = subscription?.status === 'active' || 
    (subscription && isPeriodValid); // Si la période est valide, l'abonnement est actif (même si cancel_at_period_end)
  const hasQuota = subscription 
    ? (subscription.quota === -1 || subscription.remaining > 0) // Unlimited or has remaining
    : false;
  const canAnalyze = hasActiveSubscription && hasQuota;
  const quotaPercentage = subscription && subscription.quota > 0 && subscription.quota !== -1
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

