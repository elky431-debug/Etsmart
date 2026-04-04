'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, Trash2, Paperclip, X, Search, FileText, DollarSign, Sparkles, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  attachment?: { name: string; dataUrl: string; type: string };
};

interface ModeConfig {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const MODES: ModeConfig[] = [
  { id: 'general',  label: 'Coach général',       sublabel: 'Stratégie, conseils Etsy',      icon: <Bot className="h-5 w-5" /> },
  { id: 'client',   label: 'Réponse client',       sublabel: 'Litiges, avis, messages',       icon: <MessageCircle className="h-5 w-5" /> },
  { id: 'product',  label: 'Recherche produit',    sublabel: 'Trouver des niches à potentiel', icon: <Search className="h-5 w-5" /> },
  { id: 'listing',  label: 'Optimiser un listing', sublabel: 'Titre, tags, description SEO',  icon: <FileText className="h-5 w-5" /> },
  { id: 'pricing',  label: 'Pricing & marges',     sublabel: 'Calcul de prix, rentabilité',   icon: <DollarSign className="h-5 w-5" /> },
  { id: 'branding', label: 'Branding & boutique',  sublabel: 'Image de marque, visibilité',   icon: <Sparkles className="h-5 w-5" /> },
];

export function DashboardCoach() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<string>('general');
  const [attachment, setAttachment] = useState<{ name: string; dataUrl: string; type: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  const hasMessages = messages.length > 0;

  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (hasMessages) {
      scrollDown();
    }
  }, [messages, loading, scrollDown, hasMessages]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 5 * 24 + 24; // ~5 rows
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, []);

  useEffect(() => {
    adjustTextarea();
  }, [input, adjustTextarea]);

  const handleModeSelect = (mode: ModeConfig) => {
    setActiveMode(mode.id);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAttachment({ name: file.name, dataUrl, type: file.type });
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be re-selected
    e.target.value = '';
  };

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAttachment({ name: file.name, dataUrl, type: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput('');

    const userMsg: Msg = {
      role: 'user',
      content: text,
      ...(attachment ? { attachment } : {}),
    };

    const nextHistory: Msg[] = [...messages, userMsg];
    setMessages(nextHistory);
    setAttachment(null);
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

      // Strip attachments from history for the API payload (only current message gets attachment)
      const payload = nextHistory.map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: payload,
          mode: activeMode,
          attachment: userMsg.attachment
            ? { name: userMsg.attachment.name, dataUrl: userMsg.attachment.dataUrl, type: userMsg.attachment.type }
            : null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.message ||
          (data?.error === 'SUBSCRIPTION_REQUIRED'
            ? 'Un abonnement actif est requis pour le Coach.'
            : `Impossible d'obtenir une réponse. Réessaie dans un instant.`);
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
    setMessages([]);
    setError(null);
    setAttachment(null);
    setInput('');
    setActiveMode('general');
  };

  const activeModeConfig = MODES.find((m) => m.id === activeMode) ?? MODES[0];

  // ── INPUT BAR (shared between empty and chat states) ──────────────────────
  const InputBar = (
    <div className="w-full">
      {/* Attachment preview chip */}
      {attachment && (
        <div className="mb-2 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80">
            {attachment.type.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className="h-5 w-5 rounded object-cover"
              />
            ) : (
              <FileText className="h-4 w-4 text-[#00d4ff]" />
            )}
            <span className="max-w-[200px] truncate">{attachment.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="ml-1 text-white/40 hover:text-white/80 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main input container */}
      <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 focus-within:border-[#00d4ff]/40 focus-within:ring-1 focus-within:ring-[#00d4ff]/20 transition-all">
        {/* Paperclip */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-0.5 flex-shrink-0 text-white/40 hover:text-[#00d4ff] transition-colors"
          title="Joindre un fichier"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.txt,.csv"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Textarea */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Pose ta question à EtSmart Coach…"
          rows={1}
          disabled={loading}
          className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none disabled:opacity-50 leading-6"
          style={{ maxHeight: '144px', overflowY: 'auto' }}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          className="mb-0.5 flex flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] p-2 text-black shadow-lg shadow-[#00d4ff]/20 transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      {/* Active mode badge */}
      <p className="mt-1.5 pl-1 text-[11px] text-white/40">
        Mode : <span className="text-white/60">{activeModeConfig.label}</span>
        <span className="ml-2 text-white/25">· Entrée pour envoyer · Maj+Entrée nouvelle ligne</span>
      </p>
    </div>
  );

  // ── EMPTY STATE ───────────────────────────────────────────────────────────
  if (!hasMessages) {
    return (
      <div
        className="relative flex min-h-[calc(100vh-4rem)] w-full flex-col items-center justify-center bg-black px-4 py-8 text-white"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#00d4ff] bg-[#00d4ff]/5 backdrop-blur-sm">
            <Paperclip className="h-10 w-10 text-[#00d4ff] mb-3" />
            <p className="text-[#00d4ff] font-semibold text-lg">Dépose ton fichier ici</p>
          </div>
        )}
        {/* Hero */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] shadow-xl shadow-[#00d4ff]/25">
            <Bot className="h-8 w-8 text-black" strokeWidth={2.25} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">EtSmart Coach</h1>
            <p className="mt-1.5 text-sm text-white/50">
              Pose ta question, choisis un mode ou attache un fichier
            </p>
          </div>
        </div>

        {/* Mode grid */}
        <div className="mb-8 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleModeSelect(mode)}
              className={`rounded-xl border p-4 text-left transition-all hover:border-[#00d4ff]/50 ${
                activeMode === mode.id
                  ? 'border-[#00d4ff] bg-[#00d4ff]/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/8'
              }`}
            >
              <div
                className={`mb-2 ${activeMode === mode.id ? 'text-[#00d4ff]' : 'text-white/60'}`}
              >
                {mode.icon}
              </div>
              <p className="text-sm font-semibold text-white">{mode.label}</p>
              <p className="mt-0.5 text-xs text-white/45">{mode.sublabel}</p>
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="w-full max-w-2xl">{InputBar}</div>
      </div>
    );
  }



  // ── CHAT STATE ────────────────────────────────────────────────────────────
  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col bg-black text-white"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center border-2 border-dashed border-[#00d4ff] bg-[#00d4ff]/5 backdrop-blur-sm">
          <Paperclip className="h-10 w-10 text-[#00d4ff] mb-3" />
          <p className="text-[#00d4ff] font-semibold text-lg">Dépose ton fichier ici</p>
        </div>
      )}
      {/* Header */}
      <header className="shrink-0 border-b border-white/10 bg-zinc-950 shadow-[0_8px_32px_rgba(0,0,0,0.65)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] shadow-lg shadow-[#00d4ff]/20">
              <Bot className="h-5 w-5 text-black" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg">
                EtSmart Coach
              </h1>
              <p className="truncate text-xs text-white/50">
                Mode : {activeModeConfig.label}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white active:scale-[0.98]"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Nouvelle conversation</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto max-w-3xl space-y-5 px-4 pb-8 pt-8 sm:px-6 sm:pt-10">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
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
                className={`min-w-0 max-w-[85%] sm:max-w-[80%] ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                } flex flex-col gap-2`}
              >
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed text-white/95 whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'rounded-tr-sm border-[#00d4ff]/25 bg-[#00d4ff]/15'
                      : 'rounded-tl-sm border-white/10 bg-white/5'
                  }`}
                >
                  {m.content}
                </div>
                {/* Attachment display */}
                {m.attachment && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                    {m.attachment.type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.attachment.dataUrl}
                        alt={m.attachment.name}
                        className="h-16 w-16 rounded object-cover"
                      />
                    ) : (
                      <>
                        <FileText className="h-4 w-4 text-[#00d4ff]" />
                        <span className="max-w-[180px] truncate">{m.attachment.name}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#00d4ff]/20">
                <Loader2 className="h-4 w-4 animate-spin text-[#00d4ff]" />
              </div>
              <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                Réflexion en cours…
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="shrink-0 px-4 pb-2 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        </div>
      )}

      {/* Footer input */}
      <footer className="shrink-0 border-t border-white/10 bg-zinc-950 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">{InputBar}</div>
      </footer>
    </div>
  );
}
