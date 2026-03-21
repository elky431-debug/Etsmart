"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Image as ImageIcon, Upload, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type DashboardLogoGeneratorProps = {
  embedded?: boolean;
  initialShopImageDataUrl?: string | null;
  initialProductImageDataUrl?: string | null;
};

/** Maintenance : `true` par défaut (localhost + prod). Réactiver l’outil : `NEXT_PUBLIC_LOGO_MAINTENANCE=false` sur Netlify + rebuild. */
function useLogoTabMaintenance(): boolean {
  return useMemo(
    () => process.env.NEXT_PUBLIC_LOGO_MAINTENANCE !== 'false',
    []
  );
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string) || '');
    r.onerror = () => reject(new Error('File read failed'));
    r.readAsDataURL(file);
  });

/** Réponse proxy HTML (timeout) au lieu de JSON — évite d’afficher du HTML brut. */
function formatLogoApiError(rawText: string, data: unknown): string {
  const t = (rawText || '').trim();
  const lower = t.toLowerCase();
  if (
    lower.includes('<html') ||
    lower.includes('inactivity timeout') ||
    lower.includes('<title>') ||
    lower.includes('504 gateway') ||
    lower.includes('gateway time-out')
  ) {
    return 'La génération a dépassé le délai du serveur (timeout). Réessaie dans un instant. Si ça se répète : utilise des images un peu plus légères, ou vérifie que ton déploiement autorise des fonctions longues (ex. Vercel Pro, 300 s).';
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
  const logoMaintenance = useLogoTabMaintenance();

  const shopInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const shopDragRef = useRef(0);
  const productDragRef = useRef(0);

  const handlePick = async (file: File, type: 'shop' | 'product') => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 12 * 1024 * 1024) {
      setError('Image trop lourde (max 12MB).');
      return;
    }
    const url = await readFileAsDataUrl(file);
    if (type === 'shop') {
      setShopImageDataUrl(url);
    } else {
      setProductImageDataUrl(url);
    }
    setError(null);
  };

  useEffect(() => {
    if (initialShopImageDataUrl) setShopImageDataUrl(initialShopImageDataUrl);
  }, [initialShopImageDataUrl]);

  useEffect(() => {
    if (initialProductImageDataUrl) setProductImageDataUrl(initialProductImageDataUrl);
  }, [initialProductImageDataUrl]);

  const generateLogo = async () => {
    if (!shopImageDataUrl || !productImageDataUrl) {
      setError('Ajoute les 2 images : boutique + produit.');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setLogoUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Authentification requise');

      const res = await fetch('/api/generate-logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          shopImage: shopImageDataUrl,
          productImage: productImageDataUrl,
        }),
      });
      let data: unknown = null;
      let rawText = '';
      try {
        rawText = await res.text();
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }
      if (!res.ok) {
        throw new Error(formatLogoApiError(rawText, data));
      }
      const ok = data as { imageDataUrl?: string } | null;
      if (!ok?.imageDataUrl) throw new Error(formatLogoApiError(rawText, data));
      setLogoUrl(ok.imageDataUrl);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors de la generation du logo';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadLogo = () => {
    if (!logoUrl) return;
    const a = document.createElement('a');
    a.href = logoUrl;
    a.download = 'etsmart-logo-square.png';
    a.click();
  };

  const onShopDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    shopDragRef.current += 1;
    setDragShop(true);
  }, []);
  const onShopDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    shopDragRef.current -= 1;
    if (shopDragRef.current <= 0) {
      shopDragRef.current = 0;
      setDragShop(false);
    }
  }, []);
  const onShopDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  const onShopDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    shopDragRef.current = 0;
    setDragShop(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePick(file, 'shop');
  }, []);

  const onProductDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    productDragRef.current += 1;
    setDragProduct(true);
  }, []);
  const onProductDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    productDragRef.current -= 1;
    if (productDragRef.current <= 0) {
      productDragRef.current = 0;
      setDragProduct(false);
    }
  }, []);
  const onProductDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  const onProductDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    productDragRef.current = 0;
    setDragProduct(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePick(file, 'product');
  }, []);

  if (logoMaintenance) {
    return (
      <div className={embedded ? 'bg-transparent px-0' : 'min-h-screen bg-black p-4 sm:p-6 md:p-8'}>
        <div className={embedded ? '' : 'max-w-3xl mx-auto'}>
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]" />
            <div className="p-8 sm:p-10 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/20 border border-[#00d4ff]/20 mb-5">
                <ImageIcon className="w-7 h-7 text-[#00d4ff]" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Création de logo</h1>
              <p className="text-white/70 text-base">
                Cet onglet sera bientôt disponible.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? 'bg-transparent px-0' : 'min-h-screen bg-black p-4 sm:p-6 md:p-8'}>
      <div className={embedded ? '' : 'max-w-6xl mx-auto'}>
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Creation de logo</h1>
            <p className="text-white/70 text-sm mt-1">
              Bannière + produit → emblème <strong className="text-white/90">illustration d’artisan / fantasy</strong> (pas une icône d’app générique), médaillon riche, sans texte, ton DA repris sur tes visuels.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Colonne gauche : inputs */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-sm font-semibold text-white mb-3">1) Image de la boutique (banniere)</p>
              <div
                onClick={() => shopInputRef.current?.click()}
                onDragEnter={onShopDragEnter}
                onDragLeave={onShopDragLeave}
                onDragOver={onShopDragOver}
                onDrop={onShopDrop}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-4 transition ${dragShop ? 'border-[#00d4ff] bg-[#00d4ff]/10' : 'border-white/20 hover:border-[#00d4ff]/50'}`}
              >
                <input
                  ref={shopInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handlePick(e.target.files[0], 'shop')}
                />
                {shopImageDataUrl ? (
                  <img src={shopImageDataUrl} alt="Shop" className="w-full h-44 object-cover rounded-lg" />
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center text-white/60">
                    <Upload className="w-6 h-6 mb-2" />
                    <p className="text-sm">Clique pour ajouter la banniere</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-sm font-semibold text-white mb-3">2) Image du produit de la boutique</p>
              <div
                onClick={() => productInputRef.current?.click()}
                onDragEnter={onProductDragEnter}
                onDragLeave={onProductDragLeave}
                onDragOver={onProductDragOver}
                onDrop={onProductDrop}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-4 transition ${dragProduct ? 'border-[#00d4ff] bg-[#00d4ff]/10' : 'border-white/20 hover:border-[#00d4ff]/50'}`}
              >
                <input
                  ref={productInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handlePick(e.target.files[0], 'product')}
                />
                {productImageDataUrl ? (
                  <img src={productImageDataUrl} alt="Product" className="w-full h-44 object-cover rounded-lg" />
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center text-white/60">
                    <Upload className="w-6 h-6 mb-2" />
                    <p className="text-sm">Clique pour ajouter un produit</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={generateLogo}
                disabled={isGenerating || !shopImageDataUrl || !productImageDataUrl}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Generation...
                  </span>
                ) : (
                  'Generer le logo'
                )}
              </button>
              {logoUrl && (
                <button
                  onClick={downloadLogo}
                  className="px-6 py-3 rounded-xl border border-white/20 text-white hover:bg-white/10 inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Telecharger
                </button>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* Colonne droite : preview */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <p className="text-sm font-semibold text-white mb-3">Aperçu du logo</p>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 min-h-[360px] flex items-center justify-center">
              {logoUrl ? (
                <div className="w-full flex items-center justify-center">
                  <div className="w-80 max-w-full aspect-square rounded-xl bg-white p-4">
                    <img src={logoUrl} alt="Generated logo" className="w-full h-full object-contain" />
                  </div>
                </div>
              ) : (
                <div className="text-center text-white/50 text-sm">
                  {isGenerating ? 'Génération en cours…' : 'Ton logo apparaîtra ici.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

