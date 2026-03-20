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
  Trophy,
  Target,
  TrendingUp,
  Circle,
  CheckCircle2,
  Globe,
  Star,
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

type Supplier = {
  id: string;
  name: string;
  platform: string;
  url: string;
  email: string;
  phone: string;
  deliveryDays: number;
  rating: number;
  notes: string;
};

const STORAGE_KEY_SHOPS = 'etsmart_store_manager_shops';
const STORAGE_KEY_PRODUCTS = 'etsmart_store_manager_products';
const STORAGE_KEY_TRANSACTIONS = 'etsmart_store_manager_transactions';
const STORAGE_KEY_SELECTED_SHOP = 'etsmart_store_manager_selected_shop_id';
const STORAGE_KEY_SUPPLIERS = 'etsmart_store_manager_suppliers';

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
const MONTH_LABELS = ['Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar'];
const ETSY_PLATFORM_FEE_RATE = 0.153; // 15.3%

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
  name: string;
  description: string;
  image: string;
  supplierUrl?: string;
  supplierPrice: number;
  shippingCost: number;
  sellingPrice: number;
};

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
    return stored;
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    loadFromStorage(STORAGE_KEY_TRANSACTIONS, [])
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>(() =>
    loadFromStorage(STORAGE_KEY_SUPPLIERS, [])
  );
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', platform: 'AliExpress', url: '', email: '', phone: '', deliveryDays: 15, rating: 3, notes: '' });
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
      localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(suppliers));
      if (selectedShopId) localStorage.setItem(STORAGE_KEY_SELECTED_SHOP, selectedShopId);
    } catch (e) {
      console.warn('[StoreManager] Erreur sauvegarde localStorage', e);
    }
  }, [shops, products, transactions, suppliers, selectedShopId]);
  const [statsRange, setStatsRange] = useState<'7d' | '30d' | 'month' | 'all'>('30d');
  const [statsMonth, setStatsMonth] = useState(() => new Date().getMonth());
  const [statsYear, setStatsYear] = useState(() => new Date().getFullYear());
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
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'calendar' | 'objectifs' | 'products' | 'suppliers'>('dashboard');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [showLevel1Details, setShowLevel1Details] = useState(true);
  const [showLevel2Details, setShowLevel2Details] = useState(false);

  const shop = shops.find((s) => s.id === selectedShopId);

  const filteredCountries = useMemo(
    () => (countryFilter.trim() ? COUNTRIES.filter((c) => c.toLowerCase().includes(countryFilter.trim().toLowerCase())) : COUNTRIES),
    [countryFilter]
  );

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
    const fees = amountPaid * ETSY_PLATFORM_FEE_RATE;
    setNewTxPlatformFees(fees.toFixed(2));
  }, [newTxAmountPaid]);

  const shopTransactions = useMemo(
    () => (selectedShopId ? transactions.filter((t) => (t.shopId ?? '1') === selectedShopId) : []),
    [transactions, selectedShopId]
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

  const bestDay = useMemo(() => {
    const entries = Object.entries(salesByDate);
    if (entries.length === 0) return null;
    return entries.reduce(
      (best, [date, info]) => (info.revenue > best.info.revenue ? { date, info } : best),
      { date: entries[0][0], info: entries[0][1] }
    );
  }, [salesByDate]);

  const weeklyStats = useMemo(() => {
    const weeks: Record<string, { revenue: number; count: number }> = {};
    shopTransactions.forEach((t) => {
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      const year = d.getFullYear();
      // approximation semaine: année + numéro obtenu via maths simples
      const firstJan = new Date(year, 0, 1);
      const week =
        Math.floor(
          (Number(d) - Number(firstJan)) / (1000 * 60 * 60 * 24 * 7)
        );
      const key = `${year}-W${week}`;
      if (!weeks[key]) weeks[key] = { revenue: 0, count: 0 };
      weeks[key].revenue += t.amountPaid;
      weeks[key].count += 1;
    });
    return weeks;
  }, [shopTransactions]);

  const formatDateLong = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const bestWeek = useMemo(() => {
    const entries = Object.entries(weeklyStats);
    if (entries.length === 0) return null;
    return entries.reduce(
      (best, [week, info]) => (info.revenue > best.info.revenue ? { week, info } : best),
      { week: entries[0][0], info: entries[0][1] }
    );
  }, [weeklyStats]);

  const monthlyStats = useMemo(() => {
    const months: Record<string, { revenue: number; count: number }> = {};
    shopTransactions.forEach((t) => {
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { revenue: 0, count: 0 };
      months[key].revenue += t.amountPaid;
      months[key].count += 1;
    });
    return months;
  }, [shopTransactions]);

  const bestMonth = useMemo(() => {
    const entries = Object.entries(monthlyStats);
    if (entries.length === 0) return null;
    return entries.reduce(
      (best, [month, info]) => (info.revenue > best.info.revenue ? { month, info } : best),
      { month: entries[0][0], info: entries[0][1] }
    );
  }, [monthlyStats]);

  const kpi = useMemo(() => {
    const revenue = statsTransactions.reduce((s, t) => s + t.amountPaid, 0);
    const profit = statsTransactions.reduce((s, t) => s + t.profit, 0);
    const orders = statsTransactions.length;
    return {
      revenue,
      profit,
      avgBasket: orders > 0 ? revenue / orders : 0,
      orders,
      productsCount: orders,
    };
  }, [statsTransactions]);

  // Objectifs & niveaux (utilisent les vraies stats de la boutique)
  const totalRevenue = kpi.revenue;
  const totalOrders = shopTransactions.length;
  const hasOrderWithProfitOver20 = shopTransactions.some((t) => t.profit > 20);
  const hasOrderWithProfitOver50 = shopTransactions.some((t) => t.profit > 50);
  const MAIN_COUNTRIES = ['France', 'Belgique', 'Suisse'];
  const hasOrderOutsideMainCountries = shopTransactions.some(
    (t) => t.country && !MAIN_COUNTRIES.includes(t.country)
  );

  // Streak de jours consécutifs avec au moins 1 vente
  const streak3Days = useMemo(() => {
    const dates = Object.keys(salesByDate);
    if (dates.length === 0) return false;
    const sorted = dates
      .map((d) => new Date(d))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => Number(a) - Number(b));
    let bestStreak = 1;
    let currentStreak = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const diffDays = (Number(cur) - Number(prev)) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        currentStreak += 1;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
    }
    return bestStreak >= 3;
  }, [salesByDate]);

  // Objectifs niveau 1
  const level1Objectives = {
    firstOrder: totalOrders >= 1,
    threeOrders: totalOrders >= 3,
    profit20: hasOrderWithProfitOver20,
    internationalOrder: hasOrderOutsideMainCountries,
    revenue100: totalRevenue >= 100,
  };
  const level1Completed = Object.values(level1Objectives).every(Boolean);

  // Objectifs niveau 2
  const hasDayWithAtLeastFiveOrders = Object.values(salesByDate).some((d) => d.count >= 5);
  const level2Objectives = {
    tenOrders: totalOrders >= 10,
    streak3Days,
    fiveOrdersOneDay: hasDayWithAtLeastFiveOrders,
    revenue500: totalRevenue >= 500,
    profit50: hasOrderWithProfitOver50,
  };
  const level2Completed = Object.values(level2Objectives).every(Boolean);

  // Niveau global basé sur le CA (pour la barre) mais en respectant le fait
  // qu'un niveau ne peut être "actif" que si le précédent est complété.
  const levelThresholds = [0, 500, 2000, 5000];
  let rawLevel =
    totalRevenue >= levelThresholds[3]
      ? 3
      : totalRevenue >= levelThresholds[2]
      ? 2
      : totalRevenue >= levelThresholds[1]
      ? 1
      : 0;
  // Forcer la progression par niveaux successifs
  if (!level1Completed) {
    rawLevel = 0;
  } else if (!level2Completed && rawLevel > 1) {
    rawLevel = 1;
  }
  const currentLevel = rawLevel;
  const nextLevel = Math.min(currentLevel + 1, levelThresholds.length - 1);
  const currentThreshold = levelThresholds[currentLevel];
  const nextThreshold = levelThresholds[nextLevel];
  const levelProgress =
    nextThreshold === currentThreshold
      ? 1
      : Math.min(1, Math.max(0, (totalRevenue - currentThreshold) / (nextThreshold - currentThreshold)));

  const annualData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const buckets = MONTH_LABELS.map((month) => ({ month, ca: 0, profit: 0 }));
    statsTransactions.forEach((t) => {
      const d = new Date(t.date);
      const y = d.getFullYear();
      const m = d.getMonth();
      const chartIndex = m >= 3 ? m - 3 : m + 9;
      const slotYear = chartIndex <= 8 ? currentYear - 1 : currentYear;
      if (y === slotYear && chartIndex >= 0 && chartIndex < 12) {
        buckets[chartIndex].ca += t.amountPaid;
        buckets[chartIndex].profit += t.profit;
      }
    });
    return buckets;
  }, [statsTransactions]);

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
  const filteredProducts = products.filter(
    (p) => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

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
    if (!newProductName.trim()) return;
    const supplierPrice = parseFloat(newProductSupplierPrice.replace(',', '.')) || 0;
    const shippingCost = parseFloat(newProductShippingCost.replace(',', '.')) || 0;
    const sellingPrice = parseFloat(newProductSellingPrice.replace(',', '.')) || 0;

    if (editingProductId) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProductId
            ? {
                ...p,
                name: newProductName.trim(),
                description: newProductDescription.trim() || '-',
                supplierUrl: newProductSupplierUrl.trim(),
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
          id: String(Date.now()),
          name: newProductName.trim(),
          description: newProductDescription.trim() || '-',
          image: '/examples/placeholder-product.jpg',
          supplierUrl: newProductSupplierUrl.trim(),
          supplierPrice,
          shippingCost,
          sellingPrice,
        },
      ]);
    }
    setEditingProductId(null);
    setNewProductName('');
    setNewProductDescription('');
    setNewProductSupplierUrl('');
    setNewProductSupplierPrice('');
    setNewProductShippingCost('');
    setNewProductSellingPrice('');
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
    setCreateProductModalOpen(true);
  };

  const handleDeleteProduct = (productId: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleAddTransaction = () => {
    const amountPaid = parseFloat(newTxAmountPaid.replace(',', '.')) || 0;
    const productCost = parseFloat(newTxProductCost.replace(',', '.')) || 0;
    const platformFees = Number((amountPaid * ETSY_PLATFORM_FEE_RATE).toFixed(2));
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

            {/* Sub-tabs: Gestion / Produits / Calendrier / Objectifs / Fournisseurs */}
            <div className="mb-6">
              <div className="flex rounded-full bg-white/5 p-1 border border-white/10 gap-1 w-full max-w-3xl">
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
                <button
                  type="button"
                  onClick={() => setActiveSubTab('objectifs')}
                  className={`flex-1 text-center px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                    activeSubTab === 'objectifs'
                      ? 'bg-white/20 text-white font-medium shadow-sm'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Objectifs
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('suppliers')}
                  className={`flex-1 text-center px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                    activeSubTab === 'suppliers'
                      ? 'bg-white/20 text-white font-medium shadow-sm'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Fournisseurs
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard title="Chiffre d'affaires" value={`${kpi.revenue.toFixed(2)} €`} />
              <KpiCard title="Profit" value={kpi.profit >= 0 ? `+${kpi.profit.toFixed(2)} €` : `${kpi.profit.toFixed(2)} €`} profit />
              <KpiCard title="Panier moyen" value={`${kpi.avgBasket.toFixed(2)} €`} />
              <KpiCard title="Commandes" value={String(kpi.orders)} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/10 shadow-lg shadow-black/20">
                <h3 className="text-sm font-semibold text-white mb-0.5">Évolution annuelle</h3>
                <p className="text-xs text-white/50 mb-4">CA et profit sur 12 mois</p>
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
              {products.length === 0 ? (
                <p className="text-white/60 text-sm">
                  Aucun produit. Ajoutez-en dans « Gestion des produits » pour suivre vos marges.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10 overflow-hidden">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-zinc-900/80 border-b border-white/10 text-white/60">
                      <tr>
                        <th className="py-2.5 px-3 text-left font-medium w-16">#</th>
                        <th className="py-2.5 px-3 text-left font-medium">Produit</th>
                        <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Prix fournisseur</th>
                        <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Frais livraison</th>
                        <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Prix vente</th>
                        <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Profit</th>
                        <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Marge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p, index) => {
                        const profit = p.sellingPrice - p.supplierPrice - p.shippingCost;
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
                      <th className="py-3.5 px-4 font-semibold">Profit</th>
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
                              onDoubleClick={() => cycleTransactionStatus(t.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleTransactionStatus(t.id); } }}
                              className={`inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer select-none hover:opacity-90 ${
                                t.status === 'Envoyé'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : t.status === 'À modifier'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-red-500/20 text-red-400'
                              }`}
                              title="Double-clic pour changer le statut"
                            >
                              {t.status}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-white/90">{t.label}</td>
                        <td className="py-3.5 px-4 text-white/70">{t.destination}</td>
                        <td className="py-3.5 px-4 text-emerald-400 font-medium">+{t.profit.toFixed(2)} €</td>
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

                {products.length === 0 ? (
                  <div className="p-10 rounded-2xl bg-zinc-900 border border-dashed border-white/10 text-center space-y-3">
                    <div className="h-12 w-12 mx-auto rounded-xl bg-zinc-800 flex items-center justify-center">
                      <Package className="h-6 w-6 text-white/30" />
                    </div>
                    <p className="text-sm text-white/50">Aucun produit enregistré</p>
                    <p className="text-xs text-white/30">Ajoute un produit pour commencer à suivre tes marges.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
                    <div className="grid grid-cols-6 px-4 py-3 text-[11px] text-white/40 uppercase tracking-wide border-b border-white/5">
                      <span className="col-span-2 text-left">Produit</span>
                      <span className="text-right">Prix fournisseur</span>
                      <span className="text-right">Frais livraison</span>
                      <span className="text-right">Prix vente</span>
                      <span className="text-right">Profit / marge</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {products.map((p) => {
                        const cost = p.supplierPrice + p.shippingCost;
                        const profit = p.sellingPrice - cost;
                        const margin = p.sellingPrice > 0 ? (profit / p.sellingPrice) * 100 : 0;
                        return (
                          <div key={p.id} className="grid grid-cols-6 px-4 py-3 items-center text-sm text-white/80 hover:bg-white/[0.02] transition-colors">
                            <div className="col-span-2 flex items-center gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center overflow-hidden">
                                <ImageIcon className="h-5 w-5 text-white/30" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                                {p.supplierUrl && (
                                  <a
                                    href={p.supplierUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 truncate"
                                  >
                                    <Link2 className="h-3 w-3" />
                                    Voir le fournisseur
                                  </a>
                                )}
                              </div>
                            </div>
                            <span className="text-right text-sm text-white/70">{p.supplierPrice.toFixed(2)} €</span>
                            <span className="text-right text-sm text-white/70">{p.shippingCost.toFixed(2)} €</span>
                            <span className="text-right text-sm text-white/70">{p.sellingPrice.toFixed(2)} €</span>
                            <div className="text-right text-xs">
                              <p className={profit >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                                {profit >= 0 ? '+' : ''}
                                {profit.toFixed(2)} €
                              </p>
                              <p className="text-white/40 mt-0.5">{margin.toFixed(1)} %</p>
                            </div>
                          </div>
                        );
                      })}
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
                                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                          t.status === 'Envoyé'
                                            ? 'bg-emerald-500/15 text-emerald-300'
                                            : t.status === 'À modifier'
                                              ? 'bg-amber-500/15 text-amber-300'
                                              : 'bg-red-500/15 text-red-300'
                                        }`}
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

            {activeSubTab === 'objectifs' && (
              <div className="space-y-6">

                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <Trophy className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Objectifs & gamification</h3>
                    <p className="text-xs text-white/50">Monte de niveau, bats tes records et débloque des succès.</p>
                  </div>
                </div>

                {/* Barre de niveau global */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-900/80 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                        <span className="text-sm font-bold text-cyan-300">{currentLevel + 1}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">
                          Vendeur {currentLevel === 0 ? 'débutant' : currentLevel === 1 ? 'confirmé' : 'avancé'}
                        </p>
                        <p className="text-[11px] text-white/40">Niveau global de la boutique</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-white/50">
                      {nextThreshold - totalRevenue > 0
                        ? `${(nextThreshold - totalRevenue).toFixed(0)} € restants`
                        : 'Niveau max atteint'}
                    </p>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${Math.round(levelProgress * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-white/40">{totalRevenue.toFixed(2)} € / {nextThreshold.toFixed(0)} € de CA cumulé</p>
                </div>

                {/* Records */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-zinc-900 border border-white/10 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-cyan-500 to-blue-500" />
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <Target className="h-3.5 w-3.5 text-cyan-400" />
                      </div>
                      <p className="text-[11px] text-white/50 uppercase tracking-wider">Meilleur jour</p>
                    </div>
                    {bestDay ? (
                      <>
                        <p className="text-lg font-bold text-white">{formatDateLong(bestDay.date)}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-white/50">{bestDay.info.count} commande{bestDay.info.count > 1 ? 's' : ''}</p>
                          <p className="text-sm font-bold text-cyan-400">+{bestDay.info.revenue.toFixed(2)} €</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-white/40">Aucun record pour le moment.</p>
                    )}
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-900 border border-white/10 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-violet-500 to-purple-500" />
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <Trophy className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                      <p className="text-[11px] text-white/50 uppercase tracking-wider">Meilleure semaine</p>
                    </div>
                    {bestWeek ? (
                      <>
                        <p className="text-lg font-bold text-white">{bestWeek.week}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-white/50">{bestWeek.info.count} commande{bestWeek.info.count > 1 ? 's' : ''}</p>
                          <p className="text-sm font-bold text-violet-400">+{bestWeek.info.revenue.toFixed(2)} €</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-white/40">Aucun record pour le moment.</p>
                    )}
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-900 border border-white/10 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                      <p className="text-[11px] text-white/50 uppercase tracking-wider">Meilleur mois</p>
                    </div>
                    {bestMonth ? (
                      <>
                        <p className="text-lg font-bold text-white">{formatDateLong(`${bestMonth.month}-01`)}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-white/50">{bestMonth.info.count} commande{bestMonth.info.count > 1 ? 's' : ''}</p>
                          <p className="text-sm font-bold text-amber-400">+{bestMonth.info.revenue.toFixed(2)} €</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-white/40">Aucun record pour le moment.</p>
                    )}
                  </div>
                </div>

                {/* Objectifs par niveau */}
                <div className="space-y-4">
                  {/* Niveau 1 */}
                  <div className="rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowLevel1Details((v) => !v)}
                      className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                          <Target className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-white">Niveau 1 · Démarrage</p>
                          <p className="text-[11px] text-white/40">{Object.values(level1Objectives).filter(Boolean).length}/5 défis réussis</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 rounded-full bg-zinc-800 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${(Object.values(level1Objectives).filter(Boolean).length / 5) * 100}%` }} />
                        </div>
                        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${showLevel1Details ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {showLevel1Details && (
                      <div className="px-4 pb-4 space-y-1">
                        {[
                          { done: level1Objectives.firstOrder, label: 'Faire ta première commande', desc: 'Débloque ton premier succès et lance ta boutique.' },
                          { done: level1Objectives.threeOrders, label: 'Atteindre 3 commandes au total', desc: 'Valide que ton offre commence à tourner.' },
                          { done: level1Objectives.profit20, label: '1 commande avec un profit > 20 €', desc: 'Focus sur la marge, pas seulement le volume.' },
                          { done: level1Objectives.internationalOrder, label: '1 commande hors de ton pays principal', desc: "Commence à ouvrir ta boutique à l'international." },
                          { done: level1Objectives.revenue100, label: '100 € de CA cumulé', desc: "Premier palier symbolique de chiffre d'affaires." },
                        ].map((obj, i) => (
                          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${obj.done ? 'bg-cyan-500/5' : 'hover:bg-white/[0.02]'}`}>
                            {obj.done ? (
                              <CheckCircle2 className="h-5 w-5 text-cyan-400 shrink-0" />
                            ) : (
                              <Circle className="h-5 w-5 text-white/20 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className={`text-sm font-medium ${obj.done ? 'text-cyan-300' : 'text-white'}`}>{obj.label}</p>
                              <p className="text-[11px] text-white/40">{obj.desc}</p>
                            </div>
                            {obj.done && (
                              <span className="ml-auto shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">Validé</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Niveau 2 */}
                  <div className={`rounded-2xl border overflow-hidden transition-opacity ${level1Completed ? 'bg-zinc-900 border-white/10' : 'bg-zinc-900/50 border-white/5 opacity-50'}`}>
                    <button
                      type="button"
                      onClick={() => level1Completed && setShowLevel2Details((v) => !v)}
                      className={`w-full p-4 flex items-center justify-between transition-colors ${level1Completed ? 'hover:bg-white/[0.02] cursor-pointer' : 'cursor-not-allowed'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl border flex items-center justify-center ${level1Completed ? 'bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-violet-500/30' : 'bg-zinc-800 border-white/10'}`}>
                          <Trophy className={`h-4 w-4 ${level1Completed ? 'text-violet-400' : 'text-white/30'}`} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-white">Niveau 2 · Vendeur confirmé</p>
                          <p className="text-[11px] text-white/40">
                            {level1Completed ? `${Object.values(level2Objectives).filter(Boolean).length}/5 défis réussis` : 'Complète le niveau 1 pour débloquer'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {level1Completed && (
                          <div className="h-1.5 w-24 rounded-full bg-zinc-800 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500" style={{ width: `${(Object.values(level2Objectives).filter(Boolean).length / 5) * 100}%` }} />
                          </div>
                        )}
                        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${showLevel2Details ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {showLevel2Details && level1Completed && (
                      <div className="px-4 pb-4 space-y-1">
                        {[
                          { done: level2Objectives.tenOrders, label: '10 commandes au total', desc: 'Tu commences à avoir du vrai volume.' },
                          { done: level2Objectives.streak3Days, label: 'Streak de 3 jours consécutifs avec au moins 1 vente', desc: "Rester constant plusieurs jours d'affilée." },
                          { done: level2Objectives.fiveOrdersOneDay, label: '1 journée avec 5 commandes ou plus', desc: 'Tester ta capacité à gérer un pic de commandes.' },
                          { done: level2Objectives.revenue500, label: '500 € de CA cumulé', desc: 'Cap important sur le chemin vers 2 000 € / mois.' },
                          { done: level2Objectives.profit50, label: '1 commande avec un profit > 50 €', desc: 'Objectif de marge plus ambitieux.' },
                        ].map((obj, i) => (
                          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${obj.done ? 'bg-violet-500/5' : 'hover:bg-white/[0.02]'}`}>
                            {obj.done ? (
                              <CheckCircle2 className="h-5 w-5 text-violet-400 shrink-0" />
                            ) : (
                              <Circle className="h-5 w-5 text-white/20 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className={`text-sm font-medium ${obj.done ? 'text-violet-300' : 'text-white'}`}>{obj.label}</p>
                              <p className="text-[11px] text-white/40">{obj.desc}</p>
                            </div>
                            {obj.done && (
                              <span className="ml-auto shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/30">Validé</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {activeSubTab === 'suppliers' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                      <Truck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Carnet de fournisseurs</h3>
                      <p className="text-xs text-white/50">Gère tes fournisseurs, leurs délais et leur fiabilité.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditSupplierId(null);
                      setSupplierForm({ name: '', platform: 'AliExpress', url: '', email: '', phone: '', deliveryDays: 15, rating: 3, notes: '' });
                      setShowSupplierForm(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter
                  </button>
                </div>

                {/* Stats rapides */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-cyan-500/15 text-center">
                    <p className="text-2xl font-bold text-cyan-400">{suppliers.length}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">Fournisseurs</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-cyan-500/15 text-center">
                    <p className="text-2xl font-bold text-cyan-400">
                      {suppliers.length > 0 ? Math.round(suppliers.reduce((s, f) => s + f.deliveryDays, 0) / suppliers.length) : '—'}
                    </p>
                    <p className="text-[11px] text-white/40 mt-0.5">Délai moyen (j)</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-cyan-500/15 text-center">
                    <p className="text-2xl font-bold text-cyan-400">
                      {suppliers.length > 0 ? (suppliers.reduce((s, f) => s + f.rating, 0) / suppliers.length).toFixed(1) : '—'}
                    </p>
                    <p className="text-[11px] text-white/40 mt-0.5">Note moyenne</p>
                  </div>
                </div>

                {/* Liste fournisseurs */}
                {suppliers.length === 0 ? (
                  <div className="p-10 rounded-2xl bg-zinc-900 border border-dashed border-cyan-500/20 text-center space-y-3">
                    <div className="h-12 w-12 mx-auto rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Truck className="h-6 w-6 text-cyan-400/50" />
                    </div>
                    <p className="text-sm text-white/50">Aucun fournisseur enregistré</p>
                    <p className="text-xs text-white/30">Clique sur &quot;Ajouter&quot; pour enregistrer ton premier fournisseur.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {suppliers.map((sup) => (
                      <div key={sup.id} className="p-4 rounded-2xl bg-zinc-900 border border-cyan-500/10 flex items-center gap-4 hover:border-cyan-500/30 transition-colors group">
                        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
                          <Globe className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white truncate">{sup.name}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shrink-0">
                              {sup.platform}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{sup.deliveryDays}j</span>
                            <span className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }, (_, i) => (
                                <Star key={i} className={`h-3 w-3 ${i < sup.rating ? 'text-amber-400 fill-amber-400' : 'text-white/15'}`} />
                              ))}
                            </span>
                            {sup.email && <span className="truncate max-w-[120px]">{sup.email}</span>}
                            {sup.phone && <span>{sup.phone}</span>}
                            {sup.url && (
                              <a href={sup.url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300">
                                <Link2 className="h-3 w-3" />Lien
                              </a>
                            )}
                          </div>
                          {sup.notes && <p className="text-[11px] text-white/30 mt-1 truncate">{sup.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditSupplierId(sup.id);
                              setSupplierForm({ name: sup.name, platform: sup.platform, url: sup.url, email: sup.email || '', phone: sup.phone || '', deliveryDays: sup.deliveryDays, rating: sup.rating, notes: sup.notes });
                              setShowSupplierForm(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSuppliers((prev) => prev.filter((s) => s.id !== sup.id))}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Modal ajout / édition */}
                {showSupplierForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowSupplierForm(false)}>
                      <div className="bg-zinc-900 border border-cyan-500/15 rounded-2xl max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between p-5 border-b border-cyan-500/10">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                            <Truck className="h-4 w-4 text-white" />
                          </div>
                          <h2 className="text-sm font-bold text-white">{editSupplierId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h2>
                        </div>
                        <button type="button" onClick={() => setShowSupplierForm(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">
                          <X size={18} />
                        </button>
                      </div>
                      <div className="p-5 space-y-4">
                        <div>
                          <label className="text-[11px] text-white/50 uppercase tracking-wide block mb-1">Nom du fournisseur</label>
                          <input
                            className="w-full rounded-xl bg-zinc-800 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-500/50 focus:outline-none transition-colors"
                            placeholder="Ex: Shenzhen Store"
                            value={supplierForm.name}
                            onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-white/50 uppercase tracking-wide block mb-1">Plateforme</label>
                            <select
                              className="w-full rounded-xl bg-zinc-800 border border-white/10 px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none transition-colors appearance-none"
                              value={supplierForm.platform}
                              onChange={(e) => setSupplierForm((f) => ({ ...f, platform: e.target.value }))}
                            >
                              <option value="AliExpress">AliExpress</option>
                              <option value="Alibaba">Alibaba</option>
                              <option value="1688">1688</option>
                              <option value="CJ Dropshipping">CJ Dropshipping</option>
                              <option value="Autre">Autre</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-white/50 uppercase tracking-wide block mb-1">Délai livraison (jours)</label>
                            <input
                              type="number"
                              className="w-full rounded-xl bg-zinc-800 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-500/50 focus:outline-none transition-colors"
                              value={supplierForm.deliveryDays}
                              onChange={(e) => setSupplierForm((f) => ({ ...f, deliveryDays: Number(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-white/50 uppercase tracking-wide block mb-1">Email</label>
                            <input
                              type="email"
                              className="w-full rounded-xl bg-zinc-800 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-500/50 focus:outline-none transition-colors"
                              placeholder="contact@supplier.com"
                              value={supplierForm.email}
                              onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-white/50 uppercase tracking-wide block mb-1">Téléphone</label>
                            <input
                              type="tel"
                              className="w-full rounded-xl bg-zinc-800 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-500/50 focus:outline-none transition-colors"
                              placeholder="+86 ..."
                              value={supplierForm.phone}
                              onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-white/50 uppercase tracking-wide block mb-1">Lien boutique</label>
                          <input
                            className="w-full rounded-xl bg-zinc-800 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-500/50 focus:outline-none transition-colors"
                            placeholder="https://..."
                            value={supplierForm.url}
                            onChange={(e) => setSupplierForm((f) => ({ ...f, url: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-white/50 uppercase tracking-wide block mb-1">Note ({supplierForm.rating}/5)</label>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }, (_, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setSupplierForm((f) => ({ ...f, rating: i + 1 }))}
                                className="p-0.5"
                              >
                                <Star className={`h-5 w-5 transition-colors ${i < supplierForm.rating ? 'text-amber-400 fill-amber-400' : 'text-white/15 hover:text-amber-400/50'}`} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-white/50 uppercase tracking-wide block mb-1">Notes</label>
                          <textarea
                            className="w-full rounded-xl bg-zinc-800 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-500/50 focus:outline-none transition-colors resize-none"
                            rows={2}
                            placeholder="Qualité, communication, remarques..."
                            value={supplierForm.notes}
                            onChange={(e) => setSupplierForm((f) => ({ ...f, notes: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="p-5 border-t border-cyan-500/10 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSupplierForm(false)}
                          className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!supplierForm.name.trim()) return;
                            if (editSupplierId) {
                              setSuppliers((prev) => prev.map((s) => s.id === editSupplierId ? { ...s, ...supplierForm } : s));
                            } else {
                              setSuppliers((prev) => [...prev, { id: String(Date.now()), ...supplierForm }]);
                            }
                            setShowSupplierForm(false);
                            setEditSupplierId(null);
                          }}
                          className="px-4 py-2 rounded-xl bg-cyan-500 text-black text-sm font-semibold hover:bg-cyan-400 transition-colors"
                        >
                          {editSupplierId ? 'Enregistrer' : 'Ajouter'}
                        </button>
                      </div>
                    </div>
                  </div>
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
                        {selectedProductIds.length === 0 && products.length === 0 && 'Aucun produit. Ajoutez-en dans « Gestion des produits ».'}
                        {selectedProductIds.length === 0 && products.length > 0 && 'Sélectionner un ou plusieurs produits'}
                        {selectedProductIds.length === 1 && products.find((p) => p.id === selectedProductIds[0])?.name}
                        {selectedProductIds.length > 1 &&
                          `${selectedProductIds.length} produits sélectionnés`}
                      </span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`ml-3 text-white/50 transition-transform ${productSelectorOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {productSelectorOpen && products.length > 0 && (
                    <div className="absolute left-0 right-0 mt-2 z-40 rounded-xl bg-zinc-900 border border-white/10 shadow-xl shadow-black/40 max-h-56 overflow-y-auto">
                      {products.map((p) => {
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
                                  const prod = products.find((prodItem) => prodItem.id === p.id);
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
                    <label className="block text-xs text-white/50 mb-1.5 min-h-[2.25rem] flex items-end">Frais plateforme (15,3%)</label>
                    <input type="text" value={newTxPlatformFees} readOnly placeholder="0" className="w-full px-3 py-2.5 rounded-xl bg-black/20 border border-white/10 text-white/80 placeholder-white/30 text-sm cursor-not-allowed" />
                  </div>
                </div>
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
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Prix fournisseur</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Frais livraison</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Prix vente</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Profit / marge</th>
                    <th className="pb-3 w-28 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3.5 px-4">
                        <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="w-5 h-5 text-white/40" />
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-white truncate max-w-[200px]">
                        <button
                          type="button"
                          onClick={() => {
                            if (p.supplierUrl) {
                              window.open(p.supplierUrl, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="truncate text-left w-full hover:underline hover:text-[#00d4ff] transition-colors"
                          title={p.name}
                        >
                          {p.name}
                        </button>
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
                            className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white"
                            title="Voir sur le fournisseur"
                            onClick={() => {
                              if (p.supplierUrl) {
                                window.open(p.supplierUrl, '_blank', 'noopener,noreferrer');
                              }
                            }}
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
                  ))}
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
              <button type="button" onClick={handleCreateShop} disabled={!newShopName.trim()} className="flex-1 py-2.5 rounded-lg bg-white text-black font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
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
                <label className="block text-xs text-white/50 mb-1">URL Fournisseur (Aliexpress, etc.)</label>
                <input
                  type="url"
                  value={newProductSupplierUrl}
                  onChange={(e) => setNewProductSupplierUrl(e.target.value)}
                  placeholder="https://fr.aliexpress.com/item/..."
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#00d4ff]/50"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Prix fournisseur (€)</label>
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
                }}
                className="flex-1 py-2.5 rounded-lg bg-white/10 text-white font-medium hover:bg-white/15"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateOrUpdateProduct}
                disabled={!newProductName.trim()}
                className="flex-1 py-2.5 rounded-lg bg-white text-black font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
