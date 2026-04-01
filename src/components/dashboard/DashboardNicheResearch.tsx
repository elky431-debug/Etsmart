'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, RefreshCw, Search, ChevronUp, ChevronDown,
  Flame, TrendingUp, Zap, Filter, Plus, X, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─── Niche catalogue ─────────────────────────────────────────────────────────
interface NicheEntry {
  keyword: string;
  label: string;         // French label for display
  category: string;
}

const NICHES: NicheEntry[] = [
  // Bijoux & Accessoires
  { keyword: 'minimalist gold necklace', label: 'Collier minimaliste doré', category: 'Bijoux' },
  { keyword: 'personalized name necklace', label: 'Collier prénom personnalisé', category: 'Bijoux' },
  { keyword: 'birthstone ring silver', label: 'Bague pierre de naissance', category: 'Bijoux' },
  { keyword: 'celestial moon jewelry', label: 'Bijoux lune céleste', category: 'Bijoux' },
  { keyword: 'dainty layering bracelet', label: 'Bracelet superposable délicat', category: 'Bijoux' },
  { keyword: 'crystal gemstone jewelry handmade', label: 'Bijoux cristaux fait main', category: 'Bijoux' },
  { keyword: 'custom initial charm bracelet', label: 'Bracelet initiale personnalisé', category: 'Bijoux' },
  { keyword: 'pearl earrings handmade', label: 'Boucles d\'oreilles perles', category: 'Bijoux' },
  // Décoration Maison
  { keyword: 'macrame wall hanging boho', label: 'Macramé mural bohème', category: 'Décoration' },
  { keyword: 'custom neon sign led', label: 'Enseigne néon LED custom', category: 'Décoration' },
  { keyword: 'suspension lamp handmade wood', label: 'Lampe suspension bois', category: 'Décoration' },
  { keyword: 'ceramic planter pot handmade', label: 'Pot céramique artisanal', category: 'Décoration' },
  { keyword: 'pressed flower art framed', label: 'Art fleurs pressées encadré', category: 'Décoration' },
  { keyword: 'boho wall art print', label: 'Art mural boho', category: 'Décoration' },
  { keyword: 'wax seal stamp kit vintage', label: 'Kit sceau de cire vintage', category: 'Décoration' },
  { keyword: 'terrarium glass geometric', label: 'Terrarium géométrique', category: 'Décoration' },
  { keyword: 'linen cushion cover natural', label: 'Housse coussin lin naturel', category: 'Décoration' },
  { keyword: 'wooden wall clock rustic', label: 'Horloge murale bois rustique', category: 'Décoration' },
  // Produits Digitaux
  { keyword: 'printable wall art digital download', label: 'Art mural imprimable', category: 'Digital' },
  { keyword: 'digital planner goodnotes ipad', label: 'Agenda numérique GoodNotes', category: 'Digital' },
  { keyword: 'canva instagram template bundle', label: 'Templates Instagram Canva', category: 'Digital' },
  { keyword: 'svg cut file cricut silhouette', label: 'Fichier SVG Cricut', category: 'Digital' },
  { keyword: 'crochet pattern pdf beginner', label: 'Patron crochet PDF', category: 'Digital' },
  { keyword: 'wedding invitation digital editable', label: 'Invitation mariage digital', category: 'Digital' },
  { keyword: 'notion template productivity', label: 'Template Notion productivité', category: 'Digital' },
  { keyword: 'budget planner spreadsheet excel', label: 'Planificateur budget Excel', category: 'Digital' },
  { keyword: 'watercolor clipart bundle png', label: 'Clipart aquarelle bundle', category: 'Digital' },
  // Mariage & Événements
  { keyword: 'personalized wedding favor tag', label: 'Tag cadeau invité mariage', category: 'Mariage' },
  { keyword: 'bridal shower gift personalized', label: 'Cadeau EVJF personnalisé', category: 'Mariage' },
  { keyword: 'wedding sign wood calligraphy', label: 'Panneau mariage calligraphie', category: 'Mariage' },
  { keyword: 'bachelorette party decoration', label: 'Décoration bachelorette', category: 'Mariage' },
  { keyword: 'wedding cake topper acrylic', label: 'Topper gâteau mariage', category: 'Mariage' },
  { keyword: 'custom wedding map art print', label: 'Carte mariage illustrée', category: 'Mariage' },
  // Bébé & Enfants
  { keyword: 'personalized baby blanket name', label: 'Couverture bébé personnalisée', category: 'Bébé & Enfants' },
  { keyword: 'nursery wall art animals', label: 'Décoration chambre bébé', category: 'Bébé & Enfants' },
  { keyword: 'wooden name puzzle baby toy', label: 'Puzzle prénom bois', category: 'Bébé & Enfants' },
  { keyword: 'montessori toy wooden toddler', label: 'Jouet Montessori bois', category: 'Bébé & Enfants' },
  { keyword: 'baby milestone cards printable', label: 'Cartes étapes bébé', category: 'Bébé & Enfants' },
  { keyword: 'custom children book personalized', label: 'Livre enfant personnalisé', category: 'Bébé & Enfants' },
  // Art & Impressions
  { keyword: 'custom pet portrait painting', label: 'Portrait animal de compagnie', category: 'Art & Prints' },
  { keyword: 'watercolor family portrait custom', label: 'Portrait famille aquarelle', category: 'Art & Prints' },
  { keyword: 'birth poster custom name stars', label: 'Affiche naissance personnalisée', category: 'Art & Prints' },
  { keyword: 'city map art print minimal', label: 'Carte ville art minimal', category: 'Art & Prints' },
  { keyword: 'botanical art print vintage', label: 'Impression botanique vintage', category: 'Art & Prints' },
  { keyword: 'abstract canvas wall art large', label: 'Toile art abstrait grande', category: 'Art & Prints' },
  // Bougies & Bien-être
  { keyword: 'soy candle scented luxury', label: 'Bougie soja luxe', category: 'Bougies & Bain' },
  { keyword: 'crystal candle gemstone healing', label: 'Bougie cristaux guérison', category: 'Bougies & Bain' },
  { keyword: 'bath bomb gift set handmade', label: 'Set bombes de bain', category: 'Bougies & Bain' },
  { keyword: 'natural handmade soap bar', label: 'Savon artisanal naturel', category: 'Bougies & Bain' },
  { keyword: 'wax melt scented luxury', label: 'Fondant cire parfumé', category: 'Bougies & Bain' },
  { keyword: 'reed diffuser luxury home', label: 'Diffuseur roseau maison', category: 'Bougies & Bain' },
  // Vêtements & Accessoires
  { keyword: 'custom embroidered baseball hat', label: 'Casquette brodée personnalisée', category: 'Mode' },
  { keyword: 'personalized canvas tote bag', label: 'Tote bag toile personnalisé', category: 'Mode' },
  { keyword: 'custom phone case iphone samsung', label: 'Coque téléphone custom', category: 'Mode' },
  { keyword: 'enamel pin aesthetic cute', label: 'Pin émail esthétique', category: 'Mode' },
  { keyword: 'handmade crochet cardigan women', label: 'Cardigan crochet fait main', category: 'Mode' },
  // Gaming & Anime
  { keyword: 'gaming desk mat xxl custom', label: 'Tapis bureau gaming XXL', category: 'Gaming & Anime' },
  { keyword: 'anime wall art poster print', label: 'Affiche anime décoration', category: 'Gaming & Anime' },
  { keyword: 'gamer room decor neon light', label: 'Décoration chambre gamer', category: 'Gaming & Anime' },
  { keyword: 'custom gaming mousepad large', label: 'Tapis souris gaming custom', category: 'Gaming & Anime' },
  { keyword: 'anime figurine handmade resin', label: 'Figurine anime résine', category: 'Gaming & Anime' },
  // Papeterie
  { keyword: 'aesthetic washi tape set', label: 'Set washi tape esthétique', category: 'Papeterie' },
  { keyword: 'cute kawaii sticker sheet', label: 'Stickers kawaii feuille', category: 'Papeterie' },
  { keyword: 'custom notebook journal personalized', label: 'Carnet journal personnalisé', category: 'Papeterie' },
  { keyword: 'wildflower seed paper card', label: 'Carte papier graines fleurs', category: 'Papeterie' },
  // Animaux
  { keyword: 'custom dog tag engraved', label: 'Médaille chien gravée', category: 'Animaux' },
  { keyword: 'personalized dog bandana fabric', label: 'Bandana chien personnalisé', category: 'Animaux' },
  { keyword: 'pet memorial gift custom portrait', label: 'Souvenir animal portrait', category: 'Animaux' },
  { keyword: 'cat collar breakaway personalized', label: 'Collier chat personnalisé', category: 'Animaux' },
  // Loisirs créatifs
  { keyword: 'resin art mold silicone kit', label: 'Kit art résine moule', category: 'Loisirs créatifs' },
  { keyword: 'embroidery kit beginner floral', label: 'Kit broderie débutant floral', category: 'Loisirs créatifs' },
  { keyword: 'paint by numbers custom photo', label: 'Peinture par numéros photo', category: 'Loisirs créatifs' },
];

