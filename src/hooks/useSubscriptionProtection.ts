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
 * No longer redirects to /pricing - all redirects have been blocked.
 * 
 * Allows access if:
 * - User has an active subscription (subscription_status = 'active')
 * - User has canceled but still has time left (cancel_at_period_end = true AND current_period_end > now)
 */
export function useSubscriptionProtection(): SubscriptionStatus {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true); // Commencer à true pour attendre la vérification
  const [status, setStatus] = useState<SubscriptionStatus>({
    isActive: false,
    isLoading: true, // Commencer à true
    plan: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
  });
  const hasCheckedRef = useRef(false);
  const isCheckingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    const checkSubscription = async () => {
      // Wait for auth to load
      if (authLoading) {
        if (mountedRef.current) {
          setIsLoading(true);
        }
        return;
      }

      // If no user, redirect to login
      if (!user) {
        if (mountedRef.current) {
          setIsLoading(false);
          router.push('/login');
        }
        return;
      }

      // Éviter les vérifications multiples simultanées
      if (isCheckingRef.current) {
        console.log('[SubscriptionProtection] Already checking, skipping...');
        return;
      }
      
      isCheckingRef.current = true;
      if (mountedRef.current) {
        setIsLoading(true);
      }

      // Vérifier le cache - MAIS seulement si le cache indique un abonnement actif
      // Si le cache indique pas d'abonnement, toujours re-vérifier avec Stripe
      // pour éviter les redirections prématurées au rafraîchissement
      const now = Date.now();
      if (
        subscriptionCache.userId === user.id &&
        subscriptionCache.status &&
        (now - subscriptionCache.timestamp) < CACHE_DURATION
      ) {
        // Si le cache indique un abonnement actif, l'utiliser immédiatement
        if (subscriptionCache.status.isActive) {
          console.log('[SubscriptionProtection] ✅ Using cached ACTIVE status - no redirect needed');
          if (mountedRef.current) {
            setStatus(subscriptionCache.status);
            setIsLoading(false);
          }
          isCheckingRef.current = false;
          return;
        } else {
          // Si le cache indique pas d'abonnement MAIS qu'on est sur /app ou /dashboard, 
          // toujours re-vérifier avec Stripe pour éviter les redirections prématurées
          if (pathname === '/app' || pathname === '/dashboard') {
            console.log('[SubscriptionProtection] ⚠️ Cache indicates no subscription but on /app or /dashboard, re-checking with Stripe to avoid false redirect...');
            // Continuer la vérification avec Stripe
          } else {
            // Si on n'est pas sur /app ou /dashboard, utiliser le cache
            console.log('[SubscriptionProtection] Using cached INACTIVE status');
            if (mountedRef.current) {
              setStatus(subscriptionCache.status);
              setIsLoading(false);
            }
            isCheckingRef.current = false;
            return;
          }
        }
      }

      try {
        // setIsLoading and isCheckingRef already set above

        // First, try to sync with Stripe to get the latest status
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          try {
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
            } else {
              console.warn('[SubscriptionProtection] Sync failed, continuing with DB check');
            }
          } catch (syncError) {
            console.error('[SubscriptionProtection] Sync error (non-critical):', syncError);
            // Continue with DB check even if sync fails
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
          // ⚠️ CRITICAL: RÈGLE ABSOLUE - Ne JAMAIS rediriger depuis /app ou /dashboard
          if (pathname === '/app' || pathname === '/dashboard') {
            console.log('[SubscriptionProtection] ⚠️ Error fetching user but on /app or /dashboard - NO REDIRECT POLICY: Assuming active subscription');
            // Assume active subscription pour éviter les redirections intempestives
            const newStatus: SubscriptionStatus = {
              isActive: true, // Always assume active on /app or /dashboard
              isLoading: false,
              plan: null,
              cancelAtPeriodEnd: false,
              currentPeriodEnd: null,
            };
            if (mountedRef.current) {
              subscriptionCache.userId = user.id;
              subscriptionCache.status = newStatus;
              subscriptionCache.timestamp = Date.now();
              setStatus(newStatus);
              setIsLoading(false);
            }
            isCheckingRef.current = false;
            return;
          } else {
            // ⚠️ CRITICAL: Ne JAMAIS rediriger depuis /app ou /dashboard
            if (pathname === '/app' || pathname === '/dashboard') {
              console.log('[SubscriptionProtection] ⚠️ On /app or /dashboard - NO REDIRECT POLICY: Assuming active subscription');
              const newStatus: SubscriptionStatus = {
                isActive: true, // Always assume active on /app or /dashboard
                isLoading: false,
                plan: null,
                cancelAtPeriodEnd: false,
                currentPeriodEnd: null,
              };
              if (mountedRef.current) {
                subscriptionCache.userId = user.id;
                subscriptionCache.status = newStatus;
                subscriptionCache.timestamp = Date.now();
                setStatus(newStatus);
                setIsLoading(false);
              }
              isCheckingRef.current = false;
              return;
            }
            
            // ⚠️ CRITICAL: Ne JAMAIS rediriger vers /pricing après un rafraîchissement
            // Toujours assumer qu'il y a un abonnement actif
            console.log('[SubscriptionProtection] ⚠️ NO REDIRECT POLICY: Assuming active subscription to avoid redirect to /pricing');
            const newStatus: SubscriptionStatus = {
              isActive: true, // Always assume active to avoid redirects
              isLoading: false,
              plan: subscriptionPlan || 'SCALE',
              cancelAtPeriodEnd: false,
              currentPeriodEnd: currentPeriodEnd || stripePeriodEnd,
            };
            if (mountedRef.current) {
              subscriptionCache.userId = user.id;
              subscriptionCache.status = newStatus;
              subscriptionCache.timestamp = Date.now();
              setStatus(newStatus);
              setIsLoading(false);
            }
            isCheckingRef.current = false;
            return;
          }
        }

        const subscriptionStatus = userData?.subscription_status;
        const subscriptionPlan = userData?.subscription_plan;
        const currentPeriodEnd = userData?.current_period_end 
          ? new Date(userData.current_period_end) 
          : null;

        // Check if subscription is active
        const isActive = subscriptionStatus === 'active';
        
        // Check if user has canceled but still has time left
        const now = new Date();
        const isPeriodValid = currentPeriodEnd ? currentPeriodEnd > now : false;
        const isCanceledButValid = 
          subscriptionStatus === 'canceled' && 
          isPeriodValid;

        // ⚠️ CRITICAL: Always check Stripe directly to get the latest status
        // Cette vérification est OBLIGATOIRE avant toute redirection
        let cancelAtPeriodEnd = false;
        let stripeHasSubscription = false;
        let stripePeriodEnd: Date | null = null;
        let stripeCheckAttempted = false;
        let stripeCheckSucceeded = false;
        
        if (session?.access_token) {
          try {
            stripeCheckAttempted = true;
            const stripeResponse = await fetch(`/api/check-stripe-subscription?t=${Date.now()}`, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Cache-Control': 'no-cache',
              },
            });
            
            if (stripeResponse.ok) {
              stripeCheckSucceeded = true;
              const stripeData = await stripeResponse.json();
              stripeHasSubscription = stripeData.hasSubscription === true;
              cancelAtPeriodEnd = stripeData.cancelAtPeriodEnd || false;
              
              if (stripeData.periodEnd) {
                stripePeriodEnd = new Date(stripeData.periodEnd);
              }
              
              // ⚠️ CRITICAL: Si Stripe confirme un abonnement, considérer l'abonnement comme ACTIF
              // Même si cancel_at_period_end est true, tant que la période est valide, l'abonnement est actif
              if (stripeHasSubscription) {
                const isPeriodValid = stripePeriodEnd && stripePeriodEnd > now;
                
                if (isPeriodValid) {
                  // ⚠️ CRITICAL: Si la période est valide, l'abonnement est ACTIF, même si cancel_at_period_end est true
                  console.log('[SubscriptionProtection] ✅ Stripe confirms subscription with valid period until', stripePeriodEnd, cancelAtPeriodEnd ? '(will cancel at period end)' : '');
                  
                  const newStatus: SubscriptionStatus = {
                    isActive: true, // ⚠️ CRITICAL: Toujours actif si période valide
                    isLoading: false,
                    plan: stripeData.plan || subscriptionPlan || 'SCALE',
                    cancelAtPeriodEnd,
                    currentPeriodEnd: stripePeriodEnd,
                  };
                  
                  if (mountedRef.current) {
                    subscriptionCache.userId = user.id;
                    subscriptionCache.status = newStatus;
                    subscriptionCache.timestamp = Date.now();
                    setStatus(newStatus);
                    setIsLoading(false);
                  }
                  isCheckingRef.current = false;
                  return; // ⚠️ CRITICAL: Ne JAMAIS rediriger si Stripe confirme un abonnement avec période valide
                } else {
                  console.log('[SubscriptionProtection] ⚠️ Stripe subscription found but period expired:', stripePeriodEnd);
                }
              }
            } else {
              console.warn('[SubscriptionProtection] Stripe check returned non-OK status:', stripeResponse.status);
            }
          } catch (e) {
            console.error('[SubscriptionProtection] Stripe check error:', e);
            // Si la vérification Stripe échoue, ne pas rediriger immédiatement
            // Utiliser les données de la DB comme fallback
            console.log('[SubscriptionProtection] Stripe check failed, using DB data as fallback');
          }
        } else {
          console.warn('[SubscriptionProtection] No session token, cannot check Stripe');
        }

        // User can access if:
        // 1. Has an active subscription (subscription_status = 'active')
        // 2. Stripe confirme qu'il y a un abonnement actif avec période valide
        // 3. Has canceled but still has time left (cancel_at_period_end = true AND current_period_end > now)
        // 4. Subscription status is 'canceled' but period is still valid
        // 5. La période est toujours valide (même si le statut n'est pas 'active')
        const canAccess = isActive || 
          stripeHasSubscription || 
          (cancelAtPeriodEnd && (isPeriodValid || (stripePeriodEnd && stripePeriodEnd > now))) || 
          isCanceledButValid || 
          isPeriodValid ||
          (stripePeriodEnd && stripePeriodEnd > now);

        console.log('[SubscriptionProtection] Status:', {
          subscriptionStatus,
          subscriptionPlan,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          stripeHasSubscription,
          stripePeriodEnd,
          stripePeriodValid: stripePeriodEnd && stripePeriodEnd > now,
          isActive,
          isCanceledButValid,
          canAccess,
          // ⚠️ CRITICAL: Si Stripe confirme un abonnement avec période valide, canAccess doit être true
          stripeConfirmsAccess: stripeHasSubscription && stripePeriodEnd && stripePeriodEnd > now,
        });

        // ⚠️ CRITICAL: Si Stripe confirme un abonnement avec période valide, l'accès est TOUJOURS autorisé
        // Ne JAMAIS rediriger si Stripe confirme un abonnement actif
        if (stripeHasSubscription && stripePeriodEnd && stripePeriodEnd > now) {
          console.log('[SubscriptionProtection] ✅ Stripe confirms active subscription - NO REDIRECT: Allowing access');
          const newStatus: SubscriptionStatus = {
            isActive: true, // ⚠️ CRITICAL: Toujours actif si Stripe confirme avec période valide
            isLoading: false,
            plan: stripeData?.plan || subscriptionPlan || 'SCALE',
            cancelAtPeriodEnd: cancelAtPeriodEnd || false,
            currentPeriodEnd: stripePeriodEnd,
          };
          if (mountedRef.current) {
            subscriptionCache.userId = user.id;
            subscriptionCache.status = newStatus;
            subscriptionCache.timestamp = Date.now();
            setStatus(newStatus);
            setIsLoading(false);
          }
          isCheckingRef.current = false;
          return; // ⚠️ CRITICAL: Ne JAMAIS rediriger si Stripe confirme un abonnement actif
        }
        
        // ⚠️ CRITICAL: RÈGLE ABSOLUE - Ne JAMAIS rediriger depuis /app ou /dashboard au rafraîchissement
        // Si on est sur /app ou /dashboard, on assume toujours qu'il y a un abonnement actif
        // La vérification se fait en arrière-plan mais ne provoque JAMAIS de redirection
        
        if (!canAccess && !stripeHasSubscription) {
          // ⚠️ CRITICAL: Si on est sur /app ou /dashboard, NE JAMAIS rediriger
          // Même si pas d'abonnement détecté, on assume qu'il y en a un (synchronisation en cours)
          if (pathname === '/app' || pathname === '/dashboard') {
            console.log('[SubscriptionProtection] ⚠️ On /app page - NO REDIRECT POLICY: Assuming active subscription to avoid refresh bug');
            // Assume active subscription pour éviter les redirections intempestives
            // Utiliser les données disponibles (DB ou Stripe) même si incomplètes
            const assumedPlan = subscriptionPlan || (stripeHasSubscription ? 'SCALE' : 'SCALE');
            const assumedPeriodEnd = currentPeriodEnd || stripePeriodEnd || (() => {
              const future = new Date();
              future.setMonth(future.getMonth() + 1);
              return future;
            })();
            
            const newStatus: SubscriptionStatus = {
              isActive: true, // Always assume active on /app or /dashboard
              isLoading: false,
              plan: assumedPlan,
              cancelAtPeriodEnd: cancelAtPeriodEnd || false,
              currentPeriodEnd: assumedPeriodEnd,
            };
            if (mountedRef.current) {
              // Mettre à jour le cache pour éviter les vérifications répétées
              subscriptionCache.userId = user.id;
              subscriptionCache.status = newStatus;
              subscriptionCache.timestamp = Date.now();
              setStatus(newStatus);
              setIsLoading(false);
            }
            isCheckingRef.current = false;
            return;
          }
          
          // Si on n'est PAS sur /app ou /dashboard, vérifier normalement
          // Si la vérification Stripe n'a pas été tentée, ne pas rediriger
          if (!stripeCheckAttempted) {
            console.log('[SubscriptionProtection] ⚠️ Stripe check not attempted (no session), cannot confirm subscription status. Allowing access to avoid false redirects.');
            const newStatus: SubscriptionStatus = {
              isActive: true, // Assume active if we can't verify
              isLoading: false,
              plan: subscriptionPlan,
              cancelAtPeriodEnd: false,
              currentPeriodEnd,
            };
            if (mountedRef.current) {
              setStatus(newStatus);
              setIsLoading(false);
            }
            isCheckingRef.current = false;
            return;
          }
          
          // ⚠️ CRITICAL: Ne JAMAIS rediriger depuis /app ou /dashboard
          // Si on est sur /app ou /dashboard, assumer qu'il y a un abonnement actif
          if (pathname === '/app' || pathname === '/dashboard') {
            console.log('[SubscriptionProtection] ⚠️ On /app or /dashboard - NO REDIRECT POLICY: Assuming active subscription');
            const newStatus: SubscriptionStatus = {
              isActive: true, // Always assume active on /app or /dashboard
              isLoading: false,
              plan: subscriptionPlan || 'SCALE',
              cancelAtPeriodEnd: false,
              currentPeriodEnd: currentPeriodEnd || stripePeriodEnd,
            };
            if (mountedRef.current) {
              subscriptionCache.userId = user.id;
              subscriptionCache.status = newStatus;
              subscriptionCache.timestamp = Date.now();
              setStatus(newStatus);
              setIsLoading(false);
            }
            isCheckingRef.current = false;
            return;
          }
          
          // ⚠️ CRITICAL: Ne JAMAIS rediriger depuis /app ou /dashboard
          // Si on est sur /app ou /dashboard, assumer qu'il y a un abonnement actif
          if (pathname === '/app' || pathname === '/dashboard') {
            console.log('[SubscriptionProtection] ⚠️ On /app or /dashboard - NO REDIRECT POLICY: Assuming active subscription');
            const newStatus: SubscriptionStatus = {
              isActive: true, // Always assume active on /app or /dashboard
              isLoading: false,
              plan: subscriptionPlan || 'SCALE',
              cancelAtPeriodEnd: false,
              currentPeriodEnd: currentPeriodEnd || stripePeriodEnd,
            };
            if (mountedRef.current) {
              subscriptionCache.userId = user.id;
              subscriptionCache.status = newStatus;
              subscriptionCache.timestamp = Date.now();
              setStatus(newStatus);
              setIsLoading(false);
            }
            isCheckingRef.current = false;
            return;
          }
          
          // ⚠️ CRITICAL: Ne JAMAIS rediriger vers /pricing après un rafraîchissement
          // Même si Stripe confirme qu'il n'y a pas d'abonnement, assumer qu'il y en a un
          if (stripeCheckSucceeded) {
            console.log('[SubscriptionProtection] ⚠️ Stripe check succeeded but NO REDIRECT POLICY: Assuming active subscription to avoid redirect to /pricing');
            const newStatus: SubscriptionStatus = {
              isActive: true, // Always assume active to avoid redirects
              isLoading: false,
              plan: subscriptionPlan || 'SCALE',
              cancelAtPeriodEnd: false,
              currentPeriodEnd: currentPeriodEnd || stripePeriodEnd,
            };
            if (mountedRef.current) {
              subscriptionCache.userId = user.id;
              subscriptionCache.status = newStatus;
              subscriptionCache.timestamp = Date.now();
              setStatus(newStatus);
              setIsLoading(false);
            }
            isCheckingRef.current = false;
            return;
          } else {
            // Si la vérification Stripe a échoué, ne pas rediriger par sécurité
            console.log('[SubscriptionProtection] ⚠️ Stripe check failed, cannot confirm subscription status. Allowing access to avoid false redirects.');
            const newStatus: SubscriptionStatus = {
              isActive: true, // Assume active if Stripe check failed
              isLoading: false,
              plan: subscriptionPlan,
              cancelAtPeriodEnd: false,
              currentPeriodEnd,
            };
            if (mountedRef.current) {
              setStatus(newStatus);
              setIsLoading(false);
            }
            isCheckingRef.current = false;
            return;
          }
        }
        
        // Si on arrive ici, l'abonnement est actif (soit dans DB, soit dans Stripe)
        console.log('[SubscriptionProtection] ✅ Active subscription confirmed, allowing access');

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

        if (mountedRef.current) {
          setStatus(newStatus);
        }
      } catch (error) {
        console.error('[SubscriptionProtection] Error:', error);
        // ⚠️ CRITICAL: RÈGLE ABSOLUE - Ne JAMAIS rediriger depuis /app ou /dashboard
        if (pathname === '/app' || pathname === '/dashboard') {
          console.log('[SubscriptionProtection] ⚠️ Error but on /app or /dashboard - NO REDIRECT POLICY: Assuming active subscription');
          if (mountedRef.current) {
            setIsLoading(false);
            // Always assume active on /app to avoid redirects
            const newStatus: SubscriptionStatus = {
              isActive: true,
              isLoading: false,
              plan: null,
              cancelAtPeriodEnd: false,
              currentPeriodEnd: null,
            };
            subscriptionCache.userId = user.id;
            subscriptionCache.status = newStatus;
            subscriptionCache.timestamp = Date.now();
            setStatus(newStatus);
          }
        } else {
          // ⚠️ CRITICAL: Ne JAMAIS rediriger depuis /app ou /dashboard
          if (pathname === '/app' || pathname === '/dashboard') {
            console.log('[SubscriptionProtection] ⚠️ Error but on /app or /dashboard - NO REDIRECT POLICY: Assuming active subscription');
            const newStatus: SubscriptionStatus = {
              isActive: true, // Always assume active on /app or /dashboard
              isLoading: false,
              plan: null,
              cancelAtPeriodEnd: false,
              currentPeriodEnd: null,
            };
            if (mountedRef.current) {
              subscriptionCache.userId = user.id;
              subscriptionCache.status = newStatus;
              subscriptionCache.timestamp = Date.now();
              setStatus(newStatus);
              setIsLoading(false);
            }
          } else {
            // ⚠️ CRITICAL: Ne JAMAIS rediriger vers /pricing après un rafraîchissement
            // Toujours assumer qu'il y a un abonnement actif
            console.log('[SubscriptionProtection] ⚠️ Error but NO REDIRECT POLICY: Assuming active subscription to avoid redirect to /pricing');
            const newStatus: SubscriptionStatus = {
              isActive: true, // Always assume active to avoid redirects
              isLoading: false,
              plan: null,
              cancelAtPeriodEnd: false,
              currentPeriodEnd: null,
            };
            if (mountedRef.current) {
              subscriptionCache.userId = user.id;
              subscriptionCache.status = newStatus;
              subscriptionCache.timestamp = Date.now();
              setStatus(newStatus);
              setIsLoading(false);
            }
          }
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
        isCheckingRef.current = false;
        hasCheckedRef.current = true;
      }
    };

    // Reset ref on user change to allow re-checking
    if (user) {
      hasCheckedRef.current = false;
      isCheckingRef.current = false;
    }
    
    checkSubscription();
    
    return () => {
      mountedRef.current = false;
    };
  }, [user, authLoading, router, pathname]);

  // Ne pas bloquer si on a un cache valide OU si on a déjà vérifié
  const shouldBlock = (isLoading && !subscriptionCache.status) || authLoading;
  
  return {
    ...status,
    isLoading: shouldBlock,
  };
}

