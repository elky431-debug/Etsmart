'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionProtection } from '@/hooks/useSubscriptionProtection';

export default function AppPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // 🔒 Check subscription status
  const { isLoading: subscriptionLoading, isActive } = useSubscriptionProtection();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Wait for loading to finish
    if (loading || subscriptionLoading) return;
    
    // No user → login
    if (!user) {
      router.push('/login');
      return;
    }

    // User connected but no subscription → dashboard (shows paywall)
    if (!isActive) {
      console.log('[AppPage] No active subscription, redirecting to dashboard (paywall)');
      router.push('/dashboard');
      return;
    }

    // User connected with subscription → analyze
    console.log('[AppPage] Active subscription, redirecting to analyze page');
    router.push('/analyze');
  }, [user, loading, subscriptionLoading, isActive, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center px-4">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#00d4ff]"></div>
        <p className="mt-4 text-sm text-white/60">
          {loading || subscriptionLoading 
            ? 'Chargement...' 
            : user 
              ? 'Redirection...' 
              : 'Redirection vers la connexion...'}
        </p>
      </div>
    </div>
  );
}
