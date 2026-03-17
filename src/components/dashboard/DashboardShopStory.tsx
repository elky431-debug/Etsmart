'use client';

import { useEffect, useState } from 'react';
import { BookText, Copy, Check, Sparkles, Loader2, Link as LinkIcon, User } from 'lucide-react';

const STORY_KEY = 'etsmart-shop-story';
const BIO_KEY = 'etsmart-shop-bio';
const CHARACTER_NAME_KEY = 'etsmart-shop-character-name';
const CHARACTER_ROLE_KEY = 'etsmart-shop-character-role';
const CHARACTER_SUMMARY_KEY = 'etsmart-shop-character-summary';
const CHARACTER_IMAGE_KEY = 'etsmart-shop-character-image';
const INPUT_URL_KEY = 'etsmart-shop-story-input-url';

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
  const [inputUrl, setInputUrl] = useState('');
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setInputUrl(localStorage.getItem(INPUT_URL_KEY) || '');
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
    // Avoid blowing localStorage quota with large base64 images
    if (image && !image.startsWith('data:')) {
      localStorage.setItem(CHARACTER_IMAGE_KEY, image);
    } else if (!image) {
      localStorage.setItem(CHARACTER_IMAGE_KEY, '');
    }
  };

  const copyText = async (type: 'story' | 'bio', value: string) => {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopied(type);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleGenerate = async () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      setError('Ajoute un lien Etsy (produit ou boutique).');
      return;
    }
    setLoading(true);
    setError(null);
    if (typeof window !== 'undefined') localStorage.setItem(INPUT_URL_KEY, trimmed);

    try {
      const res = await fetch('/api/shop-story/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setError(json?.message || json?.error || 'Impossible de générer histoire + biographie.');
        return;
      }

      const generatedStory = String(json?.result?.shopStory || '');
      const character = (json?.result?.character || {}) as GeneratedCharacter;
      saveStory(generatedStory);
      saveBio(String(character.biography || ''));
      saveCharacterMeta(
        String(character.name || 'Createur Etsy'),
        String(character.role || 'Artisan/Creatif'),
        String(character.personaSummary || ''),
        character.imageDataUrl || character.imageUrl || null
      );
      setTraits(Array.isArray(character.traits) ? character.traits : []);
    } catch {
      setError('Erreur réseau pendant la génération.');
    } finally {
      setLoading(false);
    }
  };

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
              Colle un lien Etsy: on génère une histoire crédible + un personnage cohérent avec ta niche.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
          <label className="block text-white/75 text-sm mb-2">Lien Etsy (produit ou boutique)</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <LinkIcon className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://www.etsy.com/listing/... ou https://www.etsy.com/shop/..."
                className="w-full h-11 rounded-lg bg-black/40 border border-white/10 pl-9 pr-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/40"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="h-11 px-4 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Generation...' : 'Generer histoire + biographie'}
            </button>
          </div>
          {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
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
                <p className="text-white/40 text-xs px-3 text-center">Aucune image Pinterest recuperée.</p>
              )}
            </div>
            <p className="text-white font-semibold">{characterName || 'Nom du personnage'}</p>
            <p className="text-xs text-[#00d4ff] mt-0.5">{characterRole || 'Role'}</p>
            <p className="text-xs text-white/65 mt-2">{characterSummary || 'Le resume du personnage apparaitra ici.'}</p>
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
              placeholder="Ex: Nous avons créé cette boutique pour proposer des pièces uniques inspirées de..."
              className="w-full h-72 rounded-lg bg-black/40 border border-white/10 p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/40"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">Biographie du personnage</h2>
              <button
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
              placeholder="Ex: Je suis createur de miniatures fantasy et je lance cette boutique pour..."
              className="w-full h-72 rounded-lg bg-black/40 border border-white/10 p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/40"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
