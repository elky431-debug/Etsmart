'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { extractListingPriceFromItem } from '@/lib/listing-price-extract';
import { extractListingTagsFromItem } from '@/lib/listing-tags-extract';
import { extractListingVideoFromItem } from '@/lib/listing-video-extract';
import {
  clampScore,
  letterGradeVerbal,
  scoreBadgeClasses,
  scoreToLetterGrade,
} from '@/lib/etsy/listing-letter-grade';

/** Palette Etsmart : bleu / cyan (#00d4ff → #00c9b7), alignée abonnement / réglages */
const ES = {
  brand: 'text-cyan-300',
  border: 'border-cyan-500/35',
  bgTint: 'bg-cyan-500/10',
  ring: 'ring-1 ring-cyan-500/15',
  barStrong: 'bg-cyan-500',
  gradientBtn: 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]',
  focus: 'focus:border-cyan-500/55',
} as const;

/** Attente max côté app : Apify (Etsy + proxy) a besoin souvent de 1–3 min ; on coupe avant l’infini. */
const SCRAPE_FETCH_TIMEOUT_MS = 180_000;

const PREFILL_LISTING_URL_KEY = 'etsmart-prefill-listing-url';

function createFetchTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}

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

/** Style RankHero : pastilles vert / ambre / rouge */
type FeedbackLevel = 'good' | 'warn' | 'bad';

type FeedbackItem = { level: FeedbackLevel; text: string };

type SectionScore = {
  score: number;
  /** Sous-titre type « 12 / 13 tags » ou « 139 / 140 caractères » */
  summary?: string;
  feedback: FeedbackItem[];
};

function scoreTierColors(score: number): { bar: string; text: string } {
  if (score >= 80) return { bar: 'bg-cyan-500', text: 'text-cyan-400' };
  if (score >= 50) return { bar: 'bg-sky-400', text: 'text-sky-300' };
  return { bar: 'bg-rose-500', text: 'text-rose-400' };
}

function dotClass(level: FeedbackLevel): string {
  if (level === 'good') return 'bg-emerald-400';
  if (level === 'warn') return 'bg-sky-400';
  return 'bg-rose-500';
}

/** Logique proche RankHero : titre (clarté + SEO + longueur) */
function scoreTitleRankHero(title: string, tags: string[]): SectionScore {
  const t = title.trim();
  if (!t) {
    return { score: 0, summary: '—', feedback: [{ level: 'bad', text: 'Aucun titre détecté.' }] };
  }
  const words = t.split(/\s+/).filter(Boolean);
  const len = t.length;
  const wordCount = words.length;
  let score = 55;

  const feedback: FeedbackItem[] = [];

  if (wordCount <= 15) {
    feedback.push({
      level: 'good',
      text: `Clarté : ${wordCount} mot(s) (Etsy recommande souvent moins de 15 pour la lisibilité).`,
    });
    score += 12;
  } else {
    feedback.push({
      level: 'warn',
      text: `Le titre contient ${wordCount} mots. Etsy recommande moins de 15 pour la clarté et la scannabilité.`,
    });
    score -= 10;
  }

  if (len >= 70 && len <= 140) {
    feedback.push({ level: 'good', text: `Longueur SEO fréquente : ${len}/140 caractères.` });
    score += 18;
  } else if (len >= 40 && len < 70) {
    feedback.push({ level: 'warn', text: `Titre un peu court (${len}/140). Vise souvent 70–140 caractères.` });
    score += 6;
  } else if (len > 140) {
    feedback.push({ level: 'warn', text: `Titre au-dessus de 140 caractères (${len}). Etsy tronque l’affichage : simplifie.` });
    score -= 12;
  } else {
    feedback.push({ level: 'bad', text: `Titre très court (${len} caractères).` });
    score -= 18;
  }

  const freq = new Map<string, number>();
  for (const w of words) {
    const k = w.toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüç-]/gi, '');
    if (k.length < 3) continue;
    freq.set(k, (freq.get(k) || 0) + 1);
  }
  const heavy = [...freq.entries()].filter(([, c]) => c > 2);
  if (heavy.length === 0) {
    feedback.push({ level: 'good', text: 'Pas de mot trop répété dans le titre.' });
    score += 5;
  } else {
    feedback.push({ level: 'warn', text: `Mots fréquents : ${heavy.map(([w]) => w).join(', ')}.` });
    score -= 6;
  }

  const lowerTitle = t.toLowerCase();
  const tagsInTitle = tags.filter((tag) => tag && lowerTitle.includes(tag.toLowerCase()));
  if (tagsInTitle.length > 0) {
    feedback.push({
      level: 'good',
      text: `SEO : le titre inclut ${tagsInTitle.length} tag(s) : ${tagsInTitle.slice(0, 4).join(', ')}.`,
    });
    score += 10;
  } else if (tags.length > 0) {
    feedback.push({
      level: 'warn',
      text: 'Aucun tag ne figure tel quel dans le titre (optionnel mais utile pour la cohérence).',
    });
  }

  return { score: clampScore(score), summary: `${len}/140 caractères · ${wordCount} mots`, feedback };
}

