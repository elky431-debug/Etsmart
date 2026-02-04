'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange, signIn, signUp, signOut, resetPassword, updatePassword } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Essayer de récupérer l'utilisateur depuis le cache Supabase d'abord (évite le flash de chargement)
  const [user, setUser] = useState<User | null>(() => {
    // Ne pas initialiser côté serveur
    if (typeof window === 'undefined') return null;
    // Essayer de récupérer depuis sessionStorage pour éviter le flash
    try {
      const cached = sessionStorage.getItem('etsmart-user-cached');
      if (cached === 'true') {
        // On a déjà chargé une fois, on peut retourner null temporairement
        // Le vrai user sera chargé par getCurrentUser mais sans afficher de loader
        return null;
      }
    } catch (e) {
      // Ignore
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    // Si on a déjà chargé une fois dans cette session, ne pas afficher de loader
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('etsmart-user-cached');
      return cached !== 'true';
    }
    return true;
  });
  const router = useRouter();

  useEffect(() => {
    // Get initial user
    getCurrentUser()
      .then((user) => {
        setUser(user);
        setLoading(false);
        // Marquer comme chargé dans cette session
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('etsmart-user-cached', 'true');
        }
      })
      .catch((error) => {
        console.error('Error getting current user:', error);
        // If refresh token is invalid, clear session and redirect to login
        if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh')) {
          signOut().catch(() => {});
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
            sessionStorage.removeItem('etsmart-user-cached');
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
      // Ne pas rediriger si on est sur /auth/callback (la page gère déjà la redirection)
      if (user && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath === '/auth/callback') {
          // La page callback gère la redirection, ne rien faire ici
          return;
        }
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
    try {
      await signOut();
      setUser(null);
      // Nettoyer le localStorage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      router.push('/');
      // Forcer le rechargement pour s'assurer que tout est nettoyé
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // Même en cas d'erreur, nettoyer et rediriger
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
      }
    }
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


