'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  Clock, 
  Flame, 
  CheckCircle, 
  Play, 
  PackageCheck, 
  AlertTriangle,
  Printer,
  Volume2,
  VolumeX
} from 'lucide-react';
import ThermalTicketModal, { ThermalOrderData } from '@/components/ThermalTicketModal';
import { playKitchenChime } from '@/lib/sound';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  notes?: string | null;
  product: {
    name: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  source: string;
  status: string;
  customerName: string;
  notes?: string | null;
  items: OrderItem[];
  table?: {
    number: string;
    name: string;
  } | null;
  diners?: number | null;
  createdAt: string;
  updatedAt: string;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isThermalOpen, setIsThermalOpen] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<ThermalOrderData | null>(null);
  
  // Real-time & Audio state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [connectionMode, setConnectionMode] = useState<'SSE' | 'POLL' | 'CONNECTING'>('CONNECTING');
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(Date.now());
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const { addNotification } = useAppStore();

  const fetchActiveOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        // Kitchen only cares about RECEIVED, PREPARING and READY orders
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

  // 1. Clock ticker for live second-by-second wait timers
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
          // Play kitchen chime if new order is received
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
        // Fallback to active polling if SSE is disconnected
        setConnectionMode('POLL');
      };
    } catch {
      setConnectionMode('POLL');
    }

    // Safety fallback interval (every 8s if SSE drops, otherwise keeps fresh)
    fallbackInterval = setInterval(fetchActiveOrders, 8000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [fetchActiveOrders, addNotification]);

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
        addNotification(`Pedido ${data.order.orderNumber} actualizado a ${nextStatus}`, 'info');
        fetchActiveOrders();
      } else {
        alert('Error al avanzar el pedido');
      }
    } catch {
      alert('Error de red al actualizar estado');
    }
  };

  // Helper: calculate waiting time in minutes and seconds formatted (MM:SS)
  const getElapsedDetail = (createdAtStr: string) => {
    const created = new Date(createdAtStr).getTime();
    const diffSeconds = Math.max(0, Math.floor((currentTimestamp - created) / 1000));
    const mins = Math.floor(diffSeconds / 60);
    const secs = diffSeconds % 60;
    const formattedTime = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    return {
      mins,
      secs,
      formattedTime,
      isUrgent: mins >= 20,
      isWarning: mins >= 10 && mins < 20,
    };
  };

  // Group orders by status
  const receivedOrders = orders.filter((o) => o.status === 'RECEIVED');
  const preparingOrders = orders.filter((o) => o.status === 'PREPARING');
  const readyOrders = orders.filter((o) => o.status === 'READY');

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
        <div className="flex flex-wrap gap-4 items-center justify-between shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Flame className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">KDS Cocina Central</h2>
                {/* Live SSE / Polling Beacon */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border ${
                  connectionMode === 'SSE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${connectionMode === 'SSE' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'}`} />
                  {connectionMode === 'SSE' ? 'EN VIVO (SSE)' : 'EN VIVO (POLL)'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Gestión de comandas y línea de preparación multi-marca</p>
            </div>
          </div>

          {/* Sound Controls & Counters */}
          <div className="flex items-center gap-3">
            {/* Audio Toggle */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  if (next) playKitchenChime();
                  addNotification(next ? 'Campana de cocina activada' : 'Campana silenciada', 'info');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  soundEnabled 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title={soundEnabled ? 'Silenciar campana' : 'Activar campana'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span className="hidden sm:inline">{soundEnabled ? 'Campana Activa' : 'Mute'}</span>
              </button>

              <button
                onClick={() => playKitchenChime()}
                className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Probar sonido de campana"
              >
                Probar
              </button>
            </div>

            {/* Counters */}
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

        {/* 3-Column board layout */}
        <div className="flex-1 flex flex-col md:flex-row gap-5 overflow-hidden">
          {/* Column 1: RECEIVED */}
          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">Nuevos Pedidos</span>
              <span className="h-5 px-2 bg-slate-800 text-slate-300 rounded text-[10px] font-bold flex items-center">{receivedOrders.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {receivedOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs py-12">
                  No hay órdenes en espera
                </div>
              ) : (
                receivedOrders.map((order) => {
                  const { formattedTime, isUrgent, isWarning } = getElapsedDetail(order.createdAt);
                  return (
                    <div 
                      key={order.id} 
                      className={`glass-panel border rounded-xl p-4 space-y-3 relative overflow-hidden transition-all duration-200 hover:border-slate-700 ${
                        isUrgent 
                          ? 'border-red-600/80 bg-red-950/20 shadow-lg shadow-red-950/20' 
                          : isWarning 
                            ? 'border-amber-600/60 bg-amber-950/10' 
                            : 'border-slate-800'
                      }`}
                    >
                      {/* Top status */}
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-white">{order.orderNumber}</span>
                          {order.table && (
                            <span className="font-bold text-[10px] bg-brand-primary text-slate-950 px-1.5 py-0.5 rounded">
                              🍽️ {order.table.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 rounded uppercase">
                          {order.source}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 py-2 border-t border-b border-slate-800/60">
                        {order.items.map((item) => (
                          <div key={item.id} className="text-xs flex flex-col">
                            <div className="flex justify-between items-start text-white">
                              <span className="font-bold">{item.quantity}x {item.product.name}</span>
                            </div>
                            {item.notes && (
                              <span className="text-[10px] text-amber-500 font-medium italic mt-0.5 bg-amber-950/20 px-1.5 py-0.5 rounded">
                                Nota: {item.notes}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Footer controls */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          isUrgent 
                            ? 'text-red-400 bg-red-950/60 border-red-800 animate-pulse' 
                            : isWarning 
                              ? 'text-amber-400 bg-amber-950/40 border-amber-800/60' 
                              : 'text-emerald-400 bg-emerald-950/30 border-emerald-800/40'
                        }`}>
                          <Clock className="h-3.5 w-3.5" /> {formattedTime} min
                          {isUrgent && <AlertTriangle className="h-3 w-3 text-red-400" />}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedOrderForPrint(order as unknown as ThermalOrderData);
                              setIsThermalOpen(true);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 cursor-pointer"
                            title="Imprimir Comanda Térmica"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => advanceOrderStatus(order.id, order.status)}
                            className="flex items-center gap-1 py-1.5 px-3 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg cursor-pointer transition-all active:scale-95"
                          >
                            <Play className="h-3 w-3 stroke-[3px]" /> Preparar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: PREPARING */}
          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">En Preparación</span>
              <span className="h-5 px-2 bg-amber-950 border border-amber-900 text-amber-400 rounded text-[10px] font-bold flex items-center">{preparingOrders.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {preparingOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs py-12">
                  No hay órdenes en cocina
                </div>
              ) : (
                preparingOrders.map((order) => {
                  const { formattedTime, isUrgent, isWarning } = getElapsedDetail(order.createdAt);
                  return (
                    <div 
                      key={order.id} 
                      className={`glass-panel border rounded-xl p-4 space-y-3 relative overflow-hidden transition-all duration-200 hover:border-slate-700 ${
                        isUrgent 
                          ? 'border-red-600/80 bg-red-950/20 shadow-lg shadow-red-950/20' 
                          : isWarning 
                            ? 'border-amber-600/60 bg-amber-950/10' 
                            : 'border-slate-800'
                      }`}
                    >
                      {/* Top status */}
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded">{order.orderNumber}</span>
                          {order.table && (
                            <span className="font-bold text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded">
                              🍽️ {order.table.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 rounded uppercase">
                          {order.source}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 py-2 border-t border-b border-slate-800/60">
                        {order.items.map((item) => (
                          <div key={item.id} className="text-xs flex flex-col">
                            <div className="flex justify-between items-start text-white">
                              <span className="font-bold">{item.quantity}x {item.product.name}</span>
                            </div>
                            {item.notes && (
                              <span className="text-[10px] text-amber-500 font-medium italic mt-0.5 bg-amber-950/20 px-1.5 py-0.5 rounded">
                                Nota: {item.notes}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Footer controls */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          isUrgent 
                            ? 'text-red-400 bg-red-950/60 border-red-800 animate-pulse' 
                            : isWarning 
                              ? 'text-amber-400 bg-amber-950/40 border-amber-800/60' 
                              : 'text-emerald-400 bg-emerald-950/30 border-emerald-800/40'
                        }`}>
                          <Clock className="h-3.5 w-3.5" /> {formattedTime} min
                          {isUrgent && <AlertTriangle className="h-3 w-3 text-red-400" />}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedOrderForPrint(order as unknown as ThermalOrderData);
                              setIsThermalOpen(true);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 cursor-pointer"
                            title="Imprimir Comanda Térmica"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => advanceOrderStatus(order.id, order.status)}
                            className="flex items-center gap-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg cursor-pointer transition-all active:scale-95"
                          >
                            <CheckCircle className="h-3 w-3 stroke-[3px]" /> Terminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: READY */}
          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">Listos para Despacho</span>
              <span className="h-5 px-2 bg-emerald-950 border border-emerald-900 text-emerald-400 rounded text-[10px] font-bold flex items-center">{readyOrders.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {readyOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs py-12">
                  No hay pedidos listos
                </div>
              ) : (
                readyOrders.map((order) => {
                  const { formattedTime } = getElapsedDetail(order.createdAt);
                  return (
                    <div 
                      key={order.id} 
                      className="glass-panel border border-emerald-900/30 bg-emerald-950/5 rounded-xl p-4 space-y-3 relative overflow-hidden transition-all duration-200 hover:border-emerald-800/50"
                    >
                      {/* Top status */}
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded">{order.orderNumber}</span>
                          {order.table && (
                            <span className="font-bold text-[10px] bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded">
                              🍽️ {order.table.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 rounded uppercase">
                          {order.source}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 py-2 border-t border-b border-slate-800/60">
                        {order.items.map((item) => (
                          <div key={item.id} className="text-xs flex flex-col">
                            <span className="font-bold text-slate-300">{item.quantity}x {item.product.name}</span>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                          <PackageCheck className="h-4 w-4 text-emerald-500" /> Listo
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {formattedTime} min
                          </span>
                          <button
                            onClick={() => {
                              setSelectedOrderForPrint(order as unknown as ThermalOrderData);
                              setIsThermalOpen(true);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 cursor-pointer"
                            title="Imprimir Comanda Térmica"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ESC/POS Kitchen Thermal Printing Dialog */}
      {selectedOrderForPrint && (
        <ThermalTicketModal
          isOpen={isThermalOpen}
          onClose={() => setIsThermalOpen(false)}
          order={selectedOrderForPrint}
          initialMode="KITCHEN"
        />
      )}
    </DashboardContainer>
  );
}
