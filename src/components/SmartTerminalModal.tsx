'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Wifi,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Radio,
  ChevronRight,
  Heart
} from 'lucide-react';
import { SmartTerminalDTO } from '@/lib/smartTerminals';

interface SmartTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandId?: string;
  orderId: string;
  orderNumber: string;
  total: number;
  tableName?: string | null;
  onPaymentSuccess?: () => void;
}

export default function SmartTerminalModal({
  isOpen,
  onClose,
  brandId,
  orderId,
  orderNumber,
  total,
  tableName,
  onPaymentSuccess,
}: SmartTerminalModalProps) {
  const [terminals, setTerminals] = useState<SmartTerminalDTO[]>([]);
  const [loadingTerminals, setLoadingTerminals] = useState(false);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('');

  // Step: 'SELECT_TERMINAL' | 'WAITING_CARD' | 'APPROVED' | 'REJECTED'
  const [step, setStep] = useState<'SELECT_TERMINAL' | 'WAITING_CARD' | 'APPROVED' | 'REJECTED'>('SELECT_TERMINAL');
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  // Tip
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [selectedTipPct, setSelectedTipPct] = useState<'0' | '10' | '15' | '20'>('10');

  // Result info
  const [resultData, setResultData] = useState<{
    authCode?: string;
    cardBrand?: string;
    cardLast4?: string;
    amount?: number;
    tip?: number;
    reason?: string;
  } | null>(null);

  // Load terminals on open
  useEffect(() => {
    if (isOpen) {
      setStep('SELECT_TERMINAL');
      setActiveIntentId(null);
      setResultData(null);
      setTipAmount(parseFloat((total * 0.10).toFixed(2)));
      setSelectedTipPct('10');

      const fetchTerminals = async () => {
        try {
          setLoadingTerminals(true);
          const res = await fetch('/api/smart-terminals');
          const data = await res.json();
          if (res.ok && data.terminals) {
            setTerminals(data.terminals.filter((t: SmartTerminalDTO) => t.isActive));
            if (data.terminals.length > 0) {
              setSelectedTerminalId(data.terminals[0].id);
            }
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingTerminals(false);
        }
      };
      fetchTerminals();
    }
  }, [isOpen, total]);

  // Handle Tip Pct change
  const handleTipPctChange = (pct: '0' | '10' | '15' | '20') => {
    setSelectedTipPct(pct);
    if (pct === '0') setTipAmount(0);
    else if (pct === '10') setTipAmount(parseFloat((total * 0.10).toFixed(2)));
    else if (pct === '15') setTipAmount(parseFloat((total * 0.15).toFixed(2)));
    else if (pct === '20') setTipAmount(parseFloat((total * 0.20).toFixed(2)));
  };

  const grandTotal = parseFloat((total + tipAmount).toFixed(2));

  // Push Payment to Terminal
  const handleSendPush = async () => {
    if (!selectedTerminalId) {
      alert('Por favor selecciona una terminal');
      return;
    }

    try {
      setPushing(true);
      const res = await fetch('/api/smart-terminals/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminalId: selectedTerminalId,
          orderId,
          amount: total,
          tip: tipAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar cobro a terminal');

      setActiveIntentId(data.intentId);
      setStep('WAITING_CARD');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error en comunicación con terminal');
    } finally {
      setPushing(false);
    }
  };

  // Simulate Card Interaction (Sandbox)
  const handleSimulate = async (action: 'APPROVE' | 'REJECT' | 'CANCEL') => {
    if (!activeIntentId) return;

    try {
      setPushing(true);
      const res = await fetch('/api/smart-terminals/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: activeIntentId,
          action,
          cardBrand: 'VISA',
          cardLast4: '8842',
          tip: tipAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en simulación');

      if (action === 'APPROVE') {
        setResultData({
          authCode: data.authCode,
          cardBrand: data.cardBrand,
          cardLast4: data.cardLast4,
          amount: data.amount,
          tip: data.tip,
        });
        setStep('APPROVED');
        if (onPaymentSuccess) onPaymentSuccess();
      } else if (action === 'REJECT') {
        setResultData({
          reason: data.reason || 'Tarjeta declinada',
        });
        setStep('REJECTED');
      } else {
        setStep('SELECT_TERMINAL');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al procesar');
    } finally {
      setPushing(false);
    }
  };

  if (!isOpen) return null;

  const currentTerminal = terminals.find((t) => t.id === selectedTerminalId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">Cobro en Terminal Smart POS</h3>
              <p className="text-xs text-slate-400">
                Comanda #{orderNumber} {tableName ? `• Mesa ${tableName}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: SELECT TERMINAL & TIP */}
        {step === 'SELECT_TERMINAL' && (
          <div className="space-y-5">
            {/* Amount Summary */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 flex items-baseline justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase font-bold">Total a Cobrar</p>
                <h2 className="text-3xl font-black text-white">${total.toFixed(2)} <span className="text-xs text-amber-400">MXN</span></h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Con Propina ({selectedTipPct}%):</p>
                <p className="text-lg font-black text-emerald-400">${grandTotal.toFixed(2)} MXN</p>
              </div>
            </div>

            {/* Tip Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> Propina para el personal:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['0', '10', '15', '20'] as const).map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleTipPctChange(pct)}
                    className={`py-2 px-1 rounded-xl text-xs font-black border transition-all ${
                      selectedTipPct === pct
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {pct === '0' ? 'Sin propina' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Selecciona la terminal física inalámbrica:
              </label>
              {loadingTerminals ? (
                <div className="p-4 text-center text-xs text-slate-500">Cargando terminales registradas...</div>
              ) : terminals.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> No hay terminales registradas
                  </p>
                  <p className="text-[11px] text-amber-400/80">
                    Registra una terminal Clip o Mercado Pago Point en el tab de Terminales en /integrations.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {terminals.map((t) => {
                    const isSelected = selectedTerminalId === t.id;
                    const isClip = t.provider === 'CLIP';
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTerminalId(t.id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                            : 'bg-slate-850 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                                isClip ? 'bg-orange-500 text-white' : 'bg-sky-500 text-white'
                              }`}
                            >
                              {isClip ? 'CLIP' : 'MP POINT'}
                            </span>
                            <span className="font-bold text-xs text-white">{t.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {t.zone} • SN: {t.serialNumber}
                          </p>
                        </div>
                        <Radio className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-600'}`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action button */}
            <button
              onClick={handleSendPush}
              disabled={pushing || terminals.length === 0}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-5 h-5 fill-slate-950" />
              <span>Enviar Cobro a Terminal (${grandTotal.toFixed(2)})</span>
            </button>
          </div>
        )}

        {/* STEP 2: WAITING FOR CARD / TERMINAL SCREEN */}
        {step === 'WAITING_CARD' && currentTerminal && (
          <div className="space-y-6 text-center animate-fade-in">
            {/* Visual Smart POS Graphic */}
            <div className="w-56 mx-auto bg-slate-950 border-4 border-slate-700 rounded-3xl p-4 shadow-2xl relative space-y-3">
              {/* Speaker / NFC Icon */}
              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span className="font-bold text-amber-400">{currentTerminal.provider}</span>
                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              </div>

              {/* Terminal Screen */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-mono">Total a Pagar</p>
                <p className="text-xl font-black text-white">${grandTotal.toFixed(2)}</p>
                <div className="pt-1 flex items-center justify-center gap-1 text-[9px] text-emerald-400 animate-pulse">
                  <CreditCard className="w-3 h-3" />
                  <span>Acerque o inserte tarjeta</span>
                </div>
              </div>

              {/* Animated contactless wave indicator */}
              <div className="h-10 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-amber-400/80 animate-ping opacity-75" />
              </div>

              {/* Card Slot */}
              <div className="w-24 h-1.5 bg-slate-800 mx-auto rounded-full" />
            </div>

            <div className="space-y-1">
              <h4 className="font-black text-white text-base">Esperando pago en {currentTerminal.name}...</h4>
              <p className="text-xs text-slate-400">
                La terminal física ha recibido el cobro por ${grandTotal.toFixed(2)} MXN
              </p>
            </div>

            {/* Sandbox Simulation Buttons */}
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
              <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                🧪 Simulador Interactivo de Terminal:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSimulate('APPROVE')}
                  disabled={pushing}
                  className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Aprobar Pago</span>
                </button>

                <button
                  onClick={() => handleSimulate('REJECT')}
                  disabled={pushing}
                  className="py-2.5 px-3 bg-rose-500 hover:bg-rose-400 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Rechazar</span>
                </button>
              </div>

              <button
                onClick={() => handleSimulate('CANCEL')}
                disabled={pushing}
                className="w-full text-slate-500 hover:text-slate-300 text-xs font-bold pt-1"
              >
                Cancelar Transacción
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: APPROVED */}
        {step === 'APPROVED' && resultData && (
          <div className="text-center space-y-5 animate-fade-in py-4">
            <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-2xl">
              <CheckCircle2 className="w-16 h-16" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white">¡Cobro Aprobado en Terminal!</h3>
              <p className="text-xs text-slate-400">
                Transacción autorizada con éxito por el banco.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs space-y-2 max-w-sm mx-auto text-left">
              <div className="flex justify-between text-slate-300">
                <span>Tarjeta:</span>
                <span className="font-bold text-white">{resultData.cardBrand} ****{resultData.cardLast4}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Código de Autorización:</span>
                <span className="font-mono font-bold text-amber-400">{resultData.authCode}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Propina agregada:</span>
                <span className="font-bold text-emerald-400">${resultData.tip?.toFixed(2)} MXN</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-850 font-black">
                <span className="text-white">Total Cobrado:</span>
                <span className="text-emerald-400">${((resultData.amount || 0) + (resultData.tip || 0)).toFixed(2)} MXN</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-sm shadow-xl shadow-emerald-500/20 cursor-pointer"
            >
              Listo / Cerrar
            </button>
          </div>
        )}

        {/* STEP 4: REJECTED */}
        {step === 'REJECTED' && resultData && (
          <div className="text-center space-y-5 animate-fade-in py-4">
            <div className="inline-flex p-4 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
              <AlertCircle className="w-16 h-16" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white">Transacción Rechazada</h3>
              <p className="text-xs text-rose-300">
                {resultData.reason || 'Fondos insuficientes o tarjeta rechazada por el banco emisor.'}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('SELECT_TERMINAL')}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-xs cursor-pointer"
              >
                Reintentar
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-bold rounded-2xl text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
