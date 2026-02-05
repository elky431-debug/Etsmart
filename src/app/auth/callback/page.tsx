'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Si erreur OAuth depuis Google
      if (error) {
        console.error('[OAuth Callback] Erreur OAuth:', error, errorDescription);
        router.push(`/login?error=oauth_error&message=${encodeURIComponent(errorDescription || error)}`);
        return;
      }

      if (!code) {
        console.error('[OAuth Callback] Pas de code dans l\'URL');
        router.push('/login?error=oauth_error&message=no_code');
        return;
      }

      try {
        // Échanger le code contre une session (PKCE géré automatiquement par le client)
        const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('[OAuth Callback] Erreur lors de l\'échange du code:', exchangeError);
          router.push(`/login?error=oauth_error&message=${encodeURIComponent(exchangeError.message)}`);
          return;
        }
        
        if (!data?.user) {
          console.error('[OAuth Callback] Pas d\'utilisateur après l\'échange');
          router.push('/login?error=oauth_error&message=no_user');
          return;
        }

        // ⚠️ CRITICAL: Ne JAMAIS rediriger vers /pricing après un rafraîchissement
        // Toujours rediriger vers le dashboard Analyse et Simulation
        console.log('[OAuth Callback] Redirection vers Analyse et Simulation (NO REDIRECT TO /pricing)');
        router.push('/dashboard?section=analyse-simulation');
      } catch (err: any) {
        console.error('[OAuth Callback] Erreur inattendue:', err);
        router.push(`/login?error=oauth_error&message=${encodeURIComponent(err.message || 'Erreur inconnue')}`);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  // Afficher un loader pendant le traitement
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff] mb-4"></div>
        <p className="text-white">Connexion en cours...</p>
      </div>
    </div>
  );
}

