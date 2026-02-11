'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface SubscriptionStatus {
  isActive: boolean;
  isLoading: boolean;
  plan: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}

/**
 * Hook to protect pages that require an active subscription.
 * 
 * BEHAVIOR:
 * - While checking: isLoading = true, isActive = false
 * - No user: redirects to /login
 * - No subscription: isActive = false (dashboard shows paywall)
 * - Active subscription: isActive = true
 * - Canceled but period valid: isActive = true
 */
export function useSubscriptionProtection(): SubscriptionStatus {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Vérifier si on est sur une page d'analyse (extension) - BYPASS COMPLET
  // Ces pages ne doivent JAMAIS rediriger, même si l'utilisateur n'est pas connecté
  const isCompetitorsPage = pathname?.includes('/competitors');
  const isShopAnalyzePage = pathname?.includes('/shop/analyze');
  const isTestPage = pathname?.includes('/test-extension');
  const shouldBypassProtection = isCompetitorsPage || isShopAnalyzePage || isTestPage;
  
  // Log pour debug
  if (shouldBypassProtection) {
    console.log('[SubscriptionProtection] 🚫 BYPASS activé pour:', pathname);
  }
  
  // #region agent log
  console.log('[DEBUG] Hook useSubscriptionProtection init', {pathname, shouldBypassProtection, user: !!user, authLoading});
  fetch('http://127.0.0.1:7242/ingest/36280d17-3cec-4672-8547-feae1e9f30cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSubscriptionProtection.ts:43',message:'Hook init - shouldBypassProtection check',data:{pathname,shouldBypassProtection,user:!!user,authLoading},timestamp:Date.now(),runId:'debug1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  const [status, setStatus] = useState<SubscriptionStatus>({
    isActive: shouldBypassProtection ? true : false, // Forcer isActive à true pour pages analyse
    isLoading: shouldBypassProtection ? false : true, // Pas de loading pour pages analyse
    plan: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
  });
  const isCheckingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    // #region agent log
    console.log('[DEBUG] useSubscriptionProtection useEffect triggered', {pathname, shouldBypassProtection, user: !!user, authLoading});
    fetch('http://127.0.0.1:7242/ingest/36280d17-3cec-4672-8547-feae1e9f30cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSubscriptionProtection.ts:53',message:'useEffect triggered',data:{pathname,shouldBypassProtection,user:!!user,authLoading},timestamp:Date.now(),runId:'debug1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Si on bypass, ne rien faire du tout
    if (shouldBypassProtection) {
      // #region agent log
      console.log('[DEBUG] ✅ BYPASS - useEffect return early', {pathname, shouldBypassProtection});
      fetch('http://127.0.0.1:7242/ingest/36280d17-3cec-4672-8547-feae1e9f30cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSubscriptionProtection.ts:55',message:'BYPASS - useEffect return early',data:{pathname,shouldBypassProtection},timestamp:Date.now(),runId:'debug1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    mountedRef.current = true;
    
    const checkSubscription = async () => {
      // Wait for auth to load
      if (authLoading) {
        return;
      }

      // If no user, redirect to login (SEULEMENT si pas de bypass)
      if (!user) {
        // #region agent log
        console.error('[DEBUG] ❌ REDIRECT TO LOGIN', {pathname, shouldBypassProtection, user: !!user});
        fetch('http://127.0.0.1:7242/ingest/36280d17-3cec-4672-8547-feae1e9f30cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSubscriptionProtection.ts:68',message:'REDIRECT TO LOGIN',data:{pathname,shouldBypassProtection,user:!!user},timestamp:Date.now(),runId:'debug1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        if (mountedRef.current) {
          setStatus(prev => ({ ...prev, isLoading: false, isActive: false }));
          router.push('/login');
        }
        return;
      }

      // Avoid concurrent checks
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        // 1. Get auth session
        const { data: { session } } = await supabase.auth.getSession();
        
        // 2. Try Stripe direct check first (source of truth)
        if (session?.access_token) {
          try {
            // Force sync with Stripe
            await fetch('/api/force-sync-subscription', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${session.access_token}` },
            }).catch(() => {}); // Non-critical

            // Check Stripe subscription
            const stripeResponse = await fetch(`/api/check-stripe-subscription?t=${Date.now()}`, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Cache-Control': 'no-cache',
              },
            });

            if (stripeResponse.ok) {
              const stripeData = await stripeResponse.json();
              
              if (stripeData.hasSubscription) {
                const periodEnd = stripeData.periodEnd ? new Date(stripeData.periodEnd) : null;
                const now = new Date();
                const isPeriodValid = periodEnd ? periodEnd > now : false;

                if (isPeriodValid) {
                  console.log('[SubscriptionProtection] ✅ Stripe confirms active subscription until', periodEnd);
                  if (mountedRef.current) {
                    setStatus({
                      isActive: true,
                      isLoading: false,
                      plan: stripeData.plan || null,
                      cancelAtPeriodEnd: stripeData.cancelAtPeriodEnd || false,
                      currentPeriodEnd: periodEnd,
                    });
                  }
                  isCheckingRef.current = false;
                  return;
                }
              }
            }
          } catch (e) {
            console.warn('[SubscriptionProtection] Stripe check failed, falling back to DB:', e);
          }
        }

        // 3. Fallback: Check database
        const { data: userData, error } = await supabase
          .from('users')
          .select('subscription_plan, subscription_status, current_period_end')
          .eq('id', user.id)
          .single();

        if (error || !userData) {
          console.error('[SubscriptionProtection] DB check failed:', error);
          if (mountedRef.current) {
            setStatus({
              isActive: false,
              isLoading: false,
              plan: null,
              cancelAtPeriodEnd: false,
              currentPeriodEnd: null,
            });
          }
          isCheckingRef.current = false;
          return;
        }

        const subscriptionStatus = userData.subscription_status;
        const subscriptionPlan = userData.subscription_plan;
        const currentPeriodEnd = userData.current_period_end
          ? new Date(userData.current_period_end)
          : null;

        const now = new Date();
        const isActive = subscriptionStatus === 'active';
        const isPeriodValid = currentPeriodEnd ? currentPeriodEnd > now : false;
        const canAccess = isActive || isPeriodValid;

        console.log('[SubscriptionProtection] DB check result:', {
          subscriptionStatus,
          subscriptionPlan,
          currentPeriodEnd,
          isActive,
          isPeriodValid,
          canAccess,
        });

        if (mountedRef.current) {
          setStatus({
            isActive: canAccess,
            isLoading: false,
            plan: subscriptionPlan || null,
            cancelAtPeriodEnd: subscriptionStatus === 'canceled' && isPeriodValid,
            currentPeriodEnd,
          });
        }
      } catch (error) {
        console.error('[SubscriptionProtection] Error:', error);
        if (mountedRef.current) {
          setStatus({
            isActive: false,
            isLoading: false,
            plan: null,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
          });
        }
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Reset and check on user change
    isCheckingRef.current = false;
    checkSubscription();

    return () => {
      mountedRef.current = false;
    };
  }, [user, authLoading, router, shouldBypassProtection]);

  // Si on bypass, retourner un statut qui indique que tout est OK
  if (shouldBypassProtection) {
    return {
      isActive: true,
      isLoading: false,
      plan: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    };
  }

  return status;
}
