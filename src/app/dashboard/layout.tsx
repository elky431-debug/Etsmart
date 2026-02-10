'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubscriptionProtection } from '@/hooks/useSubscriptionProtection';
import { Paywall } from '@/components/paywall/Paywall';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const subscriptionProtection = useSubscriptionProtection();
  const { subscription, loading: subLoading, hasActiveSubscription } = useSubscription();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Vérifier si on est sur une page d'analyse en cours (extension)
  const isAnalyzingPage = pathname?.includes('/competitors') && searchParams?.get('analyzing') === 'true';
  const isShopAnalyzingPage = pathname?.includes('/shop/analyze') && searchParams?.get('analyzing') === 'true';
  const isTestPage = pathname?.includes('/test-extension');
  const shouldBypassProtection = isAnalyzingPage || isShopAnalyzingPage || isTestPage;

  // ⚠️ CRITICAL: Use STATE (not ref) to track if the initial check is complete
  // This ensures a re-render happens when the check completes
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  // Once the subscription was confirmed active in this session, remember it
  // This prevents the dashboard from unmounting/remounting on credit refresh
  const [wasActiveOnce, setWasActiveOnce] = useState(false);

  const isLoading = authLoading || subscriptionProtection.isLoading || subLoading;

  // Check if subscription is active
  const subscriptionStatus = subscription?.status;
  const periodEnd = subscription?.periodEnd;
  const now = new Date();
  const isPeriodValid = periodEnd ? periodEnd > now : false;
  const isSubscriptionActive = subscriptionStatus === 'active' || (subscription && isPeriodValid);
  const isReallyActive = (isSubscriptionActive && hasActiveSubscription) || subscriptionProtection.isActive;

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

  // 0. ⚠️ BYPASS: Pages d'analyse en cours (extension) → toujours afficher
  //    Ces pages doivent s'afficher même sans abonnement vérifié pour permettre l'analyse
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
