'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Wine, 
  Beer, 
  Coffee, 
  CheckCircle2, 
  Clock, 
  Flame, 
  Bell, 
  RefreshCw, 
  Layers, 
  Volume2, 
  VolumeX, 
  Search, 
  Sparkles, 
  Info, 
  ChevronRight, 
  Utensils, 
  Check, 
  AlertTriangle,
  FileText,
  GlassWater,
  X
} from 'lucide-react';
import { playWaiterCallChime, playKitchenChime } from '@/lib/sound';
import { useAppStore } from '@/lib/store';

interface RecipeSpec {
  ingredientId?: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  inStock?: number;
}

interface BarItem {
  id: string;
  productId: string;
  name: string;
  categoryName: string;
  quantity: number;
  price: number;
  notes?: string | null;
  modifiers?: any;
  status: 'PENDING' | 'COOKING' | 'DONE';
  barChecked: boolean;
  startedAt?: string | null;
  finishedAt?: string | null;
  servedAt?: string | null;
  serviceStage?: string | null;
  allergenAlert?: string | null;
  recipeSpecs?: RecipeSpec[];
}

interface BarOrder {
  id: string;
  orderNumber: string;
  source: string;
  status: string;
  customerName: string;
  notes?: string | null;
  tableId?: string | null;
  tableNumber?: string | null;
  tableName?: string | null;
  diners?: number | null;
  waiterId?: string | null;
  waiterName?: string | null;
  barStatus: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';
  barNotifiedAt?: string | null;
  barCompletedAt?: string | null;
  targetPrepTimeMinutes: number;
  createdAt: string;
  totalItemsCount: number;
  doneItemsCount: number;
  isBarComplete: boolean;
  items: BarItem[];
}

interface ConsolidatedDrink {
  productId: string;
  productName: string;
  categoryName: string;
  totalQuantity: number;
  recipeSpecs: RecipeSpec[];
  orderQueues: Array<{
    orderId: string;
    orderNumber: string;
    tableNumber: string;
    quantity: number;
    notes?: string | null;
    modifiers?: any;
    createdAt: string;
  }>;
}

interface BarStats {
  activeOrdersCount: number;
  totalPendingDrinks: number;
  totalReadyDrinks: number;
  ordersReadyCount: number;
  targetSlaMinutes: number;
}

interface BarStationViewProps {
  currentTimestamp: number;
  soundEnabled: boolean;
}

