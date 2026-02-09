'use client';

import { useRef, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubscriptionProtection } from '@/hooks/useSubscriptionProtection';
import { Paywall } from '@/components/paywall/Paywall';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const subscriptionProtection = useSubscriptionProtection();
  const { subscription, loading: subLoading, hasActiveSubscription } = useSubscription();

  // ⚠️ CRITICAL: Track if we've completed the initial check
  // After the first successful check, NEVER show the loader again
  // This prevents the dashboard from unmounting/remounting on credit refresh
  const hasCompletedInitialCheck = useRef(false);
  const [wasActiveOnce, setWasActiveOnce] = useState(false);

  const isLoading = authLoading || subscriptionProtection.isLoading || subLoading;

  // Once subscription is confirmed active, remember it
  useEffect(() => {
    if (!isLoading && !hasCompletedInitialCheck.current) {
      hasCompletedInitialCheck.current = true;
    }
  }, [isLoading]);

  // Check if subscription is active
  const subscriptionStatus = subscription?.status;
  const periodEnd = subscription?.periodEnd;
  const now = new Date();
  const isPeriodValid = periodEnd ? periodEnd > now : false;
  const isSubscriptionActive = subscriptionStatus === 'active' || (subscription && isPeriodValid);
  const isReallyActive = (isSubscriptionActive && hasActiveSubscription) || subscriptionProtection.isActive;

  // Remember that the user was active at least once in this session
  useEffect(() => {
    if (isReallyActive && !wasActiveOnce) {
      setWasActiveOnce(true);
    }
  }, [isReallyActive, wasActiveOnce]);

  // ⚠️ ONLY show loader on the VERY FIRST load, before we know anything
  // After that, NEVER unmount the dashboard (to preserve tab state)
  if (isLoading && !hasCompletedInitialCheck.current && !wasActiveOnce) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center px-4">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#00d4ff]"></div>
          <p className="mt-4 text-sm text-white/60">Vérification de votre abonnement...</p>
        </div>
      </div>
    );
  }

  // ⚠️ Not logged in → redirect handled by useSubscriptionProtection
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

  // ⚠️ No active subscription AND initial check is done AND was never active
  // Show paywall only if we're SURE the user has no subscription
  if (!isReallyActive && hasCompletedInitialCheck.current && !wasActiveOnce && !isLoading) {
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

  // ✅ Show dashboard content (either active subscription or was active before refresh)
  return <>{children}</>;
}
