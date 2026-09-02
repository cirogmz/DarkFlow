'use client';

import React, { useEffect, useState } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  Clock, 
  Flame, 
  CheckCircle, 
  Play, 
  PackageCheck,
  AlertTriangle
} from 'lucide-react';

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
  createdAt: string;
  updatedAt: string;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useAppStore();

  const fetchActiveOrders = React.useCallback(async () => {
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

  useEffect(() => {
    fetchActiveOrders();
    // Auto refresh kitchen display every 15 seconds
    const interval = setInterval(fetchActiveOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchActiveOrders]);

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

  // Helper: calculate waiting time in minutes
  const getWaitingTimeMins = (createdAtStr: string) => {
    const created = new Date(createdAtStr);
    const diffMs = Date.now() - created.getTime();
    return Math.floor(diffMs / (60 * 1000));
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
          <p className="text-sm text-slate-400">Cargando comandas de cocina...</p>
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <div className="space-y-6 flex flex-col h-[calc(100vh-130px)] overflow-hidden">
        {/* Header Board stats */}
        <div className="flex flex-wrap gap-4 items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-brand-primary animate-pulse" />
            <h2 className="text-xl font-bold text-white">Kitchen Display System (KDS)</h2>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-400">
              Nuevos: <strong className="text-white">{receivedOrders.length}</strong>
            </span>
            <span className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-400">
              En Cocina: <strong className="text-amber-500">{preparingOrders.length}</strong>
            </span>
            <span className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-400">
              Listos: <strong className="text-emerald-500">{readyOrders.length}</strong>
            </span>
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
                  const waitTime = getWaitingTimeMins(order.createdAt);
                  const isLate = waitTime >= 15;
                  return (
                    <div 
                      key={order.id} 
                      className={`glass-panel border rounded-xl p-4 space-y-3 relative overflow-hidden transition-all duration-200 hover:border-slate-700 ${
                        isLate ? 'border-red-900/60 bg-red-950/5' : 'border-slate-800'
                      }`}
                    >
                      {/* Top status */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-white">{order.orderNumber}</span>
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
                        <span className={`flex items-center gap-1.5 font-semibold ${isLate ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                          <Clock className="h-4 w-4" /> {waitTime} min
                          {isLate && <AlertTriangle className="h-3.5 w-3.5" />}
                        </span>

                        <button
                          onClick={() => advanceOrderStatus(order.id, order.status)}
                          className="flex items-center gap-1 py-1.5 px-3 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg cursor-pointer"
                        >
                          <Play className="h-3 w-3 stroke-[3px]" /> Preparar
                        </button>
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
                  const waitTime = getWaitingTimeMins(order.createdAt);
                  const isLate = waitTime >= 15;
                  return (
                    <div 
                      key={order.id} 
                      className={`glass-panel border rounded-xl p-4 space-y-3 relative overflow-hidden transition-all duration-200 hover:border-slate-700 ${
                        isLate ? 'border-red-900/60 bg-red-950/5' : 'border-slate-800'
                      }`}
                    >
                      {/* Top status */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded">{order.orderNumber}</span>
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
                        <span className={`flex items-center gap-1.5 font-semibold ${isLate ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                          <Clock className="h-4 w-4" /> {waitTime} min
                          {isLate && <AlertTriangle className="h-3.5 w-3.5" />}
                        </span>

                        <button
                          onClick={() => advanceOrderStatus(order.id, order.status)}
                          className="flex items-center gap-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg cursor-pointer"
                        >
                          <CheckCircle className="h-3 w-3 stroke-[3px]" /> Terminar
                        </button>
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
                  const waitTime = getWaitingTimeMins(order.createdAt);
                  return (
                    <div 
                      key={order.id} 
                      className="glass-panel border border-emerald-900/30 bg-emerald-950/5 rounded-xl p-4 space-y-3 relative overflow-hidden transition-all duration-200 hover:border-emerald-800/50"
                    >
                      {/* Top status */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded">{order.orderNumber}</span>
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
                          <PackageCheck className="h-4 w-4 text-emerald-500" /> Listo para despacho
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Espera: {waitTime}m
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardContainer>
  );
}
