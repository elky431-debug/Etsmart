'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Image as ImageIcon, Loader2, Sparkles, Store, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

export function DashboardBanner() {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadDragRef = useRef(0);
  const [shopName, setShopName] = useState('');
  const [model, setModel] = useState<'auto' | 'pro' | 'flash'>('pro');
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragUpload, setDragUpload] = useState(false);

  const handlePickImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Merci de choisir un fichier image valide.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Image trop lourde (max 12 Mo).');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setProductImage(file);
    setProductPreview(dataUrl);
    setError(null);
  }, []);

  const onUploadDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    uploadDragRef.current += 1;
    setDragUpload(true);
  }, []);
  const onUploadDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    uploadDragRef.current -= 1;
    if (uploadDragRef.current <= 0) {
      uploadDragRef.current = 0;
      setDragUpload(false);
    }
  }, []);
  const onUploadDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  const onUploadDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      uploadDragRef.current = 0;
      setDragUpload(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void handlePickImage(f);
    },
    [handlePickImage]
  );

  const handleGenerate = async () => {
    if (!productImage) {
      setError('Ajoute une image produit (fichier ou glisser-déposer).');
      return;
    }
    setError(null);
    setBannerUrl(null);
    setIsGenerating(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Authentication required.');

      const imageData = await readFileAsDataUrl(productImage);
      const response = await fetch('/api/generate-banner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shopName: shopName.trim() || undefined,
          modelPreference: model,
          productImage: imageData,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success || !json?.bannerDataUrl) {
        throw new Error(json?.message || json?.error || 'Banner generation failed.');
      }
      setBannerUrl(String(json.bannerDataUrl));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unexpected error.';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadBanner = () => {
    if (!bannerUrl) return;
    const link = document.createElement('a');
    link.href = bannerUrl;
    link.download = 'etsmart-banner-1200x300.png';
    link.click();
  };

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Generate a banner</h1>
              <p className="text-white/70 text-sm mt-1">
                Image produit obligatoire (clic ou glisser-déposer), puis génération d’une bannière 1200×300.
              </p>
              <p className="text-[#00d4ff] text-sm mt-1 font-medium">
                2 crédits par génération
              </p>
            </div>
          </div>
        </motion.div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
          >
            <label className="block text-white/75 text-sm mb-2">Shop name</label>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Example: LampStoreUSA"
              className="w-full h-11 rounded-lg bg-black/40 border border-white/10 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/40 mb-4"
            />

            <label className="block text-white/75 text-sm mb-2">Modèle Gemini</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {([
                { id: 'pro', label: 'Pro' },
                { id: 'flash', label: 'Flash' },
                { id: 'auto', label: 'Auto' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`h-10 rounded-lg border text-sm transition ${
                    model === m.id
                      ? 'border-[#00d4ff]/60 bg-[#00d4ff]/15 text-[#9befff]'
                      : 'border-white/15 bg-black/30 text-white/70 hover:border-white/30'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <p className="text-white/60 text-xs mb-2">Image produit (obligatoire)</p>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              onDragEnter={onUploadDragEnter}
              onDragLeave={onUploadDragLeave}
              onDragOver={onUploadDragOver}
              onDrop={onUploadDrop}
              className={`rounded-xl border-2 border-dashed p-4 cursor-pointer transition ${
                dragUpload ? 'border-[#00d4ff] bg-[#00d4ff]/10' : 'border-white/20 hover:border-[#00d4ff]/50'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePickImage(file);
                }}
              />
              {productPreview ? (
                <img src={productPreview} alt="Product preview" className="w-full h-40 object-cover rounded-lg" />
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-white/55 px-2 text-center">
                  <Upload className="w-6 h-6 mb-2" />
                  <p className="text-sm">Glisse-dépose une image ici ou clique pour choisir</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black font-semibold disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? 'Generating...' : 'Generate 1200x300 banner'}
              </button>
              <span className="text-white/60 text-sm">(2 crédits)</span>
              {bannerUrl && (
                <button
                  onClick={downloadBanner}
                  className="px-5 py-2.5 rounded-xl border border-white/20 text-white hover:bg-white/10 inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              )}
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
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-4 h-4 text-[#00d4ff]" />
              <p className="text-sm font-semibold text-white">Banner preview (1200x300)</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 min-h-[250px] flex items-center justify-center">
              {bannerUrl ? (
                <img src={bannerUrl} alt="Generated banner" className="w-full h-auto rounded-lg object-cover" />
              ) : (
                <div className="text-center text-white/50">
                  {isGenerating ? (
                    <p className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating your banner...
                    </p>
                  ) : (
                    <p>Your generated banner will appear here.</p>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-white/45 mt-3">
              The exported banner is always generated and resized to exactly 1200x300.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

