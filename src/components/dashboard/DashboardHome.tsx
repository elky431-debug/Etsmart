'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckSquare,
  ClipboardList,
  Package,
  Plus,
  Square,
  Store,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Truck,
} from 'lucide-react';

type DashboardActionTarget =
  | 'store-manager'
  | 'tracking'
  | 'quick-generate'
  | 'listing'
  | 'images'
  | 'competitors'
  | 'analyse-simulation';

interface DashboardHomeProps {
  onNavigate: (section: DashboardActionTarget) => void;
}

type StoreShop = { id: string; name: string };
type StoreTransaction = {
  status?: string;
  tracking?: string;
  amountPaid?: number;
  date?: string;
  shopId?: string;
};
type TodoItem = { id: string; text: string; done: boolean };
type GoalItem = { id: string; title: string; current: number; target: number };

const STORE_KEY_SHOPS = 'etsmart_store_manager_shops';
const STORE_KEY_TRANSACTIONS = 'etsmart_store_manager_transactions';
const TODO_KEY = 'etsmart_dashboard_todos_v1';
const GOALS_KEY = 'etsmart_dashboard_goals_v1';
const CA_PERIOD_KEY = 'etsmart_dashboard_ca_period_v1';
/** Filtre CA sur le dashboard uniquement : `global` ou id boutique (une seule à la fois). */
const CA_SHOP_FILTER_KEY = 'etsmart_dashboard_ca_shop_filter_v1';

type CaPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all';

const CA_PERIODS: { id: CaPeriod; label: string; hint: string }[] = [
  { id: 'today', label: "Aujourd'hui", hint: 'Montants encaissés sur la journée en cours.' },
  { id: 'yesterday', label: 'Hier', hint: 'Journée calendaire précédente.' },
  { id: 'week', label: 'Cette semaine', hint: 'Du lundi à aujourd’hui (semaine locale).' },
  { id: 'month', label: 'Ce mois-ci', hint: 'Du 1er au dernier jour du mois en cours.' },
  { id: 'all', label: 'Depuis l’ouverture', hint: 'Total cumulé sur toutes les commandes enregistrées.' },
];

