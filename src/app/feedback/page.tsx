'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Star,
  HeartHandshake,
  CheckCircle2,
  AlertTriangle,
  Gift,
  Wallet,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  MessageSquare,
  UtensilsCrossed,
  Clock,
  UserCheck,
  Sparkle
} from 'lucide-react';
import { POPULAR_SURVEY_TAGS } from '@/lib/surveyConstants';

interface OrderData {
  id: string;
  orderNumber: string;
  total: number;
  customerName?: string | null;
  customerPhone?: string | null;
  tableNumber?: string | null;
  waiterName?: string | null;
  createdAt: string;
}

interface BrandData {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string;
  surveyQrFooterText?: string | null;
}

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  walletBalance: number;
  walletQrCode?: string | null;
  tier: string;
}

function FeedbackContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const tableId = searchParams.get('tableId');
  const orderNumberParam = searchParams.get('orderNumber');
  const brandIdParam = searchParams.get('brandId');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded data
  const [order, setOrder] = useState<OrderData | null>(null);
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  // Manual search fallback if no URL params
  const [manualOrderNumber, setManualOrderNumber] = useState('');

  // Form State
  const [overallRating, setOverallRating] = useState<number>(5);
  const [npsScore, setNpsScore] = useState<number>(10);
  const [foodRating, setFoodRating] = useState<number>(5);
  const [serviceRating, setServiceRating] = useState<number>(5);
  const [speedRating, setSpeedRating] = useState<number>(5);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Submission Result State
  const [result, setResult] = useState<{
    success: boolean;
    isDetractor: boolean;
    compensation?: {
      applied: boolean;
      type: 'NONE' | 'WALLET_CREDIT' | 'COUPON' | 'MANUAL_RECOVERY';
      amount: number;
      couponCode?: string | null;
      newWalletBalance?: number | null;
      message: string;
    };
    message: string;
  } | null>(null);

  const [copiedCoupon, setCopiedCoupon] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId, tableId, orderNumberParam, brandIdParam]);

  const fetchOrderDetails = async (customOrderNumber?: string) => {
    setLoading(true);
    setError(null);
    try {
      let query = '';
      if (orderId) {
        query = `orderId=${encodeURIComponent(orderId)}`;
      } else if (customOrderNumber && brandIdParam) {
        query = `orderNumber=${encodeURIComponent(customOrderNumber)}&brandId=${encodeURIComponent(brandIdParam)}`;
      } else if (orderNumberParam && brandIdParam) {
        query = `orderNumber=${encodeURIComponent(orderNumberParam)}&brandId=${encodeURIComponent(brandIdParam)}`;
      } else if (tableId) {
        query = `tableId=${encodeURIComponent(tableId)}`;
      }

      if (!query) {
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/public/surveys?${query}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se encontró la comanda');
      }

      if (data.exists) {
        setAlreadyCompleted(true);
      }

      setOrder(data.order);
      setBrand(data.brand);
      setCustomer(data.customer || null);
      if (data.order?.customerName) setCustomerName(data.order.customerName);
      if (data.order?.customerPhone) setCustomerPhone(data.order.customerPhone);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order?.id) {
      setError('No se identificó la comanda a evaluar.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/public/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          overallRating,
          npsScore,
          foodRating,
          serviceRating,
          speedRating,
          cleanlinessRating,
          tags: selectedTags,
          comment,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          source: order.tableNumber ? 'QR_TABLE' : 'QR_TICKET',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar encuesta');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error al procesar la encuesta');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2500);
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 1:
        return 'Muy mala 😞';
      case 2:
        return 'Insatisfactoria 🙁';
      case 3:
        return 'Regular 😐';
      case 4:
        return 'Buena 😊';
      case 5:
        return '¡Excelente! 🤩';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium animate-pulse">Cargando encuesta de satisfacción...</p>
      </div>
    );
  }

  // Already Completed Screen
  if (alreadyCompleted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-2">¡Encuesta ya completada!</h2>
          <p className="text-slate-400 text-sm mb-6">
            Ya hemos registrado los comentarios para la Comanda #{order?.orderNumber || ''}. Agradecemos mucho tu tiempo para ayudarnos a mejorar cada día.
          </p>
          <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/50 text-left mb-6">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Comensal</p>
            <p className="text-sm font-semibold text-white">{order?.customerName || 'Cliente Distinguido'}</p>
            {order?.tableNumber && (
              <p className="text-xs text-amber-400 mt-1">{order.tableNumber}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Success / Compensation Result Screen
  if (result) {
    const isComp = result.compensation && result.compensation.applied;
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 text-center shadow-2xl relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-30 ${result.isDetractor ? 'bg-amber-500' : 'bg-emerald-500'}`} />

          {/* Icon Header */}
          <div className={`w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center border shadow-lg ${
            result.isDetractor
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            {result.isDetractor ? <HeartHandshake className="w-10 h-10" /> : <Sparkles className="w-10 h-10" />}
          </div>

          <h2 className="text-2xl font-black mb-2 tracking-tight">
            {result.isDetractor ? 'Tu opinión nos ayuda a mejorar' : '¡Muchísimas Gracias!'}
          </h2>

          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            {result.message}
          </p>

          {/* Automatic Compensation Card */}
          {isComp && (
            <div className="p-5 bg-gradient-to-br from-amber-950/60 via-slate-900 to-amber-950/40 border-2 border-amber-500/40 rounded-2xl mb-6 text-left shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-5 h-5 text-amber-400 animate-bounce" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Compensación de Satisfacción
                </span>
              </div>

              {result.compensation?.type === 'WALLET_CREDIT' ? (
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs text-slate-400">Saldo Acreditado:</span>
                    <span className="text-2xl font-black text-amber-300">
                      +${result.compensation.amount.toFixed(2)} MXN
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-amber-500/20 text-slate-300">
                    <span className="flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-amber-400" /> Monedero Digital
                    </span>
                    <span className="font-semibold text-emerald-400">
                      Nuevo Saldo: ${result.compensation.newWalletBalance?.toFixed(2)} MXN
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 leading-tight">
                    * El saldo ha sido depositado a tu cuenta y podrás usarlo en tu próxima visita o pedido.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-300 mb-2">
                    Te obsequiamos este cupón con un <strong>{result.compensation?.amount}% de descuento</strong> para tu próxima visita:
                  </p>
                  <div className="flex items-center justify-between p-3 bg-black/40 border border-amber-500/30 rounded-xl mb-2">
                    <span className="font-mono text-lg font-black tracking-widest text-amber-400">
                      {result.compensation?.couponCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.compensation?.couponCode || '')}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
                    >
                      {copiedCoupon ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCoupon ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    * Válido por 30 días en cualquiera de nuestras marcas participantes.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-slate-500">
            Comanda #{order?.orderNumber} • {brand?.name || 'DarkFlow Kitchen'}
          </div>
        </div>
      </div>
    );
  }

  // Fallback search if no order identified
  if (!order) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
          <UtensilsCrossed className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Evalúa tu Experiencia</h2>
          <p className="text-slate-400 text-sm mb-6">
            Ingresa el número de tu comanda o ticket para compartir tu opinión y recibir beneficios exclusivos.
          </p>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Ej: 1042"
              value={manualOrderNumber}
              onChange={(e) => setManualOrderNumber(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => fetchOrderDetails(manualOrderNumber)}
              disabled={!manualOrderNumber.trim()}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center gap-1 transition-colors"
            >
              Buscar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
        </div>
      </div>
    );
  }

  // Main Survey Form
  const availableTags = overallRating <= 3 ? POPULAR_SURVEY_TAGS.negative : POPULAR_SURVEY_TAGS.positive;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      {/* Brand Header */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {brand?.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.name} className="w-9 h-9 rounded-xl object-cover border border-slate-700" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-black text-amber-400">
                {brand?.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold leading-tight">{brand?.name || 'DarkFlow Kitchen'}</h1>
              <p className="text-[11px] text-slate-400">
                Comanda #{order.orderNumber} {order.tableNumber && `• ${order.tableNumber}`}
              </p>
            </div>
          </div>
          {order.waiterName && (
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Atendido por</span>
              <span className="text-xs font-semibold text-amber-400">{order.waiterName}</span>
            </div>
          )}
        </div>
      </header>

      {/* Hero Notice */}
      <div className="max-w-xl mx-auto px-4 pt-6 pb-2 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-3">
          <Sparkle className="w-3.5 h-3.5" /> Tu opinión es 100% escuchada
        </div>
        <h2 className="text-2xl font-black tracking-tight mb-2">
          ¿Cómo estuvo tu experiencia?
        </h2>
        <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
          {brand?.surveyQrFooterText || 'Queremos brindarte siempre la máxima calidad gastronómica y de servicio.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 mt-6 space-y-6">
        {/* 1. CSAT Overall Stars */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center shadow-xl">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-4">
            Calificación General
          </label>
          <div className="flex justify-center items-center gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setOverallRating(star)}
                className="p-1.5 transition-transform hover:scale-110 active:scale-95 focus:outline-none"
              >
                <Star
                  className={`w-10 h-10 ${
                    star <= overallRating
                      ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                      : 'text-slate-700'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-sm font-bold text-amber-400 animate-fadeIn">
            {getRatingLabel(overallRating)}
          </p>
        </div>

        {/* 2. NPS Metric (0 - 10) */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Recomendación (NPS)
          </label>
          <p className="text-xs text-slate-400 mb-4">
            ¿Qué tan probable es que nos recomiendes con un amigo o familiar?
          </p>
          <div className="grid grid-cols-11 gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
              const isSelected = npsScore === score;
              let btnColor = 'bg-slate-800 text-slate-400 border-slate-700';
              if (isSelected) {
                if (score >= 9) btnColor = 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-emerald-500/50 shadow-md';
                else if (score >= 7) btnColor = 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-amber-500/50 shadow-md';
                else btnColor = 'bg-rose-500 text-white font-black border-rose-400 shadow-rose-500/50 shadow-md';
              }
              return (
                <button
                  key={score}
                  type="button"
                  onClick={() => setNpsScore(score)}
                  className={`h-11 rounded-xl text-xs border font-bold flex items-center justify-center transition-all ${btnColor}`}
                >
                  {score}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold px-1 mt-2">
            <span>0 = Nada probable</span>
            <span>10 = Muy probable</span>
          </div>
        </div>

        {/* 3. Detailed Criteria Stars */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Evaluación por Factores Clave
          </label>

          {/* Sabor */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" /> Sabor y Calidad de Platillos
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setFoodRating(s)}>
                  <Star className={`w-5 h-5 ${s <= foodRating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Servicio */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-sky-400" /> Atención del Personal {order.waiterName && `(${order.waiterName})`}
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setServiceRating(s)}>
                  <Star className={`w-5 h-5 ${s <= serviceRating ? 'fill-sky-400 text-sky-400' : 'text-slate-700'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Rapidez */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> Rapidez y Tiempos de Espera
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setSpeedRating(s)}>
                  <Star className={`w-5 h-5 ${s <= speedRating ? 'fill-emerald-400 text-emerald-400' : 'text-slate-700'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Limpieza */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Limpieza y Presentación
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setCleanlinessRating(s)}>
                  <Star className={`w-5 h-5 ${s <= cleanlinessRating ? 'fill-purple-400 text-purple-400' : 'text-slate-700'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Tag Chips */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
            {overallRating <= 3 ? '¿Qué podríamos mejorar?' : '¿Qué fue lo que más te gustó?'}
          </label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    active
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Written Comment */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" /> Comentarios Adicionales
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Escribe aquí cualquier detalle sobre tu visita o platillos..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* 6. Identification & Wallet Reward Link */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400" />
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Datos de Contacto & Monedero Digital
            </label>
          </div>
          <p className="text-[11px] text-slate-400">
            Ingresa tu WhatsApp para vincular tu Monedero DarkFlow y recibir saldo de compensación o recompensas VIP.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Tu Nombre</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre completo"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">WhatsApp / Teléfono</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="10 dígitos"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:opacity-95 disabled:opacity-50 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              Enviar Evaluación <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm">
        Cargando formulario...
      </div>
    }>
      <FeedbackContent />
    </Suspense>
  );
}

