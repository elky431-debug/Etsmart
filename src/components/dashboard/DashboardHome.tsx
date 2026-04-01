'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckSquare,
  ChevronRight,
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
import { DashboardFilterSelect } from '@/components/dashboard/DashboardFilterSelect';

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
  userId?: string;
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

function homeKeys(uid: string | undefined) {
  const s = uid ? `_${uid}` : '';
  return {
    shops:       `etsmart_store_manager_shops${s}`,
    transactions:`etsmart_store_manager_transactions${s}`,
    todos:       `etsmart_dashboard_todos_v1${s}`,
    goals:       `etsmart_dashboard_goals_v1${s}`,
    caPeriod:    `etsmart_dashboard_ca_period_v1${s}`,
    caShopFilter:`etsmart_dashboard_ca_shop_filter_v1${s}`,
  };
}

/** Dégradé texte Etsmart (identique au mot « Dashboard ») */
const ET_TEXT_GRADIENT =
  'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent';
/** Bleu-gris froid pour sous-titres / cartes action (même famille que la marque) */
const ET_MUTED_LABEL = 'text-[#6d95a8]';
const ET_MUTED_BODY = 'text-[#5c8494]';

type CaPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all';

const CA_PERIODS: { id: CaPeriod; label: string; hint: string }[] = [
  { id: 'today', label: "Aujourd'hui", hint: 'Montants encaissés sur la journée en cours.' },
  { id: 'yesterday', label: 'Hier', hint: 'Journée calendaire précédente.' },
  { id: 'week', label: 'Cette semaine', hint: "Du lundi à aujourd'hui (semaine locale)." },
  { id: 'month', label: 'Ce mois-ci', hint: 'Du 1er au dernier jour du mois en cours.' },
  { id: 'all', label: "Depuis l'ouverture", hint: 'Total cumulé sur toutes les commandes enregistrées.' },
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

export function DashboardHome({ onNavigate, userId }: DashboardHomeProps) {
  const keys = useMemo(() => homeKeys(userId), [userId]);
  const [shops, setShops] = useState<StoreShop[]>([]);
  const [transactions, setTransactions] = useState<StoreTransaction[]>([]);
  /** null = Global (toutes les boutiques). Sinon id d'une seule boutique. */
  const [caFilterShopId, setCaFilterShopId] = useState<string | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoInput, setTodoInput] = useState('');
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('10');
  const [caPeriod, setCaPeriod] = useState<CaPeriod>('today');

  const reloadFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    const shopList = parseList<StoreShop>(localStorage.getItem(keys.shops));
    setShops(shopList);
    setTransactions(parseList<StoreTransaction>(localStorage.getItem(keys.transactions)));
    const savedFilter = localStorage.getItem(keys.caShopFilter);
    if (savedFilter && savedFilter !== 'global' && savedFilter.trim() !== '') {
      const stillExists = shopList.some((s) => s.id === savedFilter);
      setCaFilterShopId(stillExists ? savedFilter : null);
    } else {
      setCaFilterShopId(null);
    }
    setTodos(parseList<TodoItem>(localStorage.getItem(keys.todos)));
    setGoals(parseList<GoalItem>(localStorage.getItem(keys.goals)));
    const savedPeriod = localStorage.getItem(keys.caPeriod);
    if (savedPeriod && CA_PERIODS.some((p) => p.id === savedPeriod)) {
      setCaPeriod(savedPeriod as CaPeriod);
    }
  }, [keys]);

  useEffect(() => {
    reloadFromStorage();
    const onFocus = () => reloadFromStorage();
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') reloadFromStorage();
    };
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === keys.transactions ||
        e.key === keys.shops ||
        e.key === keys.caShopFilter
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
  }, [reloadFromStorage, keys]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(keys.todos, JSON.stringify(todos));
  }, [todos, keys.todos]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(keys.goals, JSON.stringify(goals));
  }, [goals, keys.goals]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(keys.caPeriod, caPeriod);
  }, [caPeriod, keys.caPeriod]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(keys.caShopFilter, caFilterShopId === null ? 'global' : caFilterShopId);
  }, [caFilterShopId, keys.caShopFilter]);

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
        title: "Rien d'urgent",
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
    <div className="min-h-full bg-black text-white">
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 md:px-8 md:py-10 lg:px-10">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Vue d'ensemble</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-[2rem]">
              <span className={ET_TEXT_GRADIENT}>Dashboard</span>{' '}
              <span className="text-white">d'actions</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/50">
              Chiffre d'affaires et actions prioritaires — le reste en un coup d'œil.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('store-manager')}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:border-[#00d4ff]/45 hover:bg-[#00d4ff]/10 hover:text-[#00d4ff]"
          >
            Gestionnaire
            <ArrowRight className="h-4 w-4" />
          </button>
        </header>

        {/* Zone principale : action d'abord sur mobile, CA à gauche sur grand écran */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
          <div
            className={`order-1 rounded-2xl border border-white/10 bg-black p-6 md:p-7 lg:order-2 lg:col-span-4 ${
              isUrgent ? 'border-l-4 border-l-white' : 'border-l-4 border-l-[#00d4ff]'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${ET_MUTED_LABEL}`}
              >
                Action prioritaire
              </p>
              {isUrgent && primaryAlert ? (
                <span className="rounded-full border border-white/25 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  À traiter
                </span>
              ) : null}
            </div>
            {primaryAlert && (
              <>
                <p className={`mt-4 text-lg font-semibold leading-snug ${ET_TEXT_GRADIENT}`}>
                  {primaryAlert.title}
                </p>
                <p className={`mt-2 text-sm leading-relaxed ${ET_MUTED_BODY}`}>
                  {primaryAlert.description}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate(primaryAlert.target)}
                  className={
                    isUrgent
                      ? 'mt-6 w-full cursor-pointer rounded-xl border-2 border-white bg-black px-4 py-2.5 text-sm font-semibold text-[#00d4ff] shadow-[0_0_20px_-6px_rgba(0,212,255,0.35)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#00d4ff]/10 hover:text-[#00d4ff] hover:shadow-[0_0_28px_-4px_rgba(0,212,255,0.45)] active:translate-y-0 active:scale-[0.98] sm:w-auto'
                      : 'mt-6 w-full cursor-pointer rounded-xl border border-[#00d4ff]/40 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] px-4 py-2.5 text-sm font-semibold text-black shadow-[0_4px_24px_-6px_rgba(0,212,255,0.45)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_32px_-6px_rgba(0,212,255,0.5)] active:translate-y-0 active:scale-[0.98] sm:w-auto'
                  }
                >
                  {primaryAlert.id === 'tracking-missing'
                    ? 'Corriger maintenant'
                    : primaryAlert.cta}
                </button>
              </>
            )}
            {secondaryAlerts.length > 0 && (
              <ul className="mt-6 space-y-3 border-t border-white/10 pt-5">
                {secondaryAlerts.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-white/50">{a.title}</span>
                    <button
                      type="button"
                      onClick={() => onNavigate(a.target)}
                      className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-[#00d4ff] transition-all duration-200 hover:bg-[#00d4ff]/12 hover:text-white hover:ring-1 hover:ring-[#00d4ff]/35 active:scale-[0.97]"
                    >
                      {a.cta}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="order-2 rounded-2xl border border-white/10 bg-black p-6 md:p-8 lg:order-1 lg:col-span-8">
            <div className="flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Chiffre d'affaires
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <DashboardFilterSelect
                      id="ca-shop-filter"
                      label="Boutique"
                      value={caFilterShopId ?? 'global'}
                      onChange={(v) => setCaFilterShopId(v === 'global' ? null : v)}
                      triggerClassName="w-full sm:max-w-[280px]"
                      options={[
                        { value: 'global', label: 'Global — toutes les boutiques' },
                        ...shops.map((s) => ({ value: s.id, label: s.name })),
                      ]}
                    />
                    <p className="mt-1.5 text-xs text-white/40">
                      Périmètre : <span className="text-white/70">{caScopeLabel}</span>
                    </p>
                  </div>
                  <div>
                    <DashboardFilterSelect
                      id="ca-period"
                      label="Période"
                      value={caPeriod}
                      onChange={(v) => setCaPeriod(v as CaPeriod)}
                      triggerClassName="w-full sm:max-w-[220px]"
                      options={CA_PERIODS.map((p) => ({ value: p.id, label: p.label }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">
                  {caDisplay.label}
                </p>
                <p className="mt-2 text-[2.5rem] font-bold leading-none tabular-nums tracking-tight md:text-[2.85rem] lg:text-[3.25rem]">
                  <span className={ET_TEXT_GRADIENT}>{formatEur(caDisplay.value)}</span>
                </p>
                {caPeriod !== 'all' && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold tabular-nums ${
                        caDisplay.trend.positive === true
                          ? 'border-[#00d4ff]/30 bg-[#00d4ff]/10 text-[#00d4ff]'
                          : caDisplay.trend.positive === false
                            ? 'border-white/15 bg-white/5 text-white/55'
                            : 'border-white/10 bg-white/[0.04] text-white/45'
                      }`}
                    >
                      {caDisplay.trend.positive === true && <TrendingUp className="h-3.5 w-3.5" />}
                      {caDisplay.trend.positive === false && <TrendingDown className="h-3.5 w-3.5" />}
                      {caDisplay.trend.label}
                    </span>
                    {caDisplay.trend.compareLabel ? (
                      <span className="text-xs text-white/45">{caDisplay.trend.compareLabel}</span>
                    ) : null}
                  </div>
                )}
                <p className="mt-4 max-w-lg text-xs leading-relaxed text-white/40">{caDisplay.hint}</p>
              </div>

              <div className="w-full lg:w-[220px]">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">
                  Semaine (lun → dim)
                </p>
                <div className="rounded-xl border border-white/10 bg-black px-3 pb-2 pt-3 ring-1 ring-inset ring-white/[0.04]">
                  <div className="group flex h-20 items-end gap-1.5">
                    {revenueSparkline.heights.map((pct, i) => (
                      <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                        <div
                          className="w-full max-w-[20px] rounded-sm bg-gradient-to-t from-[#00d4ff] to-[#00c9b7] opacity-90 transition-opacity group-hover:opacity-100"
                          style={{ height: `${Math.max(8, 10 + (pct / 100) * 56)}px` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-1 border-t border-white/5 pt-2">
                    {revenueSparkline.dayLabels.map((letter, i) => (
                      <span
                        key={i}
                        className="min-w-0 flex-1 text-center text-[10px] font-bold tabular-nums text-white/40"
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
        </section>

        {/* Indicateurs — grille minimaliste */}
        <section>
          <div className="mb-5 flex items-center gap-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Indicateurs</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              { label: 'Boutiques actives', value: shops.length, Icon: Store },
              { label: 'À envoyer', value: pendingToSend, Icon: Package },
              { label: 'À modifier', value: toModify, Icon: ClipboardList },
              { label: 'Sans tracking', value: sentWithoutTracking, Icon: Truck },
            ].map(({ label, value, Icon }, i) => {
              const accentBlue = i % 2 === 0;
              return (
                <div
                  key={label}
                  className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black p-5 transition-all hover:border-white/18 ${
                    accentBlue
                      ? 'hover:shadow-[0_0_40px_-12px_rgba(0,212,255,0.2)]'
                      : 'hover:shadow-[0_0_28px_-12px_rgba(255,255,255,0.06)]'
                  }`}
                >
                  <Icon
                    className={`absolute right-4 top-4 h-5 w-5 ${accentBlue ? 'text-[#00d4ff]/50' : 'text-white/25'}`}
                    strokeWidth={1.5}
                  />
                  <p className="text-3xl font-bold tabular-nums text-white">{value}</p>
                  <p className="mt-2 pr-8 text-[11px] font-medium leading-snug text-white/45">{label}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* To do list + objectifs — deux colonnes inversées sur XL (objectifs à gauche) */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-8">
          <div className="order-2 rounded-2xl border border-white/10 bg-black p-6 md:p-8 xl:order-1">
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#00d4ff]/30 bg-[#00d4ff]/10">
                <ClipboardList className="h-4 w-4 text-[#00d4ff]" strokeWidth={1.75} />
              </div>
              <h2 className="text-base font-semibold text-white">To do list</h2>
            </div>
            <p className="mb-6 text-xs text-white/50">Coche quand c'est fait.</p>
            <div className="mb-6 flex gap-2">
              <input
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                placeholder="Ajouter une tâche…"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white transition-all placeholder:text-white/35 focus:border-[#00d4ff]/45 focus:outline-none focus:ring-1 focus:ring-[#00d4ff]/25"
              />
              <button
                type="button"
                onClick={addTodo}
                className="cursor-pointer rounded-xl border border-[#00d4ff]/40 bg-[#00d4ff]/12 px-4 py-3 text-[#00d4ff] transition-all hover:bg-[#00d4ff]/22"
                aria-label="Ajouter"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2">
              {todos.length === 0 && <li className="text-sm text-white/40">Aucune tâche.</li>}
              {todos.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black px-4 py-3 transition-colors hover:border-white/15"
                >
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded-lg p-0.5 text-[#00d4ff] transition-all hover:bg-[#00d4ff]/10 hover:ring-1 hover:ring-[#00d4ff]/30 active:scale-95"
                    onClick={() =>
                      setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
                    }
                    aria-label={t.done ? 'Marquer non fait' : 'Marquer fait'}
                  >
                    {t.done ? (
                      <CheckSquare className="h-5 w-5" strokeWidth={1.75} />
                    ) : (
                      <Square className="h-5 w-5 text-white/35" strokeWidth={1.75} />
                    )}
                  </button>
                  <span
                    className={`min-w-0 flex-1 text-sm ${t.done ? 'text-white/35 line-through' : 'text-white'}`}
                  >
                    {t.text}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded-md p-1.5 text-white/40 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                    onClick={() => setTodos((prev) => prev.filter((x) => x.id !== t.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="order-1 rounded-2xl border border-white/10 bg-black p-6 md:p-8 xl:order-2">
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04]">
                <Trophy className="h-4 w-4 text-[#00d4ff]" strokeWidth={1.75} />
              </div>
              <h2 className="text-base font-semibold text-white">Objectifs</h2>
            </div>
            <p className="mb-6 text-xs text-white/50">Progression manuelle.</p>
            <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_88px_auto]">
              <input
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="Intitulé"
                className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white transition-all placeholder:text-white/35 focus:border-[#00d4ff]/45 focus:outline-none focus:ring-1 focus:ring-[#00d4ff]/25"
              />
              <input
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                placeholder="Cible"
                className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white transition-all placeholder:text-white/35 focus:border-[#00d4ff]/45 focus:outline-none focus:ring-1 focus:ring-[#00d4ff]/25"
              />
              <button
                type="button"
                onClick={addGoal}
                className="cursor-pointer rounded-xl border border-[#00d4ff]/35 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] px-4 py-3 text-sm font-semibold text-black transition-all hover:brightness-110"
              >
                Ajouter
              </button>
            </div>
            <div className="custom-scrollbar max-h-[280px] space-y-4 overflow-y-auto pr-1">
              {goals.length === 0 && <p className="text-sm text-white/40">Aucun objectif.</p>}
              {goals.map((g) => {
                const progress = Math.max(0, Math.min(100, Math.round((g.current / g.target) * 100)));
                return (
                  <div
                    key={g.id}
                    className="rounded-xl border border-white/8 bg-black p-4 transition-colors hover:border-white/15"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-white">{g.title}</p>
                      <p className="shrink-0 text-xs tabular-nums text-white/50">
                        {g.current} / {g.target}
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] transition-[width] duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="cursor-pointer rounded-lg border border-white/12 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/50 transition-all hover:bg-white/10 hover:text-white active:scale-95"
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
                        className="cursor-pointer rounded-lg border border-[#00d4ff]/35 bg-[#00d4ff]/12 px-2.5 py-1 text-xs font-semibold text-[#00d4ff] transition-all hover:border-[#00d4ff]/55 hover:bg-[#00d4ff]/22 hover:text-white hover:shadow-[0_0_20px_-4px_rgba(0,212,255,0.35)] active:scale-95"
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
                        className="ml-auto cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-white/45 transition-all hover:bg-white/10 hover:text-white active:scale-95"
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

        {/* Raccourcis — liste type "réglages" */}
        <section>
          <div className="mb-4 flex items-center gap-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Raccourcis</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
            {[
              {
                label: 'Gestionnaire boutique',
                icon: Store,
                target: 'store-manager' as const,
              },
              {
                label: 'Suivi colis',
                icon: Truck,
                target: 'tracking' as const,
              },
              {
                label: 'Analyse boutique',
                icon: Target,
                target: 'competitors' as const,
              },
              {
                label: 'Génération rapide',
                icon: ClipboardList,
                target: 'quick-generate' as const,
              },
            ].map((item, idx) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.target)}
                className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black px-4 py-4 text-left transition-all hover:border-[#00d4ff]/25 hover:bg-[#00d4ff]/5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      idx % 2 === 0
                        ? 'border-[#00d4ff]/30 bg-[#00d4ff]/10'
                        : 'border-white/12 bg-white/[0.04]'
                    }`}
                  >
                    <item.icon
                      className={`h-[18px] w-[18px] ${idx % 2 === 0 ? 'text-[#00d4ff]' : 'text-white/55'}`}
                      strokeWidth={1.75}
                    />
                  </span>
                  <span className="truncate text-sm font-medium text-white/85 group-hover:text-white">
                    {item.label}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:text-[#00d4ff]" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
