'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Store,
  Home,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Package,
  Search,
  Plus,
  X,
  ExternalLink,
  Calendar,
  MapPin,
  DollarSign,
  Truck,
  Image as ImageIcon,
  Clock,
  Link2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

// Couleurs pour « Créer une boutique »
const SHOP_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#dc2626',
  '#f97316', '#22c55e', '#14b8a6', '#4f46e5',
];

type Transaction = {
  id: string;
  shopId: string;
  date: string;
  status: string;
  label: string;
  destination: string;
  amountPaid: number;
  productCost: number;
  platformFees: number;
  profit: number;
  country: string;
  tracking: string;
};

const STORAGE_KEY_SHOPS = 'etsmart_store_manager_shops';
const STORAGE_KEY_PRODUCTS = 'etsmart_store_manager_products';
const STORAGE_KEY_TRANSACTIONS = 'etsmart_store_manager_transactions';
const STORAGE_KEY_SELECTED_SHOP = 'etsmart_store_manager_selected_shop_id';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

// Données mock initiales
// On ne met plus de boutique ni de produits par défaut : l'utilisateur doit tout créer lui-même.
const INITIAL_SHOPS: { id: string; name: string; color?: string }[] = [];
const INITIAL_PRODUCTS: Product[] = [];

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
/** Libellés axe X du graphique annuel : janvier → décembre (année civile). */
const ANNUAL_CHART_MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
// Frais Etsy (estimés) d'après la grille affichée par Etsy.
const ETSY_TRANSACTION_RATE = 0.065;
const ETSY_PAYMENT_RATE = 0.04;
const ETSY_PAYMENT_FIXED = 0.3;
const ETSY_REGULATORY_RATE = 0.0047;

function calculateEtsyFees(amountPaid: number) {
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return {
      transactionFee: 0,
      paymentFee: 0,
      regulatoryFee: 0,
      totalFees: 0,
      netAfterEtsy: 0,
    };
  }
  const transactionFee = amountPaid * ETSY_TRANSACTION_RATE;
  const paymentFee = amountPaid * ETSY_PAYMENT_RATE + ETSY_PAYMENT_FIXED;
  const regulatoryFee = amountPaid * ETSY_REGULATORY_RATE;
  const totalFees = transactionFee + paymentFee + regulatoryFee;
  const netAfterEtsy = amountPaid - totalFees;
  return {
    transactionFee: Number(transactionFee.toFixed(2)),
    paymentFee: Number(paymentFee.toFixed(2)),
    regulatoryFee: Number(regulatoryFee.toFixed(2)),
    totalFees: Number(totalFees.toFixed(2)),
    netAfterEtsy: Number(netAfterEtsy.toFixed(2)),
  };
}

// Liste des pays (noms en français, ordre alphabétique)
const COUNTRIES = [
  'Afghanistan', 'Afrique du Sud', 'Albanie', 'Algérie', 'Allemagne', 'Andorre', 'Angola', 'Antigua-et-Barbuda',
  'Arabie saoudite', 'Argentine', 'Arménie', 'Australie', 'Autriche', 'Azerbaïdjan', 'Bahamas', 'Bahreïn',
  'Bangladesh', 'Barbade', 'Belgique', 'Belize', 'Bénin', 'Bhoutan', 'Biélorussie', 'Birmanie', 'Bolivie',
  'Bosnie-Herzégovine', 'Botswana', 'Brésil', 'Brunei', 'Bulgarie', 'Burkina Faso', 'Burundi', 'Cambodge',
  'Cameroun', 'Canada', 'Cap-Vert', 'Centrafrique', 'Chili', 'Chine', 'Chypre', 'Colombie', 'Comores',
  'Congo', 'Congo (RDC)', 'Corée du Nord', 'Corée du Sud', 'Costa Rica', 'Côte d\'Ivoire', 'Croatie', 'Cuba',
  'Danemark', 'Djibouti', 'Dominique', 'Égypte', 'Émirats arabes unis', 'Équateur', 'Érythrée', 'Espagne',
  'Estonie', 'États-Unis', 'Éthiopie', 'Fidji', 'Finlande', 'France', 'Gabon', 'Gambie', 'Géorgie', 'Ghana',
  'Grèce', 'Grenade', 'Guatemala', 'Guinée', 'Guinée-Bissau', 'Guinée équatoriale', 'Guyana', 'Haïti',
  'Honduras', 'Hongrie', 'Inde', 'Indonésie', 'Irak', 'Iran', 'Irlande', 'Islande', 'Israël', 'Italie',
  'Jamaïque', 'Japon', 'Jordanie', 'Kazakhstan', 'Kenya', 'Kirghizistan', 'Kiribati', 'Koweït', 'Laos',
  'Lesotho', 'Lettonie', 'Liban', 'Libéria', 'Libye', 'Liechtenstein', 'Lituanie', 'Luxembourg', 'Macédoine du Nord',
  'Madagascar', 'Malaisie', 'Malawi', 'Maldives', 'Mali', 'Malte', 'Maroc', 'Îles Marshall', 'Maurice',
  'Mauritanie', 'Mexique', 'Micronésie', 'Moldavie', 'Monaco', 'Mongolie', 'Monténégro', 'Mozambique',
  'Namibie', 'Nauru', 'Népal', 'Nicaragua', 'Niger', 'Nigeria', 'Norvège', 'Nouvelle-Zélande', 'Oman',
  'Ouganda', 'Ouzbékistan', 'Pakistan', 'Palaos', 'Palestine', 'Panama', 'Papouasie-Nouvelle-Guinée', 'Paraguay',
  'Pays-Bas', 'Pérou', 'Philippines', 'Pologne', 'Portugal', 'Qatar', 'République dominicaine', 'République tchèque',
  'Roumanie', 'Royaume-Uni', 'Russie', 'Rwanda', 'Saint-Kitts-et-Nevis', 'Saint-Marin', 'Saint-Vincent-et-les-Grenadines',
  'Sainte-Lucie', 'Îles Salomon', 'Salvador', 'Samoa', 'São Tomé-et-Príncipe', 'Sénégal', 'Serbie', 'Seychelles',
  'Sierra Leone', 'Singapour', 'Slovaquie', 'Slovénie', 'Somalie', 'Soudan', 'Soudan du Sud', 'Sri Lanka',
  'Suède', 'Suisse', 'Suriname', 'Syrie', 'Tadjikistan', 'Tanzanie', 'Tchad', 'Thaïlande', 'Timor oriental',
  'Togo', 'Tonga', 'Trinité-et-Tobago', 'Tunisie', 'Turkménistan', 'Turquie', 'Tuvalu', 'Ukraine', 'Uruguay',
  'Vanuatu', 'Vatican', 'Venezuela', 'Vietnam', 'Yémen', 'Zambie', 'Zimbabwe', 'Autre',
];

const COUNTRY_COLORS: Record<string, string> = { France: '#ef4444', 'États-Unis': '#22c55e', Belgique: '#3b82f6', Suisse: '#eab308', Allemagne: '#8b5cf6', 'Royaume-Uni': '#ec4899' };
function getCountryColor(country: string, index: number) {
  return COUNTRY_COLORS[country] || ['#14b8a6', '#f97316', '#6366f1', '#84cc16', '#ec4899', '#8b5cf6'][index % 6];
}

