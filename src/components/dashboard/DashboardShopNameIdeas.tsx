'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Loader2, Sparkles, Store, Upload, Lightbulb, Languages } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSubscription } from '@/hooks/useSubscription';
import { SHOP_NAME_LANGUAGES, type ShopNameLanguageCode } from '@/lib/shop-name-languages';

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(new Error('Lecture fichier impossible.'));
    reader.readAsDataURL(file);
  });

export type ShopNameProposal = {
  shopName: string;
  slogan: string;
  angle: string;
};

export function DashboardShopNameIdeas() {
  const { refreshSubscription } = useSubscription();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadDragRef = useRef(0);
  const [shopLanguage, setShopLanguage] = useState<ShopNameLanguageCode>('fr');
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ShopNameProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [dragUpload, setDragUpload] = useState(false);

  const handlePickImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Choisis une image (JPG, PNG, WebP…).');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Image trop lourde (max 12 Mo).');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setProductPreview(dataUrl);
    setError(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      uploadDragRef.current = 0;
      setDragUpload(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void handlePickImage(f);
    },
    [handlePickImage]
  );

  const generate = async () => {
    if (!productPreview) {
      setError('Ajoute une photo de ton produit (obligatoire).');
      return;
    }
    setError(null);
    setLoading(true);
    setProposals([]);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Connecte-toi pour continuer.');

      const res = await fetch('/api/generate-shop-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productImage: productPreview,
          shopLanguage,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || json?.error || 'Génération impossible.');
      }
      setProposals(Array.isArray(json.proposals) ? json.proposals : []);
      void refreshSubscription(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('subscription-refresh'));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setLoading(false);
    }
  };

  const copyLine = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Copie impossible dans le presse-papiers.');
    }
  };

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7]">
              <Lightbulb className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Nom de boutique & slogans</h1>
              <p className="mt-1 text-sm text-white/70">
                Une photo suffit : la niche est déduite de l’image. Choisis la <strong className="text-white/90">langue de ta boutique</strong>.
                Tu reçois <strong className="text-white/90">5 options</strong> : nom court (1–3 mots fusionnés sans espace, type CamelCase),
                slogan ≤ 8 mots, ton Etsy premium.
              </p>
              <p className="mt-1 text-sm font-medium text-[#00d4ff]">0,5 crédit par génération</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
          >
            <p className="mb-2 text-sm font-semibold text-white">1. Photo produit (obligatoire)</p>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                uploadDragRef.current += 1;
                setDragUpload(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                uploadDragRef.current -= 1;
                if (uploadDragRef.current <= 0) {
                  uploadDragRef.current = 0;
                  setDragUpload(false);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={onDrop}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-4 transition ${
                dragUpload ? 'border-[#00d4ff] bg-[#00d4ff]/10' : 'border-white/20 hover:border-[#00d4ff]/50'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePickImage(f);
                }}
              />
              {productPreview ? (
                <img src={productPreview} alt="Aperçu produit" className="h-44 w-full rounded-lg object-contain bg-black/40" />
              ) : (
                <div className="flex h-44 flex-col items-center justify-center px-2 text-center text-white/55">
                  <Upload className="mb-2 h-7 w-7" />
                  <p className="text-sm font-medium">Glisse-dépose ou clique pour ajouter une photo</p>
                  <p className="mt-1 text-xs text-white/40">JPG, PNG, WebP — max 12 Mo</p>
                </div>
              )}
            </div>

            {productPreview && (
              <button
                type="button"
                onClick={() => setProductPreview(null)}
                className="mt-2 text-sm text-white/50 underline hover:text-white"
              >
                Changer l’image
              </button>
            )}

            <div className="mt-6">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Languages className="h-4 w-4 text-[#00d4ff]" />
                2. Langue de la boutique (Etsy)
              </label>
              <p className="mb-3 text-xs text-white/50">
                Tout sera généré dans cette langue : noms, slogans et angle de positionnement.
              </p>
              <select
                value={shopLanguage}
                onChange={(e) => setShopLanguage(e.target.value as ShopNameLanguageCode)}
                className="h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/40"
              >
                {SHOP_NAME_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-zinc-900">
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={generate}
                disabled={loading || !productPreview}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] px-5 py-2.5 font-semibold text-black disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? 'Génération…' : 'Générer noms & slogans'}
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              <Store className="h-4 w-4 text-[#00d4ff]" />
              <p className="text-sm font-semibold text-white">Propositions (langue boutique)</p>
            </div>

            {proposals.length === 0 && !loading && (
              <p className="py-12 text-center text-sm text-white/45">
                Les idées apparaîtront ici après génération, dans la langue choisie.
              </p>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-white/60">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Analyse de la photo et création des variantes…</span>
              </div>
            )}

            <ul className="space-y-3">
              {proposals.map((p, i) => {
                const id = `p-${i}`;
                return (
                  <li
                    key={id}
                    className="rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-[#00d4ff]/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold text-white">{p.shopName}</p>
                        <p className="mt-1 text-sm text-[#00d4ff]/90">{p.slogan}</p>
                        {p.angle ? <p className="mt-2 text-xs text-white/45">{p.angle}</p> : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          title="Copier le nom"
                          onClick={() => void copyLine(`${id}-n`, p.shopName)}
                          className="rounded-lg border border-white/15 p-2 text-white/70 hover:bg-white/10 hover:text-white"
                        >
                          {copied === `${id}-n` ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Copier le slogan"
                          onClick={() => void copyLine(`${id}-s`, p.slogan)}
                          className="rounded-lg border border-white/15 p-2 text-white/70 hover:bg-white/10 hover:text-white"
                        >
                          {copied === `${id}-s` ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyLine(`${id}-b`, `${p.shopName}\n${p.slogan}`)}
                      className="mt-3 text-xs font-medium text-[#00d4ff] hover:underline"
                    >
                      Copier nom + slogan
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
