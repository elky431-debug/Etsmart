'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardList,
  Plus,
  Store,
  Target,
  Trash2,
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
type StoreTransaction = { status?: string; tracking?: string };
type TodoItem = { id: string; text: string; done: boolean };
type GoalItem = { id: string; title: string; current: number; target: number };

const STORE_KEY_SHOPS = 'etsmart_store_manager_shops';
const STORE_KEY_TRANSACTIONS = 'etsmart_store_manager_transactions';
const TODO_KEY = 'etsmart_dashboard_todos_v1';
const GOALS_KEY = 'etsmart_dashboard_goals_v1';

function parseList<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  const [shops, setShops] = useState<StoreShop[]>([]);
  const [transactions, setTransactions] = useState<StoreTransaction[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoInput, setTodoInput] = useState('');
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('10');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setShops(parseList<StoreShop>(localStorage.getItem(STORE_KEY_SHOPS)));
    setTransactions(parseList<StoreTransaction>(localStorage.getItem(STORE_KEY_TRANSACTIONS)));
    setTodos(parseList<TodoItem>(localStorage.getItem(TODO_KEY)));
    setGoals(parseList<GoalItem>(localStorage.getItem(GOALS_KEY)));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TODO_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  }, [goals]);

  const pendingToSend = useMemo(
    () => transactions.filter((t) => (t.status || '').trim() === 'À envoyer').length,
    [transactions]
  );
  const toModify = useMemo(
    () => transactions.filter((t) => (t.status || '').trim() === 'À modifier').length,
    [transactions]
  );
  const sentWithoutTracking = useMemo(
    () =>
      transactions.filter((t) => {
        const status = (t.status || '').trim();
        const tracking = (t.tracking || '').trim();
        return status === 'Envoyé' && (!tracking || tracking === '—');
      }).length,
    [transactions]
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

  return (
    <div className="p-4 md:p-8 bg-black">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">Dashboard d’actions</h1>
            <p className="text-white/60 mt-1">
              Priorités du jour pour le gestionnaire de boutique, avec raccourcis rapides.
            </p>
          </div>
          <button
            onClick={() => onNavigate('store-manager')}
            className="inline-flex items-center gap-2 rounded-xl border border-[#00d4ff]/40 bg-[#00d4ff]/10 px-4 py-2 text-sm font-medium text-[#9befff] hover:bg-[#00d4ff]/20"
          >
            Ouvrir le gestionnaire
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/60">Boutiques actives</p>
            <p className="text-2xl font-bold text-white mt-1">{shops.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/60">Commandes à envoyer</p>
            <p className="text-2xl font-bold text-amber-300 mt-1">{pendingToSend}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/60">À modifier</p>
            <p className="text-2xl font-bold text-white mt-1">{toModify}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/60">Tracking manquant</p>
            <p className="text-2xl font-bold text-rose-300 mt-1">{sentWithoutTracking}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-white font-semibold mb-4">Ce qu’il faut faire maintenant</h2>
          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-start gap-3">
                  {a.danger ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{a.title}</p>
                    <p className="text-xs text-white/60 mt-1">{a.description}</p>
                  </div>
                  <button
                    onClick={() => onNavigate(a.target)}
                    className="px-3 py-1.5 rounded-lg border border-[#00d4ff]/40 bg-[#00d4ff]/10 text-xs text-[#9befff] hover:bg-[#00d4ff]/20"
                  >
                    {a.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-white font-semibold mb-3">Todo list</h3>
            <div className="flex gap-2 mb-3">
              <input
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                placeholder="Ex: Envoyer 5 commandes avant 18h"
                className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#00d4ff]/50"
              />
              <button
                onClick={addTodo}
                className="px-3 py-2 rounded-lg bg-[#00d4ff]/20 border border-[#00d4ff]/40 text-[#9befff]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {todos.length === 0 && <p className="text-xs text-white/50">Aucune tâche pour l’instant.</p>}
              {todos.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-2.5">
                  <button onClick={() => setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}>
                    {t.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-white/50" />}
                  </button>
                  <p className={`flex-1 text-sm ${t.done ? 'text-white/40 line-through' : 'text-white/85'}`}>{t.text}</p>
                  <button onClick={() => setTodos((prev) => prev.filter((x) => x.id !== t.id))}>
                    <Trash2 className="w-4 h-4 text-white/50 hover:text-rose-300" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-white font-semibold mb-3">Objectifs</h3>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 mb-3">
              <input
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="Ex: Commandes envoyées aujourd’hui"
                className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#00d4ff]/50"
              />
              <input
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                placeholder="Cible"
                className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#00d4ff]/50"
              />
              <button
                onClick={addGoal}
                className="px-3 py-2 rounded-lg bg-[#00d4ff]/20 border border-[#00d4ff]/40 text-[#9befff] text-sm"
              >
                Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {goals.length === 0 && <p className="text-xs text-white/50">Aucun objectif défini.</p>}
              {goals.map((g) => {
                const progress = Math.max(0, Math.min(100, Math.round((g.current / g.target) * 100)));
                return (
                  <div key={g.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-white font-medium">{g.title}</p>
                      <p className="text-xs text-white/60">{g.current}/{g.target}</p>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 mt-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button className="px-2 py-1 text-xs rounded border border-white/20 text-white/80" onClick={() => setGoals((prev) => prev.map((x) => x.id === g.id ? { ...x, current: Math.max(0, x.current - 1) } : x))}>-1</button>
                      <button className="px-2 py-1 text-xs rounded border border-[#00d4ff]/40 text-[#9befff]" onClick={() => setGoals((prev) => prev.map((x) => x.id === g.id ? { ...x, current: Math.min(x.target, x.current + 1) } : x))}>+1</button>
                      <button className="ml-auto px-2 py-1 text-xs rounded border border-white/20 text-white/80" onClick={() => setGoals((prev) => prev.filter((x) => x.id !== g.id))}>Supprimer</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-white font-semibold mb-3">Raccourcis</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Gestionnaire boutique', icon: Store, target: 'store-manager' as DashboardActionTarget },
              { label: 'Suivi colis', icon: Truck, target: 'tracking' as DashboardActionTarget },
              { label: 'Analyse boutique', icon: Target, target: 'competitors' as DashboardActionTarget },
              { label: 'Génération rapide', icon: ClipboardList, target: 'quick-generate' as DashboardActionTarget },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => onNavigate(item.target)}
                className="rounded-xl border border-white/10 bg-black/30 p-3 text-left hover:border-[#00d4ff]/40 transition-colors"
              >
                <item.icon className="w-5 h-5 text-[#00d4ff] mb-2" />
                <p className="text-sm text-white font-medium">{item.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
