'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubscriptionProtection } from '@/hooks/useSubscriptionProtection';
import { Paywall } from '@/components/paywall/Paywall';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Vérifier si on est sur une page d'analyse (extension) - BYPASS COMPLET
  const isCompetitorsPage = pathname?.includes('/competitors');
  const isShopAnalyzePage = pathname?.includes('/shop/analyze');
  const isTestPage = pathname?.includes('/test-extension');
  const shouldBypassProtection = isCompetitorsPage || isShopAnalyzePage || isTestPage;
  
  // ⚠️ CRITICAL: Toujours appeler les hooks (règle React), mais ignorer leurs résultats si on bypass
  const { user, loading: authLoading } = useAuth();
  const subscriptionProtection = useSubscriptionProtection();
  const { subscription, loading: subLoading, hasActiveSubscription } = useSubscription();
  
  // Si on bypass, forcer les valeurs pour éviter toute vérification
  const effectiveProtection = shouldBypassProtection 
    ? { isActive: true, isLoading: false, plan: null, cancelAtPeriodEnd: false, currentPeriodEnd: null }
    : subscriptionProtection;
  const effectiveSubscription = shouldBypassProtection
    ? { subscription: null, loading: false, hasActiveSubscription: true }
    : { subscription, loading: subLoading, hasActiveSubscription };

  // ⚠️ CRITICAL: Use STATE (not ref) to track if the initial check is complete
  // This ensures a re-render happens when the check completes
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  // Once the subscription was confirmed active in this session, remember it
  // This prevents the dashboard from unmounting/remounting on credit refresh
  const [wasActiveOnce, setWasActiveOnce] = useState(false);

  const isLoading = shouldBypassProtection ? false : (authLoading || effectiveProtection.isLoading || effectiveSubscription.loading);

  // Check if subscription is active (ignoré si on bypass)
  const subscriptionStatus = effectiveSubscription.subscription?.status;
  const periodEnd = effectiveSubscription.subscription?.periodEnd;
  const now = new Date();
  const isPeriodValid = periodEnd ? periodEnd > now : false;
  const isSubscriptionActive = subscriptionStatus === 'active' || (effectiveSubscription.subscription && isPeriodValid);
  const isReallyActive = shouldBypassProtection ? true : ((isSubscriptionActive && effectiveSubscription.hasActiveSubscription) || effectiveProtection.isActive);

  // Mark the initial check as done (uses state → triggers re-render)
  useEffect(() => {
    if (!isLoading && !initialCheckDone) {
      setInitialCheckDone(true);
    }
  }, [isLoading, initialCheckDone]);

  // Remember that the user was active at least once in this session
  useEffect(() => {
    if (isReallyActive && !wasActiveOnce) {
      setWasActiveOnce(true);
    }
  }, [isReallyActive, wasActiveOnce]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER LOGIC - ORDER MATTERS!
  // The DEFAULT is paywall/loading, children only show when EXPLICITLY active
  // ═══════════════════════════════════════════════════════════════════════

  // 0. ⚠️ BYPASS COMPLET: Pages d'analyse (extension) → afficher DIRECTEMENT
  if (shouldBypassProtection) {
    return <>{children}</>;
  }

  // 1. Still loading (initial check not done yet) → show spinner
  if (!initialCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center px-4">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#00d4ff]"></div>
          <p className="mt-4 text-sm text-white/60">Vérification de votre abonnement...</p>
        </div>
      </div>
    );
  }

  // 2. Not logged in → redirect (handled by useSubscriptionProtection)
  if (!user && !authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center px-4">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#00d4ff]"></div>
          <p className="mt-4 text-sm text-white/60">Redirection vers la connexion...</p>
        </div>
      </div>
    );
  }

  // 3. ✅ Subscription is active (or was active before in this session) → show dashboard
  //    The wasActiveOnce check prevents remounting when credits refresh
  if (isReallyActive || wasActiveOnce) {
    return <>{children}</>;
  }

  // 4. ⚠️ DEFAULT: No active subscription → show paywall
  //    This is the SAFE default - paywall shows unless we explicitly confirmed active
  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-black">
      <Paywall
        hasActiveSubscription={false}
        title="Abonnement requis"
        message="Choisissez votre plan pour accéder au dashboard et commencer à analyser des produits"
      />
    </div>
  );
}