function KpiCard({
  title,
  value,
  sub,
  profit,
}: { title: string; value: string; sub?: string; profit?: boolean }) {
  return (
    <div className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/10 shadow-lg shadow-black/20 transition hover:border-white/15">
      <p className="text-xs text-white/50 uppercase tracking-wider font-medium">{title}</p>
      <p className={`text-2xl font-bold mt-2 tracking-tight ${profit ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-white/45 mt-1">{sub}</p>}
    </div>
  );
}

type Product = {
  id: string;
  /** Boutique propriétaire (obligatoire après migration). */
  shopId: string;
  name: string;
  description: string;
  image: string;
  supplierUrl?: string;
  supplierPrice: number;
  shippingCost: number;
  sellingPrice: number;
};

/** Anciens produits sans shopId : rattachés à la 1ʳᵉ boutique pour ne plus tout mélanger. */
function migrateProductsShopIds(
  list: Product[],
  shops: { id: string }[]
): Product[] {
  const fallback = shops[0]?.id ?? '';
  return list.map((p) => {
    const sid = (p as Product & { shopId?: string }).shopId;
    const ok = Boolean(sid && shops.some((s) => s.id === sid));
    return { ...p, shopId: ok ? sid! : fallback };
  });
}

/**
 * Sans schéma (https://), le navigateur traite le lien comme relatif au domaine du SaaS (ex. localhost).
 * Normalise les collages type www.aliexpress.com/... ou //aliexpress.com/...
 */
function normalizeExternalUrl(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  const t = String(raw).trim();
  if (!t) return undefined;
  const lower = t.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return undefined;
  }
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  return `https://${t}`;
}

function openExternalSupplierUrl(raw: string | undefined | null) {
  const href = normalizeExternalUrl(raw);
  if (href) window.open(href, '_blank', 'noopener,noreferrer');
}

function ProductThumb({
  src,
  sizeClass = 'h-9 w-9',
  iconClass = 'h-5 w-5 text-white/30',
}: {
  src?: string;
  sizeClass?: string;
  iconClass?: string;
}) {
  const [broken, setBroken] = useState(false);
  const ok = Boolean(src && /^https?:\/\//i.test(src) && !broken);
  return (
    <div
      className={`${sizeClass} shrink-0 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center overflow-hidden`}
    >
      {ok ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <ImageIcon className={iconClass} />
      )}
    </div>
  );
}

export function DashboardStoreManager() {
  const [shops, setShops] = useState<{ id: string; name: string; color?: string }[]>(() => {
    const stored = loadFromStorage<{ id: string; name: string; color?: string }[]>(STORAGE_KEY_SHOPS, INITIAL_SHOPS);
    // Migration: si l'ancienne boutique mock unique existe encore, on la retire pour forcer la création
    if (stored.length === 1 && stored[0].id === '1' && stored[0].name === 'MarbleMuseStore') {
      return [];
    }
    return stored;
  });
  const [products, setProducts] = useState<Product[]>(() => {
    const stored = loadFromStorage<Product[]>(STORAGE_KEY_PRODUCTS, INITIAL_PRODUCTS);
    // Migration: si les anciens produits mock avec prix à 0 existent encore, on les supprime au premier chargement
    if (stored.length && stored.every((p) => p.supplierPrice === 0 && p.shippingCost === 0 && p.sellingPrice === 0)) {
      return [];
    }
    const shopList = loadFromStorage<{ id: string }[]>(STORAGE_KEY_SHOPS, INITIAL_SHOPS);
    return migrateProductsShopIds(stored as unknown as Product[], shopList);
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const raw = loadFromStorage<Transaction[]>(STORAGE_KEY_TRANSACTIONS, []);
    const shopList = loadFromStorage<{ id: string }[]>(STORAGE_KEY_SHOPS, INITIAL_SHOPS);
    const firstId = shopList[0]?.id ?? '';
    return raw.map((t) => ({
      ...t,
      shopId: t.shopId && shopList.some((s) => s.id === t.shopId) ? t.shopId : t.shopId || firstId,
    }));
  });
  const [selectedShopId, setSelectedShopId] = useState<string | null>(() => {
    const storedShops = loadFromStorage<{ id: string; name: string; color?: string }[]>(STORAGE_KEY_SHOPS, INITIAL_SHOPS);
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SELECTED_SHOP) : null;
    if (savedId && storedShops.some((s) => s.id === savedId)) return savedId;
    // Ne pas sélectionner automatiquement une boutique : l'utilisateur doit choisir/créer
    return null;
  });

  // Persister boutiques, produits, transactions et boutique sélectionnée
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_SHOPS, JSON.stringify(shops));
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
      if (selectedShopId) localStorage.setItem(STORAGE_KEY_SELECTED_SHOP, selectedShopId);
    } catch (e) {
      console.warn('[StoreManager] Erreur sauvegarde localStorage', e);
    }
  }, [shops, products, transactions, selectedShopId]);

  /** Rattrapage : produits AliExpress déjà en localStorage sans image distante */
  const supplierImageBackfillRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (supplierImageBackfillRef.current) return;
    supplierImageBackfillRef.current = true;

    const run = async () => {
      let list: Product[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
        if (!raw) return;
        list = JSON.parse(raw) as Product[];
      } catch {
        return;
      }
      const needs = list.filter(
        (p) =>
          p.supplierUrl &&
          /aliexpress\.com|aliexpress\.us/i.test(p.supplierUrl) &&
          (!p.image || !/^https?:\/\//i.test(p.image) || p.image.includes('placeholder'))
      );
      if (needs.length === 0) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      for (const p of needs) {
        const url = normalizeExternalUrl(p.supplierUrl);
        if (!url) continue;
        try {
          const res = await fetch('/api/supplier-preview-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ url }),
          });
          const data = await res.json();
          if (data?.imageUrl) {
            setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, image: data.imageUrl } : x)));
          }
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    };

    void run();
  }, []);

  const [statsRange, setStatsRange] = useState<'7d' | '30d' | 'month' | 'all'>('30d');
  const [statsMonth, setStatsMonth] = useState(() => new Date().getMonth());
  const [statsYear, setStatsYear] = useState(() => new Date().getFullYear());
  /** Année affichée sur le graphique « Évolution annuelle » (indépendante du filtre KPI). */
  const [annualChartYear, setAnnualChartYear] = useState(() => new Date().getFullYear());
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<'all' | 'À envoyer' | 'À modifier' | 'Envoyé'>('all');
  const [editTransactionId, setEditTransactionId] = useState<string | null>(null);
  const [newTransactionModalOpen, setNewTransactionModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [createShopModalOpen, setCreateShopModalOpen] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopDescription, setNewShopDescription] = useState('');
  const [newShopColor, setNewShopColor] = useState(SHOP_COLORS[4]);
  const [createProductModalOpen, setCreateProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [newProductSupplierUrl, setNewProductSupplierUrl] = useState('');
  const [newProductSupplierPrice, setNewProductSupplierPrice] = useState('');
  const [newProductShippingCost, setNewProductShippingCost] = useState('');
  const [newProductSellingPrice, setNewProductSellingPrice] = useState('');
  const [newProductImageUrl, setNewProductImageUrl] = useState('');
  const [newProductAutoFillLoading, setNewProductAutoFillLoading] = useState(false);
  const [newProductAutoFillError, setNewProductAutoFillError] = useState('');
  // Formulaire nouvelle transaction
  const [newTxDate, setNewTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newTxStatus, setNewTxStatus] = useState('À envoyer');
  const [newTxAmountPaid, setNewTxAmountPaid] = useState('');
  const [newTxProductCost, setNewTxProductCost] = useState('');
  const [newTxPlatformFees, setNewTxPlatformFees] = useState('');
  const [newTxCountry, setNewTxCountry] = useState('');
  const [newTxCity, setNewTxCity] = useState('');
  const [newTxLabel, setNewTxLabel] = useState('');
  const [newTxTracking, setNewTxTracking] = useState('');
  const [editShopId, setEditShopId] = useState<string | null>(null);
  const [editShopName, setEditShopName] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countryFilter, setCountryFilter] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'calendar' | 'products'>('dashboard');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());

  const shop = shops.find((s) => s.id === selectedShopId);

  const filteredCountries = useMemo(
    () => (countryFilter.trim() ? COUNTRIES.filter((c) => c.toLowerCase().includes(countryFilter.trim().toLowerCase())) : COUNTRIES),
    [countryFilter]
  );

  /** Évite de garder des produits d’une autre boutique sélectionnés après changement de boutique */
  useEffect(() => {
    setSelectedProductIds([]);
    setProductSelectorOpen(false);
  }, [selectedShopId]);

  useEffect(() => {
    if (!countryDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [countryDropdownOpen]);

  useEffect(() => {
    const amountPaid = parseFloat(newTxAmountPaid.replace(',', '.'));
    if (Number.isNaN(amountPaid) || amountPaid <= 0) {
      setNewTxPlatformFees('');
      return;
    }
    const { totalFees } = calculateEtsyFees(amountPaid);
    setNewTxPlatformFees(totalFees.toFixed(2));
  }, [newTxAmountPaid]);

  const shopTransactions = useMemo(
    () => (selectedShopId ? transactions.filter((t) => t.shopId === selectedShopId) : []),
    [transactions, selectedShopId]
  );

  /** Produits de la boutique active uniquement */
  const shopProducts = useMemo(
    () => (selectedShopId ? products.filter((p) => p.shopId === selectedShopId) : []),
    [products, selectedShopId]
  );

  const statsTransactions = useMemo(() => {
    if (statsRange === 'month') {
      return shopTransactions.filter((t) => {
        const d = new Date(t.date);
        return !Number.isNaN(d.getTime()) && d.getMonth() === statsMonth && d.getFullYear() === statsYear;
      });
    }
    if (statsRange === 'all') return shopTransactions;
    const days = statsRange === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (days - 1));
    return shopTransactions.filter((t) => {
      const d = new Date(t.date);
      return !Number.isNaN(d.getTime()) && d >= cutoff;
    });
  }, [shopTransactions, statsRange, statsMonth, statsYear]);

  const prevStatsMonth = () => {
    if (statsMonth === 0) {
      setStatsMonth(11);
      setStatsYear((y) => y - 1);
      return;
    }
    setStatsMonth((m) => m - 1);
  };

  const nextStatsMonth = () => {
    if (statsMonth === 11) {
      setStatsMonth(0);
      setStatsYear((y) => y + 1);
      return;
    }
    setStatsMonth((m) => m + 1);
  };

  const salesByDate = useMemo(
    () =>
      shopTransactions.reduce<Record<string, { count: number; revenue: number }>>((acc, t) => {
        const d = t.date || '';
        if (!d) return acc;
        if (!acc[d]) acc[d] = { count: 0, revenue: 0 };
        acc[d].count += 1;
        acc[d].revenue += t.amountPaid;
        return acc;
      }, {}),
    [shopTransactions]
  );

  const kpi = useMemo(() => {
    const revenue = statsTransactions.reduce((s, t) => s + t.amountPaid, 0);
    const netAfterEtsy = statsTransactions.reduce((s, t) => s + (t.amountPaid - t.platformFees), 0);
    const netFinal = statsTransactions.reduce((s, t) => s + t.profit, 0);
    const orders = statsTransactions.length;
    return {
      revenue,
      netAfterEtsy,
      netFinal,
      avgBasket: orders > 0 ? revenue / orders : 0,
      orders,
      productsCount: orders,
    };
  }, [statsTransactions]);

  const annualData = useMemo(() => {
    const yTarget = annualChartYear;
    const buckets = ANNUAL_CHART_MONTH_LABELS.map((month) => ({ month, ca: 0, profit: 0 }));
    shopTransactions.forEach((t) => {
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== yTarget) return;
      const m = d.getMonth();
      if (m >= 0 && m < 12) {
        buckets[m].ca += t.amountPaid;
        buckets[m].profit += t.profit;
      }
    });
    return buckets;
  }, [shopTransactions, annualChartYear]);

  const ordersByCountry = useMemo(() => {
    const map: Record<string, number> = {};
    statsTransactions.forEach((t) => {
      const c = t.country || 'Autre';
      map[c] = (map[c] || 0) + 1;
    });
    return Object.entries(map).map(([name], i) => ({
      name,
      value: map[name],
      color: getCountryColor(name, i),
    }));
  }, [statsTransactions]);

  const topProducts = useMemo(() => [
    { id: '1', rank: 1, name: '1 pièce, pots de fleurs décorés de poupé', sales: 0, image: '/examples/placeholder-product.jpg' },
    { id: '2', rank: 2, name: 'Pot de fleur avec visage souriant', sales: 0, image: '/examples/placeholder-product.jpg' },
    { id: '3', rank: 3, name: 'visage de fille Pot de fleurs', sales: 0, image: '/examples/placeholder-product.jpg' },
  ], []);

  const filteredTransactions = statsTransactions.filter((t) => {
    const matchesSearch =
      !transactionSearch ||
      t.label.toLowerCase().includes(transactionSearch.toLowerCase()) ||
      t.destination.toLowerCase().includes(transactionSearch.toLowerCase());
    const matchesStatus = transactionStatusFilter === 'all' || t.status === transactionStatusFilter;
    return matchesSearch && matchesStatus;
  });
  const filteredProducts = shopProducts.filter(
    (p) => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleAutoFillFromSupplierUrl = async () => {
    const normalized = normalizeExternalUrl(newProductSupplierUrl);
    if (!normalized) {
      setNewProductAutoFillError('Ajoute un lien fournisseur valide (AliExpress/Alibaba).');
      return;
    }
    setNewProductAutoFillError('');
    setNewProductAutoFillLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setNewProductAutoFillError('Session expirée. Reconnecte-toi.');
        return;
      }
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 16_000);
      let res: Response;
      try {
        res = await fetch('/api/parse-product-quick', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: normalized }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.product) {
        setNewProductAutoFillError(
          data?.error || data?.message || 'Impossible de récupérer automatiquement les données fournisseur.'
        );
        return;
      }
      const parsedProduct = data.product as {
        title?: string;
        description?: string;
        price?: number;
        images?: string[];
      };
      if (!newProductName.trim() && parsedProduct.title) {
        setNewProductName(String(parsedProduct.title));
      }
      if ((!newProductDescription.trim() || newProductDescription === '-') && parsedProduct.description) {
        setNewProductDescription(String(parsedProduct.description));
      }
      if ((!newProductSupplierPrice || Number(newProductSupplierPrice) <= 0) && Number(parsedProduct.price) > 0) {
        setNewProductSupplierPrice(String(Number(parsedProduct.price).toFixed(2)));
      }
      if (Array.isArray(parsedProduct.images) && parsedProduct.images[0]) {
        setNewProductImageUrl(String(parsedProduct.images[0]));
      }
      setNewProductAutoFillError('');
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setNewProductAutoFillError('Délai dépassé. Réessaie ou saisis le prix à la main.');
        return;
      }
      const message = e instanceof Error ? e.message : 'Erreur réseau lors de la récupération automatique.';
      setNewProductAutoFillError(message);
    } finally {
      setNewProductAutoFillLoading(false);
    }
  };

  const handleCreateShop = () => {
    if (!newShopName.trim()) return;
    const id = String(Date.now());
    setShops((prev) => [...prev, { id, name: newShopName.trim(), color: newShopColor }]);
    setSelectedShopId(id);
    setNewShopName('');
    setNewShopDescription('');
    setNewShopColor(SHOP_COLORS[4]);
    setCreateShopModalOpen(false);
  };

  const handleCreateOrUpdateProduct = () => {
    if (!newProductName.trim() || !selectedShopId) return;
    const supplierPrice = parseFloat(newProductSupplierPrice.replace(',', '.')) || 0;
    const shippingCost = parseFloat(newProductShippingCost.replace(',', '.')) || 0;
    const sellingPrice = parseFloat(newProductSellingPrice.replace(',', '.')) || 0;

    const supplierUrlNorm = normalizeExternalUrl(newProductSupplierUrl) ?? '';
    const urlForPreview = normalizeExternalUrl(newProductSupplierUrl);
    const productId = editingProductId ?? String(Date.now());

    if (editingProductId) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProductId
            ? {
                ...p,
                name: newProductName.trim(),
                description: newProductDescription.trim() || '-',
                image: newProductImageUrl || p.image,
                supplierUrl: supplierUrlNorm,
                supplierPrice,
                shippingCost,
                sellingPrice,
              }
            : p
        )
      );
    } else {
      setProducts((prev) => [
        ...prev,
        {
          id: productId,
          shopId: selectedShopId,
          name: newProductName.trim(),
          description: newProductDescription.trim() || '-',
          image: newProductImageUrl || '/examples/placeholder-product.jpg',
          supplierUrl: supplierUrlNorm,
          supplierPrice,
          shippingCost,
          sellingPrice,
        },
      ]);
    }

    const shouldFetchAliImage =
      urlForPreview &&
      /aliexpress\.com|aliexpress\.us/i.test(urlForPreview) &&
      (() => {
        if (!editingProductId) return true;
        const prev = products.find((p) => p.id === editingProductId);
        if (!prev) return true;
        const prevU = normalizeExternalUrl(prev.supplierUrl);
        if (prevU !== urlForPreview) return true;
        if (!prev.image || prev.image.includes('placeholder') || !/^https?:\/\//i.test(prev.image)) return true;
        return false;
      })();

    if (shouldFetchAliImage) {
      void (async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) return;
          const res = await fetch('/api/supplier-preview-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ url: urlForPreview }),
          });
          const data = await res.json();
          if (data?.imageUrl) {
            setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, image: data.imageUrl } : p)));
          }
        } catch {
          /* ignore */
        }
      })();
    }
    setEditingProductId(null);
    setNewProductName('');
    setNewProductDescription('');
    setNewProductSupplierUrl('');
    setNewProductSupplierPrice('');
    setNewProductShippingCost('');
    setNewProductSellingPrice('');
    setNewProductImageUrl('');
    setNewProductAutoFillError('');
    setNewProductAutoFillLoading(false);
    setCreateProductModalOpen(false);
  };

  const handleEditProduct = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setEditingProductId(productId);
    setNewProductName(product.name);
    setNewProductDescription(product.description === '-' ? '' : product.description);
    setNewProductSupplierUrl(product.supplierUrl || '');
    setNewProductSupplierPrice(product.supplierPrice ? String(product.supplierPrice) : '');
    setNewProductShippingCost(product.shippingCost ? String(product.shippingCost) : '');
    setNewProductSellingPrice(product.sellingPrice ? String(product.sellingPrice) : '');
    setNewProductImageUrl(product.image || '');
    setNewProductAutoFillError('');
    setNewProductAutoFillLoading(false);
    setCreateProductModalOpen(true);
  };

  const handleOpenProductModal = () => {
    setEditingProductId(null);
    setNewProductName('');
    setNewProductDescription('');
    setNewProductSupplierUrl('');
    setNewProductSupplierPrice('');
    setNewProductShippingCost('');
    setNewProductSellingPrice('');
    setNewProductImageUrl('');
    setNewProductAutoFillError('');
    setNewProductAutoFillLoading(false);
    setCreateProductModalOpen(true);
  };

  const handleDeleteProduct = (productId: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleAddTransaction = () => {
    const amountPaid = parseFloat(newTxAmountPaid.replace(',', '.')) || 0;
    const productCost = parseFloat(newTxProductCost.replace(',', '.')) || 0;
    const { totalFees } = calculateEtsyFees(amountPaid);
    const platformFees = totalFees;
    const profit = amountPaid - productCost - platformFees;
    const country = newTxCountry || 'Autre';
    const city = newTxCity || '';
    const destination = city ? `${city} ${country}` : country;
    const label = newTxLabel.trim() || '1 commande';
    if (!selectedShopId) return;
    setTransactions((prev) => [...prev, {
      id: String(Date.now()),
      shopId: selectedShopId,
      date: newTxDate,
      status: newTxStatus,
      label,
      destination,
      amountPaid,
      productCost,
      platformFees,
      profit,
      country,
      tracking: newTxTracking.trim() || '—',
    }]);
    setNewTxDate(new Date().toISOString().slice(0, 10));
    setNewTxStatus('À envoyer');
    setNewTxAmountPaid('');
    setNewTxProductCost('');
    setNewTxPlatformFees('');
    setNewTxCountry('');
    setNewTxCity('');
    setNewTxLabel('');
    setNewTxTracking('');
    setSelectedProductIds([]);
    setProductSelectorOpen(false);
    setSelectedCalendarDate(null);
    setNewTransactionModalOpen(false);
  };

  const cycleTransactionStatus = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== transactionId) return t;
        const next: Record<string, string> = { 'À envoyer': 'À modifier', 'À modifier': 'Envoyé', Envoyé: 'À envoyer' };
        return { ...t, status: next[t.status] ?? 'À envoyer' };
      })
    );
  };

  const handleRenameShop = () => {
    if (!editShopId || !editShopName.trim()) return;
    setShops((prev) => prev.map((s) => (s.id === editShopId ? { ...s, name: editShopName.trim() } : s)));
    setEditShopId(null);
    setEditShopName('');
  };

  const handleDeleteShop = (shopId: string) => {
    if (!confirm('Supprimer cette boutique ? Les transactions associées seront définitivement perdues.')) return;
    setShops((prev) => prev.filter((s) => s.id !== shopId));
    setTransactions((prev) => prev.filter((t) => t.shopId !== shopId));
    setProducts((prev) => prev.filter((p) => p.shopId !== shopId));
    setSelectedShopId((prev) => {
      if (prev !== shopId) return prev;
      const rest = shops.filter((s) => s.id !== shopId);
      return rest[0]?.id ?? null;
    });
    setEditShopId(null);
    setEditShopName('');
  };

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-2rem)] min-h-[600px] bg-black rounded-xl border border-white/10 md:overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-60 flex-shrink-0 border-b md:border-b-0 md:border-r border-white/10 flex flex-col bg-gradient-to-b from-zinc-950 to-black">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Gestion de vos boutiques Etsy</h2>
          <p className="text-xs text-white/50 mt-1">Boutiques, produits et commandes</p>
        </div>
        <nav className="p-3 flex-1 overflow-y-auto">
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-white font-medium shadow-lg shadow-[#00d4ff]/5"
          >
            <Home size={18} />
            Dashboard
          </button>
            <div className="mt-6">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider px-4 mb-2">Boutiques</p>
            {shops.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedShopId(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${
                  selectedShopId === s.id ? 'bg-white/10 text-white font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white/90'
                }`}
              >
                <span className="flex-shrink-0" style={{ color: s.color || '#ef4444' }}><Store size={18} /></span>
                <span className="truncate text-sm">{s.name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCreateShopModalOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/5 hover:text-white/90 transition-colors mt-1 border border-dashed border-white/10 hover:border-[#00d4ff]/30"
            >
              <Plus size={18} />
              <span className="text-sm">Nouvelle boutique</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gradient-to-b from-black via-zinc-950/30 to-black">
        {!shop ? (
          <div className="flex flex-col items-center justify-center h-full text-white/50 gap-4">
            <Store className="w-16 h-16 text-white/20" />
            <p className="text-center max-w-xs">Sélectionnez une boutique ou créez-en une pour commencer.</p>
          </div>
        ) : (
          <>
            {/* Shop header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10" style={{ color: shop.color || '#ef4444' }}>
                  <Store size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">{shop.name}</h1>
                  <p className="text-sm text-white/50 mt-0.5">Tableau de bord</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { setEditShopId(shop.id); setEditShopName(shop.name); }} className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Renommer la boutique">
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => handleDeleteShop(shop.id)} className="p-2 rounded-xl hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors" title="Supprimer la boutique">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProductModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium"
              >
                <Package size={18} />
                Produits
              </button>
            </div>

            {/* Sous-onglets : Gestion / Produits / Calendrier */}
            <div className="mb-6">
              <div className="flex rounded-full bg-white/5 p-1 border border-white/10 gap-1 w-full max-w-xl">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('dashboard')}
                  className={`flex-1 text-center px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                    activeSubTab === 'dashboard'
                      ? 'bg-white/20 text-white font-medium shadow-sm'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Gestion
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('products')}
                  className={`flex-1 text-center px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                    activeSubTab === 'products'
                      ? 'bg-white/20 text-white font-medium shadow-sm'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Produits
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('calendar')}
                  className={`flex-1 text-center px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                    activeSubTab === 'calendar'
                      ? 'bg-white/20 text-white font-medium shadow-sm'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Calendrier
                </button>
              </div>
            </div>

            {activeSubTab === 'dashboard' && (
            <>
            {/* Stats range */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white/90">Statistiques</h2>
              <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setStatsRange('7d')}
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                    statsRange === '7d' ? 'bg-white/20 text-white font-medium' : 'text-white/70 hover:text-white'
                  }`}
                >
                  7 jours
                </button>
                <button
                  type="button"
                  onClick={() => setStatsRange('30d')}
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                    statsRange === '30d' ? 'bg-white/20 text-white font-medium' : 'text-white/70 hover:text-white'
                  }`}
                >
                  30 jours
                </button>
                <button
                  type="button"
                  onClick={() => setStatsRange('month')}
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                    statsRange === 'month' ? 'bg-white/20 text-white font-medium' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Par mois
                </button>
                <button
                  type="button"
                  onClick={() => setStatsRange('all')}
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                    statsRange === 'all' ? 'bg-white/20 text-white font-medium' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Depuis le début
                </button>
              </div>
            </div>
            {statsRange === 'month' && (
              <div className="flex items-center justify-end gap-2 mb-4">
                <button
                  type="button"
                  onClick={prevStatsMonth}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
                  aria-label="Mois précédent"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-white/80 min-w-[140px] text-center">
                  {MONTHS[statsMonth]} {statsYear}
                </span>
                <button
                  type="button"
                  onClick={nextStatsMonth}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
                  aria-label="Mois suivant"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <KpiCard title="CA brut" value={`${kpi.revenue.toFixed(2)} €`} />
              <KpiCard title="CA net (après Etsy)" value={`${kpi.netAfterEtsy.toFixed(2)} €`} />
              <KpiCard title="Net final (après AliExpress)" value={kpi.netFinal >= 0 ? `+${kpi.netFinal.toFixed(2)} €` : `${kpi.netFinal.toFixed(2)} €`} profit />
              <KpiCard title="Panier moyen" value={`${kpi.avgBasket.toFixed(2)} €`} />
              <KpiCard title="Commandes" value={String(kpi.orders)} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/10 shadow-lg shadow-black/20">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-white">Évolution annuelle</h3>
                  <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-1">
                    <button
                      type="button"
                      onClick={() => setAnnualChartYear((y) => y - 1)}
                      className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white"
                      aria-label="Année précédente"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-medium text-white/90 min-w-[3rem] text-center tabular-nums">{annualChartYear}</span>
                    <button
                      type="button"
                      onClick={() => setAnnualChartYear((y) => y + 1)}
                      className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white"
                      aria-label="Année suivante"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-white/50 mb-4">
                  CA et profit par mois (janv. → déc.) — toutes les commandes de la boutique pour l&apos;année choisie
                </p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={annualData}>
                      <defs>
                        <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00c9b7" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#00c9b7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="#666" fontSize={11} />
                      <YAxis stroke="#666" fontSize={11} tickFormatter={(v: number | undefined) => (v != null ? `${v}€` : '')} />
                      <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} formatter={(v: number | undefined) => [v != null ? `${v.toFixed(2)} €` : '—', '']} />
                      <Area type="monotone" dataKey="ca" stroke="#00d4ff" fill="url(#caGrad)" name="CA" />
                      <Area type="monotone" dataKey="profit" stroke="#00c9b7" fill="url(#profitGrad)" name="Profit" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/10 shadow-lg shadow-black/20">
                <h3 className="text-sm font-semibold text-white mb-0.5">Commandes par pays</h3>
                <p className="text-xs text-white/50 mb-4">Répartition géographique</p>
                <div className="h-64 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ordersByCountry}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value }) => `${name} ${value}`}
                      >
                        {ordersByCountry.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <span className="text-2xl font-bold text-white">{ordersByCountry.reduce((s, d) => s + d.value, 0)}</span>
                      <br />
                      <span className="text-xs text-white/50">Total</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Produits de la boutique : marges & profits */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/10 shadow-lg shadow-black/20 mb-6">
              <h3 className="text-sm font-semibold text-white mb-0.5">Produits de la boutique</h3>
              <p className="text-xs text-white/50 mb-4">
                Vue d&apos;ensemble des prix, profits et marges pour chaque produit
              </p>
              {shopProducts.length === 0 ? (
                <p className="text-white/60 text-sm">
                  Aucun produit pour cette boutique. Ajoutez-en dans « Gestion des produits » pour suivre vos marges.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10 overflow-hidden">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-zinc-900/80 border-b border-white/10 text-white/60">
                      <tr>
                        <th className="py-2.5 px-3 text-left font-medium w-16">#</th>
                        <th className="py-2.5 px-3 text-left font-medium">Produit</th>
                        <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Prix AliExpress/Fournisseur</th>
                        <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Frais livraison</th>
                        <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Prix vente</th>
                        <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Net estimé</th>
                        <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Marge</th>
                        <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap w-[88px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shopProducts.map((p, index) => {
                        const etsyFees = calculateEtsyFees(p.sellingPrice).totalFees;
                        const profit = p.sellingPrice - etsyFees - p.supplierPrice - p.shippingCost;
                        const margin =
                          p.sellingPrice > 0 ? (profit / p.sellingPrice) * 100 : 0;
                        const hasPricing = p.sellingPrice > 0 || p.supplierPrice > 0 || p.shippingCost > 0;
                        return (
                          <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors">
                            <td className="py-2.5 px-3 text-white/60 font-mono text-[11px] sm:text-xs">
                              #{index + 1}
                            </td>
                            <td className="py-2.5 px-3 text-white truncate max-w-[220px]">
                              <span title={p.name}>{p.name}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-white/70">
                              {p.supplierPrice ? `${p.supplierPrice.toFixed(2)} €` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-white/70">
                              {p.shippingCost ? `${p.shippingCost.toFixed(2)} €` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-white/70">
                              {p.sellingPrice ? `${p.sellingPrice.toFixed(2)} €` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {hasPricing ? (
                                <span className={profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {profit >= 0 ? '+' : ''}
                                  {profit.toFixed(2)} €
                                </span>
                              ) : (
                                <span className="text-white/40">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {p.sellingPrice > 0 ? (
                                <span className="text-white/70">
                                  {margin.toFixed(1)} %
                                </span>
                              ) : (
                                <span className="text-white/40">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditProduct(p.id)}
                                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
                                  title="Modifier"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(p.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400"
                                  title="Supprimer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Transactions */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/10 shadow-lg shadow-black/20">
              <h3 className="text-sm font-semibold text-white mb-0.5">Transactions</h3>
              <p className="text-xs text-white/50 mb-4">Liste des commandes de la boutique</p>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Rechercher par libellé, destination..."
                    value={transactionSearch}
                    onChange={(e) => setTransactionSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50 focus:ring-1 focus:ring-[#00d4ff]/20 transition-all"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/40 uppercase tracking-wide hidden sm:inline">Statut</span>
                  <div className="relative">
                    <select
                      value={transactionStatusFilter}
                      onChange={(e) => setTransactionStatusFilter(e.target.value as typeof transactionStatusFilter)}
                      className="pl-3 pr-8 py-2.5 rounded-xl bg-zinc-900/90 border border-[#00d4ff]/40 text-xs sm:text-sm text-white/90 focus:outline-none focus:border-[#00d4ff]/60 focus:ring-1 focus:ring-[#00d4ff]/30 appearance-none cursor-pointer shadow-sm shadow-[#00d4ff]/10"
                    >
                      <option value="all">Tous</option>
                      <option value="À envoyer">À envoyer</option>
                      <option value="À modifier">À modifier</option>
                      <option value="Envoyé">Envoyé</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#00d4ff]/70" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNewTransactionModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00d4ff]/20 border border-[#00d4ff]/50 text-[#00d4ff] font-medium hover:bg-[#00d4ff]/30 hover:border-[#00d4ff]/60 transition-all shadow-lg shadow-[#00d4ff]/5"
                >
                  <Plus size={18} />
                  Nouvelle transaction
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-white/10">
                    <tr className="text-left text-white/60">
                      <th className="py-3.5 px-4 font-semibold">Date & statut</th>
                      <th className="py-3.5 px-4 font-semibold">Libellé</th>
                      <th className="py-3.5 px-4 font-semibold">Destination</th>
                      <th className="py-3.5 px-4 font-semibold">CA brut</th>
                      <th className="py-3.5 px-4 font-semibold">CA net Etsy</th>
                      <th className="py-3.5 px-4 font-semibold">Net final</th>
                      <th className="py-3.5 px-4 font-semibold">Tracking</th>
                      <th className="py-3.5 px-4 w-24 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white">{t.date}</span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                cycleTransactionStatus(t.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  cycleTransactionStatus(t.id);
                                }
                              }}
                              className={`inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer select-none hover:opacity-90 hover:ring-1 hover:ring-white/20 transition-shadow ${
                                t.status === 'Envoyé'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : t.status === 'À modifier'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-red-500/20 text-red-400'
                              }`}
                              title="Cliquer pour changer le statut (À envoyer → À modifier → Envoyé)"
                            >
                              {t.status}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-white/90">{t.label}</td>
                        <td className="py-3.5 px-4 text-white/70">{t.destination}</td>
                        <td className="py-3.5 px-4 text-white/80 font-medium tabular-nums">{t.amountPaid.toFixed(2)} €</td>
                        <td className="py-3.5 px-4 text-cyan-300 font-medium tabular-nums">{(t.amountPaid - t.platformFees).toFixed(2)} €</td>
                        <td className="py-3.5 px-4 text-emerald-400 font-medium tabular-nums">
                          {t.profit >= 0 ? '+' : ''}{t.profit.toFixed(2)} €
                        </td>
                        <td className="py-3.5 px-4 text-white/60">{t.tracking}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditTransactionId(t.id)}
                              className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white"
                              title="Modifier"
                            >
                              <Pencil size={14} />
                            </button>
                            <button type="button" className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white" title="Voir">
                              <ExternalLink size={14} />
                            </button>
                            <button type="button" className="p-1.5 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400" title="Supprimer">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </>
            )}

            {activeSubTab === 'products' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Produits de la boutique</h3>
                    <p className="text-xs text-white/50">
                      Liste de tous les produits que tu utilises dans tes commandes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenProductModal}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter un produit
                  </button>
                </div>

                {shopProducts.length === 0 ? (
                  <div className="p-10 rounded-2xl bg-zinc-900 border border-dashed border-white/10 text-center space-y-3">
                    <div className="h-12 w-12 mx-auto rounded-xl bg-zinc-800 flex items-center justify-center">
                      <Package className="h-6 w-6 text-white/30" />
                    </div>
                    <p className="text-sm text-white/50">Aucun produit pour cette boutique</p>
                    <p className="text-xs text-white/30">Ajoute un produit pour commencer à suivre tes marges.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/60">
                    <div className="min-w-[640px]">
                      <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_auto] px-4 py-3 text-[11px] text-white/40 uppercase tracking-wide border-b border-white/5 gap-2">
                        <span className="text-left">Produit</span>
                        <span className="text-right">Prix AliExpress/Fournisseur</span>
                        <span className="text-right">Frais livraison</span>
                        <span className="text-right">Prix vente</span>
                        <span className="text-right">Net estimé / marge</span>
                        <span className="text-center w-[88px] shrink-0">Actions</span>
                      </div>
                      <div className="divide-y divide-white/5">
                        {shopProducts.map((p) => {
                          const supplierHref = normalizeExternalUrl(p.supplierUrl);
                          const cost = p.supplierPrice + p.shippingCost;
                          const etsyFees = calculateEtsyFees(p.sellingPrice).totalFees;
                          const profit = p.sellingPrice - etsyFees - cost;
                          const margin = p.sellingPrice > 0 ? (profit / p.sellingPrice) * 100 : 0;
                          return (
                            <div
                              key={p.id}
                              className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_auto] px-4 py-3 items-center text-sm text-white/80 hover:bg-white/[0.02] transition-colors gap-2"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <ProductThumb src={p.image} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{p.name}</p>
                                  {supplierHref && (
                                    <a
                                      href={supplierHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 truncate"
                                    >
                                      <Link2 className="h-3 w-3" />
                                      Voir le fournisseur
                                    </a>
                                  )}
                                </div>
                              </div>
                              <span className="text-right text-sm text-white/70 tabular-nums">{p.supplierPrice.toFixed(2)} €</span>
                              <span className="text-right text-sm text-white/70 tabular-nums">{p.shippingCost.toFixed(2)} €</span>
                              <span className="text-right text-sm text-white/70 tabular-nums">{p.sellingPrice.toFixed(2)} €</span>
                              <div className="text-right text-xs">
                                <p className={profit >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                                  {profit >= 0 ? '+' : ''}
                                  {profit.toFixed(2)} €
                                </p>
                                <p className="text-white/40 mt-0.5">{margin.toFixed(1)} %</p>
                              </div>
                              <div className="flex justify-center items-center gap-0.5 w-[88px] shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleEditProduct(p.id)}
                                  className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
                                  title="Modifier le produit"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(p.id)}
                                  className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400"
                                  title="Supprimer le produit"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'calendar' && (
              <div className="p-5 rounded-2xl bg-black border border-white/10 shadow-lg shadow-black/40">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">Calendrier des commandes</h3>
                    <p className="text-xs text-white/50">
                      Sélectionne un jour pour voir combien tu as encaissé.
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-xs text-white/50">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Jour avec commande(s)</span>
                  </div>
                </div>
                {shopTransactions.length === 0 ? (
                  <p className="text-white/60 text-sm">
                    Aucune commande pour l&apos;instant. Crée une transaction pour remplir le calendrier.
                  </p>
                ) : (
                  <>
                    {/* Mois courant */}
                    <div className="flex items-center justify-between mb-3 text-sm text-white/80">
                      <button
                        type="button"
                        onClick={() => {
                          if (calendarMonth === 0) {
                            setCalendarMonth(11);
                            setCalendarYear((y) => y - 1);
                          } else {
                            setCalendarMonth((m) => m - 1);
                          }
                          setSelectedCalendarDate(null);
                        }}
                        className="px-2 py-1 rounded-lg hover:bg-white/10 text-white/70"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="font-medium">
                        {MONTHS[calendarMonth]} {calendarYear}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (calendarMonth === 11) {
                            setCalendarMonth(0);
                            setCalendarYear((y) => y + 1);
                          } else {
                            setCalendarMonth((m) => m + 1);
                          }
                          setSelectedCalendarDate(null);
                        }}
                        className="px-2 py-1 rounded-lg hover:bg-white/10 text-white/70"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {/* En-tête jours de la semaine */}
                    <div className="grid grid-cols-7 text-[11px] text-white/50 mb-1">
                      {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d) => (
                        <div key={d} className="text-center py-1">
                          {d}
                        </div>
                      ))}
                    </div>
                    {/* Grille de jours */}
                    {(() => {
                      const monthStart = new Date(calendarYear, calendarMonth, 1);
                      const startWeekday = monthStart.getDay(); // 0 (dimanche) - 6
                      const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                      const cells: (number | null)[] = [
                        ...Array(startWeekday).fill(null),
                        ...Array(daysInMonth)
                          .fill(0)
                          .map((_, i) => i + 1),
                      ];

                      return (
                        <div className="grid grid-cols-7 gap-1 text-sm mb-4">
                          {cells.map((day, idx) => {
                            if (!day) {
                              return <div key={`empty-${idx}`} className="h-9 sm:h-10" />;
                            }
                            const dateKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(
                              day
                            ).padStart(2, '0')}`;
                            const info = salesByDate[dateKey];
                            const isSelected = selectedCalendarDate === dateKey;
                            return (
                              <button
                                key={dateKey}
                                type="button"
                                onClick={() => setSelectedCalendarDate(dateKey)}
                                className={`h-9 sm:h-10 rounded-lg flex flex-col items-center justify-center border text-xs transition-all ${
                                  isSelected
                                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                                    : info
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-white'
                                    : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30'
                                }`}
                              >
                                <span>{day}</span>
                                {info && (
                                  <span className="text-[10px] text-emerald-200 hidden sm:inline">
                                    +{info.revenue.toFixed(0)}€
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Résumé + détail du jour sélectionné */}
                    {selectedCalendarDate && salesByDate[selectedCalendarDate] && (
                      <div className="mt-3 space-y-3">
                        <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-sm">
                          <div>
                            <p className="text-white font-medium">{selectedCalendarDate}</p>
                            <p className="text-xs text-white/50">
                              {salesByDate[selectedCalendarDate].count} commande
                              {salesByDate[selectedCalendarDate].count > 1 ? 's' : ''} ce jour-là
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-emerald-400 font-semibold">
                              +{salesByDate[selectedCalendarDate].revenue.toFixed(2)} €
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 overflow-hidden">
                          <table className="w-full text-xs sm:text-sm">
                            <thead className="bg-zinc-900/80 text-white/60">
                              <tr>
                                <th className="py-2.5 px-3 text-left font-medium">Libellé</th>
                                <th className="py-2.5 px-3 text-left font-medium">Destination</th>
                                <th className="py-2.5 px-3 text-left font-medium">Statut</th>
                                <th className="py-2.5 px-3 text-right font-medium">Montant payé</th>
                                <th className="py-2.5 px-3 text-right font-medium">Profit</th>
                                <th className="py-2.5 px-3 text-left font-medium">Tracking</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shopTransactions
                                .filter((t) => t.date === selectedCalendarDate)
                                .map((t) => (
                                  <tr key={t.id} className="border-t border-white/5 bg-black">
                                    <td className="py-2.5 px-3 text-white/90">{t.label}</td>
                                    <td className="py-2.5 px-3 text-white/60">{t.destination}</td>
                                    <td className="py-2.5 px-3">
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          cycleTransactionStatus(t.id);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            cycleTransactionStatus(t.id);
                                          }
                                        }}
                                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer select-none hover:opacity-90 hover:ring-1 hover:ring-white/20 ${
                                          t.status === 'Envoyé'
                                            ? 'bg-emerald-500/15 text-emerald-300'
                                            : t.status === 'À modifier'
                                              ? 'bg-amber-500/15 text-amber-300'
                                              : 'bg-red-500/15 text-red-300'
                                        }`}
                                        title="Cliquer pour changer le statut"
                                      >
                                        {t.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-white/80">
                                      {t.amountPaid.toFixed(2)} €
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <span className={t.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                        {t.profit >= 0 ? '+' : ''}
                                        {t.profit.toFixed(2)} €
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-white/60">{t.tracking}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </>
        )}
      </main>

      {/* Modal Modifier la transaction */}
      {editTransactionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setEditTransactionId(null)}>
          <div
            className="bg-zinc-900 border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">Modifier la transaction</h2>
                <p className="text-sm text-white/50 mt-0.5">Modifiez les informations de la transaction</p>
              </div>
              <button type="button" onClick={() => setEditTransactionId(null)} className="p-2 rounded-lg hover:bg-white/10 text-white/60">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Type *</label>
                  <select className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                    <option>Commande</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Date *</label>
                  <input type="text" defaultValue="15 mars 2026" className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Produits * (2)</label>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm">2 produits sélectionnés</div>
                <div className="mt-2 space-y-2">
                  {['1 pièce, pots de fleurs décorés de poupé', 'Pot de fleur avec visage souriant'].map((name, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                      <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0" />
                      <span className="flex-1 text-sm text-white truncate">{name}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" className="w-8 h-8 rounded border border-white/20 text-white/80">−</button>
                        <span className="w-8 text-center text-sm text-white">1</span>
                        <button type="button" className="w-8 h-8 rounded border border-white/20 text-white/80">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Statut *</label>
                <select className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                  <option>À envoyer</option>
                  <option>À modifier</option>
                  <option>Envoyé</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Montant payé *</label>
                  <input type="text" defaultValue="63,1" className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Coût produit *</label>
                  <input type="text" defaultValue="24,28" className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Frais plateforme *</label>
                  <input type="text" defaultValue="8,66" className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Pays *</label>
                  <select className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark]">
                    <option value="">Choisir un pays</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Ville *</label>
                  <input type="text" defaultValue="Montpellier" className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Tracking AliExpress</label>
                  <input type="text" defaultValue="37460077385" className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Tracking Tracktaco</label>
                  <input type="text" placeholder="Numéro de suivi" className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Notes</label>
                <textarea placeholder="Notes supplémentaires..." rows={3} className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-white/10">
              <button type="button" onClick={() => setEditTransactionId(null)} className="flex-1 py-2.5 rounded-lg bg-white/10 text-white font-medium hover:bg-white/15">
                Annuler
              </button>
              <button type="button" onClick={() => setEditTransactionId(null)} className="flex-1 py-2.5 rounded-lg bg-[#00d4ff] text-black font-medium hover:opacity-90">
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nouvelle transaction */}
      {newTransactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setNewTransactionModalOpen(false)}>
          <div
            className="bg-zinc-900/95 border border-white/10 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/40 ring-1 ring-[#00d4ff]/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-6 pb-5 rounded-t-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00d4ff]/15 via-[#00c9b7]/5 to-transparent" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#00d4ff]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-[#00d4ff]/20 border border-[#00d4ff]/30">
                    <Package className="w-6 h-6 text-[#00d4ff]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Nouvelle transaction</h2>
                    <p className="text-sm text-white/60 mt-0.5">Ajoutez une commande à votre boutique</p>
                  </div>
                </div>
                <button type="button" onClick={() => setNewTransactionModalOpen(false)} className="p-2.5 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 pt-4 space-y-6">
              {/* Type & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-2">Type</label>
                  <div className="relative">
                    <select className="w-full pl-4 pr-10 py-3 rounded-xl bg-zinc-800/80 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 transition-all appearance-none cursor-pointer">
                      <option>Commande</option>
                    </select>
                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-2 flex items-center gap-1.5">
                    <Calendar size={12} className="text-[#00d4ff]/80" /> Date
                  </label>
                  <input type="date" value={newTxDate} onChange={(e) => setNewTxDate(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 transition-all [color-scheme:dark]" />
                </div>
              </div>

              {/* Produits */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-2 flex items-center gap-1.5">
                  <Package size={12} className="text-[#00d4ff]/80" /> Produits de la commande
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProductSelectorOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white/80 hover:border-[#00d4ff]/40 hover:bg-white/[0.06] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        <Package size={18} className="text-white/40" />
                      </div>
                      <span className="truncate">
                        {selectedProductIds.length === 0 && shopProducts.length === 0 && 'Aucun produit. Ajoutez-en dans « Gestion des produits ».'}
                        {selectedProductIds.length === 0 && shopProducts.length > 0 && 'Sélectionner un ou plusieurs produits'}
                        {selectedProductIds.length === 1 && shopProducts.find((p) => p.id === selectedProductIds[0])?.name}
                        {selectedProductIds.length > 1 &&
                          `${selectedProductIds.length} produits sélectionnés`}
                      </span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`ml-3 text-white/50 transition-transform ${productSelectorOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {productSelectorOpen && shopProducts.length > 0 && (
                    <div className="absolute left-0 right-0 mt-2 z-40 rounded-xl bg-zinc-900 border border-white/10 shadow-xl shadow-black/40 max-h-56 overflow-y-auto">
                      {shopProducts.map((p) => {
                        const selected = selectedProductIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedProductIds((prev) => {
                                const already = prev.includes(p.id);
                                const next = already ? prev.filter((id) => id !== p.id) : [...prev, p.id];

                                // Auto-remplir les infos de prix si un seul produit est sélectionné
                                if (!already && next.length === 1) {
                                  const prod = shopProducts.find((prodItem) => prodItem.id === p.id);
                                  if (prod) {
                                    const cost = (prod.supplierPrice || 0) + (prod.shippingCost || 0);
                                    if (!newTxProductCost) {
                                      setNewTxProductCost(cost ? String(cost.toFixed(2)) : '');
                                    }
                                    if (!newTxAmountPaid && prod.sellingPrice) {
                                      setNewTxAmountPaid(String(prod.sellingPrice.toFixed(2)));
                                    }
                                  }
                                }

                                // Si on désélectionne tout, on ne touche pas aux champs (l'utilisateur peut les avoir modifiés)
                                return next;
                              });
                              setProductSelectorOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                              selected ? 'bg-[#00d4ff]/15 text-[#00d4ff]' : 'text-white/80 hover:bg-white/5'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0">
                              <Package size={14} className={selected ? 'text-[#00d4ff]' : 'text-white/40'} />
                            </div>
                            <span className="truncate">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Statut & Libellé */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-2">Statut</label>
                  <div className="relative">
                    <select
                      value={newTxStatus}
                      onChange={(e) => setNewTxStatus(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 rounded-xl bg-zinc-800/80 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 transition-all appearance-none cursor-pointer"
                    >
                      <option>À envoyer</option>
                      <option>À modifier</option>
                      <option>Envoyé</option>
                    </select>
                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-2">Libellé</label>
                  <input type="text" value={newTxLabel} onChange={(e) => setNewTxLabel(e.target.value)} placeholder="Ex: 1 commande" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 transition-all" />
                </div>
              </div>

              {/* Montants */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-[#00d4ff]/5 to-[#00c9b7]/5 border border-[#00d4ff]/15">
                <p className="text-xs font-semibold text-[#00c9b7]/90 mb-3 flex items-center gap-2">
                  <DollarSign size={14} /> Montants
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5 min-h-[2.25rem] flex items-end">Montant payé</label>
                    <input type="text" value={newTxAmountPaid} onChange={(e) => setNewTxAmountPaid(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#00d4ff]/40 focus:ring-1 focus:ring-[#00d4ff]/20" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5 min-h-[2.25rem] flex items-end">Coût produit</label>
                    <input type="text" value={newTxProductCost} onChange={(e) => setNewTxProductCost(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#00d4ff]/40 focus:ring-1 focus:ring-[#00d4ff]/20" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5 min-h-[2.25rem] flex items-end">Frais Etsy estimés</label>
                    <input type="text" value={newTxPlatformFees} readOnly placeholder="0" className="w-full px-3 py-2.5 rounded-xl bg-black/20 border border-white/10 text-white/80 placeholder-white/30 text-sm cursor-not-allowed" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-white/45">
                  Estimation: 6.5% transaction + 4% paiement + 0.30€ + 0.47% réglementaire.
                </p>
              </div>

              {/* Destination */}
              <div>
                <p className="text-xs font-semibold text-white/70 mb-3 flex items-center gap-2">
                  <MapPin size={14} className="text-[#00d4ff]/80" /> Destination
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">Pays</label>
                    <div className="relative" ref={countryDropdownRef}>
                      <button
                        type="button"
                        onClick={() => { setCountryDropdownOpen((o) => !o); setCountryFilter(''); }}
                        className="w-full flex items-center justify-between pl-4 pr-10 py-3 rounded-xl bg-zinc-800/80 border border-white/10 text-left text-white text-sm focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 transition-all cursor-pointer"
                      >
                        <span className={newTxCountry ? '' : 'text-white/50'}>{newTxCountry || 'Choisir un pays'}</span>
                        <ChevronDown size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 text-white/50 transition-transform ${countryDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {countryDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl bg-zinc-800 border border-white/10 shadow-xl shadow-black/40 overflow-hidden">
                          <div className="p-2 border-b border-white/10 bg-zinc-900/80">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                              <input
                                type="text"
                                value={countryFilter}
                                onChange={(e) => setCountryFilter(e.target.value)}
                                placeholder="Rechercher un pays..."
                                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#00d4ff]/40"
                              />
                            </div>
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            <button
                              type="button"
                              onClick={() => { setNewTxCountry(''); setCountryDropdownOpen(false); }}
                              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${!newTxCountry ? 'bg-[#00d4ff]/20 text-[#00d4ff]' : 'text-white/90 hover:bg-white/10'}`}
                            >
                              Choisir un pays
                            </button>
                            {filteredCountries.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => { setNewTxCountry(c); setCountryDropdownOpen(false); }}
                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${newTxCountry === c ? 'bg-[#00d4ff]/20 text-[#00d4ff]' : 'text-white/90 hover:bg-white/10'}`}
                              >
                                {c}
                              </button>
                            ))}
                            {filteredCountries.length === 0 && (
                              <p className="px-4 py-3 text-sm text-white/50">Aucun pays trouvé</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">Ville</label>
                    <input type="text" value={newTxCity} onChange={(e) => setNewTxCity(e.target.value)} placeholder="Ville" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 transition-all" />
                  </div>
                </div>
              </div>

              {/* Tracking */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-2 flex items-center gap-1.5">
                  <Truck size={12} className="text-[#00d4ff]/80" /> Tracking
                </label>
                <input type="text" value={newTxTracking} onChange={(e) => setNewTxTracking(e.target.value)} placeholder="Numéro de suivi" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 transition-all" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 pt-2 border-t border-white/10 bg-black/30 rounded-b-3xl">
              <button type="button" onClick={() => setNewTransactionModalOpen(false)} className="flex-1 py-3.5 rounded-xl border border-white/20 text-white/80 font-medium hover:bg-white/10 hover:border-white/30 transition-all">
                Annuler
              </button>
              <button type="button" onClick={handleAddTransaction} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black font-semibold shadow-lg shadow-[#00d4ff]/20 hover:shadow-[#00d4ff]/30 hover:brightness-110 transition-all">
                Créer la transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gestion des produits */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setProductModalOpen(false)}>
          <div
            className="bg-zinc-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Gestion des produits</h2>
                  <p className="text-sm text-white/50 mt-0.5">Gérez vos produits pour pouvoir les sélectionner lors de la création de commandes</p>
                </div>
                <button type="button" onClick={() => setProductModalOpen(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/60">
                  <X size={20} />
                </button>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Rechercher un produit..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCreateProductModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00d4ff]/20 border border-[#00d4ff]/50 text-[#00d4ff] font-medium hover:bg-[#00d4ff]/30"
                >
                  <Plus size={18} />
                  Nouveau
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {filteredProducts.length === 0 ? (
                <p className="text-white/70 text-center py-12">Aucun produit. Créez-en un pour commencer.</p>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/50 border-b border-white/10">
                    <th className="pb-3 pr-4 font-medium w-16">Image</th>
                    <th className="pb-3 pr-4 font-medium">Nom</th>
                    <th className="pb-3 pr-4 font-medium">Description</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Prix AliExpress/Fournisseur</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Frais livraison</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Prix vente</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Profit / marge</th>
                    <th className="pb-3 w-28 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const supplierHref = normalizeExternalUrl(p.supplierUrl);
                    return (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3.5 px-4">
                        <ProductThumb src={p.image} sizeClass="w-12 h-12" iconClass="w-5 h-5 text-white/40" />
                      </td>
                      <td className="py-3 pr-4 text-white truncate max-w-[200px]">
                        {supplierHref ? (
                          <button
                            type="button"
                            onClick={() => openExternalSupplierUrl(p.supplierUrl)}
                            className="truncate text-left w-full hover:underline hover:text-[#00d4ff] transition-colors"
                            title={`Ouvrir le fournisseur : ${p.name}`}
                          >
                            {p.name}
                          </button>
                        ) : (
                          <span className="truncate block" title={p.name}>
                            {p.name}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-white/40 truncate max-w-[260px]">{p.description}</td>
                      <td className="py-3 pr-4 text-white/70 text-sm">{p.supplierPrice ? `${p.supplierPrice.toFixed(2)} €` : '—'}</td>
                      <td className="py-3 pr-4 text-white/70 text-sm">{p.shippingCost ? `${p.shippingCost.toFixed(2)} €` : '—'}</td>
                      <td className="py-3 pr-4 text-white/70 text-sm">{p.sellingPrice ? `${p.sellingPrice.toFixed(2)} €` : '—'}</td>
                      <td className="py-3 pr-4 text-sm">
                        {p.sellingPrice > 0 ? (
                          (() => {
                            const profit = p.sellingPrice - p.supplierPrice - p.shippingCost;
                            const margin = (profit / p.sellingPrice) * 100;
                            return (
                              <div className="flex flex-col">
                                <span className={profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {profit >= 0 ? '+' : ''}
                                  {profit.toFixed(2)} €
                                </span>
                                <span className="text-xs text-white/50">
                                  {margin.toFixed(1)} %
                                </span>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-white/40 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                            title="Voir sur le fournisseur (AliExpress, etc.)"
                            disabled={!supplierHref}
                            onClick={() => openExternalSupplierUrl(p.supplierUrl)}
                          >
                            <ExternalLink size={14} />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white"
                            title="Modifier"
                            onClick={() => handleEditProduct(p.id)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400"
                            title="Supprimer"
                            onClick={() => handleDeleteProduct(p.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Renommer la boutique */}
      {editShopId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => { setEditShopId(null); setEditShopName(''); }}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-md w-full shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-1">Renommer la boutique</h2>
            <p className="text-sm text-white/50 mb-4">Choisissez un nouveau nom pour cette boutique</p>
            <input
              type="text"
              value={editShopName}
              onChange={(e) => setEditShopName(e.target.value)}
              placeholder="Nom de la boutique"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50 mb-4"
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameShop(); if (e.key === 'Escape') { setEditShopId(null); setEditShopName(''); } }}
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => { setEditShopId(null); setEditShopName(''); }} className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15">
                Annuler
              </button>
              <button type="button" onClick={handleRenameShop} disabled={!editShopName.trim()} className="flex-1 py-2.5 rounded-xl bg-[#00d4ff] text-black font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Créer une boutique */}
      {createShopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setCreateShopModalOpen(false)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">Créer une boutique</h2>
                <p className="text-sm text-white/50 mt-0.5">Créez une nouvelle boutique pour gérer vos produits et commandes</p>
              </div>
              <button type="button" onClick={() => setCreateShopModalOpen(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/60">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Nom de la boutique *</label>
                <input
                  type="text"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  placeholder="Boutique2"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Description</label>
                <textarea
                  value={newShopDescription}
                  onChange={(e) => setNewShopDescription(e.target.value)}
                  placeholder="Description de ma boutique..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-2">Couleur</label>
                <div className="grid grid-cols-4 gap-2">
                  {SHOP_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewShopColor(c)}
                      className="h-10 rounded-xl transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/50"
                      style={{
                        backgroundColor: c,
                        border: newShopColor === c ? '2px solid white' : '2px solid transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-white/10">
              <button type="button" onClick={() => setCreateShopModalOpen(false)} className="flex-1 py-2.5 rounded-lg bg-white/10 text-white font-medium hover:bg-white/15">
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateShop}
                disabled={!newShopName.trim()}
                className="flex-1 py-2.5 rounded-lg bg-[#00d4ff] text-black font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Créer la boutique
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nouveau produit (dans Gestion des produits) */}
      {createProductModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80" onClick={() => setCreateProductModalOpen(false)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-lg w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">{editingProductId ? 'Modifier le produit' : 'Nouveau produit'}</h2>
                <p className="text-sm text-white/50 mt-0.5">
                  {editingProductId
                    ? 'Mettez à jour les informations de ce produit'
                    : 'Gérez vos produits pour pouvoir les sélectionner lors de la création de commandes'}
                </p>
              </div>
              <button type="button" onClick={() => setCreateProductModalOpen(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/60">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Nom du produit *</label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Nom du produit"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Description</label>
                <textarea
                  value={newProductDescription}
                  onChange={(e) => setNewProductDescription(e.target.value)}
                  placeholder="Description du produit..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Lien produit AliExpress (ou autre)</label>
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  value={newProductSupplierUrl}
                  onChange={(e) => setNewProductSupplierUrl(e.target.value)}
                  onBlur={() => {
                    if (
                      newProductSupplierUrl.trim() &&
                      (!newProductName.trim() || !newProductSupplierPrice.trim())
                    ) {
                      void handleAutoFillFromSupplierUrl();
                    }
                  }}
                  placeholder="https://www.aliexpress.com/item/... (https ajouté si absent)"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50"
                />
                <p className="text-[11px] text-white/35 mt-1">
                  Pour AliExpress/Alibaba, tu peux auto-remplir le titre + prix fournisseur depuis l&apos;API.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoFillFromSupplierUrl}
                    disabled={!newProductSupplierUrl.trim() || newProductAutoFillLoading}
                    className="px-3 py-1.5 rounded-lg border border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#8eefff] text-xs font-medium hover:bg-[#00d4ff]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {newProductAutoFillLoading ? 'Récupération...' : 'Auto-remplir depuis le lien'}
                  </button>
                  {newProductAutoFillError && (
                    <span className="text-[11px] text-red-300">{newProductAutoFillError}</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Prix AliExpress/Fournisseur (€)</label>
                  <input
                    type="text"
                    value={newProductSupplierPrice}
                    onChange={(e) => setNewProductSupplierPrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Frais de livraison (€)</label>
                  <input
                    type="text"
                    value={newProductShippingCost}
                    onChange={(e) => setNewProductShippingCost(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Prix de vente (€)</label>
                  <input
                    type="text"
                    value={newProductSellingPrice}
                    onChange={(e) => setNewProductSellingPrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setCreateProductModalOpen(false);
                  setEditingProductId(null);
                  setNewProductName('');
                  setNewProductDescription('');
                  setNewProductSupplierUrl('');
                  setNewProductSupplierPrice('');
                  setNewProductShippingCost('');
                  setNewProductSellingPrice('');
                  setNewProductImageUrl('');
                  setNewProductAutoFillError('');
                  setNewProductAutoFillLoading(false);
                }}
                className="flex-1 py-2.5 rounded-lg bg-white/10 text-white font-medium hover:bg-white/15"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateOrUpdateProduct}
                disabled={!newProductName.trim()}
                className="flex-1 py-2.5 rounded-lg bg-[#00d4ff] text-black font-semibold hover:bg-[#33ddff] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#00d4ff]"
              >
                {editingProductId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
