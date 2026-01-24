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

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
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

    fetchSubscription();
  }, [user]);

  const hasActiveSubscription = subscription?.status === 'active';
  const hasQuota = subscription ? subscription.remaining > 0 : false;
  const canAnalyze = hasActiveSubscription && hasQuota;
  const quotaPercentage = subscription && subscription.quota > 0
    ? (subscription.used / subscription.quota) * 100
    : 0;

  return {
    subscription,
    loading,
    error,
    hasActiveSubscription,
    hasQuota,
    canAnalyze,
    quotaPercentage,
  };
}

