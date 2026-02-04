'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface SubscriptionStatus {
  isActive: boolean;
  isLoading: boolean;
  plan: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}

// Cache pour éviter les appels répétés
const subscriptionCache: {
  userId: string | null;
  status: SubscriptionStatus | null;
  timestamp: number;
} = {
  userId: null,
  status: null,
  timestamp: 0,
};

const CACHE_DURATION = 30000; // 30 secondes

/**
 * Hook to protect pages that require an active subscription.
 * Redirects to /pricing if user doesn't have an active subscription.
 * 
 * Allows access if:
 * - User has an active subscription (subscription_status = 'active')
 * - User has canceled but still has time left (cancel_at_period_end = true AND current_period_end > now)
 */
export function useSubscriptionProtection(): SubscriptionStatus {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false); // Commencer à false pour ne pas bloquer
  const [status, setStatus] = useState<SubscriptionStatus>({
    isActive: false,
    isLoading: false, // Commencer à false
    plan: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
  });
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    const checkSubscription = async () => {
      // Wait for auth to load
      if (authLoading) return;

      // If no user, redirect to login
      if (!user) {
        router.push('/login');
        return;
      }

      // Vérifier le cache
      const now = Date.now();
      if (
        subscriptionCache.userId === user.id &&
        subscriptionCache.status &&
        (now - subscriptionCache.timestamp) < CACHE_DURATION
      ) {
        console.log('[SubscriptionProtection] Using cached status');
        setStatus(subscriptionCache.status);
        return;
      }

      // Éviter les vérifications multiples simultanées
      if (hasCheckedRef.current) return;
      hasCheckedRef.current = true;

      try {
        setIsLoading(true);

        // First, try to sync with Stripe to get the latest status
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          // Force sync subscription from Stripe
          const syncResponse = await fetch('/api/force-sync-subscription', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });
          
          if (syncResponse.ok) {
            const syncData = await syncResponse.json();
            console.log('[SubscriptionProtection] Sync result:', syncData);
          }
        }

        // Now check the subscription status from database
        const { data: userData, error } = await supabase
          .from('users')
          .select('subscription_plan, subscription_status, current_period_end')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('[SubscriptionProtection] Error fetching user:', error);
          // If we can't fetch user data, redirect to pricing to be safe
          router.push('/pricing');
          return;
        }

        const subscriptionStatus = userData?.subscription_status;
        const subscriptionPlan = userData?.subscription_plan;
        const currentPeriodEnd = userData?.current_period_end 
          ? new Date(userData.current_period_end) 
          : null;

        // Check if subscription is active
        const isActive = subscriptionStatus === 'active';
        
        // Check if user has canceled but still has time left
        const isCanceledButValid = 
          subscriptionStatus === 'canceled' && 
          currentPeriodEnd && 
          currentPeriodEnd > new Date();

        // Also check Stripe directly for cancel_at_period_end
        let cancelAtPeriodEnd = false;
        if (session?.access_token) {
          try {
            const stripeResponse = await fetch('/api/check-stripe-subscription', {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            });
            
            if (stripeResponse.ok) {
              const stripeData = await stripeResponse.json();
              cancelAtPeriodEnd = stripeData.cancelAtPeriodEnd || false;
            }
          } catch (e) {
            console.error('[SubscriptionProtection] Stripe check error:', e);
          }
        }

        // User can access if:
        // 1. Has an active subscription
        // 2. Has canceled but still has time left (cancel_at_period_end = true)
        const canAccess = isActive || isCanceledButValid || (cancelAtPeriodEnd && currentPeriodEnd && currentPeriodEnd > new Date());

        console.log('[SubscriptionProtection] Status:', {
          subscriptionStatus,
          subscriptionPlan,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          isActive,
          isCanceledButValid,
          canAccess,
        });

        if (!canAccess) {
          console.log('[SubscriptionProtection] No active subscription, redirecting to /pricing');
          router.push('/pricing');
          return;
        }

        const newStatus: SubscriptionStatus = {
          isActive: true,
          isLoading: false,
          plan: subscriptionPlan,
          cancelAtPeriodEnd,
          currentPeriodEnd,
        };

        // Mettre à jour le cache
        subscriptionCache.userId = user.id;
        subscriptionCache.status = newStatus;
        subscriptionCache.timestamp = Date.now();

        setStatus(newStatus);
      } catch (error) {
        console.error('[SubscriptionProtection] Error:', error);
        router.push('/pricing');
      } finally {
        setIsLoading(false);
        hasCheckedRef.current = false;
      }
    };

    checkSubscription();
  }, [user, authLoading, router]);

  // Ne pas bloquer si on a un cache valide
  const shouldBlock = isLoading && !subscriptionCache.status;
  
  return {
    ...status,
    isLoading: shouldBlock || authLoading,
  };
}