function scoreImagesRankHero(count: number): SectionScore {
  const MAX = 20;
  const REC = 7;
  let score = 0;
  if (count >= REC) score = 100;
  else if (count >= 6) score = 86;
  else if (count >= 5) score = 72;
  else if (count >= 4) score = 56;
  else score = Math.max(12, Math.round((count / REC) * 62));

  const feedback: FeedbackItem[] = [];
  if (count >= REC) {
    feedback.push({ level: 'good', text: `Nombre d’images solide (${count} / ${REC}+ recommandé).` });
  } else {
    feedback.push({
      level: 'warn',
      text: `Ajoute des visuels : Etsy performe mieux avec au moins ${REC} photos (tu en as ${count}).`,
    });
  }
  feedback.push({ level: 'good', text: `Etsy autorise jusqu’à ${MAX} images par listing.` });
  return { score: clampScore(score), summary: `${count} / ${MAX} images`, feedback };
}

function scoreVideoRankHero(
  firstItem: Record<string, unknown>,
  videoDetectedOnEtsyPage: boolean
): SectionScore {
  const { url, hasVideo } = extractListingVideoFromItem(firstItem);
  const has = hasVideo || videoDetectedOnEtsyPage;
  const score = has ? 100 : 0;
  const feedbackGood = (): FeedbackItem[] => {
    if (url) return [{ level: 'good', text: 'Vidéo détectée dans les données Apify (URL extraite).' }];
    if (hasVideo)
      return [{ level: 'good', text: 'Vidéo signalée dans les données scraper (lien parfois absent).' }];
    return [
      {
        level: 'good',
        text: 'Vidéo détectée sur la page Etsy (analyse HTML ; souvent absente des données Apify).',
      },
    ];
  };
  return {
    score,
    summary: has ? (url ? '1 / 1 vidéo' : '1 / 1 vidéo') : '0 / 1 vidéo',
    feedback: has
      ? feedbackGood()
      : [
          { level: 'bad', text: 'Aucune vidéo détectée (ni Apify ni page publique).' },
          { level: 'warn', text: 'Une vidéo peut fortement améliorer la confiance et la conversion.' },
        ],
  };
}

function scoreDescriptionRankHero(desc: string): SectionScore {
  const t = desc.trim();
  const words = t.split(/\s+/).filter(Boolean);
  const len = t.length;
  if (!t) {
    return {
      score: 0,
      summary: '0 mots',
      feedback: [{ level: 'bad', text: 'Aucune description détectée.' }],
    };
  }

  let score = 40;
  if (words.length >= 400) score = 100;
  else if (words.length >= 250) score = 88;
  else if (words.length >= 150) score = 74;
  else if (words.length >= 90) score = 58;
  else score = 40;

  const feedback: FeedbackItem[] = [
    { level: 'good', text: `${words.length} mots · ${len} caractères` },
  ];
  if (words.length >= 120) {
    feedback.push({ level: 'good', text: 'Description dans une plage souvent recommandée pour Etsy.' });
  } else {
    feedback.push({
      level: 'warn',
      text: 'Description courte : ajoute bénéfices, détails techniques, dimensions, livraison et retours.',
    });
  }

  return { score: clampScore(score), summary: `${words.length} mots · ${len} caractères`, feedback };
}

