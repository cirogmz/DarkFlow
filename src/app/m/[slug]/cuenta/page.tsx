'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import {
  Utensils,
  CreditCard,
  Wallet,
  Coins,
  CheckCircle2,
  Users,
  Receipt,
  Bell,
  Sparkles,
  ArrowLeft,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Heart,
  Clock,
  AlertCircle
} from 'lucide-react';
import { TableBillSummary, EqualSplitOption } from '@/lib/splitBill';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function TableBillSelfServicePage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const { slug } = unwrappedParams;

  const [tableNumber, setTableNumber] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billData, setBillData] = useState<TableBillSummary | null>(null);
  const [equalSplits, setEqualSplits] = useState<EqualSplitOption[]>([]);
  const [splitsCount, setSplitsCount] = useState<number>(2);

  // Split tabs: 'EQUAL' | 'ITEMS' | 'FULL'
  const [splitMode, setSplitMode] = useState<'EQUAL' | 'ITEMS' | 'FULL'>('EQUAL');
  const [selectedSplitIndex, setSelectedSplitIndex] = useState<number>(1);
  const [selectedItemsState, setSelectedItemsState] = useState<Record<string, number>>({});

  // Tip calculation
  const [tipOption, setTipOption] = useState<'0' | '10' | '15' | '20' | 'CUSTOM'>('15');
  const [customTip, setCustomTip] = useState<string>('');

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'WALLET' | 'CASH'>('CARD');
  const [payerName, setPayerName] = useState<string>('');
  const [payerPhone, setPayerPhone] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  // Success screen state
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    effectiveAmount: number;
    safeTip: number;
    newRemaining: number;
    isNowFullyPaid: boolean;
    transactionId: string;
  } | null>(null);

  // Assistance call state
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [assistanceSent, setAssistanceSent] = useState<string | null>(null);

  // Parse URL search params for table
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const tbl = sp.get('table') || '1';
      setTableNumber(tbl);
    }
  }, []);

  const fetchBill = useCallback(async () => {
    if (!tableNumber) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/public/tables/bill?slug=${slug}&table=${tableNumber}&splits=${splitsCount}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cargar la cuenta de la mesa');
      }

      setBillData(data.bill);
      setEqualSplits(data.equalSplits || []);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error al conectar con la mesa');
    } finally {
      setLoading(false);
    }
  }, [slug, tableNumber, splitsCount]);

  useEffect(() => {
    if (tableNumber) {
      fetchBill();
    }
  }, [tableNumber, fetchBill]);

  // Handle Assistance Call
  const handleCallWaiter = async (reason: 'CALL_WAITER' | 'BILL_REQUESTED' | 'SERVICE_HELP') => {
    try {
      setCallingWaiter(true);
      const res = await fetch('/api/public/tables/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandSlug: slug,
          tableNumber,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al llamar');

      setAssistanceSent(data.message || 'Llamado enviado al mesero');
      setTimeout(() => setAssistanceSent(null), 6000);
      fetchBill();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al llamar al mesero');
    } finally {
      setCallingWaiter(false);
    }
  };

  // Calculate effective bill amount according to selected mode
  const calculateModeAmount = (): number => {
    if (!billData) return 0;

    if (splitMode === 'FULL') {
      return billData.remainingBalance;
    }

    if (splitMode === 'EQUAL') {
      const selected = equalSplits.find((s) => s.splitIndex === selectedSplitIndex);
      return selected ? selected.amount : billData.remainingBalance / splitsCount;
    }

    if (splitMode === 'ITEMS') {
      let sum = 0;
      billData.items.forEach((item) => {
        const qty = selectedItemsState[item.id] || 0;
        sum += item.price * qty;
      });
      return parseFloat(sum.toFixed(2));
    }

    return billData.remainingBalance;
  };

  const currentAmount = calculateModeAmount();

  // Tip calculation
  const calculateTipAmount = (): number => {
    if (tipOption === '0') return 0;
    if (tipOption === '10') return parseFloat((currentAmount * 0.10).toFixed(2));
    if (tipOption === '15') return parseFloat((currentAmount * 0.15).toFixed(2));
    if (tipOption === '20') return parseFloat((currentAmount * 0.20).toFixed(2));
    if (tipOption === 'CUSTOM') {
      const val = parseFloat(customTip);
      return isNaN(val) ? 0 : Math.max(0, val);
    }
    return 0;
  };

  const currentTip = calculateTipAmount();
  const currentGrandTotal = parseFloat((currentAmount + currentTip).toFixed(2));

  // Toggle item selection in Item-based split
  const handleItemQtyChange = (itemId: string, newQty: number, maxQty: number) => {
    setSelectedItemsState((prev) => {
      const clamped = Math.max(0, Math.min(newQty, maxQty));
      if (clamped === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: clamped };
    });
  };

  // Submit Payment
  const handleProcessPayment = async () => {
    if (currentAmount <= 0) {
      alert('Por favor selecciona los platillos o un monto válido para pagar');
      return;
    }

    if (paymentMethod === 'WALLET' && (!payerPhone || !payerPhone.trim())) {
      alert('Por favor ingresa tu número de teléfono celular para debitar de tu Monedero Digital.');
      return;
    }

    try {
      setProcessing(true);

      const payload: {
        brandSlug: string;
        tableNumber: string;
        paymentMethod: 'CARD' | 'WALLET' | 'CASH';
        splitType: 'FULL' | 'EQUAL' | 'ITEMS';
        amount: number;
        tip: number;
        splitIndex?: number;
        payerName?: string;
        payerPhone?: string;
        selectedItems?: { orderItemId: string; quantity: number }[];
      } = {
        brandSlug: slug,
        tableNumber,
        paymentMethod,
        splitType: splitMode,
        amount: currentAmount,
        tip: currentTip,
        payerName: payerName.trim() || undefined,
        payerPhone: payerPhone.trim() || undefined,
      };

      if (splitMode === 'EQUAL') {
        payload.splitIndex = selectedSplitIndex;
      }

      if (splitMode === 'ITEMS') {
        payload.selectedItems = Object.entries(selectedItemsState).map(([orderItemId, quantity]) => ({
          orderItemId,
          quantity,
        }));
      }

      const res = await fetch('/api/public/tables/bill/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ocurrió un error al procesar el pago');
      }

      setPaymentSuccessData({
        effectiveAmount: data.result.effectiveAmount,
        safeTip: data.result.safeTip,
        newRemaining: data.result.newRemaining,
        isNowFullyPaid: data.result.isNowFullyPaid,
        transactionId: data.result.transaction.id,
      });

      // Refresh bill state
      fetchBill();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error en la transacción');
    } finally {
      setProcessing(false);
    }
  };

  if (loading && !billData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400">Consultando cuenta de tu mesa...</p>
      </div>
    );
  }

  if (error || !billData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 space-y-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold text-white">Mesa no disponible</h2>
        <p className="text-sm text-slate-400 max-w-xs">{error || 'No pudimos localizar la mesa solicitada.'}</p>
        <Link
          href={`/m/${slug}?table=${tableNumber}`}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm"
        >
          Volver al Menú Digital
        </Link>
      </div>
    );
  }

  // SUCCESS SCREEN
  if (paymentSuccessData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-md mx-auto flex flex-col justify-between">
        <div className="space-y-6 pt-6">
          <div className="text-center space-y-3">
            <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-14 h-14" />
            </div>
            <h1 className="text-2xl font-black text-white">¡Pago Exitoso!</h1>
            <p className="text-xs text-slate-400">
              {paymentSuccessData.isNowFullyPaid
                ? 'La cuenta de tu mesa ha quedado 100% saldada. ¡Muchas gracias!'
                : `Tu parte ha sido pagada. Aún resta un saldo de $${paymentSuccessData.newRemaining.toFixed(2)} MXN en la mesa.`}
            </p>
          </div>

          {/* Receipt Breakdown Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">Mesa #{billData.tableNumber}</span>
              <span className="text-amber-400 font-bold">{billData.brandName}</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Tu aportación:</span>
                <span className="font-bold text-white">${paymentSuccessData.effectiveAmount.toFixed(2)} MXN</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Heart className="w-3.5 h-3.5" /> Propina al mesero:
                </span>
                <span className="font-bold text-emerald-400">${paymentSuccessData.safeTip.toFixed(2)} MXN</span>
              </div>
              <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800">
                <span className="font-black text-white text-sm">Total Cobrado:</span>
                <span className="font-black text-emerald-400 text-base">
                  ${(paymentSuccessData.effectiveAmount + paymentSuccessData.safeTip).toFixed(2)} MXN
                </span>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-500 text-center">
              Folio de Transacción: <span className="font-mono text-slate-400">{paymentSuccessData.transactionId.slice(0, 14)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pb-6 pt-4">
          <Link
            href={`/feedback?table=${tableNumber}&slug=${slug}`}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Sparkles className="w-4 h-4" /> Calificar Servicio y Dejar Reseña
          </Link>

          {!paymentSuccessData.isNowFullyPaid && (
            <button
              onClick={() => setPaymentSuccessData(null)}
              className="w-full py-3 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4 text-amber-400" /> Ver Saldo Restante de la Mesa
            </button>
          )}

          <Link
            href={`/m/${slug}?table=${tableNumber}`}
            className="w-full py-3 px-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-medium rounded-xl text-xs flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al Menú Digital
          </Link>
        </div>
      </div>
    );
  }

  // ALREADY FULLY PAID SCREEN
  if (billData.isFullyPaid) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-md mx-auto flex flex-col justify-center items-center text-center space-y-6">
        <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-16 h-16" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">Mesa #{billData.tableNumber} Pagada</h2>
          <p className="text-xs text-slate-400 max-w-xs">
            Esta mesa no tiene saldo pendiente por pagar. Todas las comandas están al corriente.
          </p>
        </div>
        <div className="w-full space-y-3 pt-4">
          <Link
            href={`/feedback?table=${tableNumber}&slug=${slug}`}
            className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Dejar Reseña / Calificar Servicio
          </Link>
          <Link
            href={`/m/${slug}?table=${tableNumber}`}
            className="w-full py-3 px-4 bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
          >
            <Utensils className="w-4 h-4 text-amber-400" /> Abrir Menú Digital
          </Link>
        </div>
      </div>
    );
  }

  const progressPct = Math.min(100, Math.round((billData.totalPaid / billData.total) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link
            href={`/m/${slug}?table=${tableNumber}`}
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Menú
          </Link>
          <div className="flex items-center gap-2">
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
              <Utensils className="w-3 h-3" /> Mesa #{billData.tableNumber}
            </span>
            <span className="text-xs text-slate-400 font-medium">{billData.brandName}</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto p-4 space-y-5">
        {/* Assistance notification banner */}
        {assistanceSent && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fade-in shadow-lg">
            <Bell className="w-4 h-4 text-emerald-400 animate-bounce" />
            <span>{assistanceSent}</span>
          </div>
        )}

        {/* Waiter Card & Quick Assistance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-amber-400 text-sm">
              {billData.assignedWaiter ? billData.assignedWaiter.name.charAt(0) : 'M'}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Mesero en Turno</p>
              <h3 className="text-sm font-bold text-white">
                {billData.assignedWaiter ? billData.assignedWaiter.name : 'Personal de Salón'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCallWaiter('CALL_WAITER')}
              disabled={callingWaiter}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Llamar</span>
            </button>
            <button
              onClick={() => handleCallWaiter('SERVICE_HELP')}
              disabled={callingWaiter}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
              title="Servilletas / Hielo"
            >
              🧊
            </button>
          </div>
        </div>

        {/* Live Bill Total & Progress Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-850 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Cuenta Comanda #{billData.orderNumber || 'S/N'}</span>
              <span>{billData.diners} comensales</span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Saldo Restante por Pagar</p>
                <h1 className="text-3xl font-black text-white tracking-tight">
                  ${billData.remainingBalance.toFixed(2)}{' '}
                  <span className="text-xs font-bold text-amber-400">MXN</span>
                </h1>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-500">Total Comanda</p>
                <p className="text-sm font-bold text-slate-300">${billData.total.toFixed(2)} MXN</p>
              </div>
            </div>

            {/* Split Progress Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                <span>Progreso de Pago ({progressPct}%)</span>
                <span>Pagado: ${billData.totalPaid.toFixed(2)}</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Split Modes Selector */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            ¿Cómo deseas pagar?
          </h3>
          <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setSplitMode('EQUAL')}
              className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                splitMode === 'EQUAL'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>En Partes</span>
            </button>
            <button
              onClick={() => setSplitMode('ITEMS')}
              className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                splitMode === 'ITEMS'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Por Platillos</span>
            </button>
            <button
              onClick={() => setSplitMode('FULL')}
              className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                splitMode === 'FULL'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Total Completo</span>
            </button>
          </div>
        </div>

        {/* TAB 1: EQUAL SPLIT */}
        {splitMode === 'EQUAL' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Dividir entre comensales</h4>
                <p className="text-[11px] text-slate-400">Selecciona el número de personas</p>
              </div>
              <div className="flex items-center gap-3 bg-slate-800 px-3 py-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setSplitsCount((prev) => Math.max(2, prev - 1))}
                  className="font-bold text-slate-300 hover:text-white text-base px-1"
                >
                  -
                </button>
                <span className="font-black text-amber-400 text-sm">{splitsCount}</span>
                <button
                  onClick={() => setSplitsCount((prev) => Math.min(10, prev + 1))}
                  className="font-bold text-slate-300 hover:text-white text-base px-1"
                >
                  +
                </button>
              </div>
            </div>

            {/* Split cards */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {equalSplits.map((split) => {
                const isSelected = selectedSplitIndex === split.splitIndex;
                return (
                  <button
                    key={split.splitIndex}
                    onClick={() => setSelectedSplitIndex(split.splitIndex)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/80 shadow-md'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-bold text-slate-400">Parte {split.splitIndex}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <p className="text-base font-black text-white">${split.amount.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400">MXN</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: ITEM-BASED SPLIT */}
        {splitMode === 'ITEMS' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-white">Selecciona tus platillos consumidos</h4>
              <p className="text-[11px] text-slate-400">Toca para marcar lo que te corresponde pagar</p>
            </div>

            <div className="divide-y divide-slate-800/80">
              {billData.items.map((item) => {
                const maxAvailable = item.unpaidQuantity;
                const isItemFullyPaid = item.isPaid;
                const selectedQty = selectedItemsState[item.id] || 0;

                return (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="space-y-0.5 max-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">{item.name}</span>
                        {item.promoBadge && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-black">
                            {item.promoBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400">
                        ${item.price.toFixed(2)} c/u • Total: {item.quantity} pedidas
                      </p>
                      {isItemFullyPaid && (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Totalmente Pagado
                        </span>
                      )}
                    </div>

                    {!isItemFullyPaid ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg">
                          <button
                            onClick={() => handleItemQtyChange(item.id, selectedQty - 1, maxAvailable)}
                            className="px-2 py-1 text-slate-300 font-bold"
                          >
                            -
                          </button>
                          <span className="px-2 font-black text-amber-400">{selectedQty}</span>
                          <button
                            onClick={() => handleItemQtyChange(item.id, selectedQty + 1, maxAvailable)}
                            className="px-2 py-1 text-slate-300 font-bold"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-bold text-white text-xs w-16 text-right">
                          ${(item.price * selectedQty).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-600 font-bold text-xs">Pagado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: FULL BILL NOTICE */}
        {splitMode === 'FULL' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-xs space-y-1">
            <p className="font-bold text-white">Pagar saldo completo restante</p>
            <p className="text-slate-400">
              Liquidará todos los platillos pendientes de la comanda por un monto de{' '}
              <span className="font-black text-amber-400">${billData.remainingBalance.toFixed(2)} MXN</span>.
            </p>
          </div>
        )}

        {/* Tip Selector */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span>Propina para el mesero</span>
            </div>
            {billData.assignedWaiter && (
              <span className="text-[11px] text-amber-400 font-bold">
                100% para {billData.assignedWaiter.name}
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(['0', '10', '15', '20'] as const).map((opt) => {
              const isSelected = tipOption === opt;
              const tipAmount =
                opt === '0' ? 0 : parseFloat((currentAmount * (parseInt(opt, 10) / 100)).toFixed(2));

              return (
                <button
                  key={opt}
                  onClick={() => setTipOption(opt)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'bg-rose-500/10 border-rose-500/80 text-rose-400 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs font-black">{opt === '0' ? 'No' : `${opt}%`}</p>
                  <p className="text-[10px] opacity-80">${tipAmount.toFixed(0)}</p>
                </button>
              );
            })}
          </div>

          {tipOption === 'CUSTOM' && (
            <div className="pt-2">
              <label className="text-[11px] text-slate-400 block mb-1">Monto de propina personalizado ($ MXN):</label>
              <input
                type="number"
                min="0"
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                placeholder="Ej. 50"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          )}
        </div>

        {/* Payment Methods */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Método de Pago</h4>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setPaymentMethod('CARD')}
              className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                paymentMethod === 'CARD'
                  ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-[11px] font-bold">Tarjeta</span>
            </button>

            <button
              onClick={() => setPaymentMethod('WALLET')}
              className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                paymentMethod === 'WALLET'
                  ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span className="text-[11px] font-bold">Monedero</span>
            </button>

            <button
              onClick={() => setPaymentMethod('CASH')}
              className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                paymentMethod === 'CASH'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Coins className="w-5 h-5" />
              <span className="text-[11px] font-bold">Efectivo</span>
            </button>
          </div>

          {/* Additional fields for wallet or card */}
          <div className="space-y-2 pt-2">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Tu nombre (opcional para el ticket):</label>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Ej. Carlos"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            {paymentMethod === 'WALLET' && (
              <div>
                <label className="text-[11px] text-purple-400 font-bold block mb-1">
                  Número de teléfono del Monedero Digital:
                </label>
                <input
                  type="tel"
                  value={payerPhone}
                  onChange={(e) => setPayerPhone(e.target.value)}
                  placeholder="Ej. 5512345678"
                  className="w-full bg-slate-950 border border-purple-800/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Past Split Transactions Log */}
        {billData.transactions.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-2">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Pagos registrados en esta mesa:
            </h4>
            <div className="space-y-1.5">
              {billData.transactions.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center text-xs text-slate-300 py-1 border-b border-slate-800/50">
                  <div>
                    <span className="font-bold text-white">{tx.payerName || 'Comensal'}</span>
                    <span className="text-slate-500 text-[10px] ml-1.5">({tx.gateway})</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400">${tx.amount.toFixed(2)} MXN</span>
                    {tx.tip > 0 && (
                      <span className="text-[10px] text-slate-400 ml-1">(+${tx.tip} propina)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Payment Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 z-50">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Total a Pagar</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">${currentGrandTotal.toFixed(2)}</span>
              <span className="text-[10px] text-slate-400 font-bold">MXN</span>
            </div>
            {currentTip > 0 && (
              <p className="text-[10px] text-emerald-400 font-bold">Incluye ${currentTip.toFixed(2)} de propina</p>
            )}
          </div>

          <button
            onClick={handleProcessPayment}
            disabled={processing || currentAmount <= 0}
            className="flex-1 py-3.5 px-5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {processing ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Pagar Ahora</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

