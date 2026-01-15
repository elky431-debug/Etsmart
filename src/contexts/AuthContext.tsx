'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange, signIn, signUp, signOut, signInWithGoogle } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get initial user
    getCurrentUser().then((user) => {
      setUser(user);
      setLoading(false);
    });

    // Listen to auth state changes
    const { data: { subscription } } = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
      
      // Redirect to dashboard if user just logged in (e.g., via Google OAuth)
      // Only redirect if we're on login/register pages
      if (user && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath === '/login' || currentPath === '/register') {
          router.push('/dashboard');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSignUp = async (email: string, password: string, fullName?: string) => {
    await signUp(email, password, fullName);
    // User will be set via auth state change
    router.push('/dashboard');
  };

  const handleSignIn = async (email: string, password: string) => {
    await signIn(email, password);
    router.push('/dashboard');
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp: handleSignUp,
        signIn: handleSignIn,
        signOut: handleSignOut,
        signInWithGoogle: handleSignInWithGoogle,
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