function SectionScoreCard({ label, data }: { label: string; data: SectionScore }) {
  const { bar, text } = scoreTierColors(data.score);
  return (
    <div className={`rounded-2xl border border-white/10 bg-black/35 p-5 ${ES.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-white">{label}</h4>
          {data.summary ? <p className="mt-0.5 text-xs text-white/45">{data.summary}</p> : null}
        </div>
        <span className={`text-sm font-bold tabular-nums ${text}`}>{data.score}/100</span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-white/10">
        <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${data.score}%` }} />
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Feedback</p>
        <ul className="mt-2 space-y-2">
          {data.feedback.map((item, idx) => (
            <li key={idx} className="flex gap-2.5 text-xs leading-relaxed text-white/80">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass(item.level)}`} aria-hidden />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function OverviewScoreRow({ label, score }: { label: string; score: number }) {
  const { bar, text } = scoreTierColors(score);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3 ring-1 ring-cyan-500/10 sm:flex-row sm:items-center sm:gap-4">
      <span className="min-w-0 flex-1 text-sm font-medium text-white/90">{label}</span>
      <div className="flex items-center gap-3 sm:justify-end">
        <span className={`text-sm font-bold tabular-nums ${text}`}>{score}/100</span>
        <div className="h-2 w-full min-w-[6rem] max-w-[8rem] flex-1 overflow-hidden rounded-full bg-white/10 sm:w-28">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  step,
  title,
  subtitle,
}: {
  step: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <span
          className="inline-flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-sm font-bold tabular-nums text-cyan-400"
          aria-hidden
        >
          {step}
        </span>
        <div className="min-w-0 flex-1 border-b border-white/10 pb-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
          {subtitle ? <p className="mt-1.5 text-sm leading-relaxed text-white/45">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function DashboardEtsyListingAnalyzer() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState('');
  /** Complément Apify : détection vidéo sur le HTML du listing (souvent plus fiable que l’actor). */
  const [videoFromHtmlPage, setVideoFromHtmlPage] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const pre = sessionStorage.getItem(PREFILL_LISTING_URL_KEY);
      if (pre?.trim()) {
        sessionStorage.removeItem(PREFILL_LISTING_URL_KEY);
        setUrl(pre.trim());
        setResult(null);
        setError('');
      }
    } catch {
      /* ignore */
    }
  }, []);

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
    return [...new Set(all)].slice(0, 20);
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
  const priceInfo = useMemo(() => extractListingPriceFromItem(firstItemRec), [firstItemRec]);
  const priceDisplay =
    priceInfo.display ||
    (typeof mapped?.price === 'number' && mapped.price > 0 ? String(mapped.price) : '') ||
    '—';
  const variationLines = useMemo(() => extractVariationLabels(firstItemRec), [firstItemRec]);
  const listingDate = useMemo(() => pickString(firstItemRec, ['listedOn', 'createdAt', 'date']), [firstItemRec]);
  const listingUrl = useMemo(() => pickString(firstItemRec, ['url', 'listingUrl']), [firstItemRec]);

  /** Textes les plus complets possibles pour l’affichage (plusieurs clés côté Apify). */
  const listingTitleDisplay = useMemo(() => {
    const fromMapped = mapped?.title || '';
    const fromItem = pickString(firstItemRec, ['name', 'title', 'listingTitle', 'productTitle', 'itemTitle']);
    return (fromItem.length > fromMapped.length ? fromItem : fromMapped) || '';
  }, [mapped?.title, firstItemRec]);

  const listingDescriptionDisplay = useMemo(() => {
    const fromMapped = mapped?.description || '';
    const fromItem = pickString(firstItemRec, [
      'description',
      'fullDescription',
      'longDescription',
      'body',
      'htmlDescription',
      'productDescription',
      'summary',
    ]);
    return (fromItem.length > fromMapped.length ? fromItem : fromMapped) || '';
  }, [mapped?.description, firstItemRec]);

  /** Tags uniquement pour cohérence titre / SEO (non affichés). */
  const tagsForTitle = useMemo(() => {
    const fromMapped = Array.isArray(mapped?.tags) ? mapped.tags : [];
    if (fromMapped.length > 0) return fromMapped;
    return extractListingTagsFromItem(firstItemRec);
  }, [mapped?.tags, firstItemRec]);

  const titleBlock = useMemo(
    () => scoreTitleRankHero(listingTitleDisplay, tagsForTitle),
    [listingTitleDisplay, tagsForTitle]
  );
  const imagesBlock = useMemo(() => scoreImagesRankHero(gallery.length), [gallery.length]);
  const videosBlock = useMemo(
    () => scoreVideoRankHero(firstItemRec, videoFromHtmlPage),
    [firstItemRec, videoFromHtmlPage]
  );
  const descriptionBlock = useMemo(
    () => scoreDescriptionRankHero(listingDescriptionDisplay),
    [listingDescriptionDisplay]
  );
  /** Anciennement + tags + matériaux : redistribué sur titre / images / description / vidéo. */
  const globalScore = useMemo(() => {
    const weighted =
      titleBlock.score * (25 / 70) +
      imagesBlock.score * (20 / 70) +
      descriptionBlock.score * (20 / 70) +
      videosBlock.score * (5 / 70);
    return clampScore(weighted);
  }, [titleBlock.score, imagesBlock.score, descriptionBlock.score, videosBlock.score]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setVideoFromHtmlPage(false);

    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setError('Ajoute un lien listing.');
      return;
    }

    setLoading(true);
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      let session = refreshed.session;
      if (!session?.access_token) {
        const { data: { session: cached } } = await supabase.auth.getSession();
        session = cached;
      }
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
          timeoutSecs: 120,
        }),
        signal: createFetchTimeoutSignal(SCRAPE_FETCH_TIMEOUT_MS),
      });

      const raw = await response.text();
      let data: ApiResponse = {};
      try {
        data = raw ? (JSON.parse(raw) as ApiResponse) : {};
      } catch {
        setError(
          raw.trim()
            ? `Réponse invalide (${response.status}) : ${raw.slice(0, 280)}`
            : `Erreur HTTP ${response.status}. Réessaie ou vérifie la console serveur.`
        );
        setResult(null);
        return;
      }

      if (!response.ok || !data?.success) {
        const apiErr =
          typeof data.error === 'string' && data.error.trim()
            ? data.error.trim()
            : '';
        setError(
          apiErr ||
            (response.status === 400
              ? 'Configuration Apify manquante : ajoute APIFY_API_TOKEN (et éventuellement APIFY_ACTOR_LISTING_ID) dans .env.local, puis redémarre npm run dev. Voir APIFY_ENV_TEMPLATE.txt.'
              : 'Échec de l’analyse Apify. Vérifie les variables d’environnement et les crédits Apify.')
        );
        setResult(null);
        return;
      }
      setResult(data);

      void (async () => {
        try {
          const htmlRes = await fetch('/api/etsy/scrape-listing', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ url: cleanUrl }),
            signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
              ? AbortSignal.timeout(35_000)
              : undefined,
          });
          const htmlJson = (await htmlRes.json()) as { listing?: { hasVideo?: boolean } };
          if (htmlRes.ok && htmlJson?.listing?.hasVideo === true) {
            setVideoFromHtmlPage(true);
          }
        } catch {
          /* secondaire */
        }
      })();
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setError(
          'Délai dépassé (3 min). Réessaie ou vérifie Apify / ta connexion.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Erreur réseau.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400/90">Etsmart</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Analyseur Listing Etsy</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              Colle un lien de fiche produit : analyse type RankHero (titre, images, description…).
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${ES.border} ${ES.bgTint} ${ES.brand}`}
            >
              1 crédit par analyse
            </span>
            <p className="text-xs text-white/40">Jusqu’à ~3 min si le scraper est lent.</p>
          </div>
        </header>

        <form
          onSubmit={onSubmit}
          className={`mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 ${ES.ring}`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-4">
            <div className="min-w-0 flex-1">
              <label className="mb-2 block text-xs font-medium text-white/55">Lien du listing</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.etsy.com/listing/…"
                className={`w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 ${ES.focus}`}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`shrink-0 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 disabled:opacity-60 lg:min-w-[11rem] ${ES.gradientBtn}`}
            >
              {loading ? 'Analyse…' : 'Analyser'}
            </button>
          </div>
          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </form>

        {result ? (
          <div className="mt-12 space-y-14">
            {/* 1 — Synthèse : score + aperçu + infos clés */}
            <section>
              <SectionHeading
                step="1"
                title="Synthèse"
                subtitle="Note globale, aperçu visuel et informations principales du listing."
              />
              <div
                className={`overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-cyan-950/20 ${ES.ring}`}
              >
                <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:items-start lg:gap-10">
                  <div className="lg:col-span-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-cyan-200/55">Note globale</p>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <p
                        className="text-5xl font-bold leading-none tracking-tight text-white sm:text-6xl"
                        title={`${globalScore}/100`}
                        aria-label={`Note globale ${scoreToLetterGrade(globalScore)}, ${globalScore} sur 100`}
                      >
                        {scoreToLetterGrade(globalScore)}
                      </p>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${scoreBadgeClasses(globalScore)}`}>
                        {letterGradeVerbal(scoreToLetterGrade(globalScore))}
                      </span>
                    </div>
                    <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${globalScore >= 80 ? ES.barStrong : globalScore >= 60 ? 'bg-sky-400' : 'bg-rose-500'}`}
                        style={{ width: `${globalScore}%` }}
                      />
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-white/45">
                      Pondération : titre ~36 % · images ~29 % · description ~29 % · vidéo ~7 %.
                    </p>
                  </div>

                  <div className="flex justify-center lg:col-span-3 lg:justify-start">
                    {firstImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={firstImage}
                        alt="Aperçu produit"
                        className="h-40 w-40 rounded-2xl border border-cyan-500/30 object-cover shadow-xl shadow-black/50 sm:h-44 sm:w-44"
                      />
                    ) : (
                      <div className="flex h-40 w-40 items-center justify-center rounded-2xl border border-dashed border-white/15 text-xs text-white/35">
                        Pas d’image
                      </div>
                    )}
                  </div>

                  <dl className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/35 p-1 text-sm lg:col-span-4">
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <dt className="text-white/45">Items retournés</dt>
                      <dd className="text-right font-medium text-white">{result.count ?? 0}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <dt className="text-white/45">Prix</dt>
                      <dd className="text-right font-medium text-white">{priceDisplay}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <dt className="shrink-0 text-white/45">Lien</dt>
                      <dd className="min-w-0 text-right">
                        <span className="break-all text-white/80">{displayUrl(listingUrl)}</span>
                        {listingUrl ? (
                          <a
                            href={listingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 inline-block rounded-lg border border-cyan-500/35 px-2 py-0.5 text-xs text-cyan-300 hover:bg-cyan-500/10"
                          >
                            Ouvrir
                          </a>
                        ) : null}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <dt className="text-white/45">Date</dt>
                      <dd className="text-right font-medium text-white/90">{listingDate || '—'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </section>

            {/* 2 — Contenu analysé */}
            <section>
              <SectionHeading
                step="2"
                title="Contenu analysé"
                subtitle="Texte et éléments utilisés pour calculer les scores."
              />
              <div className="rounded-2xl border border-white/10 bg-black/25 p-5 ring-1 ring-cyan-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/60">Titre</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-white">
                  {listingTitleDisplay.trim() ? listingTitleDisplay : '—'}
                </p>
                <p className="mt-2 text-xs text-white/35">{listingTitleDisplay.length} caractères</p>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5 ring-1 ring-cyan-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/60">Description</p>
                <div className="mt-3 max-h-[min(360px,55vh)] overflow-y-auto rounded-xl border border-cyan-500/20 bg-black/50 p-4">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">
                    {listingDescriptionDisplay.trim() ? listingDescriptionDisplay : '—'}
                  </p>
                </div>
                <p className="mt-2 text-xs text-white/35">
                  {listingDescriptionDisplay.length} caractères ·{' '}
                  {listingDescriptionDisplay.trim()
                    ? listingDescriptionDisplay.trim().split(/\s+/).filter(Boolean).length
                    : 0}{' '}
                  mots
                </p>
              </div>
            </section>

            {/* 3 — Scores */}
            <section>
              <SectionHeading
                step="3"
                title="Scores par critère"
                subtitle="Chaque critère est noté sur 100. Barres : cyan = bon · bleu clair = moyen · rouge = faible."
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <OverviewScoreRow label="Titre" score={titleBlock.score} />
                <OverviewScoreRow label="Images" score={imagesBlock.score} />
                <OverviewScoreRow label="Vidéo" score={videosBlock.score} />
                <OverviewScoreRow label="Description" score={descriptionBlock.score} />
              </div>
            </section>

            {/* 4 — Feedback détaillé */}
            <section>
              <SectionHeading
                step="4"
                title="Feedback détaillé"
                subtitle="Conseils par bloc. Pastilles vertes = point positif."
              />
              <div className="grid gap-5 lg:grid-cols-2">
                <SectionScoreCard label="Titre" data={titleBlock} />
                <SectionScoreCard label="Images" data={imagesBlock} />
                <SectionScoreCard label="Vidéo" data={videosBlock} />
                <SectionScoreCard label="Description" data={descriptionBlock} />
              </div>
            </section>

            {/* 5 — Boutique & variations */}
            <section>
              <SectionHeading step="5" title="Boutique & variations" />
              <div className="grid gap-5 lg:grid-cols-2">
                <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-6 ${ES.ring}`}>
                  <h3 className="text-sm font-semibold text-cyan-100">Vendeur</h3>
                  <dl className="mt-4 space-y-3 text-sm text-white/85">
                    <div>
                      <dt className="text-white/45">Nom</dt>
                      <dd className="mt-0.5 font-medium">{sellerName || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Boutique</dt>
                      <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span>{displayUrl(sellerUrl)}</span>
                        {sellerUrl ? (
                          <a
                            href={sellerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-cyan-500/35 px-2 py-0.5 text-xs text-cyan-300 hover:bg-cyan-500/10"
                          >
                            Ouvrir
                          </a>
                        ) : null}
                      </dd>
                    </div>
                    <div className="flex gap-8">
                      <div>
                        <dt className="text-white/45">Note</dt>
                        <dd className="mt-0.5 font-medium">{rating ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-white/45">Avis</dt>
                        <dd className="mt-0.5 font-medium">{reviews ?? '—'}</dd>
                      </div>
                    </div>
                  </dl>
                </div>
                <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-6 ${ES.ring}`}>
                  <h3 className="text-sm font-semibold text-cyan-100">Variations</h3>
                  {variationLines.length > 0 ? (
                    <ul className="mt-4 space-y-2 text-sm leading-relaxed text-white/85">
                      {variationLines.map((line) => (
                        <li key={line} className="flex gap-2 border-l-2 border-cyan-500/40 pl-3">
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-white/45">Aucune variation renvoyée.</p>
                  )}
                </div>
              </div>
            </section>

            {/* 6 — Galerie */}
            {gallery.length > 1 ? (
              <section>
                <SectionHeading step="6" title="Galerie images" subtitle={`${gallery.length} visuels détectés.`} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {gallery.map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img}
                      src={img}
                      alt={`Visuel ${i + 1}`}
                      className="aspect-square w-full rounded-xl border border-cyan-500/20 object-cover transition hover:ring-2 hover:ring-cyan-500/30"
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

