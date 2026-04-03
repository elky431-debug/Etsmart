'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Search, ChevronUp, ChevronDown,
  Flame, TrendingUp, Zap, Filter, Plus, X,
} from 'lucide-react';

// ─── Niche catalogue ─────────────────────────────────────────────────────────
interface NicheEntry {
  keyword: string;
  label: string;
  category: string;
}

const NICHES: NicheEntry[] = [
  // ── 10 premières : 1 par catégorie (visible en plan gratuit) ──────────────
  { keyword: 'printable wall art digital download', label: 'Art mural imprimable', category: 'Digital' },
  { keyword: 'macrame wall hanging boho', label: 'Macramé mural bohème', category: 'Décoration' },
  { keyword: 'custom pet portrait painting', label: 'Portrait animal de compagnie', category: 'Art & Prints' },
  { keyword: 'personalized baby blanket name', label: 'Couverture bébé personnalisée', category: 'Bébé & Enfants' },
  { keyword: 'soy candle scented luxury', label: 'Bougie soja luxe', category: 'Bougies & Bain' },
  { keyword: 'personalized canvas tote bag', label: 'Tote bag toile personnalisé', category: 'Mode' },
  { keyword: 'gaming desk mat xxl custom', label: 'Tapis bureau gaming XXL', category: 'Gaming & Anime' },
  { keyword: 'aesthetic washi tape set', label: 'Set washi tape esthétique', category: 'Papeterie' },
  { keyword: 'minimalist gold necklace', label: 'Collier minimaliste doré', category: 'Bijoux' },
  { keyword: 'personalized wedding favor tag', label: 'Tag cadeau invité mariage', category: 'Mariage' },
  // ── Suite ──────────────────────────────────────────────────────────────────
  // Bijoux & Accessoires
  { keyword: 'personalized name necklace', label: 'Collier prénom personnalisé', category: 'Bijoux' },
  { keyword: 'birthstone ring silver', label: 'Bague pierre de naissance', category: 'Bijoux' },
  { keyword: 'celestial moon jewelry', label: 'Bijoux lune céleste', category: 'Bijoux' },
  { keyword: 'dainty layering bracelet', label: 'Bracelet superposable délicat', category: 'Bijoux' },
  { keyword: 'crystal gemstone jewelry handmade', label: 'Bijoux cristaux fait main', category: 'Bijoux' },
  { keyword: 'custom initial charm bracelet', label: 'Bracelet initiale personnalisé', category: 'Bijoux' },
  { keyword: 'pearl earrings handmade', label: "Boucles d'oreilles perles", category: 'Bijoux' },
  // Décoration Maison
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
  { keyword: 'digital planner goodnotes ipad', label: 'Agenda numérique GoodNotes', category: 'Digital' },
  { keyword: 'canva instagram template bundle', label: 'Templates Instagram Canva', category: 'Digital' },
  { keyword: 'svg cut file cricut silhouette', label: 'Fichier SVG Cricut', category: 'Digital' },
  { keyword: 'crochet pattern pdf beginner', label: 'Patron crochet PDF', category: 'Digital' },
  { keyword: 'wedding invitation digital editable', label: 'Invitation mariage digital', category: 'Digital' },
  { keyword: 'notion template productivity', label: 'Template Notion productivité', category: 'Digital' },
  { keyword: 'budget planner spreadsheet excel', label: 'Planificateur budget Excel', category: 'Digital' },
  { keyword: 'watercolor clipart bundle png', label: 'Clipart aquarelle bundle', category: 'Digital' },
  // Mariage & Événements
  { keyword: 'bridal shower gift personalized', label: 'Cadeau EVJF personnalisé', category: 'Mariage' },
  { keyword: 'wedding sign wood calligraphy', label: 'Panneau mariage calligraphie', category: 'Mariage' },
  { keyword: 'bachelorette party decoration', label: 'Décoration bachelorette', category: 'Mariage' },
  { keyword: 'wedding cake topper acrylic', label: 'Topper gâteau mariage', category: 'Mariage' },
  { keyword: 'custom wedding map art print', label: 'Carte mariage illustrée', category: 'Mariage' },
  // Bébé & Enfants
  { keyword: 'nursery wall art animals', label: 'Décoration chambre bébé', category: 'Bébé & Enfants' },
  { keyword: 'wooden name puzzle baby toy', label: 'Puzzle prénom bois', category: 'Bébé & Enfants' },
  { keyword: 'montessori toy wooden toddler', label: 'Jouet Montessori bois', category: 'Bébé & Enfants' },
  { keyword: 'baby milestone cards printable', label: 'Cartes étapes bébé', category: 'Bébé & Enfants' },
  { keyword: 'custom children book personalized', label: 'Livre enfant personnalisé', category: 'Bébé & Enfants' },
  // Art & Impressions
  { keyword: 'watercolor family portrait custom', label: 'Portrait famille aquarelle', category: 'Art & Prints' },
  { keyword: 'birth poster custom name stars', label: 'Affiche naissance personnalisée', category: 'Art & Prints' },
  { keyword: 'city map art print minimal', label: 'Carte ville art minimal', category: 'Art & Prints' },
  { keyword: 'botanical art print vintage', label: 'Impression botanique vintage', category: 'Art & Prints' },
  { keyword: 'abstract canvas wall art large', label: 'Toile art abstrait grande', category: 'Art & Prints' },
  // Bougies & Bien-être
  { keyword: 'crystal candle gemstone healing', label: 'Bougie cristaux guérison', category: 'Bougies & Bain' },
  { keyword: 'bath bomb gift set handmade', label: 'Set bombes de bain', category: 'Bougies & Bain' },
  { keyword: 'natural handmade soap bar', label: 'Savon artisanal naturel', category: 'Bougies & Bain' },
  { keyword: 'wax melt scented luxury', label: 'Fondant cire parfumé', category: 'Bougies & Bain' },
  { keyword: 'reed diffuser luxury home', label: 'Diffuseur roseau maison', category: 'Bougies & Bain' },
  // Vêtements & Accessoires
  { keyword: 'custom embroidered baseball hat', label: 'Casquette brodée personnalisée', category: 'Mode' },
  { keyword: 'custom phone case iphone samsung', label: 'Coque téléphone custom', category: 'Mode' },
  { keyword: 'enamel pin aesthetic cute', label: 'Pin émail esthétique', category: 'Mode' },
  { keyword: 'handmade crochet cardigan women', label: 'Cardigan crochet fait main', category: 'Mode' },
  // Gaming & Anime
  { keyword: 'anime wall art poster print', label: 'Affiche anime décoration', category: 'Gaming & Anime' },
  { keyword: 'gamer room decor neon light', label: 'Décoration chambre gamer', category: 'Gaming & Anime' },
  { keyword: 'custom gaming mousepad large', label: 'Tapis souris gaming custom', category: 'Gaming & Anime' },
  { keyword: 'anime figurine handmade resin', label: 'Figurine anime résine', category: 'Gaming & Anime' },
  // Papeterie
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

// ─── Types ───────────────────────────────────────────────────────────────────
interface NicheResult {
  keyword: string;
  competitionCount: number | null;
  competitionScore: number;
  trendsScore: number | null;
  demandScore: number;
  opportunityScore: number;
}

// ─── Données statiques — plan gratuit (10 premières niches) ──────────────────
const STATIC_PREVIEW: Record<string, NicheResult> = {
  'printable wall art digital download': { keyword: 'printable wall art digital download', competitionCount: 248000, competitionScore: 78, trendsScore: 91, demandScore: 82, opportunityScore: 54 },
  'macrame wall hanging boho':           { keyword: 'macrame wall hanging boho',           competitionCount: 87000,  competitionScore: 57, trendsScore: 72, demandScore: 67, opportunityScore: 63 },
  'custom pet portrait painting':        { keyword: 'custom pet portrait painting',        competitionCount: 124000, competitionScore: 51, trendsScore: 85, demandScore: 78, opportunityScore: 71 },
  'personalized baby blanket name':      { keyword: 'personalized baby blanket name',      competitionCount: 73000,  competitionScore: 47, trendsScore: 68, demandScore: 71, opportunityScore: 69 },
  'soy candle scented luxury':           { keyword: 'soy candle scented luxury',           competitionCount: 318000, competitionScore: 82, trendsScore: 79, demandScore: 85, opportunityScore: 47 },
  'personalized canvas tote bag':        { keyword: 'personalized canvas tote bag',        competitionCount: 195000, competitionScore: 70, trendsScore: 58, demandScore: 63, opportunityScore: 45 },
  'gaming desk mat xxl custom':          { keyword: 'gaming desk mat xxl custom',          competitionCount: 21000,  competitionScore: 31, trendsScore: 74, demandScore: 58, opportunityScore: 80 },
  'aesthetic washi tape set':            { keyword: 'aesthetic washi tape set',            competitionCount: 52000,  competitionScore: 43, trendsScore: 65, demandScore: 61, opportunityScore: 67 },
  'minimalist gold necklace':            { keyword: 'minimalist gold necklace',            competitionCount: 431000, competitionScore: 86, trendsScore: 82, demandScore: 76, opportunityScore: 37 },
  'personalized wedding favor tag':      { keyword: 'personalized wedding favor tag',      competitionCount: 64000,  competitionScore: 40, trendsScore: 77, demandScore: 73, opportunityScore: 76 },
};

// ─── Données statiques — tous les plans payants (50+ niches) ─────────────────
const STATIC_ALL: Record<string, NicheResult> = {
  ...STATIC_PREVIEW,
  // Bijoux
  'personalized name necklace':        { keyword: 'personalized name necklace',        competitionCount: 130000, competitionScore: 72, trendsScore: 80, demandScore: 80, opportunityScore: 57 },
  'birthstone ring silver':            { keyword: 'birthstone ring silver',            competitionCount: 95000,  competitionScore: 62, trendsScore: 65, demandScore: 65, opportunityScore: 55 },
  'celestial moon jewelry':            { keyword: 'celestial moon jewelry',            competitionCount: 75000,  competitionScore: 55, trendsScore: 72, demandScore: 72, opportunityScore: 65 },
  'dainty layering bracelet':          { keyword: 'dainty layering bracelet',          competitionCount: 67000,  competitionScore: 52, trendsScore: 60, demandScore: 60, opportunityScore: 61 },
  'crystal gemstone jewelry handmade': { keyword: 'crystal gemstone jewelry handmade', competitionCount: 88000,  competitionScore: 59, trendsScore: 74, demandScore: 74, opportunityScore: 60 },
  'custom initial charm bracelet':     { keyword: 'custom initial charm bracelet',     competitionCount: 72000,  competitionScore: 54, trendsScore: 66, demandScore: 66, opportunityScore: 63 },
  'pearl earrings handmade':           { keyword: 'pearl earrings handmade',           competitionCount: 110000, competitionScore: 68, trendsScore: 77, demandScore: 77, opportunityScore: 54 },
  // Décoration
  'custom neon sign led':              { keyword: 'custom neon sign led',              competitionCount: 165000, competitionScore: 75, trendsScore: 84, demandScore: 84, opportunityScore: 52 },
  'suspension lamp handmade wood':     { keyword: 'suspension lamp handmade wood',     competitionCount: 42000,  competitionScore: 39, trendsScore: 55, demandScore: 55, opportunityScore: 70 },
  'ceramic planter pot handmade':      { keyword: 'ceramic planter pot handmade',      competitionCount: 98000,  competitionScore: 64, trendsScore: 71, demandScore: 71, opportunityScore: 53 },
  'pressed flower art framed':         { keyword: 'pressed flower art framed',         competitionCount: 58000,  competitionScore: 46, trendsScore: 62, demandScore: 62, opportunityScore: 69 },
  'boho wall art print':               { keyword: 'boho wall art print',               competitionCount: 280000, competitionScore: 81, trendsScore: 79, demandScore: 79, opportunityScore: 44 },
  'wax seal stamp kit vintage':        { keyword: 'wax seal stamp kit vintage',        competitionCount: 28000,  competitionScore: 33, trendsScore: 58, demandScore: 58, opportunityScore: 75 },
  'terrarium glass geometric':         { keyword: 'terrarium glass geometric',         competitionCount: 35000,  competitionScore: 36, trendsScore: 54, demandScore: 54, opportunityScore: 71 },
  'linen cushion cover natural':       { keyword: 'linen cushion cover natural',       competitionCount: 79000,  competitionScore: 57, trendsScore: 63, demandScore: 63, opportunityScore: 58 },
  'wooden wall clock rustic':          { keyword: 'wooden wall clock rustic',          competitionCount: 105000, competitionScore: 66, trendsScore: 67, demandScore: 67, opportunityScore: 52 },
  // Digital
  'digital planner goodnotes ipad':    { keyword: 'digital planner goodnotes ipad',    competitionCount: 61000,  competitionScore: 47, trendsScore: 83, demandScore: 83, opportunityScore: 73 },
  'canva instagram template bundle':   { keyword: 'canva instagram template bundle',   competitionCount: 142000, competitionScore: 71, trendsScore: 85, demandScore: 85, opportunityScore: 55 },
  'svg cut file cricut silhouette':    { keyword: 'svg cut file cricut silhouette',    competitionCount: 320000, competitionScore: 84, trendsScore: 88, demandScore: 88, opportunityScore: 43 },
  'crochet pattern pdf beginner':      { keyword: 'crochet pattern pdf beginner',      competitionCount: 55000,  competitionScore: 44, trendsScore: 76, demandScore: 76, opportunityScore: 72 },
  'wedding invitation digital editable':{ keyword: 'wedding invitation digital editable', competitionCount: 187000, competitionScore: 74, trendsScore: 81, demandScore: 81, opportunityScore: 51 },
  'notion template productivity':      { keyword: 'notion template productivity',      competitionCount: 18000,  competitionScore: 28, trendsScore: 79, demandScore: 79, opportunityScore: 83 },
  'budget planner spreadsheet excel':  { keyword: 'budget planner spreadsheet excel',  competitionCount: 24000,  competitionScore: 32, trendsScore: 75, demandScore: 75, opportunityScore: 79 },
  'watercolor clipart bundle png':     { keyword: 'watercolor clipart bundle png',     competitionCount: 68000,  competitionScore: 52, trendsScore: 70, demandScore: 70, opportunityScore: 66 },
  // Mariage
  'bridal shower gift personalized':   { keyword: 'bridal shower gift personalized',   competitionCount: 93000,  competitionScore: 62, trendsScore: 78, demandScore: 78, opportunityScore: 60 },
  'wedding sign wood calligraphy':     { keyword: 'wedding sign wood calligraphy',     competitionCount: 128000, competitionScore: 70, trendsScore: 80, demandScore: 80, opportunityScore: 54 },
  'bachelorette party decoration':     { keyword: 'bachelorette party decoration',     competitionCount: 107000, competitionScore: 67, trendsScore: 82, demandScore: 82, opportunityScore: 57 },
  'wedding cake topper acrylic':       { keyword: 'wedding cake topper acrylic',       competitionCount: 81000,  competitionScore: 58, trendsScore: 68, demandScore: 68, opportunityScore: 62 },
  'custom wedding map art print':      { keyword: 'custom wedding map art print',      competitionCount: 38000,  competitionScore: 38, trendsScore: 73, demandScore: 73, opportunityScore: 74 },
  // Bébé & Enfants
  'nursery wall art animals':          { keyword: 'nursery wall art animals',          competitionCount: 86000,  competitionScore: 58, trendsScore: 73, demandScore: 73, opportunityScore: 62 },
  'wooden name puzzle baby toy':       { keyword: 'wooden name puzzle baby toy',       competitionCount: 44000,  competitionScore: 40, trendsScore: 75, demandScore: 75, opportunityScore: 73 },
  'montessori toy wooden toddler':     { keyword: 'montessori toy wooden toddler',     competitionCount: 29000,  competitionScore: 34, trendsScore: 82, demandScore: 82, opportunityScore: 79 },
  'baby milestone cards printable':    { keyword: 'baby milestone cards printable',    competitionCount: 22000,  competitionScore: 31, trendsScore: 71, demandScore: 71, opportunityScore: 78 },
  'custom children book personalized': { keyword: 'custom children book personalized', competitionCount: 31000,  competitionScore: 35, trendsScore: 76, demandScore: 76, opportunityScore: 77 },
  // Art & Prints
  'watercolor family portrait custom': { keyword: 'watercolor family portrait custom', competitionCount: 65000,  competitionScore: 50, trendsScore: 77, demandScore: 77, opportunityScore: 70 },
  'birth poster custom name stars':    { keyword: 'birth poster custom name stars',    competitionCount: 47000,  competitionScore: 41, trendsScore: 74, demandScore: 74, opportunityScore: 73 },
  'city map art print minimal':        { keyword: 'city map art print minimal',        competitionCount: 91000,  competitionScore: 61, trendsScore: 68, demandScore: 68, opportunityScore: 57 },
  'botanical art print vintage':       { keyword: 'botanical art print vintage',       competitionCount: 117000, competitionScore: 69, trendsScore: 75, demandScore: 75, opportunityScore: 53 },
  'abstract canvas wall art large':    { keyword: 'abstract canvas wall art large',    competitionCount: 155000, competitionScore: 73, trendsScore: 80, demandScore: 80, opportunityScore: 51 },
  // Bougies & Bain
  'crystal candle gemstone healing':   { keyword: 'crystal candle gemstone healing',   competitionCount: 42000,  competitionScore: 39, trendsScore: 74, demandScore: 74, opportunityScore: 73 },
  'bath bomb gift set handmade':       { keyword: 'bath bomb gift set handmade',       competitionCount: 76000,  competitionScore: 56, trendsScore: 78, demandScore: 78, opportunityScore: 65 },
  'natural handmade soap bar':         { keyword: 'natural handmade soap bar',         competitionCount: 143000, competitionScore: 72, trendsScore: 80, demandScore: 80, opportunityScore: 54 },
  'wax melt scented luxury':           { keyword: 'wax melt scented luxury',           competitionCount: 89000,  competitionScore: 60, trendsScore: 69, demandScore: 69, opportunityScore: 58 },
  'reed diffuser luxury home':         { keyword: 'reed diffuser luxury home',         competitionCount: 48000,  competitionScore: 42, trendsScore: 63, demandScore: 63, opportunityScore: 67 },
  // Mode
  'custom embroidered baseball hat':   { keyword: 'custom embroidered baseball hat',   competitionCount: 85000,  competitionScore: 58, trendsScore: 76, demandScore: 76, opportunityScore: 63 },
  'custom phone case iphone samsung':  { keyword: 'custom phone case iphone samsung',  competitionCount: 425000, competitionScore: 87, trendsScore: 85, demandScore: 85, opportunityScore: 36 },
  'enamel pin aesthetic cute':         { keyword: 'enamel pin aesthetic cute',         competitionCount: 95000,  competitionScore: 63, trendsScore: 78, demandScore: 78, opportunityScore: 58 },
  'handmade crochet cardigan women':   { keyword: 'handmade crochet cardigan women',   competitionCount: 26000,  competitionScore: 33, trendsScore: 72, demandScore: 72, opportunityScore: 77 },
  // Gaming & Anime
  'anime wall art poster print':       { keyword: 'anime wall art poster print',       competitionCount: 78000,  competitionScore: 57, trendsScore: 80, demandScore: 80, opportunityScore: 66 },
  'gamer room decor neon light':       { keyword: 'gamer room decor neon light',       competitionCount: 62000,  competitionScore: 48, trendsScore: 79, demandScore: 79, opportunityScore: 70 },
  'custom gaming mousepad large':      { keyword: 'custom gaming mousepad large',      competitionCount: 31000,  competitionScore: 35, trendsScore: 75, demandScore: 75, opportunityScore: 77 },
  'anime figurine handmade resin':     { keyword: 'anime figurine handmade resin',     competitionCount: 53000,  competitionScore: 44, trendsScore: 81, demandScore: 81, opportunityScore: 73 },
  // Papeterie
  'cute kawaii sticker sheet':         { keyword: 'cute kawaii sticker sheet',         competitionCount: 97000,  competitionScore: 64, trendsScore: 80, demandScore: 80, opportunityScore: 57 },
  'custom notebook journal personalized':{ keyword: 'custom notebook journal personalized', competitionCount: 72000, competitionScore: 54, trendsScore: 68, demandScore: 68, opportunityScore: 63 },
  'wildflower seed paper card':        { keyword: 'wildflower seed paper card',        competitionCount: 19000,  competitionScore: 29, trendsScore: 61, demandScore: 61, opportunityScore: 75 },
  // Animaux
  'custom dog tag engraved':           { keyword: 'custom dog tag engraved',           competitionCount: 115000, competitionScore: 68, trendsScore: 76, demandScore: 76, opportunityScore: 54 },
  'personalized dog bandana fabric':   { keyword: 'personalized dog bandana fabric',   competitionCount: 45000,  competitionScore: 41, trendsScore: 74, demandScore: 74, opportunityScore: 73 },
  'pet memorial gift custom portrait': { keyword: 'pet memorial gift custom portrait', competitionCount: 28000,  competitionScore: 33, trendsScore: 77, demandScore: 77, opportunityScore: 78 },
  'cat collar breakaway personalized': { keyword: 'cat collar breakaway personalized', competitionCount: 23000,  competitionScore: 31, trendsScore: 63, demandScore: 63, opportunityScore: 74 },
  // Loisirs créatifs
  'resin art mold silicone kit':       { keyword: 'resin art mold silicone kit',       competitionCount: 35000,  competitionScore: 36, trendsScore: 76, demandScore: 76, opportunityScore: 77 },
  'embroidery kit beginner floral':    { keyword: 'embroidery kit beginner floral',    competitionCount: 52000,  competitionScore: 43, trendsScore: 79, demandScore: 79, opportunityScore: 75 },
  'paint by numbers custom photo':     { keyword: 'paint by numbers custom photo',     competitionCount: 41000,  competitionScore: 39, trendsScore: 78, demandScore: 78, opportunityScore: 77 },
};

const CATEGORIES = ['Toutes', ...Array.from(new Set(NICHES.map(n => n.category)))];

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

type SortKey = 'opportunityScore' | 'demandScore' | 'competitionScore' | 'label';
type SortDir = 'asc' | 'desc';

// ─── Component ───────────────────────────────────────────────────────────────
export default function DashboardNicheResearch({ isFreeUser = false, onUpgrade }: { isFreeUser?: boolean; onUpgrade?: () => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('opportunityScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterCategory, setFilterCategory] = useState('Toutes');
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [customNiches, setCustomNiches] = useState<NicheEntry[]>([]);

  const dataMap = isFreeUser ? STATIC_PREVIEW : STATIC_ALL;
  const allNiches = [...NICHES, ...customNiches];

  const handleAddCustom = () => {
    const kw = customInput.trim().toLowerCase();
    if (!kw || allNiches.some(n => n.keyword === kw)) { setCustomInput(''); return; }
    setCustomNiches(prev => [...prev, { keyword: kw, label: kw, category: 'Custom' }]);
    setCustomInput('');
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'label' ? 'asc' : 'desc'); }
  };

  const displayed = allNiches
    .filter(n => {
      if (filterCategory !== 'Toutes' && n.category !== filterCategory) return false;
      if (search && !n.label.toLowerCase().includes(search.toLowerCase()) && !n.keyword.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const ra = dataMap[a.keyword];
      const rb = dataMap[b.keyword];
      if (sortKey === 'label') {
        return sortDir === 'asc' ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label);
      }
      const va = ra?.[sortKey] ?? -1;
      const vb = rb?.[sortKey] ?? -1;
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  // Summary stats
  const scoredData = Object.values(dataMap).filter(r => r.opportunityScore > 0);
  const avgOpportunity = scoredData.length ? Math.round(scoredData.reduce((s, r) => s + r.opportunityScore, 0) / scoredData.length) : null;
  const topOpportunities = scoredData.filter(r => r.opportunityScore >= 65).length;
  const trending = scoredData.filter(r => r.demandScore >= 75).length;

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
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Recherche de Niche</h1>
              <p className="text-white/50 text-sm mt-0.5">Analyse concurrence + demande — {isFreeUser ? '10 niches' : `${Object.keys(dataMap).length} niches`} disponibles</p>
            </div>
          </div>
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
          {!isFreeUser && (
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
          )}
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
            <span className="text-right">Listings Etsy</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            <AnimatePresence mode="popLayout">
              {(isFreeUser ? displayed.slice(0, 10) : displayed).map((niche) => {
                const r = dataMap[niche.keyword] ?? null;
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
                      {!r ? (
                        <span className="text-xs text-white/20">—</span>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden max-w-[80px]">
                              <div className={`h-full rounded-full ${demColor!.bar}`} style={{ width: `${r.demandScore}%` }} />
                            </div>
                            <span className={`text-xs font-semibold w-7 text-right ${demColor!.text}`}>{r.demandScore}</span>
                          </div>
                          {r.trendsScore !== null && (
                            <span className="text-[10px] text-white/30 mt-0.5 block">Trends: {r.trendsScore}/100</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Competition */}
                    <div>
                      {!r ? (
                        <span className="text-xs text-white/20">—</span>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden max-w-[80px]">
                              <div className={`h-full rounded-full ${compColor!.bar}`} style={{ width: `${r.competitionScore}%` }} />
                            </div>
                            <span className={`text-xs font-semibold w-7 text-right ${compColor!.text}`}>{r.competitionScore}</span>
                          </div>
                          {r.competitionCount !== null && (
                            <span className="text-[10px] text-white/30 mt-0.5 block">{formatCount(r.competitionCount)} listings</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Opportunity score */}
                    <div>
                      {!r ? (
                        <span className="text-xs text-white/20">—</span>
                      ) : (
                        <span className={`inline-block text-sm font-bold px-2.5 py-0.5 rounded-lg border ${oppColor!.badge}`}>
                          {r.opportunityScore}
                        </span>
                      )}
                    </div>

                    {/* Listing count */}
                    <div className="text-right">
                      <span className="text-xs text-white/40">{formatCount(r?.competitionCount ?? null)}</span>
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

          {/* Free tier lock */}
          {isFreeUser && displayed.length > 0 && (
            <div className="relative">
              {/* Blurred preview */}
              <div className="divide-y divide-white/5 blur-sm select-none pointer-events-none opacity-50">
                {displayed.slice(10, 14).map((niche) => (
                  <div key={niche.keyword} className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 px-4 py-3.5 items-center">
                    <div><span className="text-white text-sm font-medium">{niche.label}</span></div>
                    <div><div className="h-1.5 w-20 bg-white/20 rounded-full" /></div>
                    <div><div className="h-1.5 w-20 bg-white/20 rounded-full" /></div>
                    <div><div className="h-6 w-10 bg-white/20 rounded-lg" /></div>
                    <div><span className="text-xs text-white/40">—</span></div>
                  </div>
                ))}
              </div>
              {/* Lock overlay */}
              <div className="border-t border-white/10 px-5 py-4 flex items-center justify-between gap-4 bg-[#00d4ff]/3">
                <div className="flex items-center gap-2 text-white/50 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00d4ff] flex-shrink-0"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span>+{Math.max(0, NICHES.length - 10)} niches supplémentaires avec un abonnement payant</span>
                </div>
                <button onClick={onUpgrade} className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                  Débloquer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/30">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Score élevé = favorable</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Score moyen = prudence</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Score faible = défavorable</span>
          <span>Demande = volume de recherche · Concurrence = listings indexés · Opportunité = score composite</span>
        </div>
      </div>
    </div>
  );
}
