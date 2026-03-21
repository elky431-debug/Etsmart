'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, Trash2, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Msg = { role: 'user' | 'assistant'; content: string };

const WELCOME =
  "Bonjour, je suis EtSmart Coach. Pose-moi n'importe quelle question sur Etsy, ta boutique, tes listings, ta niche ou ta stratégie — je te réponds de façon directe et actionnable.";

export function DashboardCoach() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollDown();
  }, [messages, loading, scrollDown]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput('');

    const nextHistory: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(nextHistory);
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Tu dois être connecté pour utiliser le Coach.');
        setMessages((m) => m.slice(0, -1));
        setLoading(false);
        return;
      }

      const payload = nextHistory
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: payload }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.message ||
          (data?.error === 'SUBSCRIPTION_REQUIRED'
            ? 'Un abonnement actif est requis pour le Coach.'
            : 'Impossible d’obtenir une réponse. Réessaie dans un instant.');
        setError(msg);
        setMessages((m) => m.slice(0, -1));
        return;
      }

      const reply = typeof data.message === 'string' ? data.message : '';
      if (!reply) {
        setError('Réponse vide. Réessaie.');
        setMessages((m) => m.slice(0, -1));
        return;
      }

      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setError('Erreur réseau. Vérifie ta connexion.');
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: WELCOME }]);
    setError(null);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-black text-white">
      {/* En-tête : fond opaque + ombre pour séparer clairement du fil de discussion */}
      <header className="shrink-0 border-b border-white/10 bg-zinc-950 shadow-[0_8px_32px_rgba(0,0,0,0.65)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] shadow-lg shadow-[#00d4ff]/20">
              <Bot className="h-5 w-5 text-black" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-white sm:text-xl">Coach</h1>
              <p className="truncate text-xs text-white/50 sm:text-sm">IA EtSmart · Etsy & e-commerce</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-2.5 text-sm text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white active:scale-[0.98]"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Nouvelle conversation</span>
          </button>
        </div>
      </header>

      {/* Zone messages : scroll interne uniquement ici */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto max-w-3xl space-y-5 px-4 pb-8 pt-8 sm:px-6 sm:pt-10">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Même largeur que l’icône du header (w-11) pour aligner les bulles avec le titre */}
              <div
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
                  m.role === 'user' ? 'bg-white/10' : 'bg-[#00d4ff]/20'
                }`}
              >
                {m.role === 'user' ? (
                  <MessageCircle className="h-4 w-4 text-white/80" />
                ) : (
                  <Bot className="h-4 w-4 text-[#00d4ff]" strokeWidth={2.25} />
                )}
              </div>
              <div
                className={`min-w-0 max-w-[85%] rounded-2xl border px-4 py-3.5 text-sm leading-relaxed text-white/95 whitespace-pre-wrap sm:max-w-[80%] ${
                  m.role === 'user'
                    ? 'border-[#00d4ff]/25 bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/10'
                    : 'border-white/10 bg-white/[0.07]'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#00d4ff]/20">
                <Loader2 className="h-4 w-4 animate-spin text-[#00d4ff]" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-sm text-white/60">
                Réflexion en cours…
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
        </div>
      </div>

      {error && (
        <div className="shrink-0 px-4 pb-2 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        </div>
      )}

      <footer className="shrink-0 border-t border-white/10 bg-zinc-950 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Pose ta question à EtSmart Coach…"
            rows={2}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-[#00d4ff]/50 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="flex cursor-pointer items-center justify-center self-end rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] px-4 py-3 font-semibold text-black shadow-lg shadow-[#00d4ff]/20 transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-white/40">
          Entrée pour envoyer · Maj+Entrée pour une nouvelle ligne
        </p>
      </footer>
    </div>
  );
}