const CATEGORIES = ['Toutes', ...Array.from(new Set(NICHES.map(n => n.category)))];
const CACHE_KEY = 'niche_research_cache_v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ─── Types ───────────────────────────────────────────────────────────────────
interface NicheResult {
  keyword: string;
  competitionCount: number | null;
  competitionScore: number;
  demandScore: number;
  opportunityScore: number;
  bestsellerCount: number;
  error?: boolean;
  cachedAt: number;
}

type SortKey = 'opportunityScore' | 'demandScore' | 'competitionScore' | 'label';
type SortDir = 'asc' | 'desc';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scoreColor(score: number, invert = false) {
  const s = invert ? 100 - score : score;
  if (s >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  if (s >= 45) return { bar: 'bg-amber-500', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
  return { bar: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300 border-red-500/30' };
}

function formatCount(n: number | null) {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function loadCache(): Record<string, NicheResult> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCache(data: Record<string, NicheResult>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* ignore quota errors */ }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function DashboardNicheResearch() {
  const [token, setToken] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, NicheResult>>({});
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('opportunityScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterCategory, setFilterCategory] = useState('Toutes');
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [customNiches, setCustomNiches] = useState<NicheEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
    });
  }, []);

  const allNiches = [...NICHES, ...customNiches];

  // Fetch a batch of keywords from the API
  const fetchBatch = useCallback(async (keywords: string[], forceRefresh = false) => {
    if (!token) return;

    const cache = loadCache();
    const now = Date.now();

    const toFetch = forceRefresh
      ? keywords
      : keywords.filter(k => {
          const cached = cache[k];
          return !cached || cached.error || (now - cached.cachedAt) > CACHE_TTL_MS;
        });

    if (toFetch.length === 0) {
      // Load from cache
      const fresh: Record<string, NicheResult> = {};
      for (const k of keywords) { if (cache[k]) fresh[k] = cache[k]; }
      setResults(prev => ({ ...prev, ...fresh }));
      return;
    }

    setLoadingSet(prev => { const s = new Set(prev); toFetch.forEach(k => s.add(k)); return s; });

    // Load cached ones immediately
    const fromCache: Record<string, NicheResult> = {};
    for (const k of keywords) { if (cache[k] && !toFetch.includes(k)) fromCache[k] = cache[k]; }
    if (Object.keys(fromCache).length) setResults(prev => ({ ...prev, ...fromCache }));

    try {
      const res = await fetch('/api/niche-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keywords: toFetch }),
        signal: abortRef.current?.signal,
      });

      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) return;

      const newCache = loadCache();
      const newResults: Record<string, NicheResult> = {};
      for (const item of json.data as NicheResult[]) {
        const enriched: NicheResult = { ...item, cachedAt: Date.now() };
        newResults[item.keyword] = enriched;
        if (!item.error) newCache[item.keyword] = enriched;
      }
      saveCache(newCache);
      setResults(prev => ({ ...prev, ...newResults }));
    } catch { /* aborted or network error */ } finally {
      setLoadingSet(prev => { const s = new Set(prev); toFetch.forEach(k => s.delete(k)); return s; });
    }
  }, [token]);

  // Load all niches once token is available
  useEffect(() => {
    if (!token) return;
    abortRef.current = new AbortController();
    const keywords = NICHES.map(n => n.keyword);
    const BATCH = 8;
    const batches: string[][] = [];
    for (let i = 0; i < keywords.length; i += BATCH) batches.push(keywords.slice(i, i + BATCH));
    batches.forEach(batch => fetchBatch(batch));
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRefresh = () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setResults({});
    const keywords = allNiches.map(n => n.keyword);
    const BATCH = 8;
    const batches: string[][] = [];
    for (let i = 0; i < keywords.length; i += BATCH) batches.push(keywords.slice(i, i + BATCH));
    batches.forEach(batch => fetchBatch(batch, true));
  };

  const handleAddCustom = () => {
    const kw = customInput.trim().toLowerCase();
    if (!kw || allNiches.some(n => n.keyword === kw)) { setCustomInput(''); return; }
    const entry: NicheEntry = { keyword: kw, label: kw, category: 'Custom' };
    setCustomNiches(prev => [...prev, entry]);
    setCustomInput('');
    fetchBatch([kw], true);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'label' ? 'asc' : 'desc'); }
  };

  // Filter + sort
  const displayed = allNiches
    .filter(n => {
      if (filterCategory !== 'Toutes' && n.category !== filterCategory) return false;
      if (search && !n.label.toLowerCase().includes(search.toLowerCase()) && !n.keyword.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const ra = results[a.keyword];
      const rb = results[b.keyword];
      if (sortKey === 'label') {
        return sortDir === 'asc' ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label);
      }
      const va = ra?.[sortKey] ?? -1;
      const vb = rb?.[sortKey] ?? -1;
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const totalLoading = loadingSet.size;
  const totalLoaded = Object.values(results).filter(r => !r.error).length;
  const cacheAge = Math.min(...Object.values(results).filter(r => r.cachedAt).map(r => r.cachedAt));
  const cacheAgeMin = cacheAge ? Math.round((Date.now() - cacheAge) / 60000) : null;

  // Summary stats
  const allScored = Object.values(results).filter(r => !r.error && r.opportunityScore > 0);
  const avgOpportunity = allScored.length ? Math.round(allScored.reduce((s, r) => s + r.opportunityScore, 0) / allScored.length) : null;
  const topOpportunities = allScored.filter(r => r.opportunityScore >= 65).length;
  const trending = allScored.filter(r => r.demandScore >= 75).length;

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="inline-flex flex-col ml-1">
      <ChevronUp size={9} className={sortKey === col && sortDir === 'asc' ? 'text-[#00d4ff]' : 'text-white/30'} />
      <ChevronDown size={9} className={`-mt-0.5 ${sortKey === col && sortDir === 'desc' ? 'text-[#00d4ff]' : 'text-white/30'}`} />
    </span>
  );

  return (
    <div className="p-4 md:p-8 bg-black pb-8 md:pb-12 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Recherche de Niche</h1>
                <p className="text-white/50 text-sm mt-0.5">Données en temps réel depuis Etsy — concurrence + demande réelle</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={totalLoading > 0}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={totalLoading > 0 ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>

          {/* Progress / cache info */}
          {(totalLoading > 0 || cacheAgeMin !== null) && (
            <div className="mt-3 flex items-center gap-3 text-xs text-white/40">
              {totalLoading > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
                  Analyse de {totalLoading} niches en cours…
                </span>
              )}
              {totalLoaded > 0 && totalLoading === 0 && cacheAgeMin !== null && (
                <span className="flex items-center gap-1.5">
                  <Clock size={11} />
                  Mis à jour il y a {cacheAgeMin < 60 ? `${cacheAgeMin} min` : `${Math.round(cacheAgeMin / 60)}h`}
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Score moyen', value: avgOpportunity !== null ? `${avgOpportunity}/100` : '—', icon: <Zap size={16} />, color: 'from-[#00d4ff]/20 to-[#00c9b7]/20' },
            { label: 'Opportunités fortes', value: topOpportunities > 0 ? String(topOpportunities) : '—', icon: <TrendingUp size={16} />, color: 'from-emerald-500/20 to-emerald-700/20' },
            { label: 'Niches trending', value: trending > 0 ? String(trending) : '—', icon: <Flame size={16} />, color: 'from-orange-500/20 to-red-500/20' },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border border-white/10 bg-gradient-to-br ${c.color} p-4`}>
              <div className="text-white/50 mb-1 flex items-center gap-1.5">{c.icon}<span className="text-xs">{c.label}</span></div>
              <div className="text-xl font-bold text-white">{c.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <Search size={14} className="text-white/40 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une niche…"
              className="bg-transparent text-white text-sm outline-none w-full placeholder:text-white/30"
            />
            {search && <button onClick={() => setSearch('')}><X size={12} className="text-white/40 hover:text-white" /></button>}
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <Filter size={14} className="text-white/40" />
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="bg-transparent text-white text-sm outline-none cursor-pointer"
            >
              {CATEGORIES.map(c => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
            </select>
          </div>
          {/* Add custom niche */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <input
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
              placeholder="Ajouter une niche…"
              className="bg-transparent text-white text-sm outline-none w-40 placeholder:text-white/30"
            />
            <button
              onClick={handleAddCustom}
              disabled={!customInput.trim()}
              className="p-1 rounded bg-[#00d4ff]/20 hover:bg-[#00d4ff]/40 text-[#00d4ff] disabled:opacity-30 transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/3 border border-white/10 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 px-4 py-3 border-b border-white/10 text-xs font-semibold text-white/40 uppercase tracking-wider">
            <button className="text-left flex items-center" onClick={() => handleSort('label')}>
              Niche <SortIcon col="label" />
            </button>
            <button className="text-left flex items-center" onClick={() => handleSort('demandScore')}>
              Demande <SortIcon col="demandScore" />
            </button>
            <button className="text-left flex items-center" onClick={() => handleSort('competitionScore')}>
              Concurrence <SortIcon col="competitionScore" />
            </button>
            <button className="text-left flex items-center" onClick={() => handleSort('opportunityScore')}>
              Opportunité <SortIcon col="opportunityScore" />
            </button>
            <span className="text-right">Listings</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            <AnimatePresence mode="popLayout">
              {displayed.map((niche) => {
                const r = results[niche.keyword];
                const isLoading = loadingSet.has(niche.keyword);
                const demColor = r ? scoreColor(r.demandScore) : null;
                const compColor = r ? scoreColor(r.competitionScore, true) : null;
                const oppColor = r ? scoreColor(r.opportunityScore) : null;

                return (
                  <motion.div
                    key={niche.keyword}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 px-4 py-3.5 hover:bg-white/3 transition-colors items-center"
                  >
                    {/* Niche name */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium truncate">{niche.label}</span>
                          {r && r.demandScore >= 75 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 flex-shrink-0">
                              <Flame size={9} /> Trending
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-white/30 truncate block mt-0.5">{niche.category}</span>
                      </div>
                    </div>

                    {/* Demand */}
                    <div>
                      {isLoading || !r ? (
                        <div className="h-3 w-24 bg-white/10 rounded-full animate-pulse" />
                      ) : r.error ? (
                        <span className="text-xs text-white/20">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden max-w-[80px]">
                            <div className={`h-full rounded-full ${demColor!.bar}`} style={{ width: `${r.demandScore}%` }} />
                          </div>
                          <span className={`text-xs font-semibold w-7 text-right ${demColor!.text}`}>{r.demandScore}</span>
                        </div>
                      )}
                    </div>

                    {/* Competition */}
                    <div>
                      {isLoading || !r ? (
                        <div className="h-3 w-24 bg-white/10 rounded-full animate-pulse" />
                      ) : r.error ? (
                        <span className="text-xs text-white/20">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden max-w-[80px]">
                            <div className={`h-full rounded-full ${compColor!.bar}`} style={{ width: `${r.competitionScore}%` }} />
                          </div>
                          <span className={`text-xs font-semibold w-7 text-right ${compColor!.text}`}>{r.competitionScore}</span>
                        </div>
                      )}
                    </div>

                    {/* Opportunity score */}
                    <div>
                      {isLoading || !r ? (
                        <div className="h-6 w-16 bg-white/10 rounded-lg animate-pulse" />
                      ) : r.error ? (
                        <span className="text-xs text-white/20">—</span>
                      ) : (
                        <span className={`inline-block text-sm font-bold px-2.5 py-0.5 rounded-lg border ${oppColor!.badge}`}>
                          {r.opportunityScore}
                        </span>
                      )}
                    </div>

                    {/* Listings count */}
                    <div className="text-right">
                      {isLoading || !r ? (
                        <div className="h-4 w-12 bg-white/10 rounded animate-pulse ml-auto" />
                      ) : (
                        <span className="text-xs text-white/40">{formatCount(r?.competitionCount ?? null)}</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {displayed.length === 0 && (
              <div className="px-4 py-12 text-center text-white/30 text-sm">
                Aucune niche trouvée pour ces filtres
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/30">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Score élevé = favorable</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Score moyen = prudence</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Score faible = défavorable</span>
          <span>Concurrence : moins c'est mieux · Demande : plus c'est mieux · Données Etsy live</span>
        </div>
      </div>
    </div>
  );
}
