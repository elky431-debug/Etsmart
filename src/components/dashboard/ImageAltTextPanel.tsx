'use client';

import { useState, useCallback } from 'react';
import { Loader2, Copy, Check, Type } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSubscription } from '@/hooks/useSubscription';

const ALT_CREDITS_LABEL = '0,2';

/** blob: et chemins same-origin uniquement — les URLs https externes passent par le serveur (imageUrl). */
async function blobOrSameOriginToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:image/')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Lecture image impossible.'));
      reader.readAsDataURL(blob);
    });
  } catch {
    throw new Error('Impossible de lire cette image localement.');
  }
}

type ImageAltTextPanelProps = {
  imageUrl: string;
};

export function ImageAltTextPanel({ imageUrl }: ImageAltTextPanelProps) {
  const { refreshSubscription } = useSubscription();
  const [altText, setAltText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setError(null);
    setLoading(true);
    setAltText(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Connexion requise');

      const trimmed = imageUrl.trim();
      const isHttp = /^https?:\/\//i.test(trimmed);
      const isData = trimmed.startsWith('data:image/');

      const payload: { image?: string; imageUrl?: string } = {};
      if (isHttp) {
        payload.imageUrl = trimmed;
      } else if (isData) {
        payload.image = trimmed;
      } else {
        payload.image = await blobOrSameOriginToDataUrl(trimmed);
      }

      let res: Response;
      try {
        res = await fetch('/api/generate-alt-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (netErr) {
        const isNetwork =
          netErr instanceof TypeError &&
          (String(netErr.message).includes('fetch') || String(netErr.message).includes('Failed to fetch'));
        throw new Error(
          isNetwork
            ? 'Connexion au serveur impossible (Failed to fetch). Vérifie que `npm run dev` tourne sur ce port, puis réessaie. Si ça persiste, redémarre le serveur.'
            : netErr instanceof Error
              ? netErr.message
              : 'Erreur réseau'
        );
      }

      let data: { altTexts?: string[]; message?: string; error?: string; detail?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(
          data.message ||
            data.error ||
            (typeof data.detail === 'string' ? data.detail : '') ||
            `Erreur serveur (${res.status})`
        );
      }

      const list = Array.isArray(data.altTexts) ? data.altTexts : [];
      const first = list[0]?.trim();
      if (!first) throw new Error('Aucun alt text reçu.');
      setAltText(first);
      await refreshSubscription(true);
    } catch (e: unknown) {
      setAltText(null);
      setError(e instanceof Error ? e.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  }, [imageUrl, refreshSubscription]);

  const copyAlt = async () => {
    if (!altText) return;
    try {
      await navigator.clipboard.writeText(altText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copie impossible (permissions navigateur).');
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || !imageUrl}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#00d4ff]/40 bg-[#00d4ff]/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#00d4ff]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Type className="h-3.5 w-3.5 text-[#00d4ff]" />
          )}
          Alt text SEO (EN)
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
            {ALT_CREDITS_LABEL} cr.
          </span>
        </button>
      </div>
      <p className="text-[10px] leading-snug text-white/45">
        Un clic génère <strong className="text-white/60">un seul</strong> alt text en anglais (Etsy / Google Images).
      </p>
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
      {altText && (
        <div className="flex items-start gap-2 rounded-md bg-white/5 px-2 py-2">
          <p className="min-w-0 flex-1 break-words text-left text-[11px] leading-snug text-white/90">{altText}</p>
          <button
            type="button"
            onClick={() => void copyAlt()}
            className="shrink-0 rounded p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            title="Copier"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
