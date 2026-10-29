'use client';

import React, { useEffect, useState, use } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  ChefHat, 
  Bell, 
  Utensils, 
  Receipt, 
  RotateCw,
  CreditCard,
  Wallet,
  ShieldCheck,
  Check,
  Star,
  Heart,
  AlertTriangle,
  Send,
  ChevronDown,
  ChevronUp,
  Gift
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
  paymentStatus?: string;
  paymentMethod?: string | null;
  paidAt?: string | null;
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
  survey?: {
    overallRating: number;
    npsScore: number;
    status: string;
    comment?: string | null;
  } | null;
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
  const [paying, setPaying] = useState(false);
  const [payModal, setPayModal] = useState<'STRIPE' | 'MERCADOPAGO' | null>(null);

  // Survey States
  const [surveyRating, setSurveyRating] = useState(5);
  const [surveyNps, setSurveyNps] = useState(10);
  const [surveyFoodRating, setSurveyFoodRating] = useState(5);
  const [surveyServiceRating, setSurveyServiceRating] = useState(5);
  const [surveySpeedRating, setSurveySpeedRating] = useState(5);
  const [surveyCleanlinessRating, setSurveyCleanlinessRating] = useState(5);
  const [surveyTags, setSurveyTags] = useState<string[]>([]);
  const [surveyComment, setSurveyComment] = useState('');
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveySubmitted, setSurveySubmitted] = useState<{
    overallRating: number;
    npsScore: number;
    status: string;
    compensationType?: string | null;
    compensationAmount?: number | null;
    compensationCouponCode?: string | null;
  } | null>(null);
  const [showSubRatings, setShowSubRatings] = useState(false);

  const fetchOrder = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/public/orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        if (data.order.survey) {
          setSurveySubmitted(data.order.survey);
        }
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Error fetching order status', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handlePay = async (gateway: 'STRIPE' | 'MERCADOPAGO') => {
    setPaying(true);
    try {
      const res = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: id,
          gateway,
          returnUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (res.ok && data.paymentUrl) {
        if (data.isSandbox) {
          setPayModal(gateway);
        } else {
          window.location.href = data.paymentUrl;
        }
      } else {
        alert(data.error || 'Error al iniciar sesión de pago');
      }
    } catch {
      alert('Error de conexión con la pasarela de pagos');
    } finally {
      setPaying(false);
    }
  };

  const handleSubmitSurvey = async () => {
    if (!order) return;
    setSurveySubmitting(true);
    try {
      const res = await fetch('/api/public/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          overallRating: surveyRating,
          npsScore: surveyNps,
          foodRating: surveyFoodRating,
          serviceRating: surveyServiceRating,
          speedRating: surveySpeedRating,
          cleanlinessRating: surveyCleanlinessRating,
          tags: surveyTags,
          comment: surveyComment,
          customerName: order.customerName,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSurveySubmitted(data.survey);
      } else {
        alert(data.error || 'Error al enviar encuesta');
      }
    } catch {
      alert('Error de conexión al enviar la encuesta');
    } finally {
      setSurveySubmitting(false);
    }
  };

  const handleConfirmSimulation = async (gateway: 'STRIPE' | 'MERCADOPAGO') => {
    setPaying(true);
    try {
      const res = await fetch('/api/payments/confirm-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: id,
          gateway,
          status: 'PAID',
        }),
      });
      if (res.ok) {
        setPayModal(null);
        fetchOrder();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al confirmar pago simulado');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setPaying(false);
    }
  };

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

        {/* Payment Status Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          {order.paymentStatus === 'PAID' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Pago Confirmado</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {order.paymentMethod || 'PAGADO'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Monto: <span className="font-mono text-white font-semibold">${order.total.toFixed(2)} MXN</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Pago Pendiente</h3>
                    <p className="text-[11px] text-slate-400">Total a liquidar: <strong className="text-amber-400 font-mono">${order.total.toFixed(2)} MXN</strong></p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800">
                  PENDIENTE
                </span>
              </div>

              {/* Online payment buttons */}
              <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handlePay('STRIPE')}
                  disabled={paying}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Pagar Stripe
                </button>

                <button
                  onClick={() => handlePay('MERCADOPAGO')}
                  disabled={paying}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Mercado Pago
                </button>
              </div>
            </div>
          )}
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

        {/* Diner Satisfaction & NPS Survey Widget */}
        {surveySubmitted ? (
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Heart className="w-5 h-5 fill-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">¡Gracias por tu valoración!</h3>
                <p className="text-xs text-slate-400">
                  Tu opinión nos ayuda a ofrecerte una experiencia excepcional en cada visita.
                </p>
              </div>
            </div>
            <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Calificación:</span>
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= (surveySubmitted.overallRating || 5)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">NPS:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {surveySubmitted.npsScore}/10
                </span>
              </div>
            </div>
            {surveySubmitted.status === 'PENDING_RESOLUTION' && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  Hemos notificado a la gerencia sobre tu experiencia. Nuestro equipo revisará tu caso para garantizar la máxima calidad en tu próxima orden.
                </span>
              </div>
            )}
            {surveySubmitted.compensationType && surveySubmitted.compensationType !== 'NONE' && (
              <div className="p-3 bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/30 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Gift className="w-4 h-4" /> Compensación Otorgada:
                </div>
                {surveySubmitted.compensationType === 'WALLET_CREDIT' ? (
                  <p className="text-amber-200 text-[11px]">
                    Se han acreditado <strong>${surveySubmitted.compensationAmount} MXN</strong> en tu Monedero Digital para tu próxima visita.
                  </p>
                ) : (
                  <p className="text-sky-300 text-[11px]">
                    Te obsequiamos el cupón <strong>{surveySubmitted.compensationCouponCode}</strong> ({surveySubmitted.compensationAmount}% de descuento).
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                </div>
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Califica tu Experiencia
                </h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                1 Minuto
              </span>
            </div>

            {/* Overall Star Rating */}
            <div className="text-center space-y-2">
              <p className="text-xs text-slate-300 font-medium">¿Qué tal estuvo tu pedido en general?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSurveyRating(star)}
                    className="p-1 text-slate-600 hover:scale-110 active:scale-95 transition-transform"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= surveyRating
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                          : 'text-slate-700 hover:text-slate-500'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-bold text-amber-400">
                {surveyRating === 5 && '¡Excelente, me encantó!'}
                {surveyRating === 4 && 'Muy bueno'}
                {surveyRating === 3 && 'Aceptable'}
                {surveyRating === 2 && 'Decepcionante'}
                {surveyRating === 1 && 'Pésimo'}
              </p>
            </div>

            {/* NPS Question (0 to 10 scale) */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <p className="text-xs text-slate-300 font-medium text-center">
                ¿Recomendarías {order.brand.name} a amigos o familiares?
              </p>
              <div className="grid grid-cols-11 gap-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                  const isSelected = surveyNps === score;
                  const isPromoter = score >= 9;
                  const isPassive = score >= 7 && score <= 8;
                  return (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setSurveyNps(score)}
                      className={`py-2 rounded-lg font-bold text-xs transition-all ${
                        isSelected
                          ? isPromoter
                            ? 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-105'
                            : isPassive
                            ? 'bg-amber-500 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.5)] scale-105'
                            : 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)] scale-105'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 px-1 font-medium">
                <span>0 = Nada probable</span>
                <span className={surveyNps >= 9 ? 'text-emerald-400 font-bold' : surveyNps >= 7 ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold'}>
                  {surveyNps >= 9 ? '💚 Promotor' : surveyNps >= 7 ? '💛 Pasivo' : '🚨 Detractor'}
                </span>
                <span>10 = Seguro que sí</span>
              </div>
            </div>

            {/* Quick Feedback Chips / Tags */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <label className="text-[11px] text-slate-400 block font-medium">Aspectos a destacar:</label>
              <div className="flex flex-wrap gap-1.5">
                {(surveyRating >= 4 ? [
                  'Comida deliciosa',
                  'Excelente presentación',
                  'Entrega súper rápida',
                  'Atención de 10',
                  'Porciones generosas',
                  'Empaque impecable'
                ] : [
                  'Comida fría',
                  'Demora excesiva',
                  'Faltó un producto',
                  'Falta de sazón',
                  'Empaque dañado',
                  'Atención deficiente'
                ]).map((tag) => {
                  const active = surveyTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSurveyTags(prev => active ? prev.filter(t => t !== tag) : [...prev, tag]);
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                        active
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-semibold'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Star Ratings (Accordion) */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowSubRatings(!showSubRatings)}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition py-1"
              >
                <span>Detalles por área (Sabor, Rapidez, Servicio...)</span>
                {showSubRatings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showSubRatings && (
                <div className="mt-2 space-y-2.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs">
                  {[
                    { label: 'Sabor de la Comida', val: surveyFoodRating, set: setSurveyFoodRating },
                    { label: 'Tiempo & Rapidez', val: surveySpeedRating, set: setSurveySpeedRating },
                    { label: 'Atención & Servicio', val: surveyServiceRating, set: setSurveyServiceRating },
                    { label: 'Higiene & Empaque', val: surveyCleanlinessRating, set: setSurveyCleanlinessRating },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-slate-300">{item.label}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => item.set(s)}
                            className="p-0.5 text-slate-600 hover:scale-110 transition-transform"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                s <= item.val ? 'fill-amber-400 text-amber-400' : 'text-slate-800'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="space-y-1">
              <textarea
                value={surveyComment}
                onChange={(e) => setSurveyComment(e.target.value)}
                placeholder="Cuéntanos más detalles o sugerencias para el equipo..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Submit button */}
            <button
              type="button"
              onClick={handleSubmitSurvey}
              disabled={surveySubmitting}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {surveySubmitting ? 'Enviando reseña...' : 'Enviar Calificación'}
            </button>
          </div>
        )}

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

      {/* Modal de Simulación de Pago */}
      {payModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">Modo Sandbox: {payModal}</h3>
              <p className="text-xs text-slate-400">Total a liquidar: ${order.total.toFixed(2)} MXN</p>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p>Puedes simular la confirmación bancaria en 1 clic para validar la transición inmediata del pedido.</p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => handleConfirmSimulation(payModal)}
                disabled={paying}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {paying ? 'Aprobando...' : 'Simular Pago Aprobado'}
              </button>

              <button
                onClick={() => setPayModal(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
