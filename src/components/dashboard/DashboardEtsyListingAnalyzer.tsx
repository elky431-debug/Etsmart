'use client';

import { FormEvent, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type ApiResponse = {
  success?: boolean;
  error?: string;
  target?: string;
  count?: number;
  mapped?: {
    title?: string | null;
    description?: string | null;
    price?: number;
    images?: string[];
    tags?: string[];
  } | null;
  firstItem?: Record<string, unknown>;
};

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function pickString(rec: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function pickNumber(rec: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const n = Number.parseFloat(value.replace(/[^0-9.,-]/g, '').replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickStringArray(rec: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = rec[key];
    if (Array.isArray(value)) {
      const out = value.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim());
      if (out.length > 0) return out;
    }
  }
  return [];
}

function displayUrl(raw: string, max = 54): string {
  if (!raw) return '—';
  try {
    const u = new URL(raw);
    const compact = `${u.hostname}${u.pathname}`;
    if (compact.length <= max) return compact;
    return `${compact.slice(0, max - 1)}…`;
  } catch {
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max - 1)}…`;
  }
}

function extractVariationLabels(rec: Record<string, unknown>): string[] {
  const variations = rec.variations;
  if (!Array.isArray(variations)) return [];
  const labels: string[] = [];
  for (const v of variations) {
    const item = toRecord(v);
    const label = pickString(item, ['label', 'name', 'type']);
    const values = Array.isArray(item.values)
      ? item.values.filter((x) => typeof x === 'string').slice(0, 3).join(', ')
      : '';
    if (label && values) labels.push(`${label}: ${values}`);
    else if (label) labels.push(label);
  }
  return labels.slice(0, 8);
}

type ScoreBlock = {
  score: number;
  feedback: string[];
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreTitle(title: string): ScoreBlock {
  const t = title.trim();
  if (!t) return { score: 0, feedback: ['Aucun titre detecte.'] };
  const words = t.split(/\s+/).filter(Boolean);
  const uniq = new Set(words.map((w) => w.toLowerCase())).size;
  const len = t.length;
  let score = 60;
  if (len >= 70 && len <= 140) score += 20;
  else if (len >= 40) score += 10;
  if (words.length >= 6) score += 10;
  if (uniq >= Math.max(3, Math.floor(words.length * 0.65))) score += 10;
  const feedback: string[] = [];
  feedback.push(`Longueur: ${len}/140 caracteres (zone ideale Etsy: 70-140).`);
  feedback.push(`${words.length} mots detectes dont ${uniq} uniques.`);
  feedback.push('Un titre performant combine intention de recherche + caracteristique produit + style.');
  if (len < 40) feedback.push('Titre trop court: ajoute la categorie, le style et l’usage.');
  if (len > 140) feedback.push('Titre trop long pour Etsy: simplifie sous 140 caracteres.');
  return { score: clampScore(score), feedback };
}

function scoreTags(tags: string[]): ScoreBlock {
  if (!tags || tags.length === 0) {
    return {
      score: 90,
      feedback: [
        'Tags non fournis par l actor.',
        'Score par defaut applique (90/100) pour ne pas bloquer le workflow.',
        'Conseil: garder 11-13 tags differents, axes intention + materiau + style + occasion.',
      ],
    };
  }
  const unique = new Set(tags.map((t) => t.toLowerCase())).size;
  const score = 70 + Math.min(30, unique * 2);
  return {
    score: clampScore(score),
    feedback: [
      `${tags.length} tags detectes (${unique} uniques).`,
      'Vise des tags non dupliques et complementaires (pas les memes mots dans un ordre different).',
    ],
  };
}

function scoreImages(imageCount: number): ScoreBlock {
  let score = 0;
  if (imageCount >= 10) score = 100;
  else if (imageCount >= 8) score = 90;
  else if (imageCount >= 6) score = 75;
  else if (imageCount >= 4) score = 60;
  else if (imageCount >= 2) score = 45;
  else if (imageCount === 1) score = 30;
  return {
    score: clampScore(score),
    feedback: [
      `${imageCount} image(s) detectee(s). Etsy performe mieux avec 8-10 visuels.`,
      'Ajoute au moins: hero shot, contexte d’usage, close-up matiere, dimensions, variantes.',
    ],
  };
}

function scoreDescription(desc: string): ScoreBlock {
  const len = desc.trim().length;
  let score = 0;
  if (len >= 450) score = 100;
  else if (len >= 250) score = 85;
  else if (len >= 120) score = 70;
  else if (len >= 40) score = 50;
  else if (len > 0) score = 25;
  const feedback = [
    len > 0 ? `Description detectee (${len} caracteres).` : 'Aucune description detectee.',
    'Structure conseillee: benefices -> details techniques -> dimensions -> livraison/retours.',
  ];
  return { score: clampScore(score), feedback };
}

function scoreMaterials(variationLines: string[]): ScoreBlock {
  const hasMaterial = variationLines.some((v) => /material|mati[eè]re|fabric|wood|metal|cotton|linen/i.test(v));
  const score = hasMaterial ? 70 : 0;
  return {
    score,
    feedback: hasMaterial
      ? ['Indice de matieres detecte dans les variations.', 'Bon point SEO: Etsy valorise les attributs matiere.']
      : ['Aucune matiere explicite detectee.', 'Ajoute les matieres principales pour mieux ressortir en recherche.'],
  };
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  const isGood = score >= 80;
  const isWarn = score >= 50 && score < 80;
  const barColor = isGood ? 'bg-[#14d4b0]' : isWarn ? 'bg-amber-400' : 'bg-pink-500';
  const scoreColor = isGood ? 'text-[#14d4b0]' : isWarn ? 'text-amber-300' : 'text-pink-400';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/85">{label}</span>
        <span className={scoreColor}>{score}/100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function scoreBadgeClasses(score: number): string {
  if (score >= 80) return 'text-[#14d4b0] border-[#14d4b0]/40 bg-[#14d4b0]/10';
  if (score >= 60) return 'text-amber-300 border-amber-300/40 bg-amber-300/10';
  return 'text-pink-400 border-pink-400/40 bg-pink-400/10';
}

export function DashboardEtsyListingAnalyzer() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState('');

  const mapped = result?.mapped;
  const firstItemRec = toRecord(result?.firstItem);
  const firstImage = useMemo(() => {
    if (mapped?.images && Array.isArray(mapped.images) && mapped.images[0]) return String(mapped.images[0]);
    const fromJson = pickStringArray(firstItemRec, ['images', 'imageUrls', 'gallery']);
    return fromJson[0] || '';
  }, [mapped?.images, firstItemRec]);

  const gallery = useMemo(() => {
    const fromMapped = Array.isArray(mapped?.images) ? mapped.images : [];
    const fromJson = pickStringArray(firstItemRec, ['images', 'imageUrls', 'gallery']);
    const all = [...fromMapped, ...fromJson];
    return [...new Set(all)].slice(0, 8);
  }, [mapped?.images, firstItemRec]);

  const sellerRec = useMemo(() => toRecord(firstItemRec.seller), [firstItemRec]);
  const sellerName = useMemo(
    () => pickString(sellerRec, ['name', 'shopName', 'sellerName']) || pickString(firstItemRec, ['shopName', 'sellerName']),
    [sellerRec, firstItemRec]
  );
  const sellerUrl = useMemo(
    () => pickString(sellerRec, ['url', 'shopUrl']) || pickString(firstItemRec, ['shopUrl']),
    [sellerRec, firstItemRec]
  );
  const rating = useMemo(() => pickNumber(firstItemRec, ['rating']), [firstItemRec]);
  const reviews = useMemo(() => pickNumber(firstItemRec, ['numberOfReviews', 'reviewCount']), [firstItemRec]);
  const rawPrice = useMemo(
    () => pickString(firstItemRec, ['Price', 'price', 'original Price', 'Original Price']),
    [firstItemRec]
  );
  const priceDisplay =
    (typeof mapped?.price === 'number' && mapped.price > 0 ? `${mapped.price}` : '') ||
    rawPrice ||
    '—';
  const variationLines = useMemo(() => extractVariationLabels(firstItemRec), [firstItemRec]);
  const listingDate = useMemo(() => pickString(firstItemRec, ['listedOn', 'createdAt', 'date']), [firstItemRec]);
  const listingUrl = useMemo(() => pickString(firstItemRec, ['url', 'listingUrl']), [firstItemRec]);
  const titleText = mapped?.title || pickString(firstItemRec, ['name', 'title']) || '';
  const descriptionText = mapped?.description || pickString(firstItemRec, ['description', 'summary']) || '';
  const tagsList = Array.isArray(mapped?.tags) ? mapped.tags : [];

  const titleBlock = useMemo(() => scoreTitle(titleText), [titleText]);
  const tagsBlock = useMemo(() => scoreTags(tagsList), [tagsList]);
  const imagesBlock = useMemo(() => scoreImages(gallery.length), [gallery.length]);
  const videosBlock = useMemo<ScoreBlock>(() => ({ score: 0, feedback: ['Aucune video detectee (actor listing standard).'] }), []);
  const materialsBlock = useMemo(() => scoreMaterials(variationLines), [variationLines]);
  const descriptionBlock = useMemo(() => scoreDescription(descriptionText), [descriptionText]);
  const globalScore = useMemo(() => {
    const weighted =
      titleBlock.score * 0.25 +
      tagsBlock.score * 0.2 +
      imagesBlock.score * 0.2 +
      descriptionBlock.score * 0.2 +
      materialsBlock.score * 0.1 +
      videosBlock.score * 0.05;
    return clampScore(weighted);
  }, [titleBlock.score, tagsBlock.score, imagesBlock.score, descriptionBlock.score, materialsBlock.score, videosBlock.score]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setError('Ajoute un lien listing.');
      return;
    }

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Session expirée. Reconnecte-toi.');
        return;
      }

      const response = await fetch('/api/apify/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target: 'listing',
          url: cleanUrl,
          maxItems: 1,
          timeoutSecs: 35,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !data?.success) {
        setError(data?.error || 'Échec du test Apify.');
        setResult(null);
        return;
      }
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl p-4 sm:p-7">
        <h1 className="text-2xl font-bold">Analyseur Listing Etsy</h1>
        <p className="mt-2 text-sm text-white/60">
          Colle un lien Etsy pour obtenir une analyse rapide de la qualite du listing.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#14d4b0]/35 bg-[#14d4b0]/10 px-3 py-1.5 text-xs font-semibold text-[#14d4b0]">
          1 credit par analyse
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div>
            <label className="mb-1.5 block text-xs text-white/60">Lien Etsy du listing</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.etsy.com/listing/..."
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
          >
            {loading ? 'Analyse en cours...' : 'Lancer l analyse'}
          </button>

          {error ? (
            <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </form>

        {result ? (
          <div className="mt-7 space-y-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45">Note globale du listing</p>
                  <p className="mt-1 text-3xl font-bold text-white">{globalScore}/100</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${scoreBadgeClasses(globalScore)}`}>
                  {globalScore >= 80 ? 'Tres bon' : globalScore >= 60 ? 'Correct' : 'A optimiser'}
                </span>
              </div>
              <div className="mt-4 h-2.5 w-full rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${globalScore >= 80 ? 'bg-[#14d4b0]' : globalScore >= 60 ? 'bg-amber-400' : 'bg-pink-500'}`}
                  style={{ width: `${globalScore}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/55">
                Score global calcule via ponderation: Title 25%, Tags 20%, Images 20%, Description 20%, Materials 10%, Videos 5%.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-white">Resume listing</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-[160px_1fr]">
                <div>
                  {firstImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={firstImage}
                      alt="Apercu produit"
                      className="h-[140px] w-[140px] rounded-lg border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-[140px] w-[140px] items-center justify-center rounded-lg border border-white/10 text-xs text-white/45">
                      no image
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm leading-relaxed text-white/80">
                  <p><span className="text-white/50">Items retournes:</span> {result.count ?? 0}</p>
                  <p><span className="text-white/50">Titre:</span> {mapped?.title || pickString(firstItemRec, ['name', 'title']) || '—'}</p>
                  <p><span className="text-white/50">Prix:</span> {priceDisplay}</p>
                  <p><span className="text-white/50">Description:</span> {mapped?.description || '—'}</p>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-white/50">URL:</span>
                    <span>{displayUrl(listingUrl)}</span>
                    {listingUrl ? (
                      <a
                        href={listingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-white/15 px-2 py-0.5 text-xs text-[#14d4b0] hover:bg-[#14d4b0]/10"
                      >
                        ouvrir
                      </a>
                    ) : null}
                  </p>
                  <p><span className="text-white/50">Date listing:</span> {listingDate || '—'}</p>
                  <p><span className="text-white/50">Tags:</span> {Array.isArray(mapped?.tags) && mapped.tags.length > 0 ? mapped.tags.join(', ') : 'non fournis par l actor'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-white">Listing Quality Score</h3>
              <div className="mt-5 space-y-4">
                <ScoreRow label="Title" score={titleBlock.score} />
                <ScoreRow label="Tags" score={tagsBlock.score} />
                <ScoreRow label="Images" score={imagesBlock.score} />
                <ScoreRow label="Videos" score={videosBlock.score} />
                <ScoreRow label="Materials" score={materialsBlock.score} />
                <ScoreRow label="Description" score={descriptionBlock.score} />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-white">Feedback details</h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Title', data: titleBlock },
                  { label: 'Tags', data: tagsBlock },
                  { label: 'Images', data: imagesBlock },
                  { label: 'Videos', data: videosBlock },
                  { label: 'Materials', data: materialsBlock },
                  { label: 'Description', data: descriptionBlock },
                ].map((section) => (
                  <div key={section.label} className="rounded-lg border border-white/10 bg-black/30 p-4">
                    <p className="text-sm font-semibold text-white">{section.label}</p>
                    <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-white/70">
                      {section.data.feedback.map((f, idx) => (
                        <li key={`${section.label}-${idx}`}>- {f}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-white">Seller + performance</h3>
                <div className="mt-4 grid gap-2.5 text-sm leading-relaxed text-white/80 sm:grid-cols-2">
                  <p><span className="text-white/50">Seller:</span> {sellerName || '—'}</p>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-white/50">Shop URL:</span>
                    <span>{displayUrl(sellerUrl)}</span>
                    {sellerUrl ? (
                      <a
                        href={sellerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-white/15 px-2 py-0.5 text-xs text-[#14d4b0] hover:bg-[#14d4b0]/10"
                      >
                        ouvrir
                      </a>
                    ) : null}
                  </p>
                  <p><span className="text-white/50">Rating:</span> {rating ?? '—'}</p>
                  <p><span className="text-white/50">Reviews:</span> {reviews ?? '—'}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-white">Variations detectees</h3>
                {variationLines.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-white/80">
                    {variationLines.map((line) => (
                      <li key={line}>- {line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-white/50">Aucune variation retournee.</p>
                )}
              </div>
            </div>

            {gallery.length > 1 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-white">Galerie images</h3>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {gallery.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img}
                      src={img}
                      alt="gallery"
                      className="aspect-square w-full rounded-md border border-white/10 object-cover"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

