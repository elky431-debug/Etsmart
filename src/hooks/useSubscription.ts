'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
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
      
      const response = await fetch('/api/user/subscription', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }
      
      const data = await response.json();
      setSubscription(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setError(err.message);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
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
        setTimeout(() => fetchSubscription(), 2000);
        setTimeout(() => fetchSubscription(), 5000);
        setTimeout(() => fetchSubscription(), 10000);
      }
    }

    // Refresh when window regains focus (after returning from Stripe)
    const handleFocus = () => {
      fetchSubscription();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Periodic refresh to sync with Stripe (every 30 seconds)
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      fetchSubscription();
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const hasActiveSubscription = subscription?.status === 'active';
  const hasQuota = subscription ? subscription.remaining > 0 : false;
  const canAnalyze = hasActiveSubscription && hasQuota;
  const quotaPercentage = subscription && subscription.quota > 0
    ? (subscription.used / subscription.quota) * 100
    : 0;
  const requiresUpgrade = subscription?.requiresUpgrade;

  return {
    subscription,
    loading,
    error,
    hasActiveSubscription,
    hasQuota,
    canAnalyze,
    quotaPercentage,
    requiresUpgrade,
  };
}

