'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  Clock, 
  Flame, 
  CheckCircle, 
  CheckCircle2,
  Play, 
  PackageCheck, 
  AlertTriangle,
  Printer, 
  Volume2, 
  VolumeX,
  ChefHat,
  Sparkles,
  Layers,
  Utensils,
  Check,
  Wifi
} from 'lucide-react';
import ThermalTicketModal, { ThermalOrderData } from '@/components/ThermalTicketModal';
import { playKitchenChime } from '@/lib/sound';
import ExpoStationView from '@/components/kitchen/ExpoStationView';
import BarStationView from '@/components/kitchen/BarStationView';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  notes?: string | null;
  modifiers?: string | null;
  status: 'PENDING' | 'COOKING' | 'DONE';
  serviceStage?: string | null;
  allergenAlert?: string | null;
  expoChecked?: boolean;
  startedAt?: string | null;
  finishedAt?: string | null;
  servedAt?: string | null;
  product: {
    id: string;
    name: string;
    targetPrepTime?: number | null;
    kitchenStation?: string | null;
    allergens?: string | null;
    dietaryTags?: string | null;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  source: string;
  status: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  notes?: string | null;
  items: OrderItem[];
  externalOrderId?: string | null;
  deliveryService?: string | null;
  table?: {
    id?: string;
    number: string;
    name: string;
  } | null;
  tableId?: string | null;
  diners?: number | null;
  waiterId?: string | null;
  waiter?: {
    id: string;
    name: string;
  } | null;
  prepTimeTarget?: number | null;
  cookingStartedAt?: string | null;
  cookingFinishedAt?: string | null;
  currentStage?: string | null;
  expoStatus?: string | null;
  expoNotifiedAt?: string | null;
  expoAssembledAt?: string | null;
  expoPackedAt?: string | null;
  expoNotes?: string | null;
  deliverySecuritySeal?: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATIONS = [
  { id: 'ALL', label: 'Todas las Estaciones', icon: '🍽️' },
  { id: 'EXPO', label: 'Estación Expo (Pase)', icon: '🛎️' },
  { id: 'BARRA', label: 'KDS Barra & Bebidas', icon: '🍹' },
  { id: 'COCINA', label: 'Cocina Caliente', icon: '🍳' },
  { id: 'PARRILLA', label: 'Parrilla / Plancha', icon: '🥩' },
  { id: 'POSTRES', label: 'Postres / Panadería', icon: '🍰' },
  { id: 'ENSALADAS', label: 'Barra Fría / Ensaladas', icon: '🥗' },
];

const STAGE_LABELS: Record<string, { name: string; badgeColor: string; nextStage?: string; nextLabel?: string }> = {
  STARTER: { 
    name: '1er Tiempo (Entradas & Bebidas)', 
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    nextStage: 'MAIN',
    nextLabel: 'Marchar 2do Tiempo (Fuertes)',
  },
  DRINK: { 
    name: 'Bebidas & Coctelería', 
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    nextStage: 'MAIN',
    nextLabel: 'Marchar Platos Fuertes',
  },
  MAIN: { 
    name: '2do Tiempo (Platos Fuertes)', 
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    nextStage: 'DESSERT',
    nextLabel: 'Marchar 3er Tiempo (Postres)',
  },
  DESSERT: { 
    name: '3er Tiempo (Postres)', 
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  },
};

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isThermalOpen, setIsThermalOpen] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<ThermalOrderData | null>(null);
  const [printingNetworkOrderId, setPrintingNetworkOrderId] = useState<string | null>(null);
  
  // Real-time, Station & Audio state
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [connectionMode, setConnectionMode] = useState<'SSE' | 'POLL' | 'CONNECTING'>('CONNECTING');
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(Date.now());
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const { addNotification } = useAppStore();

  // Read URL station param if available (e.g. /kitchen?station=BARRA)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const st = params.get('station');
      if (st) {
        setSelectedStation(st.toUpperCase());
      }
    }
  }, []);

  const fetchActiveOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        const filtered = data.orders.filter((o: Order) => 
          ['RECEIVED', 'PREPARING', 'READY'].includes(o.status)
        );
        setOrders(filtered);
      }
    } catch (e) {
      console.error('KDS failed to fetch orders', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 1. Clock ticker for live second-by-second wait timers and SLA meters
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Real-time SSE Connection with auto-reconnect & Poll fallback
  useEffect(() => {
    fetchActiveOrders();

    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource('/api/orders/stream');

      eventSource.addEventListener('connected', () => {
        setConnectionMode('SSE');
      });

      eventSource.addEventListener('order_created', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (soundEnabledRef.current) {
            playKitchenChime();
          }
          addNotification(`🔔 ¡Nueva Comanda #${payload.orderNumber}!`, 'info');
          fetchActiveOrders();
        } catch (err) {
          console.error('Error parsing order_created event', err);
        }
      });

      eventSource.addEventListener('order_updated', () => {
        fetchActiveOrders();
      });

      eventSource.onerror = () => {
        setConnectionMode('POLL');
      };
    } catch {
      setConnectionMode('POLL');
    }

    fallbackInterval = setInterval(fetchActiveOrders, 8000);

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [fetchActiveOrders, addNotification]);

  // Order status transition
  const advanceOrderStatus = async (orderId: string, currentStatus: string) => {
    let nextStatus = '';
    if (currentStatus === 'RECEIVED') nextStatus = 'PREPARING';
    else if (currentStatus === 'PREPARING') nextStatus = 'READY';
    else return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        addNotification(`Comanda ${data.order.orderNumber} actualizada a ${nextStatus}`, 'info');
        if (nextStatus === 'READY' && soundEnabledRef.current) {
          playKitchenChime();
        }
        fetchActiveOrders();
      } else {
        alert('Error al avanzar comanda');
      }
    } catch {
      alert('Error de red al actualizar estado');
    }
  };

  // March Stage handler ("Llamar a marchar siguiente tiempo")
  const handleMarchStage = async (orderId: string, nextStage: string, stageLabel: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStage: nextStage, status: 'PREPARING' }),
      });

      if (res.ok) {
        const data = await res.json();
        addNotification(`🔥 ¡Marchando ${stageLabel} en #${data.order.orderNumber}!`, 'warning');
        if (soundEnabledRef.current) {
          playKitchenChime();
        }
        fetchActiveOrders();
      }
    } catch (err) {
      console.error('Failed to march stage', err);
    }
  };

  // Toggle individual item status: PENDING -> COOKING -> DONE
  const handleToggleItemStatus = async (orderId: string, itemId: string, currentItemStatus: string) => {
    let nextItemStatus: 'PENDING' | 'COOKING' | 'DONE' = 'COOKING';
    if (currentItemStatus === 'PENDING') nextItemStatus = 'COOKING';
    else if (currentItemStatus === 'COOKING') nextItemStatus = 'DONE';
    else if (currentItemStatus === 'DONE') nextItemStatus = 'PENDING';

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemUpdates: [{ id: itemId, status: nextItemStatus }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.order?.status === 'READY' && soundEnabledRef.current) {
          playKitchenChime();
          addNotification(`🎉 ¡Comanda #${data.order.orderNumber} completamente lista para entrega!`, 'success');
        }
        fetchActiveOrders();
      }
    } catch (err) {
      console.error('Failed to update item status', err);
    }
  };

  // Complete all items in an order (fast batch complete)
  const handleCompleteAllItems = async (orderId: string, items: OrderItem[]) => {
    const itemUpdates = items.map((i) => ({ id: i.id, status: 'DONE' as const }));
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemUpdates, status: 'READY' }),
      });

      if (res.ok) {
        const data = await res.json();
        addNotification(`Comanda #${data.order.orderNumber} marcada como LISTA`, 'success');
        if (soundEnabledRef.current) {
          playKitchenChime();
        }
        fetchActiveOrders();
      }
    } catch (err) {
      console.error('Failed to complete all items', err);
    }
  };

  // SLA Calculation Helper
  const getSlaDetail = (order: Order) => {
    const created = new Date(order.createdAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((currentTimestamp - created) / 1000));
    const elapsedMins = Math.floor(elapsedSeconds / 60);
    const elapsedSecs = elapsedSeconds % 60;
    const formattedElapsed = `${elapsedMins}:${elapsedSecs < 10 ? '0' : ''}${elapsedSecs}`;

    const targetMinutes = order.prepTimeTarget || 15;
    const targetSeconds = targetMinutes * 60;
    const percent = Math.min(150, Math.round((elapsedSeconds / targetSeconds) * 100));

    const isBreached = elapsedSeconds > targetSeconds;
    const isWarning = !isBreached && percent >= 70;
    const isOnTime = !isBreached && !isWarning;

    const delaySeconds = Math.max(0, elapsedSeconds - targetSeconds);
    const delayMins = Math.floor(delaySeconds / 60);
    const delaySecs = delaySeconds % 60;
    const formattedDelay = `${delayMins}:${delaySecs < 10 ? '0' : ''}${delaySecs}`;

    return {
      elapsedMins,
      elapsedSecs,
      formattedElapsed,
      targetMinutes,
      percent,
      isBreached,
      isWarning,
      isOnTime,
      formattedDelay,
    };
  };

  const handleDirectNetworkPrint = async (orderId: string) => {
    setPrintingNetworkOrderId(orderId);
    try {
      const res = await fetch('/api/printers/print-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, type: 'KOT' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addNotification(`Comanda despachada a ${data.dispatchedCount || 1} impresora(s) de red`, 'success');
      } else {
        addNotification(data.message || data.error || 'No hay impresoras disponibles o configuradas', 'warning');
      }
    } catch (err) {
      console.error('Error triggering network print:', err);
      addNotification('Error al contactar con el hardware bridge', 'error');
    } finally {
      setPrintingNetworkOrderId(null);
    }
  };

  // Platform styling helper
  const renderPlatformBadge = (order: Order) => {
    switch (order.source) {
      case 'UBER_EATS':
        return (
          <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md uppercase tracking-wider flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Uber Eats {order.externalOrderId ? `• ${order.externalOrderId}` : ''}
          </span>
        );
      case 'RAPPI':
        return (
          <span className="text-[10px] font-black px-2 py-0.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-md uppercase tracking-wider flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
            Rappi {order.externalOrderId ? `• ${order.externalOrderId}` : ''}
          </span>
        );
      case 'DIDI_FOOD':
        return (
          <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-md uppercase tracking-wider flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            DiDi Food {order.externalOrderId ? `• ${order.externalOrderId}` : ''}
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 rounded uppercase">
            {order.source}
          </span>
        );
    }
  };

  // Filter orders by active station
  const filteredOrders = useMemo(() => {
    if (selectedStation === 'ALL') return orders;
    return orders.filter((o) => 
      o.items.some((item) => (item.product.kitchenStation || 'COCINA') === selectedStation)
    );
  }, [orders, selectedStation]);

  // Group filtered orders by status
  const receivedOrders = filteredOrders.filter((o) => o.status === 'RECEIVED');
  const preparingOrders = filteredOrders.filter((o) => o.status === 'PREPARING');
  const readyOrders = filteredOrders.filter((o) => o.status === 'READY');

  // Overall SLA Compliance calculation
  const totalActive = orders.length;
  const onTimeCount = orders.filter((o) => {
    const { isBreached } = getSlaDetail(o);
    return !isBreached;
  }).length;
  const slaCompliancePercent = totalActive > 0 ? Math.round((onTimeCount / totalActive) * 100) : 100;

  if (loading) {
    return (
      <DashboardContainer>
        <div className="flex h-[calc(100vh-200px)] items-center justify-center flex-col gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-brand-primary"></div>
          <p className="text-sm text-slate-400">Conectando con KDS en tiempo real...</p>
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <div className="space-y-4 flex flex-col h-[calc(100vh-130px)] overflow-hidden">
        {/* Header Board stats & Live Sync Beacon */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-lg shadow-orange-500/10">
              <Flame className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  KDS Cocina Central
                  <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono font-bold">
                    SLA & Tiempos
                  </span>
                </h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border ${
                  connectionMode === 'SSE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${connectionMode === 'SSE' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'}`} />
                  {connectionMode === 'SSE' ? 'EN VIVO (SSE)' : 'EN VIVO (POLL)'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Control de producción en línea, tiempos de servicio y semáforos de calidad</p>
            </div>
          </div>

          {/* Right Controls: SLA Metric, Sound & Status Badges */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            {/* SLA Metric Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
              <span className="text-slate-400">Cumplimiento SLA:</span>
              <span className={`font-mono font-black ${
                slaCompliancePercent >= 90 ? 'text-emerald-400' : slaCompliancePercent >= 75 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {slaCompliancePercent}%
              </span>
            </div>

            {/* Audio Toggle */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  if (next) playKitchenChime();
                  addNotification(next ? 'Campana de cocina activada' : 'Campana silenciada', 'info');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  soundEnabled 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title={soundEnabled ? 'Silenciar campana' : 'Activar campana'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span className="hidden sm:inline">{soundEnabled ? 'Campana' : 'Silencio'}</span>
              </button>

              <button
                onClick={() => playKitchenChime()}
                className="px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Probar sonido de campana"
              >
                Probar
              </button>
            </div>

            {/* Quick Summary Badges */}
            <div className="flex gap-2 text-xs">
              <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-300">
                Nuevos: <strong className="text-white font-bold">{receivedOrders.length}</strong>
              </span>
              <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-300">
                En Fuego: <strong className="text-amber-400 font-bold">{preparingOrders.length}</strong>
              </span>
              <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-300">
                Listos: <strong className="text-emerald-400 font-bold">{readyOrders.length}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Station Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
          {STATIONS.map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStation(st.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedStation === st.id
                  ? 'bg-brand-primary text-slate-950 font-black shadow-md scale-102'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <span>{st.icon}</span>
              <span>{st.label}</span>
              {st.id !== 'ALL' && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedStation === st.id ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  {orders.filter(o => o.items.some(i => (i.product.kitchenStation || 'COCINA') === st.id)).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Main Board view: Line KDS vs Expo Station vs Bar Station */}
        {selectedStation === 'EXPO' ? (
          <div className="flex-1 overflow-hidden">
            <ExpoStationView
              orders={orders as any}
              currentTimestamp={currentTimestamp}
              onRefresh={fetchActiveOrders}
              soundEnabled={soundEnabled}
              onDirectPrint={handleDirectNetworkPrint}
              printingOrderId={printingNetworkOrderId}
            />
          </div>
        ) : selectedStation === 'BARRA' ? (
          <div className="flex-1 overflow-hidden">
            <BarStationView
              currentTimestamp={currentTimestamp}
              soundEnabled={soundEnabled}
            />
          </div>
        ) : (
          /* 3-Column board layout */
          <div className="flex-1 flex flex-col md:flex-row gap-5 overflow-hidden">
          {/* Column 1: RECEIVED */}
          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
            <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-200 tracking-wider uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                Nuevas Comandas
              </span>
              <span className="h-5 px-2 bg-slate-800 text-slate-300 rounded text-[10px] font-bold flex items-center">{receivedOrders.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {receivedOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs py-12">
                  No hay órdenes en espera
                </div>
              ) : (
                receivedOrders.map((order) => renderOrderCard(order, 'RECEIVED'))
              )}
            </div>
          </div>

          {/* Column 2: PREPARING */}
          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
            <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-200 tracking-wider uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                En Preparación (Fuego)
              </span>
              <span className="h-5 px-2 bg-amber-950 border border-amber-900 text-amber-400 rounded text-[10px] font-bold flex items-center">{preparingOrders.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {preparingOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs py-12">
                  No hay órdenes en cocina
                </div>
              ) : (
                preparingOrders.map((order) => renderOrderCard(order, 'PREPARING'))
              )}
            </div>
          </div>

          {/* Column 3: READY */}
          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
            <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-200 tracking-wider uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Listos para Despacho
              </span>
              <span className="h-5 px-2 bg-emerald-950 border border-emerald-900 text-emerald-400 rounded text-[10px] font-bold flex items-center">{readyOrders.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {readyOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs py-12">
                  No hay órdenes listas
                </div>
              ) : (
                readyOrders.map((order) => renderOrderCard(order, 'READY'))
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Thermal Ticket Print Modal */}
      {selectedOrderForPrint && (
        <ThermalTicketModal
          isOpen={isThermalOpen}
          onClose={() => setIsThermalOpen(false)}
          order={selectedOrderForPrint}
          defaultMode="KOT"
        />
      )}
    </DashboardContainer>
  );

  // Render individual Order Card
  function renderOrderCard(order: Order, columnStatus: 'RECEIVED' | 'PREPARING' | 'READY') {
    const { formattedElapsed, targetMinutes, percent, isBreached, isWarning, formattedDelay } = getSlaDetail(order);

    // Group items by serviceStage
    const stageGroups: Record<string, OrderItem[]> = {};
    order.items.forEach((item) => {
      const stg = item.serviceStage || 'MAIN';
      if (!stageGroups[stg]) stageGroups[stg] = [];
      stageGroups[stg].push(item);
    });

    const currentStageMeta = STAGE_LABELS[order.currentStage || 'STARTER'] || STAGE_LABELS.MAIN;

    return (
      <div 
        key={order.id} 
        className={`glass-panel border rounded-xl p-4 space-y-3 relative overflow-hidden transition-all duration-200 hover:border-slate-700 ${
          isBreached 
            ? 'border-red-600/80 bg-red-950/20 shadow-lg shadow-red-950/20' 
            : isWarning 
              ? 'border-amber-600/60 bg-amber-950/15' 
              : 'border-slate-800'
        }`}
      >
        {/* SLA Progress Bar at top of card */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-950">
          <div 
            className={`h-full transition-all duration-500 ${
              isBreached ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>

        {/* Top bar: Order number, Table/Origin and Delivery badge */}
        <div className="flex justify-between items-center text-xs pt-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-black bg-slate-800 px-2.5 py-0.5 rounded text-white text-sm tracking-wide">
              {order.orderNumber}
            </span>
            {order.table && (
              <span className="font-bold text-[11px] bg-brand-primary text-slate-950 px-2 py-0.5 rounded">
                🍽️ {order.table.name}
              </span>
            )}
            {order.diners && order.diners > 1 && (
              <span className="text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
                👥 {order.diners}
              </span>
            )}
          </div>
          {renderPlatformBadge(order)}
        </div>

        {/* Customer & Diners Info */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/60 pb-1.5">
          <span className="truncate font-medium text-slate-300">👤 {order.customerName}</span>
          <span className="text-[10px] font-mono text-slate-500 shrink-0">
            SLA: {targetMinutes} min
          </span>
        </div>

        {/* Active Stage Banner & March Stage Button */}
        {order.status === 'PREPARING' && currentStageMeta.nextStage && (
          <div className="flex items-center justify-between p-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs">
            <div className="flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-[11px] font-bold text-amber-300 truncate">
                Activo: {currentStageMeta.name}
              </span>
            </div>
            <button
              onClick={() => handleMarchStage(order.id, currentStageMeta.nextStage!, currentStageMeta.nextLabel || '')}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black rounded cursor-pointer transition-all active:scale-95 shrink-0 flex items-center gap-1"
            >
              <Layers className="h-3 w-3" />
              {currentStageMeta.nextLabel}
            </button>
          </div>
        )}

        {/* Items List Grouped by Service Stage */}
        <div className="space-y-3 py-1">
          {Object.entries(stageGroups).map(([stageKey, items]) => {
            const stageConfig = STAGE_LABELS[stageKey] || { name: stageKey, badgeColor: 'bg-slate-800 text-slate-300' };
            const isCurrentActive = order.currentStage === stageKey;

            return (
              <div key={stageKey} className={`space-y-1.5 p-2 rounded-lg ${isCurrentActive ? 'bg-amber-950/20 border border-amber-800/40' : 'bg-slate-950/40'}`}>
                {/* Stage Header */}
                <div className="flex items-center justify-between text-[10px] font-bold pb-1 border-b border-slate-800/40">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${stageConfig.badgeColor}`}>
                    {stageConfig.name}
                  </span>
                  <span className="text-slate-500 text-[9px] font-mono">
                    {items.filter(i => i.status === 'DONE').length}/{items.length} listos
                  </span>
                </div>

                {/* Items in this stage */}
                <div className="space-y-1.5 pt-1">
                  {items.map((item) => {
                    let parsedMods: Array<{ optionName: string; price: number }> = [];
                    try { if (item.modifiers) parsedMods = JSON.parse(item.modifiers); } catch {}
                    const isDone = item.status === 'DONE';
                    const isCooking = item.status === 'COOKING';

                    return (
                      <div 
                        key={item.id} 
                        className={`text-xs flex items-start justify-between gap-2 p-1.5 rounded transition-all ${
                          isDone 
                            ? 'bg-emerald-950/20 border border-emerald-900/40 opacity-60' 
                            : isCooking 
                              ? 'bg-amber-950/20 border border-amber-900/40' 
                              : 'bg-slate-900/50 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold ${isDone ? 'line-through text-slate-400' : 'text-white'}`}>
                              {item.quantity}x {item.product.name}
                            </span>
                            {item.product.kitchenStation && item.product.kitchenStation !== 'COCINA' && (
                              <span className="text-[9px] px-1 py-0.2 bg-slate-800 text-slate-400 rounded font-mono">
                                {item.product.kitchenStation}
                              </span>
                            )}
                          </div>

                          {/* Modifiers */}
                          {parsedMods.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {parsedMods.map((mod, mi) => (
                                <span key={mi} className="text-[9px] font-bold bg-violet-950 border border-violet-800 text-violet-300 px-1.5 py-0.2 rounded">
                                  +{mod.optionName}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Item notes */}
                          {item.notes && (
                            <p className="text-[10px] text-amber-400 font-medium italic mt-0.5 bg-amber-950/30 px-1.5 py-0.5 rounded">
                              Nota: {item.notes}
                            </p>
                          )}

                          {/* Allergen Alert - Critical Kitchen Warning */}
                          {item.allergenAlert && (
                            <div className="mt-1 px-2 py-1 bg-red-600/20 border-2 border-red-500 rounded animate-pulse">
                              <p className="text-[10px] font-black text-red-400 uppercase tracking-wider flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 stroke-[3px]" />
                                ⚠️ ALÉRGENO: {item.allergenAlert}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Item Status Controller Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleItemStatus(order.id, item.id, item.status)}
                          className={`px-2 py-1 rounded text-[10px] font-black shrink-0 transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                            isDone
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : isCooking
                                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 animate-pulse'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                          title="Clic para cambiar estado del platillo (Pendiente -> Cocinando -> Listo)"
                        >
                          {isDone ? (
                            <>
                              <Check className="h-3 w-3 stroke-[3px]" /> Listo
                            </>
                          ) : isCooking ? (
                            <>
                              <Flame className="h-3 w-3" /> Fuego
                            </>
                          ) : (
                            <>
                              <Play className="h-2.5 w-2.5" /> Preparar
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Global order notes */}
        {order.notes && (
          <div className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-900/50 p-2 rounded-lg">
            <strong>Observación General:</strong> {order.notes}
          </div>
        )}

        {/* Footer controls: Live Timer, SLA Badge and Action Buttons */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
          {/* SLA Timer Indicator */}
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border ${
              isBreached 
                ? 'text-red-400 bg-red-950/80 border-red-800 animate-pulse' 
                : isWarning 
                  ? 'text-amber-400 bg-amber-950/60 border-amber-800/60' 
                  : 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
            }`}>
              <Clock className="h-3.5 w-3.5" /> {formattedElapsed} min
              {isBreached && (
                <span className="text-[10px] font-bold text-red-300">
                  (+{formattedDelay})
                </span>
              )}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Print KOT (Browser Dialog) */}
            <button
              onClick={() => {
                setSelectedOrderForPrint(order as unknown as ThermalOrderData);
                setIsThermalOpen(true);
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 cursor-pointer transition-colors"
              title="Vista Previa e Imprimir en Navegador"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>

            {/* Direct Hardware Bridge ESC/POS LAN Print */}
            <button
              onClick={() => handleDirectNetworkPrint(order.id)}
              disabled={printingNetworkOrderId === order.id}
              className="p-1.5 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 hover:text-cyan-100 rounded-lg border border-cyan-800/60 cursor-pointer transition-colors"
              title="Imprimir silencioso en Impresora Térmica de Red (ESC/POS)"
            >
              <Wifi className={`h-3.5 w-3.5 ${printingNetworkOrderId === order.id ? 'animate-pulse text-cyan-400' : ''}`} />
            </button>

            {/* Complete All Items button */}
            {columnStatus === 'PREPARING' && (
              <button
                onClick={() => handleCompleteAllItems(order.id, order.items)}
                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                title="Marcar todos los platillos como terminados"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Todo Listo</span>
              </button>
            )}

            {/* Advance Order status button */}
            {columnStatus === 'RECEIVED' && (
              <button
                onClick={() => advanceOrderStatus(order.id, order.status)}
                className="flex items-center gap-1 py-1.5 px-3 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg cursor-pointer transition-all active:scale-95"
              >
                <Play className="h-3 w-3 stroke-[3px]" /> Preparar
              </button>
            )}

            {columnStatus === 'PREPARING' && (
              <button
                onClick={() => advanceOrderStatus(order.id, order.status)}
                className="flex items-center gap-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg cursor-pointer transition-all active:scale-95"
              >
                <PackageCheck className="h-3.5 w-3.5" /> Listo
              </button>
            )}

            {columnStatus === 'READY' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/40">
                <CheckCircle className="h-3.5 w-3.5" /> En Despacho
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
}
