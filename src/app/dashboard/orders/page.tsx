'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Plus, Trash2, Truck, Link as LinkIcon, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type OrderStatus = 'pending_tracking' | 'registered' | 'in_transit' | 'delivered' | 'exception';

interface OrderItem {
  id: string;
  user_id: string;
  aliexpress_order_id: string;
  product_name: string | null;
  product_image: string | null;
  tracking_number: string | null;
  carrier: string | null;
  status: OrderStatus;
  last_event: string | null;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ToastItem {
  id: string;
  message: string;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_tracking: 'En attente du numéro de suivi',
  registered: 'Enregistré',
  in_transit: 'En transit',
  delivered: 'Livré',
  exception: 'Problème de livraison',
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending_tracking: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
  registered: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  in_transit: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  delivered: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  exception: 'bg-red-500/20 text-red-300 border-red-400/30',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderIdInput, setOrderIdInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Session expirée. Reconnecte-toi.');
        return;
      }
      const res = await fetch('/api/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Impossible de charger les commandes.');
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors du chargement.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, user]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('orders')
      .on('broadcast', { event: 'order_update' }, (payload) => {
        const eventPayload = payload?.payload as { user_id?: string; order?: OrderItem } | undefined;
        if (!eventPayload?.order || eventPayload.user_id !== user.id) return;

        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === eventPayload.order!.id);
          if (idx === -1) return [eventPayload.order!, ...prev];
          const next = [...prev];
          next[idx] = eventPayload.order!;
          return next;
        });
        addToast(`Mise à jour: ${STATUS_LABELS[eventPayload.order.status]}`);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [addToast, user]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [orders]
  );

  const handleAddOrder = async () => {
    const clean = orderIdInput.trim();
    if (!clean) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Session expirée. Reconnecte-toi.');

      const res = await fetch('/api/orders/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ aliexpress_order_id: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Ajout impossible.');

      if (data?.order) {
        setOrders((prev) => [data.order, ...prev.filter((o) => o.id !== data.order.id)]);
      }
      setOrderIdInput('');
      setIsModalOpen(false);
      addToast('Commande ajoutée avec succès.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors de l’ajout.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    const token = await getAuthToken();
    if (!token) {
      setError('Session expirée. Reconnecte-toi.');
      return;
    }
    const res = await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.message || 'Suppression impossible.');
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== id));
    addToast('Commande supprimée.');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Mes commandes</h1>
            <p className="mt-1 text-sm text-white/60">
              Suivi AliExpress + tracking Parcelsapp en temps réel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] px-4 py-2.5 font-semibold text-black transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Ajouter une commande
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/60">
            Chargement des commandes...
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-white/40" />
            <p className="text-white/70">Aucune commande pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sortedOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                      {order.product_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={order.product_image}
                          alt={order.product_name || 'Produit'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-white/35">
                          <Package className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-white sm:text-base">
                        {order.product_name || `Commande ${order.aliexpress_order_id}`}
                      </h2>
                      <p className="mt-1 text-xs text-white/50">
                        AliExpress: {order.aliexpress_order_id}
                      </p>

                      <div
                        className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[order.status]}`}
                      >
                        {order.status === 'pending_tracking'
                          ? '🟡'
                          : order.status === 'registered'
                            ? '🔵'
                            : order.status === 'in_transit'
                              ? '🚀'
                              : order.status === 'delivered'
                                ? '✅'
                                : '❌'}{' '}
                        <span className="ml-1">{STATUS_LABELS[order.status]}</span>
                      </div>

                      <div className="mt-2 text-xs text-white/60">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5" />
                          <span>{order.carrier || 'Transporteur non détecté'}</span>
                        </div>
                        <div className="mt-1">
                          Dernier événement: {order.last_event || '—'} ({formatDate(order.last_event_at)})
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-start">
                    {order.tracking_number ? (
                      <a
                        href={`https://parcelsapp.com/track/${encodeURIComponent(order.tracking_number)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-3 py-2 text-xs font-medium text-[#8befff] hover:bg-[#00d4ff]/20"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        {order.tracking_number}
                      </a>
                    ) : (
                      <span className="rounded-lg border border-yellow-300/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                        Tracking en attente
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleDeleteOrder(order.id)}
                      className="rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-red-200 hover:bg-red-500/20"
                      title="Supprimer la commande"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0b0b0c] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Ajouter une commande</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-2 block text-sm text-white/70">
              Numéro de commande AliExpress
            </label>
            <input
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              placeholder="ex: 8192374628192736"
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]/60"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!orderIdInput.trim() || submitting}
                onClick={() => void handleAddOrder()}
                className="rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Ajout...' : 'Suivre'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-lg border border-[#00d4ff]/30 bg-black/90 px-4 py-2 text-sm text-white shadow-lg shadow-[#00d4ff]/20"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
