'use client';

import React, { useEffect, useState, use } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  ChefHat, 
  Bell, 
  Utensils, 
  Receipt, 
  RotateCw 
} from 'lucide-react';

interface OrderItemData {
  id: string;
  quantity: number;
  price: number;
  notes?: string | null;
  product: {
    name: string;
    imageUrl?: string | null;
  };
}

interface OrderTrackingData {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  source: string;
  notes?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  brand: {
    name: string;
    slug: string;
    logoUrl?: string | null;
    primaryColor: string;
  };
  table?: {
    number: string;
    name: string;
    zone: string;
  } | null;
  items: OrderItemData[];
}

export default function OrderTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [order, setOrder] = useState<OrderTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchOrder = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/public/orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Error fetching order status', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
    // Auto-poll every 5 seconds for status updates
    const interval = setInterval(() => {
      fetchOrder();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-3">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Consultando estado del pedido...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-3">
        <h1 className="text-xl font-bold text-red-400">Pedido no encontrado</h1>
        <p className="text-sm text-slate-400">No pudimos encontrar la orden indicada.</p>
      </div>
    );
  }

  // Stepper state determination
  const statusHierarchy: Record<string, number> = {
    RECEIVED: 1,
    PREPARING: 2,
    READY: 3,
    ON_THE_WAY: 3,
    DELIVERED: 4,
    CANCELLED: 0,
  };

  const currentStep = statusHierarchy[order.status] ?? 1;
  const isCancelled = order.status === 'CANCELLED';

  const steps = [
    {
      step: 1,
      title: 'Comanda Recibida',
      desc: 'Ingresó al sistema y está en cola',
      icon: Clock,
    },
    {
      step: 2,
      title: 'En Preparación',
      desc: 'Nuestros chefs están cocinando tus platillos',
      icon: ChefHat,
    },
    {
      step: 3,
      title: 'Listo para Servir',
      desc: order.source === 'DINE_IN' ? 'Tu comida va rumbo a tu mesa' : 'Listo en barra para entrega',
      icon: Bell,
    },
    {
      step: 4,
      title: 'Entregado',
      desc: '¡Buen provecho! Gracias por visitarnos',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 pb-20 selection:bg-amber-500 selection:text-slate-950">
      <div className="max-w-md mx-auto space-y-6">
        {/* Brand & Order Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 shadow-sm">
            {order.brand.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={order.brand.logoUrl}
                alt={order.brand.name}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center font-black text-slate-950 text-[10px]"
                style={{ backgroundColor: order.brand.primaryColor }}
              >
                {order.brand.name.charAt(0)}
              </span>
            )}
            <span className="font-bold text-xs text-white">{order.brand.name}</span>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            Estado de tu Pedido
          </h1>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <span>Folio: <strong className="text-amber-400 font-mono">{order.orderNumber}</strong></span>
            <span>•</span>
            {order.table ? (
              <span className="text-emerald-400 font-bold">Mesa {order.table.number}</span>
            ) : (
              <span>Para Llevar</span>
            )}
          </div>
        </div>

        {/* Live Stepper Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 shadow-xl relative overflow-hidden">
          {isCancelled ? (
            <div className="text-center py-6 space-y-2">
              <span className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 px-3 py-1 rounded-full uppercase">
                Pedido Cancelado
              </span>
              <p className="text-xs text-slate-400">Este pedido fue cancelado. Comunícate con el personal si tienes dudas.</p>
            </div>
          ) : (
            <div className="space-y-6 relative">
              {steps.map((s, idx) => {
                const Icon = s.icon;
                const isPassed = currentStep > s.step;
                const isCurrent = currentStep === s.step;

                return (
                  <div key={s.step} className="flex gap-4 relative">
                    {/* Vertical connecting line */}
                    {idx < steps.length - 1 && (
                      <div
                        className={`absolute left-5 top-10 bottom-0 w-0.5 -ml-px transition-colors ${
                          currentStep > s.step ? 'bg-amber-500' : 'bg-slate-800'
                        }`}
                        style={{ height: 'calc(100% - 10px)' }}
                      />
                    )}

                    {/* Step Icon Bubble */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                        isPassed
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-lg'
                          : isCurrent
                          ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse'
                          : 'bg-slate-800 text-slate-600 border border-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Step Text Info */}
                    <div className="pt-0.5">
                      <h3
                        className={`text-sm font-bold ${
                          isCurrent
                            ? 'text-amber-400 font-extrabold'
                            : isPassed
                            ? 'text-white'
                            : 'text-slate-500'
                        }`}
                      >
                        {s.title}
                        {isCurrent && (
                          <span className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <RotateCw className="w-3 h-3 animate-spin" />
              Actualizando en vivo
            </span>
            <span>{lastRefreshed.toLocaleTimeString('es-MX')}</span>
          </div>
        </div>

        {/* Order Ticket Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Receipt className="w-4 h-4 text-amber-400" />
            Resumen de tu Comanda
          </h2>

          <div className="space-y-2 divide-y divide-slate-800/60">
            {order.items.map((item) => (
              <div key={item.id} className="pt-2 flex justify-between items-start gap-2 text-xs">
                <div>
                  <span className="font-bold text-white">
                    {item.quantity}x {item.product.name}
                  </span>
                  {item.notes && (
                    <p className="text-[11px] text-amber-400/80 italic">&ldquo;{item.notes}&rdquo;</p>
                  )}
                </div>
                <span className="font-mono font-medium text-slate-300 shrink-0">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono">${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>IVA (16%):</span>
              <span className="font-mono">${order.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-slate-800">
              <span>Total:</span>
              <span className="text-amber-400 font-mono">${order.total.toFixed(2)} MXN</span>
            </div>
          </div>
        </div>

        {/* Back / Re-order Action */}
        <div className="pt-2">
          <a
            href={`/m/${order.brand.slug}${order.table ? `?table=${order.table.number}` : ''}`}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-700 shadow-md transition-colors"
          >
            <Utensils className="w-4 h-4 text-amber-400" />
            <span>Pedir más platillos / Ver Menú</span>
          </a>
        </div>
      </div>
    </div>
  );
}
