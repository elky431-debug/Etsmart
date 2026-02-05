'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Activation de votre abonnement...');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      router.push('/dashboard?section=analyse-simulation');
      return;
    }

    async function syncSubscription() {
      try {
        // Get auth token
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setStatus('error');
          setMessage('Session expirée. Veuillez vous reconnecter.');
          return;
        }

        const res = await fetch('/api/subscription/sync-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ sessionId }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setStatus('success');
          setMessage('Abonnement activé avec succès !');
          
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            router.push('/dashboard?success=true&section=subscription');
          }, 2000);
        } else if (attempts < 3) {
          // Retry up to 3 times with increasing delay
          setAttempts(prev => prev + 1);
          setMessage(`Synchronisation en cours... (tentative ${attempts + 2}/4)`);
          setTimeout(syncSubscription, 2000 * (attempts + 1));
        } else {
          setStatus('error');
          setMessage(data.error || 'Erreur lors de l\'activation. Veuillez rafraîchir la page.');
        }
      } catch (err) {
        console.error('Sync error:', err);
        if (attempts < 3) {
          setAttempts(prev => prev + 1);
          setTimeout(syncSubscription, 2000 * (attempts + 1));
        } else {
          setStatus('error');
          setMessage('Erreur de connexion. Veuillez réessayer.');
        }
      }
    }

    syncSubscription();
  }, [sessionId, router, attempts]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl max-w-md w-full"
      >
        {status === 'loading' && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="mx-auto mb-6"
          >
            <Loader2 className="h-16 w-16 text-cyan-400" />
          </motion.div>
        )}
        
        {status === 'success' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="h-16 w-16 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30"
          >
            <CheckCircle2 className="h-8 w-8 text-white" />
          </motion.div>
        )}
        
        {status === 'error' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="h-16 w-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <XCircle className="h-8 w-8 text-white" />
          </motion.div>
        )}

        <h1 className="text-2xl font-bold text-white mb-3">
          {status === 'success' ? 'Merci !' : status === 'error' ? 'Oups...' : 'Patientez...'}
        </h1>
        
        <p className="text-white/70 text-lg">{message}</p>
        
        {status === 'success' && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-cyan-400 mt-6"
          >
            Redirection vers le dashboard...
          </motion.p>
        )}
        
        {status === 'error' && (
          <div className="mt-6 space-y-3">
            <button
              onClick={() => {
                setStatus('loading');
                setAttempts(0);
                setMessage('Nouvelle tentative...');
              }}
              className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-semibold rounded-xl hover:opacity-90 transition"
            >
              Réessayer
            </button>
            <button
              onClick={() => router.push('/dashboard?section=subscription')}
              className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition"
            >
              Aller au dashboard
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