function parseList<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function parseTxLocalDate(dateStr: string | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  return new Date(y, mo, day, 12, 0, 0, 0);
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Lundi = début de semaine (usage FR courant) */
function startOfWeekMonday(ref: Date): Date {
  const d = startOfLocalDay(ref);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

function startOfMonth(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
}

function sumAmountPaid(transactions: StoreTransaction[]): number {
  return transactions.reduce((s, t) => s + (Number.isFinite(t.amountPaid) ? Number(t.amountPaid) : 0), 0);
}

/** Initiale du jour (FR) : D L M M J V S — aligné sur getDay() JS (0 = dimanche) */
function weekdayLetterFr(d: Date): string {
  const letters = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  return letters[d.getDay()] ?? '?';
}

/** Entre noir pur et #0B0F14 : fond page cohérent avec le SaaS */
const DASHBOARD_BG = '#06080A';

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Tendance % vs période précédente équivalente */
function formatTrendPct(current: number, previous: number): {
  label: string;
  positive: boolean | null;
} {
  if (previous > 0) {
    const raw = ((current - previous) / previous) * 100;
    const rounded = Math.round(raw * 10) / 10;
    const sign = rounded > 0 ? '+' : '';
    return { label: `${sign}${rounded}%`, positive: rounded > 0 ? true : rounded < 0 ? false : null };
  }
  if (previous <= 0 && current > 0) {
    return { label: 'vs 0 €', positive: true };
  }
  return { label: '—', positive: null };
}

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  const [shops, setShops] = useState<StoreShop[]>([]);
  const [transactions, setTransactions] = useState<StoreTransaction[]>([]);
  /** null = Global (toutes les boutiques). Sinon id d’une seule boutique. */
  const [caFilterShopId, setCaFilterShopId] = useState<string | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoInput, setTodoInput] = useState('');
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('10');
  const [caPeriod, setCaPeriod] = useState<CaPeriod>('today');

  const reloadFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    const shopList = parseList<StoreShop>(localStorage.getItem(STORE_KEY_SHOPS));
    setShops(shopList);
    setTransactions(parseList<StoreTransaction>(localStorage.getItem(STORE_KEY_TRANSACTIONS)));
    const savedFilter = localStorage.getItem(CA_SHOP_FILTER_KEY);
    if (savedFilter && savedFilter !== 'global' && savedFilter.trim() !== '') {
      const stillExists = shopList.some((s) => s.id === savedFilter);
      setCaFilterShopId(stillExists ? savedFilter : null);
    } else {
      setCaFilterShopId(null);
    }
    setTodos(parseList<TodoItem>(localStorage.getItem(TODO_KEY)));
    setGoals(parseList<GoalItem>(localStorage.getItem(GOALS_KEY)));
    const savedPeriod = localStorage.getItem(CA_PERIOD_KEY);
    if (savedPeriod && CA_PERIODS.some((p) => p.id === savedPeriod)) {
      setCaPeriod(savedPeriod as CaPeriod);
    }
  }, []);

  useEffect(() => {
    reloadFromStorage();
    const onFocus = () => reloadFromStorage();
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') reloadFromStorage();
    };
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === STORE_KEY_TRANSACTIONS ||
        e.key === STORE_KEY_SHOPS ||
        e.key === CA_SHOP_FILTER_KEY
      ) {
        reloadFromStorage();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('storage', onStorage);
    };
  }, [reloadFromStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TODO_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CA_PERIOD_KEY, caPeriod);
  }, [caPeriod]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CA_SHOP_FILTER_KEY, caFilterShopId === null ? 'global' : caFilterShopId);
  }, [caFilterShopId]);

  /** CA filtré : par défaut global ; une boutique si choisie dans le sélecteur. */
  const scopedTransactions = useMemo(() => {
    if (caFilterShopId === null) {
      return transactions;
    }
    return transactions.filter((t) => t.shopId === caFilterShopId);
  }, [transactions, caFilterShopId]);

  const caScopeLabel = useMemo(() => {
    if (caFilterShopId === null) {
      return shops.length <= 1 ? 'Global' : 'Global — toutes les boutiques';
    }
    return shops.find((s) => s.id === caFilterShopId)?.name ?? 'Boutique';
  }, [caFilterShopId, shops]);

  const revenue = useMemo(() => {
    const now = new Date();
    const todayStart = startOfLocalDay(now);
    const todayEnd = endOfLocalDay(now);
    const yesterday = new Date(todayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = startOfLocalDay(yesterday);
    const yesterdayEnd = endOfLocalDay(yesterday);
    const weekStart = startOfWeekMonday(now);
    const weekEnd = endOfLocalDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const inRange = (t: StoreTransaction, start: Date, end: Date) => {
      const td = parseTxLocalDate(t.date);
      if (!td) return false;
      return td >= start && td <= end;
    };

    const all = sumAmountPaid(scopedTransactions);
    const today = sumAmountPaid(scopedTransactions.filter((t) => inRange(t, todayStart, todayEnd)));
    const yesterdaySum = sumAmountPaid(
      scopedTransactions.filter((t) => inRange(t, yesterdayStart, yesterdayEnd))
    );
    const week = sumAmountPaid(scopedTransactions.filter((t) => inRange(t, weekStart, weekEnd)));
    const month = sumAmountPaid(scopedTransactions.filter((t) => inRange(t, monthStart, monthEnd)));

    const dayBeforeYesterday = new Date(yesterdayStart);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
    const dbYStart = startOfLocalDay(dayBeforeYesterday);
    const dbYEnd = endOfLocalDay(dayBeforeYesterday);
    const dayBeforeYesterdaySum = sumAmountPaid(
      scopedTransactions.filter((t) => inRange(t, dbYStart, dbYEnd))
    );

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekStart);
    prevWeekEnd.setMilliseconds(prevWeekEnd.getMilliseconds() - 1);
    const prevWeek = sumAmountPaid(scopedTransactions.filter((t) => inRange(t, prevWeekStart, prevWeekEnd)));

    const prevMonthStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEndDate = endOfMonth(prevMonthStartDate);
    const prevMonthTotal = sumAmountPaid(
      scopedTransactions.filter((t) => inRange(t, prevMonthStartDate, prevMonthEndDate))
    );

    return {
      allTime: all,
      today,
      yesterday: yesterdaySum,
      week,
      month,
      dayBeforeYesterdaySum,
      prevWeek,
      prevMonthTotal,
    };
  }, [scopedTransactions]);

  const caDisplay = useMemo(() => {
    const meta = CA_PERIODS.find((p) => p.id === caPeriod) ?? CA_PERIODS[0];
    const values: Record<CaPeriod, number> = {
      today: revenue.today,
      yesterday: revenue.yesterday,
      week: revenue.week,
      month: revenue.month,
      all: revenue.allTime,
    };
    const value = values[caPeriod];
    let trend = { label: '—', positive: null as boolean | null, compareLabel: '' };
    if (caPeriod === 'today') {
      const t = formatTrendPct(revenue.today, revenue.yesterday);
      trend = { ...t, compareLabel: 'vs hier' };
    } else if (caPeriod === 'yesterday') {
      const t = formatTrendPct(revenue.yesterday, revenue.dayBeforeYesterdaySum);
      trend = { ...t, compareLabel: 'vs avant-hier' };
    } else if (caPeriod === 'week') {
      const t = formatTrendPct(revenue.week, revenue.prevWeek);
      trend = { ...t, compareLabel: 'vs semaine préc.' };
    } else if (caPeriod === 'month') {
      const t = formatTrendPct(revenue.month, revenue.prevMonthTotal);
      trend = { ...t, compareLabel: 'vs mois préc.' };
    } else {
      trend = { label: '—', positive: null, compareLabel: '' };
    }
    return { ...meta, value, trend };
  }, [revenue, caPeriod]);

  /** Semaine civile FR : lundi → dimanche (hauteur barres 0–100 % du max sur la semaine) */
  const revenueSparkline = useMemo(() => {
    const now = new Date();
    const monday = startOfWeekMonday(now);
    const values: number[] = [];
    const dayLabels: string[] = [];
    const dayNamesLong: string[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const d = new Date(monday);
      d.setDate(d.getDate() + offset);
      dayLabels.push(weekdayLetterFr(d));
      dayNamesLong.push(d.toLocaleDateString('fr-FR', { weekday: 'long' }));
      const start = startOfLocalDay(d);
      const end = endOfLocalDay(d);
      const sum = sumAmountPaid(
        scopedTransactions.filter((t) => {
          const td = parseTxLocalDate(t.date);
          if (!td) return false;
          return td >= start && td <= end;
        })
      );
      values.push(sum);
    }
    const max = Math.max(...values, 1);
    return {
      heights: values.map((v) => Math.round((v / max) * 100)),
      dayLabels,
      dayNamesLong,
    };
  }, [scopedTransactions]);

  const pendingToSend = useMemo(
    () => scopedTransactions.filter((t) => (t.status || '').trim() === 'À envoyer').length,
    [scopedTransactions]
  );
  const toModify = useMemo(
    () => scopedTransactions.filter((t) => (t.status || '').trim() === 'À modifier').length,
    [scopedTransactions]
  );
  const sentWithoutTracking = useMemo(
    () =>
      scopedTransactions.filter((t) => {
        const status = (t.status || '').trim();
        const tracking = (t.tracking || '').trim();
        return status === 'Envoyé' && (!tracking || tracking === '—');
      }).length,
    [scopedTransactions]
  );

  const alerts = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      description: string;
      cta: string;
      target: DashboardActionTarget;
      danger?: boolean;
    }> = [];

    if (shops.length === 0) {
      list.push({
        id: 'create-shop',
        title: 'Aucune boutique configurée',
        description: 'Crée ta première boutique pour commencer à suivre commandes, marges et statuts.',
        cta: 'Créer ma boutique',
        target: 'store-manager',
      });
    }
    if (pendingToSend > 0) {
      list.push({
        id: 'pending-send',
        title: `${pendingToSend} commande(s) à envoyer`,
        description: 'Des commandes sont en attente. Priorise cet envoi pour éviter les retards clients.',
        cta: 'Traiter maintenant',
        target: 'store-manager',
        danger: true,
      });
    }
    if (toModify > 0) {
      list.push({
        id: 'to-modify',
        title: `${toModify} commande(s) à modifier`,
        description: 'Ces commandes demandent une correction avant expédition.',
        cta: 'Corriger',
        target: 'store-manager',
      });
    }
    if (sentWithoutTracking > 0) {
      list.push({
        id: 'tracking-missing',
        title: `${sentWithoutTracking} envoi(s) sans tracking`,
        description: 'Ajoute les numéros de suivi pour réduire les tickets support.',
        cta: 'Ajouter tracking',
        target: 'tracking',
      });
    }
    if (list.length === 0) {
      list.push({
        id: 'all-good',
        title: 'Rien d’urgent',
        description: 'Ton gestionnaire est propre. Tu peux lancer de nouvelles actions de croissance.',
        cta: 'Aller au gestionnaire',
        target: 'store-manager',
      });
    }
    return list;
  }, [shops.length, pendingToSend, toModify, sentWithoutTracking]);

  const primaryAlert = alerts[0];
  const secondaryAlerts = alerts.slice(1);

  const addTodo = () => {
    const text = todoInput.trim();
    if (!text) return;
    setTodos((prev) => [{ id: `todo-${Date.now()}`, text, done: false }, ...prev]);
    setTodoInput('');
  };

  const addGoal = () => {
    const title = goalTitle.trim();
    const target = Number.parseInt(goalTarget, 10);
    if (!title || !Number.isFinite(target) || target <= 0) return;
    setGoals((prev) => [{ id: `goal-${Date.now()}`, title, current: 0, target }, ...prev]);
    setGoalTitle('');
    setGoalTarget('10');
  };

  const isUrgent =
    primaryAlert &&
    (primaryAlert.danger ||
      primaryAlert.id === 'tracking-missing' ||
      primaryAlert.id === 'pending-send' ||
      primaryAlert.id === 'to-modify');

  return (
    <div className="min-h-full text-white" style={{ backgroundColor: DASHBOARD_BG }}>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 md:px-8 md:py-12">
        {/* Header */}
        <header className="flex flex-col gap-5 pb-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#6B7280]">
              Vue d’ensemble
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[1.85rem]">
              Dashboard d’actions
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#6B7280]">
              Chiffre d’affaires et actions prioritaires — le reste en un coup d’œil.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('store-manager')}
            className="group inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#11161C] px-4 py-2.5 text-sm font-medium text-[#8B5CF6] shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#8B5CF6]/40 hover:bg-[#1a1f28] hover:text-white hover:shadow-[0_8px_24px_-6px_rgba(139,92,246,0.25)] active:translate-y-0 active:scale-[0.98]"
          >
            Gestionnaire
            <ArrowRight className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5" />
          </button>
        </header>

        {/* 1. Hero CA + action prioritaire */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-6">
          <div className="group relative overflow-hidden rounded-2xl p-7 shadow-[0_14px_48px_-14px_rgba(0,0,0,0.62),0_0_40px_rgba(34,211,238,0.08)] ring-1 ring-[#22D3EE]/[0.14] transition-all duration-500 hover:shadow-[0_18px_56px_-14px_rgba(0,0,0,0.68),0_0_52px_rgba(34,211,238,0.11)] md:p-8 lg:col-span-8">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#121a22] via-[#10161d] to-[#06080A]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#22D3EE]/[0.07] via-transparent to-[#8B5CF6]/[0.05]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#22D3EE]/[0.045] blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-[#8B5CF6]/[0.05] blur-3xl"
              aria-hidden
            />
            <div className="relative z-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
                  Chiffre d’affaires
                </p>
                <label htmlFor="ca-shop-filter" className="mt-2 block text-[11px] font-medium text-[#6B7280]">
                  Boutique
                </label>
                <select
                  id="ca-shop-filter"
                  value={caFilterShopId ?? 'global'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCaFilterShopId(v === 'global' ? null : v);
                  }}
                  className="mt-1 w-full max-w-[min(100%,280px)] cursor-pointer rounded-xl border border-white/5 bg-[#0a0a0a] px-3 py-2 text-sm font-medium text-[#22D3EE] shadow-inner transition-all hover:border-[#22D3EE]/30 hover:bg-[#141414] focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/40 [color-scheme:dark]"
                >
                  <option value="global">Global — toutes les boutiques</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-[#6B7280]/90">
                  Périmètre : <span className="font-medium text-[#6B7280]">{caScopeLabel}</span>
                </p>
              </div>
              <div className="w-full shrink-0 sm:w-[11rem]">
                <label htmlFor="ca-period" className="mb-1.5 block text-[11px] font-medium text-[#6B7280]">
                  Période
                </label>
                <select
                  id="ca-period"
                  value={caPeriod}
                  onChange={(e) => setCaPeriod(e.target.value as CaPeriod)}
                  className="w-full cursor-pointer rounded-xl border border-white/5 bg-[#0a0a0a] px-3.5 py-2.5 text-sm text-white shadow-inner transition-all hover:border-[#22D3EE]/30 hover:bg-[#141414] focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/40 [color-scheme:dark]"
                >
                  {CA_PERIODS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-8 lg:mt-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6B7280]">
                  {caDisplay.label}
                </p>
                <p className="mt-2 text-[2.5rem] font-bold leading-none tabular-nums tracking-tight text-white drop-shadow-[0_0_28px_rgba(34,211,238,0.12)] md:text-[2.75rem] lg:text-[3rem]">
                  {formatEur(caDisplay.value)}
                </p>
                {caPeriod !== 'all' && (
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums ${
                        caDisplay.trend.positive === true
                          ? 'bg-[#22D3EE]/10 text-[#22D3EE]'
                          : caDisplay.trend.positive === false
                            ? 'bg-[#EF4444]/10 text-[#EF4444]'
                            : 'bg-white/[0.04] text-[#6B7280]'
                      }`}
                    >
                      {caDisplay.trend.positive === true && <TrendingUp className="h-3.5 w-3.5" />}
                      {caDisplay.trend.positive === false && <TrendingDown className="h-3.5 w-3.5" />}
                      {caDisplay.trend.label}
                    </span>
                    {caDisplay.trend.compareLabel ? (
                      <span className="text-xs text-[#6B7280]">{caDisplay.trend.compareLabel}</span>
                    ) : null}
                  </div>
                )}
                <p className="mt-4 max-w-md text-xs leading-relaxed text-[#6B7280]">{caDisplay.hint}</p>
              </div>

              <div className="shrink-0 lg:w-[min(100%,220px)]">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#6B7280]">
                  Semaine (lun → dim)
                </p>
                <div className="rounded-xl bg-gradient-to-b from-[#0a0d11]/90 to-[#06080A]/80 px-2.5 pb-1.5 pt-2 ring-1 ring-[#22D3EE]/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex h-16 items-end gap-1.5">
                    {revenueSparkline.heights.map((pct, i) => (
                      <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                        <div
                          className="w-full max-w-[18px] rounded-md bg-gradient-to-t from-[#22D3EE]/50 to-[#22D3EE]/20 shadow-[0_0_12px_rgba(34,211,238,0.15)] transition-all duration-300 group-hover:from-[#22D3EE]/60 group-hover:to-[#22D3EE]/25"
                          style={{ height: `${Math.max(6, 8 + (pct / 100) * 48)}px` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 flex gap-1.5 border-t border-white/[0.05] pt-1.5">
                    {revenueSparkline.dayLabels.map((letter, i) => (
                      <span
                        key={i}
                        className="min-w-0 flex-1 text-center text-[10px] font-bold tabular-nums text-[#6B7280]"
                        title={revenueSparkline.dayNamesLong[i]}
                      >
                        {letter}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>

          <div
            className={`rounded-2xl bg-[#11161C] p-7 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.52)] ring-1 ring-white/[0.08] transition-shadow duration-300 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)] md:p-8 lg:col-span-4 ${
              isUrgent ? 'border-l-[3px] border-[#EF4444]/35' : ''
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
                Action prioritaire
              </p>
              {isUrgent && primaryAlert ? (
                <span className="rounded-md bg-[#EF4444]/[0.12] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#EF4444]">
                  À traiter
                </span>
              ) : null}
            </div>
            {primaryAlert && (
              <>
                <p className="mt-3 text-base font-semibold leading-snug text-white">{primaryAlert.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{primaryAlert.description}</p>
                <button
                  type="button"
                  onClick={() => onNavigate(primaryAlert.target)}
                  className={
                    isUrgent
                      ? 'mt-6 w-full cursor-pointer rounded-xl border border-red-400/20 bg-[#EF4444] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_-4px_rgba(239,68,68,0.4)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-red-300/30 hover:bg-[#f87171] hover:shadow-[0_8px_28px_-4px_rgba(239,68,68,0.45)] active:translate-y-0 active:scale-[0.98] sm:w-auto'
                      : 'mt-6 w-full cursor-pointer rounded-xl border border-[#22D3EE]/30 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] px-4 py-2.5 text-sm font-semibold text-black shadow-[0_4px_16px_-4px_rgba(34,211,238,0.35)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:opacity-95 hover:shadow-[0_8px_28px_-4px_rgba(34,211,238,0.4)] active:translate-y-0 active:scale-[0.98] sm:w-auto'
                  }
                >
                  {primaryAlert.id === 'tracking-missing'
                    ? 'Corriger maintenant'
                    : primaryAlert.cta}
                </button>
              </>
            )}
            {secondaryAlerts.length > 0 && (
              <ul className="mt-6 space-y-3 border-t border-white/[0.06] pt-5">
                {secondaryAlerts.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-[#6B7280]">{a.title}</span>
                    <button
                      type="button"
                      onClick={() => onNavigate(a.target)}
                      className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-[#22D3EE] transition-all duration-200 hover:bg-[#22D3EE]/15 hover:text-white hover:ring-1 hover:ring-[#22D3EE]/35 active:scale-[0.97]"
                    >
                      {a.cta}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 2. Indicateurs — compacts */}
        <section>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
            Indicateurs
          </p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
            {[
              { label: 'Boutiques actives', value: shops.length, Icon: Store },
              { label: 'À envoyer', value: pendingToSend, Icon: Package },
              { label: 'À modifier', value: toModify, Icon: ClipboardList },
              { label: 'Sans tracking', value: sentWithoutTracking, Icon: Truck },
            ].map(({ label, value, Icon }, i) => {
              const isCyan = i % 2 === 0;
              return (
              <div
                key={label}
                className={`rounded-xl bg-[#11161C] px-3.5 py-3.5 shadow-[0_4px_24px_-10px_rgba(0,0,0,0.52)] ring-1 ring-white/[0.08] transition-all duration-300 ease-out hover:-translate-y-0.5 lg:px-4 lg:py-4 ${
                  isCyan
                    ? 'hover:shadow-[0_14px_36px_-14px_rgba(0,0,0,0.58),0_0_32px_rgba(34,211,238,0.08)] hover:ring-[#22D3EE]/20'
                    : 'hover:shadow-[0_14px_36px_-14px_rgba(0,0,0,0.58),0_0_32px_rgba(139,92,246,0.09)] hover:ring-[#8B5CF6]/20'
                }`}
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${
                    isCyan
                      ? 'from-[#22D3EE]/35 to-[#22D3EE]/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_rgba(34,211,238,0.14)]'
                      : 'from-[#8B5CF6]/32 to-[#8B5CF6]/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_rgba(139,92,246,0.14)]'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isCyan ? 'text-[#22D3EE]' : 'text-[#8B5CF6]'}`}
                    strokeWidth={1.75}
                  />
                </div>
                <p className="text-xl font-bold tabular-nums tracking-tight text-white lg:text-2xl">{value}</p>
                <p className="mt-1 text-[11px] font-medium leading-snug text-[#6B7280]">{label}</p>
              </div>
            );
            })}
          </div>
        </section>

        {/* 3. Todo + Objectifs */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-8">
          <div className="rounded-2xl bg-[#11161C] p-7 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.52)] ring-1 ring-white/[0.08] transition-shadow duration-300 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55),0_0_36px_rgba(34,211,238,0.05)] md:p-8">
            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#22D3EE]/25 to-[#22D3EE]/[0.06] shadow-[0_0_16px_rgba(34,211,238,0.1)]">
                <ClipboardList className="h-4 w-4 text-[#22D3EE]" strokeWidth={1.75} />
              </div>
              <h2 className="text-sm font-semibold text-white">Tâches</h2>
            </div>
            <p className="mb-6 text-xs text-[#6B7280]">Coche quand c’est fait.</p>
            <div className="mb-6 flex gap-2">
              <input
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                placeholder="Ajouter une tâche…"
                className="min-w-0 flex-1 rounded-xl border border-white/5 bg-[#0a0a0a] px-3.5 py-2.5 text-sm text-white transition-all placeholder:text-[#6B7280]/60 hover:border-white/10 focus:border-[#22D3EE]/30 focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30"
              />
              <button
                type="button"
                onClick={addTodo}
                className="cursor-pointer rounded-xl border border-white/10 bg-[#11161C] px-3.5 py-2.5 text-[#22D3EE] transition-all hover:-translate-y-0.5 hover:border-[#22D3EE]/40 hover:bg-[#22D3EE]/15 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] active:translate-y-0 active:scale-[0.97]"
                aria-label="Ajouter"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2">
              {todos.length === 0 && <li className="text-sm text-[#6B7280]">Aucune tâche.</li>}
              {todos.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl bg-[#0C1016] px-3.5 py-3 ring-1 ring-white/[0.05] transition-colors hover:ring-white/[0.08]"
                >
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded-lg p-0.5 text-[#22D3EE] transition-all hover:bg-[#22D3EE]/10 hover:ring-1 hover:ring-[#22D3EE]/25 active:scale-95"
                    onClick={() =>
                      setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
                    }
                    aria-label={t.done ? 'Marquer non fait' : 'Marquer fait'}
                  >
                    {t.done ? (
                      <CheckSquare className="h-5 w-5" strokeWidth={1.75} />
                    ) : (
                      <Square className="h-5 w-5 text-[#6B7280]" strokeWidth={1.75} />
                    )}
                  </button>
                  <span
                    className={`min-w-0 flex-1 text-sm ${t.done ? 'text-[#6B7280] line-through' : 'text-white'}`}
                  >
                    {t.text}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded-md p-1.5 text-[#6B7280] transition-all hover:bg-[#EF4444]/10 hover:text-[#EF4444] hover:ring-1 hover:ring-[#EF4444]/25 active:scale-95"
                    onClick={() => setTodos((prev) => prev.filter((x) => x.id !== t.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-[#11161C] p-7 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.52)] ring-1 ring-white/[0.08] transition-shadow duration-300 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55),0_0_36px_rgba(139,92,246,0.07)] md:p-8">
            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#8B5CF6]/28 to-[#8B5CF6]/[0.06] shadow-[0_0_16px_rgba(139,92,246,0.12)]">
                <Trophy className="h-4 w-4 text-[#8B5CF6]" strokeWidth={1.75} />
              </div>
              <h2 className="text-sm font-semibold text-white">Objectifs</h2>
            </div>
            <p className="mb-6 text-xs text-[#6B7280]">Progression manuelle.</p>
            <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_88px_auto]">
              <input
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="Intitulé"
                className="rounded-xl border border-white/5 bg-[#0a0a0a] px-3.5 py-2.5 text-sm text-white transition-all placeholder:text-[#6B7280]/60 hover:border-white/10 focus:border-[#8B5CF6]/35 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
              />
              <input
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                placeholder="Cible"
                className="rounded-xl border border-white/5 bg-[#0a0a0a] px-3.5 py-2.5 text-sm text-white transition-all placeholder:text-[#6B7280]/60 hover:border-white/10 focus:border-[#8B5CF6]/35 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
              />
              <button
                type="button"
                onClick={addGoal}
                className="cursor-pointer rounded-xl border border-violet-400/30 bg-[#8B5CF6] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:border-violet-300/40 hover:bg-[#9d6ff7] hover:shadow-[0_8px_24px_-4px_rgba(139,92,246,0.45)] active:translate-y-0 active:scale-[0.98]"
              >
                Ajouter
              </button>
            </div>
            <div className="max-h-[280px] space-y-4 overflow-y-auto pr-1">
              {goals.length === 0 && <p className="text-sm text-[#6B7280]">Aucun objectif.</p>}
              {goals.map((g) => {
                const progress = Math.max(0, Math.min(100, Math.round((g.current / g.target) * 100)));
                return (
                  <div
                    key={g.id}
                    className="rounded-xl bg-[#0C1016] p-4 ring-1 ring-white/[0.05] transition-colors hover:ring-white/[0.08]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-white">{g.title}</p>
                      <p className="shrink-0 text-xs tabular-nums text-[#6B7280]">
                        {g.current} / {g.target}
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-[#8B5CF6] transition-[width] duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-[#6B7280] transition-all hover:border-white/20 hover:bg-white/[0.12] hover:text-white active:scale-95"
                        onClick={() =>
                          setGoals((prev) =>
                            prev.map((x) => (x.id === g.id ? { ...x, current: Math.max(0, x.current - 1) } : x))
                          )
                        }
                      >
                        −1
                      </button>
                      <button
                        type="button"
                        className="cursor-pointer rounded-lg border border-[#8B5CF6]/30 bg-[#8B5CF6]/15 px-2.5 py-1 text-xs font-semibold text-[#8B5CF6] transition-all hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/30 hover:text-white hover:shadow-[0_0_16px_rgba(139,92,246,0.25)] active:scale-95"
                        onClick={() =>
                          setGoals((prev) =>
                            prev.map((x) =>
                              x.id === g.id ? { ...x, current: Math.min(x.target, x.current + 1) } : x
                            )
                          )
                        }
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        className="ml-auto cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-[#6B7280] transition-all hover:bg-[#EF4444]/10 hover:text-[#EF4444] active:scale-95"
                        onClick={() => setGoals((prev) => prev.filter((x) => x.id !== g.id))}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. Raccourcis */}
        <section>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
            Raccourcis
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Gestionnaire boutique',
                icon: Store,
                target: 'store-manager' as const,
                accent: 'text-[#22D3EE]',
                orb: 'from-[#22D3EE]/30 to-[#22D3EE]/[0.06] shadow-[0_0_18px_rgba(34,211,238,0.1)]',
              },
              {
                label: 'Suivi colis',
                icon: Truck,
                target: 'tracking' as const,
                accent: 'text-[#22D3EE]',
                orb: 'from-[#22D3EE]/28 to-[#22D3EE]/[0.06] shadow-[0_0_18px_rgba(34,211,238,0.1)]',
              },
              {
                label: 'Analyse boutique',
                icon: Target,
                target: 'competitors' as const,
                accent: 'text-[#8B5CF6]',
                orb: 'from-[#8B5CF6]/28 to-[#8B5CF6]/[0.06] shadow-[0_0_18px_rgba(139,92,246,0.12)]',
              },
              {
                label: 'Génération rapide',
                icon: ClipboardList,
                target: 'quick-generate' as const,
                accent: 'text-[#8B5CF6]',
                orb: 'from-[#8B5CF6]/26 to-[#8B5CF6]/[0.06] shadow-[0_0_18px_rgba(139,92,246,0.12)]',
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.target)}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#11161C] px-4 py-3.5 text-left shadow-md transition-all duration-200 ease-out hover:-translate-y-1 hover:border-white/20 hover:bg-[#1a222c] hover:shadow-lg active:translate-y-0 active:scale-[0.99]"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${item.orb}`}
                >
                  <item.icon className={`h-[18px] w-[18px] ${item.accent}`} strokeWidth={1.75} />
                </div>
                <span className="text-sm font-medium text-white">{item.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
