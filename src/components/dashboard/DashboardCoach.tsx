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
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="border-b border-white/10 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center shadow-lg shadow-[#00d4ff]/20 flex-shrink-0">
              <Bot className="w-5 h-5 text-black" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white truncate">Coach</h1>
              <p className="text-xs text-white/50 truncate">IA EtSmart · Etsy & e-commerce</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Nouvelle conversation</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  m.role === 'user' ? 'bg-white/10' : 'bg-[#00d4ff]/20'
                }`}
              >
                {m.role === 'user' ? (
                  <MessageCircle className="w-4 h-4 text-white/80" />
                ) : (
                  <Bot className="w-4 h-4 text-[#00d4ff]" strokeWidth={2.25} />
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/10 border border-[#00d4ff]/25 text-white'
                    : 'bg-white/[0.06] border border-white/10 text-white/90'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#00d4ff]/20 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-[#00d4ff] animate-spin" />
              </div>
              <div className="rounded-2xl px-4 py-3 bg-white/[0.06] border border-white/10 text-sm text-white/60">
                Réflexion en cours…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && (
        <div className="max-w-3xl mx-auto w-full px-4 pb-2">
          <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-4 py-2 text-sm text-red-200">{error}</div>
        </div>
      )}

      <div className="border-t border-white/10 bg-zinc-950/90 backdrop-blur-md p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
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
            className="flex-1 resize-none rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="self-end px-4 py-3 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black font-semibold shadow-lg shadow-[#00d4ff]/20 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="max-w-3xl mx-auto mt-2 text-[11px] text-white/40 text-center">
          Entrée pour envoyer · Maj+Entrée pour une nouvelle ligne
        </p>
      </div>
    </div>
  );
}
