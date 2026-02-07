'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange, signIn, signUp, signOut, resetPassword, updatePassword, signInWithGoogle } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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
        // If refresh token is invalid, clear session and redirect to login silently
        if (error?.message?.includes('Refresh Token') || 
            error?.message?.includes('refresh') ||
            error?.message?.includes('Invalid Refresh Token') ||
            error?.code === 'PGRST301') {
          // Nettoyer silencieusement tous les tokens Supabase
          if (typeof window !== 'undefined') {
            // Nettoyer tous les tokens Supabase du localStorage
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            if (supabaseUrl) {
              const supabaseKey = 'sb-' + supabaseUrl.split('//')[1]?.split('.')[0] + '-auth-token';
              localStorage.removeItem(supabaseKey);
              // Nettoyer aussi toutes les clés qui commencent par 'sb-'
              Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-')) {
                  localStorage.removeItem(key);
                }
              });
            }
            sessionStorage.removeItem('etsmart-user-cached');
            // Déconnexion silencieuse
            signOut().catch(() => {});
            // Rediriger vers la page d'accueil (pas login pour éviter la boucle)
            const currentPath = window.location.pathname;
            if (currentPath !== '/' && currentPath !== '/login' && currentPath !== '/register') {
              router.push('/');
            }
          }
        } else {
          // Autres erreurs : logger seulement
          console.error('Error getting current user:', error);
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
          // ⚠️ CRITICAL: Ne JAMAIS rediriger vers /pricing après un rafraîchissement
          // Toujours rediriger vers le dashboard Analyse et Simulation
          router.push('/dashboard?section=analyse-simulation');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSignUp = async (email: string, password: string, fullName?: string) => {
    await signUp(email, password, fullName);
    // ⚠️ CRITICAL: Ne JAMAIS rediriger vers /pricing
    // Rediriger vers le dashboard Analyse et Simulation
    router.push('/dashboard?section=analyse-simulation');
  };

  const handleSignIn = async (email: string, password: string) => {
    await signIn(email, password);
    // Vérifier l'abonnement avant de rediriger
    const checkSubscription = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          const response = await fetch('/api/check-stripe-subscription', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });
          
          const data = await response.json();
          
          // ⚠️ CRITICAL: Ne JAMAIS rediriger vers /pricing
          // Toujours rediriger vers le dashboard Analyse et Simulation
          router.push('/dashboard?section=analyse-simulation');
        } else {
          router.push('/dashboard?section=analyse-simulation');
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        router.push('/dashboard?section=analyse-simulation');
      }
    };
    
    checkSubscription();
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

  const handleSignInWithGoogle = async () => {
    await signInWithGoogle();
    // La redirection sera gérée par le callback OAuth
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp: handleSignUp,
        signIn: handleSignIn,
        signInWithGoogle: handleSignInWithGoogle,
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


