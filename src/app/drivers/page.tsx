'use client';

import React, { useEffect, useState } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  Truck, 
  User, 
  MapPin, 
  Smartphone,
  Navigation,
  CheckCircle,
  Clock,
  Play,
  Check
} from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  role: string;
  deliveryProfile?: {
    id: string;
    vehicleType: string;
    plateNumber?: string | null;
    status: string;
  } | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  product: {
    name: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  total: number;
  items: OrderItem[];
  driverId?: string | null;
  driver?: {
    name: string;
  } | null;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Assignment selections
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');

  const { addNotification } = useAppStore();

  useEffect(() => {
    fetchDriverData();
    const interval = setInterval(fetchDriverData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchDriverData = async () => {
    try {
      // 1. Fetch drivers list
      const driversRes = await fetch('/api/drivers');
      if (driversRes.ok) {
        const driversData = await driversRes.json();
        setDrivers(driversData.drivers);
      }

      // 2. Fetch orders in READY status and ON_THE_WAY status
      const ordersRes = await fetch('/api/orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        const ready = ordersData.orders.filter((o: Order) => o.status === 'READY');
        const otw = ordersData.orders.filter((o: Order) => o.status === 'ON_THE_WAY');
        setReadyOrders(ready);
        setActiveDeliveries(otw);
        
        // Auto pre-select first order and first driver if available
        if (ready.length > 0 && !selectedOrderId) {
          setSelectedOrderId(ready[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load driver dispatch board', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || !selectedDriverId) return;

    try {
      // 1. Update order: set status to ON_THE_WAY and link driver
      const res = await fetch(`/api/orders/${selectedOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ON_THE_WAY',
          driverId: selectedDriverId,
        }),
      });

      if (res.ok) {
        // 2. Update driver profile status to DELIVERING
        await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId: selectedDriverId,
            status: 'DELIVERING',
          }),
        });

        addNotification(`Pedido asignado con éxito`, 'success');
        setSelectedOrderId('');
        setSelectedDriverId('');
        fetchDriverData();
      } else {
        alert('Error al asignar el pedido');
      }
    } catch (err) {
      alert('Error de red al despachar pedido');
    }
  };

  const handleMarkAsDelivered = async (orderId: string, driverId?: string | null) => {
    try {
      // 1. Update order status to DELIVERED (triggers stock deduction automatically in API handler!)
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED' }),
      });

      if (res.ok) {
        // 2. Update driver profile status back to AVAILABLE
        if (driverId) {
          await fetch('/api/drivers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverId,
              status: 'AVAILABLE',
            }),
          });
        }

        addNotification(`Pedido marcado como ENTREGADO. Inventario descontado.`, 'success');
        fetchDriverData();
      } else {
        alert('Error al completar pedido');
      }
    } catch (err) {
      alert('Error de red');
    }
  };

  const getDriverName = (driverId: string) => {
    return drivers.find(d => d.id === driverId)?.name || 'Repartidor';
  };

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
          <Truck className="h-6 w-6 text-brand-primary" />
          <h2 className="text-xl font-bold text-white">Logística & Despacho de Repartidores</h2>
        </div>

        {/* Dispatch Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Dispatch Control Form */}
          <div className="glass-panel border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 h-fit">
            <div className="border-b border-slate-850 pb-2 flex items-center gap-2">
              <Navigation className="h-5 w-5 text-brand-primary" />
              <h4 className="font-bold text-white text-sm">Asignar Reparto</h4>
            </div>

            {readyOrders.length === 0 ? (
              <div className="p-4 text-center border border-slate-800 border-dashed rounded text-slate-500 text-xs">
                No hay pedidos en estado "Listo" esperando despacho.
              </div>
            ) : (
              <form onSubmit={handleAssignOrder} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Seleccionar Pedido Listo</label>
                  <select
                    required
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2.5 text-slate-200 focus:border-brand-primary outline-none"
                  >
                    <option value="">-- Elige una comanda --</option>
                    {readyOrders.map(order => (
                      <option key={order.id} value={order.id}>
                        {order.orderNumber} - {order.customerName} (${order.total.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Asignar Repartidor</label>
                  <select
                    required
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2.5 text-slate-200 focus:border-brand-primary outline-none"
                  >
                    <option value="">-- Elige un chofer disponible --</option>
                    {drivers
                      .filter(d => d.deliveryProfile?.status === 'AVAILABLE')
                      .map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.deliveryProfile?.vehicleType})
                        </option>
                      ))
                    }
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!selectedOrderId || !selectedDriverId}
                  className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <Play className="h-4 w-4 fill-slate-950" /> Despachar Pedido
                </button>
              </form>
            )}
          </div>

          {/* Column 2: Active Deliveries list (En camino) */}
          <div className="glass-panel border border-slate-800 rounded-xl p-5 shadow-lg lg:col-span-2 space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500 animate-spin-slow" />
              <h4 className="font-bold text-white text-sm">Entregas Activas En Camino</h4>
            </div>

            <div className="space-y-4 overflow-y-auto max-h-[400px] pr-1">
              {activeDeliveries.length === 0 ? (
                <div className="text-center text-slate-600 text-xs py-12">No hay repartidores en ruta actualmente</div>
              ) : (
                activeDeliveries.map((order) => (
                  <div key={order.id} className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono bg-slate-850 px-2 py-0.5 rounded text-[11px]">{order.orderNumber}</span>
                        <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-semibold uppercase">En Camino</span>
                      </div>
                      <p className="text-slate-300 font-bold mt-1">Cliente: {order.customerName}</p>
                      {order.customerAddress && (
                        <p className="text-slate-400 flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" /> {order.customerAddress}</p>
                      )}
                      {order.customerPhone && (
                        <p className="text-slate-500 flex items-center gap-1"><Smartphone className="h-3.5 w-3.5 text-slate-600" /> {order.customerPhone}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 border-t md:border-t-0 pt-2.5 md:pt-0 border-slate-850 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Repartidor</span>
                        <p className="font-bold text-slate-200">{order.driver?.name || 'N/A'}</p>
                      </div>
                      <button
                        onClick={() => handleMarkAsDelivered(order.id, order.driverId)}
                        className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Check className="h-3.5 w-3.5 stroke-[3px]" /> Entregado
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Drivers Directory board */}
        <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-4">
          <div className="p-5 border-b border-slate-800 bg-slate-900/40">
            <h4 className="font-bold text-white text-base">Directorio de Repartidores Activos</h4>
            <p className="text-xs text-slate-500 mt-1">Disponibilidad en tiempo real de choferes y vehículos de la cocina.</p>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {drivers.map((driver) => {
              const status = driver.deliveryProfile?.status || 'OFFLINE';
              return (
                <div key={driver.id} className="p-4 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{driver.name}</p>
                        <p className="text-[10px] text-slate-500">{driver.deliveryProfile?.vehicleType} {driver.deliveryProfile?.plateNumber ? `• ${driver.deliveryProfile.plateNumber}` : ''}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                      status === 'AVAILABLE' 
                        ? 'bg-emerald-950/40 border border-emerald-900/50 text-emerald-400' 
                        : status === 'DELIVERING'
                        ? 'bg-amber-950/40 border border-amber-900/50 text-amber-400 animate-pulse'
                        : 'bg-slate-900 border border-slate-800 text-slate-500'
                    }`}>
                      {status === 'AVAILABLE' ? 'Disponible' : status === 'DELIVERING' ? 'Entregando' : 'Offline'}
                    </span>
                    
                    {/* Toggle status control */}
                    <button
                      onClick={async () => {
                        const nextStatus = status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
                        const res = await fetch('/api/drivers', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ driverId: driver.id, status: nextStatus }),
                        });
                        if (res.ok) fetchDriverData();
                      }}
                      className="text-[9px] text-slate-400 hover:text-white px-1.5 py-0.5 border border-slate-800 hover:border-slate-700 rounded bg-slate-900/50 cursor-pointer"
                    >
                      Alternar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardContainer>
  );
}
