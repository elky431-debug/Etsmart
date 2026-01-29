'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange, signIn, signUp, signOut, signInWithGoogle, resetPassword, updatePassword } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get initial user
    getCurrentUser()
      .then((user) => {
        setUser(user);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error getting current user:', error);
        // If refresh token is invalid, clear session and redirect to login
        if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh')) {
          signOut().catch(() => {});
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
            router.push('/login');
          }
        }
        setLoading(false);
      });

    // Listen to auth state changes
    const { data: { subscription } } = onAuthStateChange(async (user) => {
      setUser(user);
      setLoading(false);
      
      // Redirect based on user state
      if (user && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath === '/login' || currentPath === '/register') {
          // Check if user is new (created in the last 30 seconds) → redirect to pricing
          const createdAt = new Date(user.created_at || '');
          const now = new Date();
          const isNewUser = (now.getTime() - createdAt.getTime()) < 30000; // 30 seconds
          
          if (isNewUser) {
            router.push('/pricing');
          } else {
            router.push('/dashboard?section=analyze');
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSignUp = async (email: string, password: string, fullName?: string) => {
    await signUp(email, password, fullName);
    // Redirect new users to pricing/paywall
    router.push('/pricing');
  };

  const handleSignIn = async (email: string, password: string) => {
    await signIn(email, password);
    router.push('/dashboard?section=analyze');
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    router.push('/');
  };

  const handleSignInWithGoogle = async () => {
    await signInWithGoogle();
    // Redirect will be handled by Supabase
  };

  const handleResetPassword = async (email: string) => {
    await resetPassword(email);
  };

  const handleUpdatePassword = async (newPassword: string) => {
    await updatePassword(newPassword);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp: handleSignUp,
        signIn: handleSignIn,
        signOut: handleSignOut,
        signInWithGoogle: handleSignInWithGoogle,
        resetPassword: handleResetPassword,
        updatePassword: handleUpdatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


