'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      console.log('🔍 Client-side OAuth Callback');
      console.log('Code:', code ? 'present' : 'missing');
      console.log('Error:', errorParam);

      // Handle OAuth errors
      if (errorParam) {
        console.error('❌ OAuth error:', errorParam, errorDescription);
        setError(errorDescription || errorParam);
        setLoading(false);
        setTimeout(() => {
          router.push(`/register?error=${encodeURIComponent(errorDescription || errorParam)}`);
        }, 2000);
        return;
      }

      if (!code) {
        console.error('❌ No code parameter');
        setError('No authorization code received');
        setLoading(false);
        setTimeout(() => {
          router.push('/register?error=no_code');
        }, 2000);
        return;
      }

      try {
        console.log('🔄 Exchanging code for session (client-side)...');
        
        // Exchange code for session using client-side Supabase
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('❌ Error exchanging code:', exchangeError);
          setError(exchangeError.message);
          setLoading(false);
          setTimeout(() => {
            router.push(`/register?error=${encodeURIComponent(exchangeError.message)}`);
          }, 2000);
          return;
        }

        if (!data.user) {
          console.error('❌ No user after exchange');
          setError('No user data received');
          setLoading(false);
          setTimeout(() => {
            router.push('/register?error=no_user');
          }, 2000);
          return;
        }

        console.log('✅ User authenticated:', data.user.id);
        console.log('User email:', data.user.email);
        console.log('User created at:', data.user.created_at);

        // Check if user is new
        const createdAt = new Date(data.user.created_at || '');
        const now = new Date();
        const isNewUser = (now.getTime() - createdAt.getTime()) < 60000; // 60 seconds

        console.log('Is new user:', isNewUser);

        // Create user profile if new user
        if (isNewUser) {
          try {
            const fullName = data.user.user_metadata?.full_name || 
                          data.user.user_metadata?.name ||
                          data.user.email?.split('@')[0] || 
                          null;

            const { error: upsertError } = await supabase
              .from('users')
              .upsert({
                id: data.user.id,
                email: data.user.email!,
                full_name: fullName,
              }, {
                onConflict: 'id'
              });

            if (upsertError) {
              console.warn('⚠️ Error creating profile:', upsertError);
            } else {
              console.log('✅ User profile created');
            }
          } catch (err) {
            console.warn('⚠️ Error creating profile:', err);
          }

          console.log('🔄 Redirecting to /pricing');
          router.push('/pricing');
        } else {
          console.log('🔄 Redirecting to /dashboard');
          router.push('/dashboard?section=analyze');
        }
      } catch (err: any) {
        console.error('❌ Unexpected error:', err);
        setError(err.message || 'An unexpected error occurred');
        setLoading(false);
        setTimeout(() => {
          router.push(`/register?error=${encodeURIComponent(err.message || 'oauth_error')}`);
        }, 2000);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff] mb-4"></div>
          <p className="text-slate-600">Connexion en cours...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">❌ Erreur</div>
          <p className="text-slate-600">{error}</p>
          <p className="text-sm text-slate-400 mt-2">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff] mb-4"></div>
            <p className="text-slate-600">Chargement...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}