export default function BarStationView({ currentTimestamp, soundEnabled }: BarStationViewProps) {
  const [orders, setOrders] = useState<BarOrder[]>([]);
  const [consolidatedQueue, setConsolidatedQueue] = useState<ConsolidatedDrink[]>([]);
  const [stats, setStats] = useState<BarStats>({
    activeOrdersCount: 0,
    totalPendingDrinks: 0,
    totalReadyDrinks: 0,
    ordersReadyCount: 0,
    targetSlaMinutes: 4,
  });
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // View mode: 'ORDERS' (Mesas y Comandas) vs 'BATCH' (Cola de Coctelería en Lote)
  const [viewMode, setViewMode] = useState<'ORDERS' | 'BATCH'>('ORDERS');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'PREPARING' | 'READY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Recipe spec modal
  const [selectedCocktailRecipe, setSelectedCocktailRecipe] = useState<{
    name: string;
    specs: RecipeSpec[];
    category: string;
  } | null>(null);

  const { addNotification } = useAppStore();

  const fetchBarData = useCallback(async () => {
    try {
      const res = await fetch('/api/kitchen/bar');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setConsolidatedQueue(data.consolidatedQueue || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (e) {
      console.error('Error fetching bar data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBarData();
    const interval = setInterval(fetchBarData, 6000);
    return () => clearInterval(interval);
  }, [fetchBarData]);

  // SLA Time Helper for drinks (standard: 4 minutes)
  const getDrinkSla = (createdAt: string, targetMinutes: number = 4) => {
    const createdTime = new Date(createdAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((currentTimestamp - createdTime) / 1000));
    const elapsedMins = Math.floor(elapsedSeconds / 60);
    const elapsedSecs = elapsedSeconds % 60;
    const formattedElapsed = `${elapsedMins}:${elapsedSecs < 10 ? '0' : ''}${elapsedSecs}`;

    const targetSeconds = targetMinutes * 60;
    const isBreached = elapsedSeconds > targetSeconds;
    const isWarning = !isBreached && elapsedSeconds >= targetSeconds * 0.65;
    const isOnTime = !isBreached && !isWarning;

    return {
      formattedElapsed,
      elapsedMins,
      elapsedSeconds,
      isBreached,
      isWarning,
      isOnTime,
    };
  };

  // Action: Mark order drinks ready
  const handleReadyDrinks = async (orderId: string) => {
    setActionInProgress(orderId);
    try {
      const res = await fetch('/api/kitchen/bar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'READY_DRINKS', orderId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (soundEnabled) playWaiterCallChime();
        addNotification(data.message || 'Bebidas listas en barra', 'success');
        fetchBarData();
      } else {
        addNotification(data.error || 'Error al despachar bebidas', 'error');
      }
    } catch {
      addNotification('Error al despachar bebidas', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Action: Call Waiter
  const handleCallWaiter = async (orderId: string) => {
    setActionInProgress(orderId);
    try {
      const res = await fetch('/api/kitchen/bar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CALL_WAITER_BAR', orderId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (soundEnabled) playWaiterCallChime();
        addNotification(data.message || 'Aviso enviado al mesero', 'info');
        fetchBarData();
      } else {
        addNotification(data.error || 'Error al avisar al mesero', 'error');
      }
    } catch {
      addNotification('Error al llamar al mesero', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Action: Serve drinks
  const handleServeDrinks = async (orderId: string) => {
    setActionInProgress(orderId);
    try {
      const res = await fetch('/api/kitchen/bar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SERVE_DRINKS', orderId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (soundEnabled) playKitchenChime();
        addNotification(data.message || 'Bebidas servidas', 'success');
        fetchBarData();
      } else {
        addNotification(data.error || 'Error al marcar servidas', 'error');
      }
    } catch {
      addNotification('Error al marcar bebidas servidas', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Action: Toggle single drink item
  const handleToggleItem = async (orderId: string, itemId: string) => {
    try {
      const res = await fetch('/api/kitchen/bar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_BAR_ITEM', orderId, itemId }),
      });
      if (res.ok) {
        fetchBarData();
      }
    } catch {
      console.error('Error toggling item');
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterStatus !== 'ALL') {
        if (o.barStatus !== filterStatus) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTable = o.tableNumber?.toLowerCase().includes(q) || false;
        const matchesOrder = o.orderNumber.toLowerCase().includes(q);
        const matchesDrink = o.items.some((i) => i.name.toLowerCase().includes(q));
        if (!matchesTable && !matchesOrder && !matchesDrink) return false;
      }
      return true;
    });
  }, [orders, filterStatus, searchQuery]);

  return (
    <div className="flex flex-col h-full space-y-3 overflow-hidden">
      {/* Top Bar Station Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
        <div className="glass-panel p-3 rounded-xl border border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Bebidas Pendientes</span>
            <p className="text-xl font-black text-amber-400">{stats.totalPendingDrinks}</p>
          </div>
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <GlassWater className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-3 rounded-xl border border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Listas en Barra</span>
            <p className="text-xl font-black text-emerald-400">{stats.ordersReadyCount}</p>
          </div>
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-3 rounded-xl border border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Mesas Activas</span>
            <p className="text-xl font-black text-purple-400">{stats.activeOrdersCount}</p>
          </div>
          <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
            <Wine className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-3 rounded-xl border border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">SLA Objetivo</span>
            <p className="text-xl font-black text-blue-400">&lt; {stats.targetSlaMinutes} min</p>
          </div>
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <Clock className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Control Navigation & Mode Switcher */}
      <div className="glass-panel p-3 rounded-xl border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex rounded-lg border border-slate-800 overflow-hidden text-xs">
            <button
              onClick={() => setViewMode('ORDERS')}
              className={`px-3 py-1.5 font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'ORDERS'
                  ? 'bg-brand-primary text-slate-950 font-black shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <Wine className="h-3.5 w-3.5" />
              <span>Comandas de Barra ({orders.length})</span>
            </button>
            <button
              onClick={() => setViewMode('BATCH')}
              className={`px-3 py-1.5 font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'BATCH'
                  ? 'bg-brand-primary text-slate-950 font-black shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Cola Coctelería Lote ({consolidatedQueue.length})</span>
            </button>
          </div>

          {/* Status filter for Orders mode */}
          {viewMode === 'ORDERS' && (
            <div className="flex items-center gap-1 ml-2 text-xs">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  filterStatus === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilterStatus('PENDING')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  filterStatus === 'PENDING' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                En Espera
              </button>
              <button
                onClick={() => setFilterStatus('READY')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  filterStatus === 'READY' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                Listas en Barra
              </button>
            </div>
          )}
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar mesa, comanda o bebida..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary"
            />
          </div>
          <button
            onClick={() => fetchBarData()}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Refrescar comanda"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Board View: ORDERS MODE */}
      {viewMode === 'ORDERS' && (
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredOrders.length === 0 ? (
            <div className="flex h-64 items-center justify-center flex-col gap-2 glass-panel rounded-2xl border border-slate-800 text-slate-500">
              <Wine className="h-10 w-10 text-slate-600 mb-1" />
              <p className="font-bold text-slate-300 text-base">Barra al día</p>
              <p className="text-xs text-slate-500">No hay bebidas pendientes por preparar o despachar en este momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredOrders.map((order) => {
                const sla = getDrinkSla(order.createdAt, order.targetPrepTimeMinutes);
                const isReady = order.barStatus === 'READY' || order.isBarComplete;

                return (
                  <div
                    key={order.id}
                    className={`glass-panel rounded-2xl border flex flex-col justify-between overflow-hidden shadow-xl transition-all ${
                      isReady
                        ? 'border-emerald-500/50 bg-emerald-950/10'
                        : sla.isBreached
                        ? 'border-red-500/60 bg-red-950/15 shadow-red-500/10 ring-1 ring-red-500/30'
                        : sla.isWarning
                        ? 'border-amber-500/50 bg-amber-950/10'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {order.tableNumber ? `Mesa ${order.tableNumber}` : 'Barra'}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-300">
                          #{order.orderNumber}
                        </span>
                      </div>

                      {/* Drink SLA Timer */}
                      <div
                        className={`px-2 py-0.5 rounded-full text-xs font-black flex items-center gap-1 ${
                          isReady
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : sla.isBreached
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                            : sla.isWarning
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        <span>{sla.formattedElapsed}</span>
                      </div>
                    </div>

                    {/* Waiter & Notes */}
                    <div className="px-3.5 py-1.5 bg-slate-950/30 text-[11px] text-slate-400 flex items-center justify-between border-b border-slate-800/40">
                      <span>Mesero: <strong className="text-slate-200">{order.waiterName || 'General'}</strong></span>
                      {order.barNotifiedAt && (
                        <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                          <Bell className="h-2.5 w-2.5 animate-bounce" /> Mesero avisado
                        </span>
                      )}
                    </div>

                    {/* Drink Items Checklist */}
                    <div className="p-3.5 space-y-2 flex-1">
                      {order.items.map((item) => {
                        const isDone = item.status === 'DONE';

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleToggleItem(order.id, item.id)}
                            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                              isDone
                                ? 'bg-emerald-950/20 border-emerald-500/30 opacity-75'
                                : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            {/* Checkbox button */}
                            <button
                              type="button"
                              className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                isDone
                                  ? 'bg-emerald-500 text-slate-950 font-bold'
                                  : 'border border-slate-700 bg-slate-900 text-transparent'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-1">
                                <span className={`text-xs font-bold leading-tight ${
                                  isDone ? 'line-through text-slate-500' : 'text-white'
                                }`}>
                                  <span className="text-amber-400 font-black mr-1">{item.quantity}x</span>
                                  {item.name}
                                </span>
                              </div>

                              {/* Modifiers & Notes */}
                              {item.notes && (
                                <p className="text-[10px] text-amber-300 font-medium mt-0.5">
                                  Nota: {item.notes}
                                </p>
                              )}

                              {item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {item.modifiers.map((m: any, idx: number) => (
                                    <span
                                      key={idx}
                                      className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300"
                                    >
                                      {m.name || m}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Recipe spec shortcut */}
                              {item.recipeSpecs && item.recipeSpecs.length > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCocktailRecipe({
                                      name: item.name,
                                      specs: item.recipeSpecs || [],
                                      category: item.categoryName,
                                    });
                                  }}
                                  className="text-[9px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 cursor-pointer"
                                >
                                  <FileText className="h-2.5 w-2.5" /> Ficha Técnica / Onzas
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-3 border-t border-slate-800 bg-slate-950/70 flex items-center gap-2">
                      {!isReady ? (
                        <>
                          <button
                            onClick={() => handleReadyDrinks(order.id)}
                            disabled={actionInProgress === order.id}
                            className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Bebidas Listas</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleCallWaiter(order.id)}
                            disabled={actionInProgress === order.id}
                            className="flex-1 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            title="Notificar al mesero asignado para retirar bebidas en barra"
                          >
                            <Bell className="h-4 w-4" />
                            <span>Llamar Mesero</span>
                          </button>
                          <button
                            onClick={() => handleServeDrinks(order.id)}
                            disabled={actionInProgress === order.id}
                            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                            title="Marcar como servido en mesa"
                          >
                            Servido
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Board View: BATCH PREP QUEUE (Cola de Coctelería en Lote) */}
      {viewMode === 'BATCH' && (
        <div className="flex-1 overflow-y-auto pr-1">
          {consolidatedQueue.length === 0 ? (
            <div className="flex h-64 items-center justify-center flex-col gap-2 glass-panel rounded-2xl border border-slate-800 text-slate-500">
              <Sparkles className="h-10 w-10 text-slate-600 mb-1" />
              <p className="font-bold text-slate-300 text-base">Sin cócteles pendientes en cola</p>
              <p className="text-xs text-slate-500">Todas las bebidas solicitadas han sido preparadas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl text-xs text-purple-300 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
                <span>
                  <strong>Modo Coctelería en Lote:</strong> Visualiza todas las bebidas pendientes agrupadas por tipo para preparar cocteleras y servicios simultáneos.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {consolidatedQueue.map((item) => (
                  <div
                    key={item.productId}
                    className="glass-panel rounded-2xl border border-slate-800 p-4 bg-slate-900/60 flex flex-col justify-between shadow-lg"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {item.categoryName}
                          </span>
                          <h4 className="text-base font-black text-white mt-0.5 leading-snug">
                            {item.productName}
                          </h4>
                        </div>
                        <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-base shadow-lg shadow-orange-500/20">
                          {item.totalQuantity}x
                        </span>
                      </div>

                      {/* Recipe Spec Quick Summary */}
                      {item.recipeSpecs && item.recipeSpecs.length > 0 && (
                        <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Fórmula por servicio:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.recipeSpecs.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[10px]"
                              >
                                <strong>{s.quantity} {s.unit}</strong> {s.ingredientName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Table Queues Breakdown */}
                      <div className="mt-3 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Comandas solicitantes:
                        </span>
                        {item.orderQueues.map((oq, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/40 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px]">
                                {oq.tableNumber.includes('Mesa') ? oq.tableNumber : `Mesa ${oq.tableNumber}`}
                              </span>
                              <span className="text-slate-400 font-mono text-[11px]">#{oq.orderNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {oq.notes && (
                                <span className="text-[10px] text-amber-300 truncate max-w-[120px]" title={oq.notes}>
                                  {oq.notes}
                                </span>
                              )}
                              <span className="font-bold text-amber-400">{oq.quantity}x</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* COCKTAIL SPEC / RECIPE MODAL */}
      {selectedCocktailRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                  <Wine className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{selectedCocktailRecipe.name}</h3>
                  <p className="text-xs text-slate-400">{selectedCocktailRecipe.category} • Ficha Técnica de Barra</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCocktailRecipe(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Ingredientes & Escandallo (Por Servicio):
                </span>
                <div className="divide-y divide-slate-800/80 bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden">
                  {selectedCocktailRecipe.specs.map((spec, i) => (
                    <div key={i} className="p-3 flex items-center justify-between text-xs">
                      <span className="font-medium text-white">{spec.ingredientName}</span>
                      <span className="font-mono font-bold text-amber-400">
                        {spec.quantity} {spec.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
                <p className="font-bold">💡 Tip de Servicio:</p>
                <p className="text-slate-300">
                  Asegurar cristalería fría y hielo sólido para mantener dilución óptima en coctelera.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedCocktailRecipe(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
