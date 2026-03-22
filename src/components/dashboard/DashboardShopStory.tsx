'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookText,
  Copy,
  Check,
  Sparkles,
  Loader2,
  User,
  Image as ImageIcon,
  Upload,
  X,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSubscription } from '@/hooks/useSubscription';

const STORY_KEY = 'etsmart-shop-story';
const BIO_KEY = 'etsmart-shop-bio';
const CHARACTER_NAME_KEY = 'etsmart-shop-character-name';
const CHARACTER_ROLE_KEY = 'etsmart-shop-character-role';
const CHARACTER_SUMMARY_KEY = 'etsmart-shop-character-summary';
const CHARACTER_IMAGE_KEY = 'etsmart-shop-character-image';
const INPUT_SHOP_NAME_KEY = 'etsmart-shop-story-shop-name';
const INPUT_CITY_KEY = 'etsmart-shop-story-city';
const INPUT_COUNTRY_KEY = 'etsmart-shop-story-country';

const MAX_PRODUCT_IMAGES = 4;
const MAX_FILE_MB = 12;
const STORY_GENERATION_CREDITS = 1;

/** Placeholder « bientôt disponible » uniquement si `NEXT_PUBLIC_SHOP_STORY_MAINTENANCE=true` (opt-in). */
function useShopStoryMaintenance(): boolean {
  return useMemo(
    () => process.env.NEXT_PUBLIC_SHOP_STORY_MAINTENANCE === 'true',
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

interface GeneratedCharacter {
  name: string;
  role: string;
  personaSummary: string;
  biography: string;
  traits: string[];
  imageDataUrl?: string | null;
  imageUrl?: string | null;
}

export function DashboardShopStory() {
  const { refreshSubscription } = useSubscription();
  const [bannerDataUrl, setBannerDataUrl] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [shopNameInput, setShopNameInput] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [story, setStory] = useState('');
  const [bio, setBio] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [characterRole, setCharacterRole] = useState('');
  const [characterSummary, setCharacterSummary] = useState('');
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [traits, setTraits] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'story' | 'bio' | null>(null);

  const [dragBanner, setDragBanner] = useState(false);
  const [dragProducts, setDragProducts] = useState(false);
  const bannerDragRef = useRef(0);
  const productsDragRef = useRef(0);
  const shopStoryMaintenance = useShopStoryMaintenance();

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const productsInputRef = useRef<HTMLInputElement>(null);
  const productImagesRef = useRef<string[]>([]);
  productImagesRef.current = productImages;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setShopNameInput(localStorage.getItem(INPUT_SHOP_NAME_KEY) || '');
    setCity(localStorage.getItem(INPUT_CITY_KEY) || '');
    setCountry(localStorage.getItem(INPUT_COUNTRY_KEY) || '');
    setStory(localStorage.getItem(STORY_KEY) || '');
    setBio(localStorage.getItem(BIO_KEY) || '');
    setCharacterName(localStorage.getItem(CHARACTER_NAME_KEY) || '');
    setCharacterRole(localStorage.getItem(CHARACTER_ROLE_KEY) || '');
    setCharacterSummary(localStorage.getItem(CHARACTER_SUMMARY_KEY) || '');
    setCharacterImage(localStorage.getItem(CHARACTER_IMAGE_KEY) || '');
  }, []);

  const saveStory = (value: string) => {
    setStory(value);
    if (typeof window !== 'undefined') localStorage.setItem(STORY_KEY, value);
  };

  const saveBio = (value: string) => {
    setBio(value);
    if (typeof window !== 'undefined') localStorage.setItem(BIO_KEY, value);
  };

  const saveCharacterMeta = (name: string, role: string, summary: string, image: string | null) => {
    setCharacterName(name);
    setCharacterRole(role);
    setCharacterSummary(summary);
    setCharacterImage(image);
    if (typeof window === 'undefined') return;
    localStorage.setItem(CHARACTER_NAME_KEY, name);
    localStorage.setItem(CHARACTER_ROLE_KEY, role);
    localStorage.setItem(CHARACTER_SUMMARY_KEY, summary);
    if (image && !image.startsWith('data:')) {
      localStorage.setItem(CHARACTER_IMAGE_KEY, image);
    } else if (!image) {
      localStorage.setItem(CHARACTER_IMAGE_KEY, '');
    }
  };

  const validateImageFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) return 'Fichier image requis.';
    if (file.size > MAX_FILE_MB * 1024 * 1024) return `Image trop lourde (max ${MAX_FILE_MB} Mo).`;
    return null;
  };

  const handleBannerFile = async (file: File) => {
    const err = validateImageFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const url = await readFileAsDataUrl(file);
    setBannerDataUrl(url);
  };

  const handleProductFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    setError(null);
    const next = [...productImagesRef.current];
    for (const file of list) {
      if (next.length >= MAX_PRODUCT_IMAGES) break;
      const err = validateImageFile(file);
      if (err) {
        setError(err);
        continue;
      }
      next.push(await readFileAsDataUrl(file));
    }
    setProductImages(next);
  };

  const removeProductAt = (index: number) => {
    setProductImages((prev) => prev.filter((_, i) => i !== index));
  };

  const copyText = async (type: 'story' | 'bio', value: string) => {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopied(type);
    setTimeout(() => setCopied(null), 1500);
  };

  const onBannerDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    bannerDragRef.current += 1;
    setDragBanner(true);
  }, []);
  const onBannerDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    bannerDragRef.current -= 1;
    if (bannerDragRef.current <= 0) {
      bannerDragRef.current = 0;
      setDragBanner(false);
    }
  }, []);
  const onBannerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  const onBannerDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    bannerDragRef.current = 0;
    setDragBanner(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleBannerFile(f);
  }, []);

  const onProductsDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    productsDragRef.current += 1;
    setDragProducts(true);
  }, []);
  const onProductsDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    productsDragRef.current -= 1;
    if (productsDragRef.current <= 0) {
      productsDragRef.current = 0;
      setDragProducts(false);
    }
  }, []);
  const onProductsDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  const onProductsDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    productsDragRef.current = 0;
    setDragProducts(false);
    const files = e.dataTransfer.files;
    if (files?.length) void handleProductFiles(files);
  }, []);

  const clearGeneratedOutputs = () => {
    setError(null);
    setCopied(null);
    saveStory('');
    saveBio('');
    saveCharacterMeta('', '', '', null);
    setTraits([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORY_KEY);
      localStorage.removeItem(BIO_KEY);
      localStorage.removeItem(CHARACTER_NAME_KEY);
      localStorage.removeItem(CHARACTER_ROLE_KEY);
      localStorage.removeItem(CHARACTER_SUMMARY_KEY);
      localStorage.removeItem(CHARACTER_IMAGE_KEY);
    }
  };

  const handleGenerate = async () => {
    if (!bannerDataUrl) {
      setError('Ajoute une image de bannière boutique.');
      return;
    }
    if (productImages.length < 1) {
      setError('Ajoute au moins une image de produit.');
      return;
    }
    if (city.trim().length < 2 || country.trim().length < 2) {
      setError('Indique la ville et le pays (comme sur ta fiche Etsy).');
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setError('Connecte-toi pour générer l’histoire et la biographie.');
      return;
    }

    setLoading(true);
    setError(null);

    if (typeof window !== 'undefined') {
      localStorage.setItem(INPUT_SHOP_NAME_KEY, shopNameInput.trim());
      localStorage.setItem(INPUT_CITY_KEY, city.trim());
      localStorage.setItem(INPUT_COUNTRY_KEY, country.trim());
    }

    try {
      const res = await fetch('/api/shop-story/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bannerImage: bannerDataUrl,
          productImages,
          shopName: shopNameInput.trim() || undefined,
          city: city.trim(),
          country: country.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const msg =
          typeof json?.message === 'string' && json.message.trim()
            ? json.message.trim()
            : json?.error === 'QUOTA_EXCEEDED' || json?.error === 'SUBSCRIPTION_REQUIRED'
              ? 'Crédits insuffisants ou abonnement actif requis.'
              : json?.error === 'BILLING_FAILED'
                ? 'La génération a réussi mais le débit des crédits a échoué. Contacte le support.'
                : 'Impossible de générer histoire + biographie.';
        setError(msg);
        return;
      }

      const generatedStory = String(json?.result?.shopStory || '');
      const character = (json?.result?.character || {}) as GeneratedCharacter;
      saveStory(generatedStory);
      saveBio(String(character.biography || ''));
      saveCharacterMeta(
        String(character.name || 'Créateur Etsy'),
        String(character.role || 'Artisan / Créateur'),
        String(character.personaSummary || ''),
        character.imageDataUrl || character.imageUrl || null
      );
      setTraits(Array.isArray(character.traits) ? character.traits : []);
      void refreshSubscription(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('subscription-refresh'));
      }
    } catch {
      setError('Erreur réseau pendant la génération.');
    } finally {
      setLoading(false);
    }
  };

  if (shopStoryMaintenance) {
    return (
      <div className="p-4 md:p-8 bg-black min-h-screen">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]" />
            <div className="p-8 sm:p-10 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/20 border border-[#00d4ff]/20 mb-5">
                <BookText className="w-7 h-7 text-[#00d4ff]" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Histoire & Biographie</h1>
              <p className="text-white/70 text-base">Cet onglet sera bientôt disponible.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-black">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
            <BookText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Histoire de la boutique & Biographie</h1>
            <p className="text-white/60 text-sm">
              Bannière + photos produits + localisation → analyse visuelle, puis histoire, bio à la première personne et
              portrait cohérents.
            </p>
            <p className="mt-1 text-sm font-medium text-[#00d4ff]">
              {STORY_GENERATION_CREDITS} crédit par génération
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/75 text-sm mb-2">Nom de la boutique</label>
              <p className="text-white/40 text-xs mb-2">Si le nom est déjà lisible sur la bannière, tu peux laisser vide.</p>
              <input
                value={shopNameInput}
                onChange={(e) => setShopNameInput(e.target.value)}
                placeholder="Ex: Essenza Luce"
                className="w-full h-11 rounded-lg bg-black/40 border border-white/10 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/75 text-sm mb-2">Ville</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Paris"
                  className="w-full h-11 rounded-lg bg-black/40 border border-white/10 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/40"
                />
              </div>
              <div>
                <label className="block text-white/75 text-sm mb-2">Pays</label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Ex: France"
                  className="w-full h-11 rounded-lg bg-black/40 border border-white/10 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/40"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-white/75 text-sm mb-2">1) Bannière de la boutique</label>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleBannerFile(f);
                e.target.value = '';
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => bannerInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && bannerInputRef.current?.click()}
              onDragEnter={onBannerDragEnter}
              onDragLeave={onBannerDragLeave}
              onDragOver={onBannerDragOver}
              onDrop={onBannerDrop}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-4 min-h-[140px] flex flex-col items-center justify-center transition ${
                dragBanner ? 'border-[#00d4ff] bg-[#00d4ff]/10' : 'border-white/20 hover:border-[#00d4ff]/50'
              }`}
            >
              {bannerDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerDataUrl} alt="Bannière" className="max-h-36 w-full object-contain rounded-lg" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-white/40 mb-2" />
                  <p className="text-white/50 text-sm text-center">Glisse-dépose ou clique pour choisir la bannière</p>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-white/75 text-sm mb-2">
              2) Photos produits (1 à {MAX_PRODUCT_IMAGES})
            </label>
            <input
              ref={productsInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void handleProductFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => productsInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && productsInputRef.current?.click()}
              onDragEnter={onProductsDragEnter}
              onDragLeave={onProductsDragLeave}
              onDragOver={onProductsDragOver}
              onDrop={onProductsDrop}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-4 min-h-[100px] transition ${
                dragProducts ? 'border-[#00d4ff] bg-[#00d4ff]/10' : 'border-white/20 hover:border-[#00d4ff]/50'
              }`}
            >
              {productImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4">
                  <ImageIcon className="w-8 h-8 text-white/40 mb-2" />
                  <p className="text-white/50 text-sm text-center">Ajoute des captures de tes fiches produits</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {productImages.map((src, i) => (
                    <div key={`${i}-${src.slice(0, 32)}`} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/15 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProductAt(i);
                        }}
                        className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100"
                        aria-label="Retirer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {productImages.length < MAX_PRODUCT_IMAGES && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        productsInputRef.current?.click();
                      }}
                      className="w-20 h-20 rounded-lg border border-dashed border-white/25 text-white/40 text-xs flex items-center justify-center hover:border-[#00d4ff]/50"
                    >
                      +
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={loading}
              className="w-full sm:w-auto h-11 px-5 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading
                ? 'Génération…'
                : `Générer histoire + biographie + portrait (${STORY_GENERATION_CREDITS} crédit)`}
            </button>
            <button
              type="button"
              onClick={clearGeneratedOutputs}
              disabled={loading}
              className="w-full sm:w-auto h-11 px-5 rounded-lg border border-white/15 bg-white/5 text-white text-sm font-medium hover:bg-white/10 hover:border-[#00d4ff]/35 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4 text-[#00d4ff]" />
              Nouvelle histoire &amp; biographie
            </button>
          </div>
          {loading && (
            <p className="text-xs text-white/45 max-w-xl">
              Analyse des visuels + textes en un flux, puis portrait en parallèle — compte environ{' '}
              <span className="text-[#00d4ff]/90">30 à 90 s</span> selon la charge des serveurs IA.
            </p>
          )}
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 lg:col-span-1">
            <h2 className="text-white font-semibold mb-3 inline-flex items-center gap-2">
              <User className="w-4 h-4 text-[#00d4ff]" />
              Personnage
            </h2>
            <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40 h-48 flex items-center justify-center mb-3">
              {characterImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={characterImage} alt={characterName || 'Portrait personnage'} className="w-full h-full object-cover" />
              ) : (
                <p className="text-white/40 text-xs px-3 text-center">Le portrait généré apparaîtra ici.</p>
              )}
            </div>
            <p className="text-white font-semibold">{characterName || 'Nom du personnage'}</p>
            <p className="text-xs text-[#00d4ff] mt-0.5">{characterRole || 'Rôle'}</p>
            <p className="text-xs text-white/65 mt-2">{characterSummary || 'Le résumé du personnage apparaîtra ici.'}</p>
            {traits.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {traits.map((trait, idx) => (
                  <span key={`${trait}-${idx}`} className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] text-white/70">
                    {trait}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">Histoire de la boutique</h2>
              <button
                type="button"
                onClick={() => copyText('story', story)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-white/20 text-white/70 hover:text-white hover:bg-white/10"
              >
                {copied === 'story' ? <Check size={14} className="inline mr-1" /> : <Copy size={14} className="inline mr-1" />}
                {copied === 'story' ? 'Copié' : 'Copier'}
              </button>
            </div>
            <textarea
              value={story}
              onChange={(e) => saveStory(e.target.value)}
              placeholder="L’histoire générée s’affichera ici. Tu peux l’éditer avant de la coller sur Etsy."
              className="w-full h-72 rounded-lg bg-black/40 border border-white/10 p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/40"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">Biographie du personnage</h2>
              <button
                type="button"
                onClick={() => copyText('bio', bio)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-white/20 text-white/70 hover:text-white hover:bg-white/10"
              >
                {copied === 'bio' ? <Check size={14} className="inline mr-1" /> : <Copy size={14} className="inline mr-1" />}
                {copied === 'bio' ? 'Copié' : 'Copier'}
              </button>
            </div>
            <textarea
              value={bio}
              onChange={(e) => saveBio(e.target.value)}
              placeholder="Biographie à la première personne…"
              className="w-full h-72 rounded-lg bg-black/40 border border-white/10 p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/40"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
