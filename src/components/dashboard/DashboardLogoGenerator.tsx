"use client";

import { useRef, useState, useCallback, useEffect } from 'react';
import { Image as ImageIcon, Upload, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type DashboardLogoGeneratorProps = {
  embedded?: boolean;
  initialShopImageDataUrl?: string | null;
  initialProductImageDataUrl?: string | null;
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string) || '');
    r.onerror = () => reject(new Error('File read failed'));
    r.readAsDataURL(file);
  });

function formatLogoApiError(rawText: string, data: unknown): string {
  const t = (rawText || '').trim();
  const lower = t.toLowerCase();
  if (
    lower.includes('<html') ||
    lower.includes('inactivity timeout') ||
    lower.includes('504 gateway') ||
    lower.includes('gateway time-out')
  ) {
    return 'La génération a dépassé le délai du serveur. Réessaie dans un instant.';
  }
  if (data && typeof data === 'object' && data !== null) {
    const o = data as { message?: string; error?: string };
    if (o.message && typeof o.message === 'string') return o.message;
    if (o.error && typeof o.error === 'string') return o.error;
  }
  if (t.length > 0 && t.length < 400 && !t.startsWith('<')) return t.slice(0, 300);
  return 'Erreur lors de la génération du logo. Réessaie.';
}

export function DashboardLogoGenerator({
  embedded = false,
  initialShopImageDataUrl = null,
  initialProductImageDataUrl = null,
}: DashboardLogoGeneratorProps) {
  const [shopImageDataUrl, setShopImageDataUrl] = useState<string | null>(initialShopImageDataUrl);
  const [productImageDataUrl, setProductImageDataUrl] = useState<string | null>(initialProductImageDataUrl);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragShop, setDragShop] = useState(false);
  const [dragProduct, setDragProduct] = useState(false);
  const [shopName, setShopName] = useState('');
  const [withName, setWithName] = useState(false);

  const shopInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const shopDragRef = useRef(0);
  const productDragRef = useRef(0);

  const handlePick = async (file: File, type: 'shop' | 'product') => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 12 * 1024 * 1024) { setError('Image trop lourde (max 12 MB).'); return; }
    const url = await readFileAsDataUrl(file);
    if (type === 'shop') setShopImageDataUrl(url);
    else setProductImageDataUrl(url);
    setError(null);
  };

  useEffect(() => { if (initialShopImageDataUrl) setShopImageDataUrl(initialShopImageDataUrl); }, [initialShopImageDataUrl]);
  useEffect(() => { if (initialProductImageDataUrl) setProductImageDataUrl(initialProductImageDataUrl); }, [initialProductImageDataUrl]);

  const compositeNameOnCanvas = (imageDataUrl: string, name: string): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(imageDataUrl); return; }
      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 1024, 1024);
        const len = name.length;
        const fontSize = len <= 8 ? 72 : len <= 13 ? 58 : len <= 18 ? 46 : len <= 24 ? 38 : 30;
        const barH = Math.round(fontSize * 2.4);
        const grad = ctx.createLinearGradient(0, 1024 - barH, 0, 1024);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 1024 - barH, 1024, barH);
        ctx.font = `bold ${fontSize}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText(name, 513, 1024 - 18);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(name, 512, 1024 - 20);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imageDataUrl);
      img.src = imageDataUrl;
    });
  };

  const generateLogo = async () => {
    if (!shopImageDataUrl || !productImageDataUrl) {
      setError('Ajoute les 2 images : bannière + produit.');
      return;
    }
    if (withName && !shopName.trim()) {
      setError('Saisis le nom de la boutique pour l\'option "avec nom".');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setLogoUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Authentification requise');

      // Step 1 — Brief via Netlify (~6-8s, well under 26s)
      const briefRes = await fetch('/api/generate-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ shopImage: shopImageDataUrl, productImage: productImageDataUrl }),
      });
      let briefRaw = '';
      let briefData: unknown = null;
      try { briefRaw = await briefRes.text(); briefData = briefRaw ? JSON.parse(briefRaw) : null; } catch { briefData = null; }
      if (!briefRes.ok) throw new Error(formatLogoApiError(briefRaw, briefData));
      const brief = briefData as { imagePrompt?: string; bgR?: number; bgG?: number; bgB?: number } | null;
      if (!brief?.imagePrompt) throw new Error(formatLogoApiError(briefRaw, briefData));

      // Step 2 — Image via Supabase Edge Function (uses supabase client so token is always fresh)
      const { data: imgData, error: edgeError } = await supabase.functions.invoke('generate-logo-image', {
        body: { imagePrompt: brief.imagePrompt, bgR: brief.bgR, bgG: brief.bgG, bgB: brief.bgB },
      });
      if (edgeError) {
        let msg = edgeError.message || 'Erreur lors de la génération du logo. Réessaie.';
        try {
          const ctx = (edgeError as { context?: Response }).context;
          if (ctx) {
            const errBody = await ctx.json().catch(() => null) as { message?: string; error?: string } | null;
            if (errBody?.message) msg = errBody.message;
            else if (errBody?.error) msg = errBody.error;
          }
        } catch { /* use default msg */ }
        throw new Error(msg);
      }
      const ok = imgData as { imageDataUrl?: string } | null;
      if (!ok?.imageDataUrl) throw new Error('Pas d\'image générée. Réessaie.');

      // Step 3 — Composite shop name client-side via Canvas (instant, no server needed)
      let finalUrl = ok.imageDataUrl;
      if (withName && shopName.trim()) {
        finalUrl = await compositeNameOnCanvas(finalUrl, shopName.trim());
      }
      setLogoUrl(finalUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la génération du logo');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadLogo = () => {
    if (!logoUrl) return;
    const a = document.createElement('a');
    a.href = logoUrl;
    a.download = `logo-${shopName.trim().replace(/\s+/g, '-').toLowerCase() || 'boutique'}.png`;
    a.click();
  };

  const onShopDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); shopDragRef.current += 1; setDragShop(true); }, []);
  const onShopDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); shopDragRef.current -= 1; if (shopDragRef.current <= 0) { shopDragRef.current = 0; setDragShop(false); } }, []);
  const onShopDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }, []);
  const onShopDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); shopDragRef.current = 0; setDragShop(false); const file = e.dataTransfer.files?.[0]; if (file) handlePick(file, 'shop'); }, []);

  const onProductDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); productDragRef.current += 1; setDragProduct(true); }, []);
  const onProductDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); productDragRef.current -= 1; if (productDragRef.current <= 0) { productDragRef.current = 0; setDragProduct(false); } }, []);
  const onProductDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }, []);
  const onProductDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); productDragRef.current = 0; setDragProduct(false); const file = e.dataTransfer.files?.[0]; if (file) handlePick(file, 'product'); }, []);

  return (
    <div className={embedded ? 'bg-transparent px-0' : 'min-h-screen bg-black p-4 sm:p-6 md:p-8'}>
      <div className={embedded ? '' : 'max-w-6xl mx-auto'}>
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Création de logo</h1>
            <p className="text-white/60 text-sm mt-1">
              Logo emblème artisan généré à partir de ta bannière et tes produits.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column — inputs */}
          <div className="space-y-5">
            {/* Shop banner */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-sm font-semibold text-white mb-3">1) Bannière de la boutique</p>
              <div
                onClick={() => shopInputRef.current?.click()}
                onDragEnter={onShopDragEnter} onDragLeave={onShopDragLeave} onDragOver={onShopDragOver} onDrop={onShopDrop}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-4 transition ${dragShop ? 'border-[#00d4ff] bg-[#00d4ff]/10' : 'border-white/20 hover:border-[#00d4ff]/50'}`}
              >
                <input ref={shopInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePick(e.target.files[0], 'shop')} />
                {shopImageDataUrl ? (
                  <img src={shopImageDataUrl} alt="Bannière" className="w-full h-44 object-cover rounded-lg" />
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center text-white/50">
                    <Upload className="w-6 h-6 mb-2" />
                    <p className="text-sm">Clique ou glisse la bannière</p>
                  </div>
                )}
              </div>
            </div>

            {/* Product image */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-sm font-semibold text-white mb-3">2) Photo d&apos;un produit</p>
              <div
                onClick={() => productInputRef.current?.click()}
                onDragEnter={onProductDragEnter} onDragLeave={onProductDragLeave} onDragOver={onProductDragOver} onDrop={onProductDrop}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-4 transition ${dragProduct ? 'border-[#00d4ff] bg-[#00d4ff]/10' : 'border-white/20 hover:border-[#00d4ff]/50'}`}
              >
                <input ref={productInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePick(e.target.files[0], 'product')} />
                {productImageDataUrl ? (
                  <img src={productImageDataUrl} alt="Produit" className="w-full h-44 object-cover rounded-lg" />
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center text-white/50">
                    <Upload className="w-6 h-6 mb-2" />
                    <p className="text-sm">Clique ou glisse un produit</p>
                  </div>
                )}
              </div>
            </div>

            {/* With/without name toggle */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              <p className="text-sm font-semibold text-white">3) Nom de la boutique sur le logo</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setWithName(false)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${!withName ? 'bg-[#00d4ff]/20 border-[#00d4ff] text-[#00d4ff]' : 'border-white/15 text-white/60 hover:border-white/30'}`}
                >
                  Sans nom
                </button>
                <button
                  type="button"
                  onClick={() => setWithName(true)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${withName ? 'bg-[#00d4ff]/20 border-[#00d4ff] text-[#00d4ff]' : 'border-white/15 text-white/60 hover:border-white/30'}`}
                >
                  Avec nom
                </button>
              </div>
              {withName && (
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Nom de ta boutique"
                  maxLength={40}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00d4ff]/50"
                />
              )}
            </div>

            {/* Generate button */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={generateLogo}
                disabled={isGenerating || !shopImageDataUrl || !productImageDataUrl}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Génération…
                  </span>
                ) : (
                  'Générer le logo (1 crédit)'
                )}
              </button>
              {logoUrl && (
                <button
                  onClick={downloadLogo}
                  className="px-6 py-3 rounded-xl border border-white/20 text-white hover:bg-white/10 inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </button>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* Right column — preview */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <p className="text-sm font-semibold text-white mb-3">Aperçu du logo</p>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 min-h-[380px] flex items-center justify-center">
              {logoUrl ? (
                <div className="w-full flex items-center justify-center">
                  <div className="w-80 max-w-full aspect-square rounded-xl overflow-hidden shadow-2xl">
                    <img src={logoUrl} alt="Logo généré" className="w-full h-full object-contain" />
                  </div>
                </div>
              ) : (
                <div className="text-center text-white/40 text-sm">
                  {isGenerating ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#00d4ff]" /> Génération en cours…
                    </span>
                  ) : (
                    'Ton logo apparaîtra ici.'
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
