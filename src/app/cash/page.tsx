'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { 
  Coins, 
  Lock, 
  Unlock, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  FileText,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  Copy,
  Check,
  X,
  Plus,
  Minus,
  RefreshCw,
  Clock,
  User,
  ShieldCheck,
  Receipt,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  CASH_DENOMINATIONS, 
  calculateDenominationsTotal, 
  DenominationsMap,
  formatCurrency 
} from '@/lib/cashCuts';

interface CashMovement {
  id: string;
  type: string;
  amount: number;
  reason: string;
  category?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

interface CashCut {
  id: string;
  cutType: string;
  cutNumber: string;
  consecutive: number;
  openedAt: string;
  cutAt: string;
  openingBalance: number;
  cashSales: number;
  cardSales: number;
  appsSales: number;
  giftCardSales: number;
  transfersSales: number;
  totalSales: number;
  cashInTotal: number;
  cashOutTotal: number;
  expectedCash: number;
  declaredCash: number;
  cashDifference: number;
  declaredCard: number;
  declaredOther: number;
  totalDeclared: number;
  totalDifference: number;
  ordersCount: number;
  discountsTotal: number;
  canceledOrdersCount: number;
  canceledAmount: number;
  tipsTotal: number;
  tipsCash: number;
  tipsCard: number;
  denominations?: string | null;
  printedAt?: string | null;
  notes?: string | null;
  createdByName?: string | null;
  cashSession?: {
    user: {
      name: string;
    };
  };
}

interface CashSession {
  id: string;
  openedAt: string;
  closedAt?: string | null;
  openingBalance: number;
  closingBalance?: number | null;
  expectedBalance?: number | null;
  actualBalance?: number | null;
  status: string;
  cashSales: number;
  cardSales: number;
  appsSales: number;
  giftCardSales?: number;
  transfersSales?: number;
  cashInTotal?: number;
  cashOutTotal?: number;
  consecutiveZ?: number | null;
  notes?: string | null;
  user: {
    name: string;
  };
  movements?: CashMovement[];
  cuts?: CashCut[];
}

interface Aggregates {
  cashSales: number;
  cardSales: number;
  appsSales: number;
  giftCardSales: number;
  transfersSales: number;
  totalSales: number;
  cashInTotal: number;
  cashOutTotal: number;
  expectedCash: number;
  expectedBalance: number;
  ordersCount: number;
  discountsTotal: number;
  canceledOrdersCount: number;
  canceledAmount: number;
  tipsCash: number;
  tipsCard: number;
  tipsTotal: number;
  tipDistribution?: {
    waiters: number;
    kitchen: number;
    bar: number;
  };
}

export default function CashPage() {
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [pastSessions, setPastSessions] = useState<CashSession[]>([]);
  const [recentCuts, setRecentCuts] = useState<CashCut[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'flow' | 'cuts' | 'sessions'>('flow');

  // Modals state
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showCutModal, setShowCutModal] = useState(false);
  const [cutMode, setCutMode] = useState<'CORTE_X' | 'CORTE_Z'>('CORTE_X');
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [currentTicketText, setCurrentTicketText] = useState('');
  const [currentTicketCut, setCurrentTicketCut] = useState<CashCut | null>(null);
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [printingToNetwork, setPrintingToNetwork] = useState(false);
  const [printStatusMsg, setPrintStatusMsg] = useState<string | null>(null);

  // Form states
  const [openingBalance, setOpeningBalance] = useState<number>(500);

  // Movement form state
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('OUT');
  const [movementAmount, setMovementAmount] = useState<number>(200);
  const [movementCategory, setMovementCategory] = useState<string>('SAFE_DROP');
  const [movementReason, setMovementReason] = useState<string>('');

  // Blind Count (Denominations) state
  const [denominations, setDenominations] = useState<DenominationsMap>({
    b1000: 0,
    b500: 0,
    b200: 0,
    b100: 0,
    b50: 0,
    b20: 0,
    c20: 0,
    c10: 0,
    c5: 0,
    c2: 0,
    c1: 0,
    c05: 0,
  });
  const [declaredCardVouchers, setDeclaredCardVouchers] = useState<number>(0);
  const [declaredOther, setDeclaredOther] = useState<number>(0);
  const [cutNotes, setCutNotes] = useState<string>('');

  const fetchCashSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cash');
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.activeSession);
        setAggregates(data.activeAggregates);
        setPastSessions(data.pastSessions || []);
        setRecentCuts(data.recentCuts || []);
      }
    } catch (e) {
      console.error('Failed to load cash sessions', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCashSessions();
  }, [fetchCashSessions]);

  // Denominations total calculation
  const declaredCashFromDenominations = useMemo(() => {
    return calculateDenominationsTotal(denominations);
  }, [denominations]);

  const updateDenominationQty = (key: string, delta: number) => {
    setDenominations((prev) => {
      const current = prev[key] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [key]: next };
    });
  };

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (openingBalance < 0) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          openingBalance,
        }),
      });

      if (res.ok) {
        setShowOpenModal(false);
        setOpeningBalance(500);
        await fetchCashSessions();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error de red al abrir caja');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (movementAmount <= 0 || !movementReason.trim()) {
      alert('Por favor indica un monto válido y el motivo del movimiento');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch('/api/cash/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: movementType,
          amount: movementAmount,
          category: movementCategory,
          reason: movementReason.trim(),
        }),
      });

      if (res.ok) {
        setShowMovementModal(false);
        setMovementAmount(200);
        setMovementReason('');
        await fetchCashSessions();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error de red al registrar movimiento');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateCut = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = cutMode === 'CORTE_Z' ? '/api/cash/cut-z' : '/api/cash/cut-x';

    if (cutMode === 'CORTE_Z') {
      if (!confirm('¿Estás seguro de realizar el CORTE Z (Cierre Oficial)? Esta acción cerrará permanentemente el turno de caja y emitirá el folio fiscal definitivo.')) {
        return;
      }
    }

    try {
      setActionLoading(true);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          denominations,
          declaredCard: declaredCardVouchers,
          declaredOther,
          notes: cutNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowCutModal(false);
        // Show thermal ticket modal
        setCurrentTicketText(data.ticketText);
        setCurrentTicketCut(data.cut);
        setShowTicketModal(true);
        // Reset denominations
        setDenominations({
          b1000: 0,
          b500: 0,
          b200: 0,
          b100: 0,
          b50: 0,
          b20: 0,
          c20: 0,
          c10: 0,
          c5: 0,
          c2: 0,
          c1: 0,
          c05: 0,
        });
        setDeclaredCardVouchers(0);
        setDeclaredOther(0);
        setCutNotes('');
        await fetchCashSessions();
      } else {
        alert(`Error al generar ${cutMode}: ${data.error || 'Fallo desconocido'}`);
      }
    } catch {
      alert('Error de red al procesar corte de caja');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewExistingCut = async (cutId: string) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/cash/cuts/${cutId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentTicketText(data.ticketText);
        setCurrentTicketCut(data.cut);
        setShowTicketModal(true);
        setPrintStatusMsg(null);
      } else {
        alert('Error al obtener datos del corte');
      }
    } catch {
      alert('Error al consultar ticket de corte');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintToNetworkPrinter = async () => {
    if (!currentTicketCut) return;
    setPrintingToNetwork(true);
    setPrintStatusMsg(null);
    try {
      const res = await fetch(`/api/cash/cuts/${currentTicketCut.id}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPrintStatusMsg(`✓ ${data.message}`);
      } else {
        setPrintStatusMsg(`✗ Error: ${data.error || 'No se pudo conectar con la impresora'}`);
      }
    } catch {
      setPrintStatusMsg('✗ Error de red al enviar comandos ESC/POS');
    } finally {
      setPrintingToNetwork(false);
    }
  };

  const handleCopyTicket = () => {
    navigator.clipboard.writeText(currentTicketText);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2000);
  };

  if (loading && !activeSession && pastSessions.length === 0) {
    return (
      <DashboardContainer>
        <div className="flex h-[calc(100vh-200px)] items-center justify-center flex-col gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400 font-medium">Cargando estado de caja y arqueos...</p>
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Coins className="h-8 w-8 text-amber-400" />
              Control de Caja & Cortes Fiscales
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Arqueos ciegos por denominación, movimientos de efectivo, Corte X parcial y Corte Z definitivo de turno.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {!activeSession ? (
              <button
                onClick={() => setShowOpenModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
              >
                <Unlock className="h-5 w-5 stroke-[2.5]" />
                Abrir Turno de Caja
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMovementType('IN');
                    setMovementCategory('CHANGE_FLOAT');
                    setMovementAmount(200);
                    setShowMovementModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  title="Registrar entrada de cambio a la gaveta"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Entrada (+)
                </button>

                <button
                  onClick={() => {
                    setMovementType('OUT');
                    setMovementCategory('SAFE_DROP');
                    setMovementAmount(500);
                    setShowMovementModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-red-400 border border-red-500/30 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  title="Registrar retiro o sangría de seguridad"
                >
                  <ArrowDownRight className="h-4 w-4" />
                  Sangría / Retiro (-)
                </button>

                <button
                  onClick={() => {
                    setCutMode('CORTE_X');
                    setShowCutModal(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                  title="Generar arqueo informativo sin cerrar turno"
                >
                  <FileText className="h-4 w-4" />
                  Corte X (Parcial)
                </button>

                <button
                  onClick={() => {
                    setCutMode('CORTE_Z');
                    setShowCutModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 text-white font-black rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 cursor-pointer text-xs"
                  title="Cierre definitivo de turno con folio fiscal"
                >
                  <Lock className="h-4 w-4 stroke-[2.5]" />
                  Corte Z (Cierre Oficial)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Banner */}
        {activeSession ? (
          <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-emerald-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Unlock className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    TURNO ACTIVO
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {activeSession.id.slice(0, 8)}
                  </span>
                </div>
                <p className="text-sm font-bold text-white mt-1 flex items-center gap-2">
                  <span>Cajero: <strong className="text-amber-300">{activeSession.user.name}</strong></span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400 flex items-center gap-1 font-normal text-xs">
                    <Clock className="h-3.5 w-3.5" />
                    Iniciado: {new Date(activeSession.openedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Fondo de Apertura</span>
                <span className="text-lg font-black text-white font-mono">
                  {formatCurrency(activeSession.openingBalance)}
                </span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Efectivo en Gaveta</span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {aggregates ? formatCurrency(aggregates.expectedCash) : formatCurrency(activeSession.openingBalance)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-3">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Caja Cerrada / Sin Turno Activo</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
              Para registrar cobros de órdenes en POS, realizar arqueos y asentar ventas en efectivo, es necesario abrir un nuevo turno indicando el fondo inicial.
            </p>
            <button
              onClick={() => setShowOpenModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Unlock className="h-4 w-4" />
              Abrir Turno Ahora
            </button>
          </div>
        )}

        {/* KPIs Grid */}
        {activeSession && aggregates && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cash in Drawer */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5" /> Efectivo en Gaveta
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-mono">
                    {formatCurrency(aggregates.expectedCash)}
                  </h3>
                  <span className="text-[11px] text-slate-500 mt-1 inline-block">
                    Fondo ({formatCurrency(activeSession.openingBalance)}) + Ventas ({formatCurrency(aggregates.cashSales)})
                  </span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-600" />
            </div>

            {/* Total Sales */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Receipt className="h-3.5 w-3.5" /> Facturación Turno
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">
                    {formatCurrency(aggregates.totalSales)}
                  </h3>
                  <span className="text-[11px] text-slate-500 mt-1 inline-block">
                    {aggregates.ordersCount} órdenes cobradas
                  </span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Receipt className="h-6 w-6" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-500 to-amber-600" />
            </div>

            {/* Cards & Digital */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5" /> Tarjetas & Digital
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-black text-blue-400 mt-1 font-mono">
                    {formatCurrency(aggregates.cardSales)}
                  </h3>
                  <span className="text-[11px] text-slate-500 mt-1 inline-block">
                    Terminales, Stripe y MP
                  </span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <CreditCard className="h-6 w-6" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
            </div>

            {/* Tips Total & Distribution */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> Propinas del Turno
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-black text-purple-400 mt-1 font-mono">
                    {formatCurrency(aggregates.tipsTotal)}
                  </h3>
                  <span className="text-[11px] text-slate-500 mt-1 inline-block">
                    Efectivo: {formatCurrency(aggregates.tipsCash)} | Tarjeta: {formatCurrency(aggregates.tipsCard)}
                  </span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Coins className="h-6 w-6" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-purple-600" />
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab('flow')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'flow'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Coins className="w-4 h-4" />
            Flujo de Caja & Movimientos
            {activeSession && (activeSession.movements?.length || 0) > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {activeSession.movements?.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cuts')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'cuts'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Historial de Cortes X y Z
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
              {recentCuts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'sessions'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Turnos Anteriores Cerrados
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {pastSessions.length}
            </span>
          </button>
        </div>

        {/* TAB 1: FLUJO DE CAJA & MOVIMIENTOS */}
        {activeTab === 'flow' && (
          <div className="space-y-6">
            {activeSession && aggregates ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cash Flow Ledger Card */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-400" />
                      Arqueo de Efectivo en Gaveta
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">Fórmula Fiscal</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 text-slate-500" /> Fondo Inicial de Apertura
                      </span>
                      <span className="font-bold font-mono text-white">
                        {formatCurrency(activeSession.openingBalance)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 text-emerald-500" /> Ventas en Efectivo Cobradas
                      </span>
                      <span className="font-bold font-mono text-emerald-400">
                        +{formatCurrency(aggregates.cashSales)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <ArrowUpRight className="h-3.5 w-3.5 text-blue-400" /> Entradas de Cambio (Inflow)
                      </span>
                      <span className="font-bold font-mono text-blue-400">
                        +{formatCurrency(aggregates.cashInTotal)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <ArrowDownRight className="h-3.5 w-3.5 text-red-400" /> Retiros / Sangrías (Outflow)
                      </span>
                      <span className="font-bold font-mono text-red-400">
                        -{formatCurrency(aggregates.cashOutTotal)}
                      </span>
                    </div>

                    <div className="p-3 bg-gradient-to-r from-emerald-950/40 to-slate-950 rounded-xl border border-emerald-500/40 flex justify-between items-center mt-3">
                      <div>
                        <span className="text-[10px] uppercase font-black text-emerald-400 block tracking-wider">
                          Efectivo Esperado en Caja
                        </span>
                        <span className="text-[10px] text-slate-400">Debe cuadrar con el conteo físico</span>
                      </div>
                      <span className="text-xl font-black text-emerald-400 font-mono">
                        {formatCurrency(aggregates.expectedCash)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Breakdown */}
                  <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                      Desglose de Facturación por Canal
                    </span>

                    <div className="flex justify-between items-center p-2 bg-slate-950/50 rounded-lg">
                      <span className="flex items-center gap-2 text-slate-400">
                        <CreditCard className="h-3.5 w-3.5 text-blue-400" /> Terminales / Tarjetas
                      </span>
                      <span className="font-mono text-white font-bold">{formatCurrency(aggregates.cardSales)}</span>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-slate-950/50 rounded-lg">
                      <span className="flex items-center gap-2 text-slate-400">
                        <Coins className="h-3.5 w-3.5 text-amber-400" /> Monedero / Gift Card
                      </span>
                      <span className="font-mono text-white font-bold">{formatCurrency(aggregates.giftCardSales)}</span>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-slate-950/50 rounded-lg">
                      <span className="flex items-center gap-2 text-slate-400">
                        <Smartphone className="h-3.5 w-3.5 text-orange-400" /> Delivery Apps (Rappi/Uber)
                      </span>
                      <span className="font-mono text-white font-bold">{formatCurrency(aggregates.appsSales)}</span>
                    </div>

                    {aggregates.transfersSales > 0 && (
                      <div className="flex justify-between items-center p-2 bg-slate-950/50 rounded-lg">
                        <span className="flex items-center gap-2 text-slate-400">
                          <ArrowUpRight className="h-3.5 w-3.5 text-cyan-400" /> Transferencias SPEI
                        </span>
                        <span className="font-mono text-white font-bold">{formatCurrency(aggregates.transfersSales)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Movements (Inflows & Sangrias) List */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl lg:col-span-2 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-blue-400" />
                        <h4 className="font-bold text-white text-sm">Movimientos del Turno (Entradas & Sangrías)</h4>
                      </div>
                      <button
                        onClick={() => {
                          setMovementType('OUT');
                          setMovementCategory('SAFE_DROP');
                          setShowMovementModal(true);
                        }}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> Registrar Movimiento
                      </button>
                    </div>

                    {(!activeSession.movements || activeSession.movements.length === 0) ? (
                      <div className="text-center py-12 text-slate-500 text-xs">
                        No hay entradas ni sangrías registradas durante este turno aún.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800 mt-2">
                        {activeSession.movements.map((m) => (
                          <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                  m.type === 'IN'
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}
                              >
                                {m.type === 'IN' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-xs">
                                    {m.type === 'IN' ? 'Entrada de Cambio' : 'Retiro / Sangría'}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                    {m.category || 'GENERAL'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">{m.reason}</p>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(m.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} • por {m.createdByName || 'Cajero'}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`text-sm font-black font-mono ${
                                m.type === 'IN' ? 'text-blue-400' : 'text-red-400'
                              }`}
                            >
                              {m.type === 'IN' ? '+' : '-'}{formatCurrency(m.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tip Distribution Footprint */}
                  {aggregates.tipDistribution && (
                    <div className="p-3.5 bg-slate-950/70 border border-purple-900/30 rounded-xl space-y-2 mt-4">
                      <span className="text-[10px] uppercase font-bold text-purple-300 block tracking-wider">
                        Sugerencia de Reparto de Propinas Acumuladas ({formatCurrency(aggregates.tipsTotal)})
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Meseros (70%)</span>
                          <span className="font-black text-emerald-400 font-mono">
                            {formatCurrency(aggregates.tipDistribution.waiters)}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Cocina (20%)</span>
                          <span className="font-black text-amber-400 font-mono">
                            {formatCurrency(aggregates.tipDistribution.kitchen)}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Barra (10%)</span>
                          <span className="font-black text-blue-400 font-mono">
                            {formatCurrency(aggregates.tipDistribution.bar)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
                No hay turno de caja abierto. Haz clic en "Abrir Turno de Caja" en la parte superior para comenzar a operar.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HISTORIAL DE CORTES X Y Z */}
        {activeTab === 'cuts' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-base">Arqueos & Cortes Registrados</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cortes parciales informativos (X) y cortes definitivos de liquidación fiscal (Z).
                </p>
              </div>
              <button
                onClick={() => fetchCashSessions()}
                className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl transition-colors cursor-pointer"
                title="Actualizar lista"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                    <th className="p-4">Folio / Tipo</th>
                    <th className="p-4">Fecha y Hora</th>
                    <th className="p-4">Cajero</th>
                    <th className="p-4">Facturación</th>
                    <th className="p-4">Efectivo Esperado</th>
                    <th className="p-4">Efectivo Declarado</th>
                    <th className="p-4">Diferencia</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {recentCuts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No se han generado cortes X o Z aún.
                      </td>
                    </tr>
                  ) : (
                    recentCuts.map((cut) => {
                      const isZ = cut.cutType === 'CORTE_Z';
                      const diff = cut.cashDifference;
                      return (
                        <tr key={cut.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                  isZ
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {isZ && <Lock className="h-3 w-3" />}
                                {cut.cutType}
                              </span>
                              <span className="font-mono font-bold text-white text-xs">
                                #{cut.cutNumber}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-slate-300">
                            {new Date(cut.cutAt).toLocaleString('es-MX', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="p-4 font-medium text-white">
                            {cut.createdByName || cut.cashSession?.user?.name || 'Cajero'}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-200">
                            {formatCurrency(cut.totalSales)}
                          </td>
                          <td className="p-4 font-mono text-slate-300">
                            {formatCurrency(cut.expectedCash)}
                          </td>
                          <td className="p-4 font-mono font-bold text-white">
                            {formatCurrency(cut.declaredCash)}
                          </td>
                          <td className="p-4">
                            <span
                              className={`font-mono font-bold text-xs ${
                                Math.abs(diff) <= 0.05
                                  ? 'text-emerald-400'
                                  : diff > 0
                                  ? 'text-blue-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {Math.abs(diff) <= 0.05
                                ? 'EXACTO'
                                : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleViewExistingCut(cut.id)}
                              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                              title="Ver ticket térmico"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Ver Ticket
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: TURNOS ANTERIORES CERRADOS */}
        {activeTab === 'sessions' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 bg-slate-900/50">
              <h4 className="font-bold text-white text-base">Historial de Turnos de Caja (Sesiones)</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolidado histórico de aperturas y cierres de caja en esta sucursal.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                    <th className="p-4">Turno</th>
                    <th className="p-4">Apertura / Cierre</th>
                    <th className="p-4">Fondo Inicial</th>
                    <th className="p-4">Venta Efectivo</th>
                    <th className="p-4">Cierre Declarado</th>
                    <th className="p-4">Diferencia</th>
                    <th className="p-4 text-right">Folio Z</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pastSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No hay turnos pasados registrados.
                      </td>
                    </tr>
                  ) : (
                    pastSessions.map((session) => {
                      const diff = (session.closingBalance || 0) - (session.expectedBalance || 0);
                      return (
                        <tr key={session.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-4 font-bold text-white">
                            <div>{session.user.name}</div>
                            <span className="text-[10px] text-slate-500 font-mono font-normal">
                              ID: {session.id.slice(0, 8)}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300">
                            <div className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1 font-medium">
                                <Calendar className="h-3 w-3 text-slate-500" />
                                {new Date(session.openedAt).toLocaleDateString('es-MX')}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(session.openedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} - {session.closedAt ? new Date(session.closedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 font-mono text-slate-300">
                            {formatCurrency(session.openingBalance)}
                          </td>
                          <td className="p-4 font-mono text-slate-300">
                            {formatCurrency(session.cashSales)}
                          </td>
                          <td className="p-4 font-mono font-bold text-white">
                            {session.closingBalance !== null && session.closingBalance !== undefined ? formatCurrency(session.closingBalance) : 'N/A'}
                          </td>
                          <td className="p-4">
                            <span
                              className={`font-mono font-bold text-xs ${
                                Math.abs(diff) <= 0.05
                                  ? 'text-emerald-400'
                                  : diff > 0
                                  ? 'text-blue-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {Math.abs(diff) <= 0.05
                                ? 'EXACTO'
                                : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {session.consecutiveZ ? (
                              <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Z-{String(session.consecutiveZ).padStart(4, '0')}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-mono text-[10px]">Manual</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ABRIR TURNO DE CAJA                                                */}
        {/* ========================================================================= */}
        {showOpenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Unlock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Abrir Turno de Caja</h3>
                    <p className="text-xs text-slate-400">Establece el fondo inicial en gaveta</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowOpenModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleOpenSession} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Fondo Inicial de Apertura ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 font-bold">$</span>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={openingBalance || ''}
                      onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                      placeholder="500.00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-8 pr-4 text-lg font-black text-amber-300 font-mono outline-none focus:border-amber-500"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Dinero físico disponible para cambio al comenzar la jornada.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowOpenModal(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'Iniciando...' : 'Iniciar Turno'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: REGISTRAR ENTRADA / RETIRO (SANGRÍA)                              */}
        {/* ========================================================================= */}
        {showMovementModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      movementType === 'IN'
                        ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                  >
                    {movementType === 'IN' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {movementType === 'IN' ? 'Entrada de Efectivo' : 'Sangría / Retiro de Caja'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {movementType === 'IN' ? 'Aporte de cambio a gaveta' : 'Resguardo o gasto en efectivo'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMovementModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateMovement} className="p-6 space-y-4">
                {/* Movement Type Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Tipo de Movimiento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMovementType('IN');
                        setMovementCategory('CHANGE_FLOAT');
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition cursor-pointer ${
                        movementType === 'IN'
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      Entrada (+)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMovementType('OUT');
                        setMovementCategory('SAFE_DROP');
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition cursor-pointer ${
                        movementType === 'OUT'
                          ? 'bg-red-500/20 border-red-500 text-red-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <ArrowDownRight className="h-4 w-4" />
                      Sangría / Retiro (-)
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Monto ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={movementAmount || ''}
                    onChange={(e) => setMovementAmount(parseFloat(e.target.value) || 0)}
                    placeholder="200.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-lg font-black text-white font-mono outline-none focus:border-amber-500"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Categoría
                  </label>
                  <select
                    value={movementCategory}
                    onChange={(e) => setMovementCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {movementType === 'IN' ? (
                      <>
                        <option value="CHANGE_FLOAT">Dotación de Cambio (Monedas/Billetes)</option>
                        <option value="ADDITIONAL_CASH">Aporte de Efectivo Extraordinario</option>
                        <option value="OTHER">Otro Ingreso de Caja</option>
                      </>
                    ) : (
                      <>
                        <option value="SAFE_DROP">Sangría de Seguridad a Caja Fuerte</option>
                        <option value="SUPPLIER_PAYMENT">Pago a Proveedor de Urgencia</option>
                        <option value="EXPENSE">Compra de Insumo Menor / Hielo</option>
                        <option value="OTHER">Otro Retiro de Caja</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Reason / Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Motivo / Observación *
                  </label>
                  <input
                    type="text"
                    required
                    value={movementReason}
                    onChange={(e) => setMovementReason(e.target.value)}
                    placeholder={movementType === 'IN' ? 'Ej. Se agregaron $200 en monedas de $10' : 'Ej. Resguardo de billetes grandes a gerencia'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowMovementModal(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className={`px-5 py-2.5 font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 ${
                      movementType === 'IN'
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20'
                    }`}
                  >
                    {actionLoading ? 'Registrando...' : 'Confirmar Movimiento'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ARQUEO CIEGO & GENERACIÓN DE CORTE (X o Z)                         */}
        {/* ========================================================================= */}
        {showCutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      cutMode === 'CORTE_Z'
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                        : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    }`}
                  >
                    {cutMode === 'CORTE_Z' ? <Lock className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {cutMode === 'CORTE_Z' ? 'Corte Z - Cierre Oficial de Turno' : 'Corte X - Arqueo Parcial Informativo'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {cutMode === 'CORTE_Z'
                        ? 'Liquidación fiscal definitiva con cierre de turno inmutable'
                        : 'Verificación de caja a mitad de turno sin cerrar la sesión'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCutModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleGenerateCut} className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Blind Count Notice */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <strong className="block">Arqueo Ciego de Seguridad (Soft Restaurant Parity)</strong>
                    <span className="text-[11px] text-amber-200/80">
                      Cuenta el dinero físico presente en la gaveta e introduce las cantidades por denominación. El sistema calculará el cuadre automáticamente sin sesgar al cajero.
                    </span>
                  </div>
                </div>

                {/* Denominations Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Desglose de Billetes y Monedas
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      Total Contado: {formatCurrency(declaredCashFromDenominations)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {CASH_DENOMINATIONS.map((item) => {
                      const qty = denominations[item.key] || 0;
                      const sub = qty * item.value;
                      return (
                        <div
                          key={item.key}
                          className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="text-xs font-black text-white block">{item.label}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Subtotal: {formatCurrency(sub)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateDenominationQty(item.key, -1)}
                              className="h-7 w-7 rounded-lg bg-slate-850 hover:bg-slate-750 text-slate-300 flex items-center justify-center font-bold text-xs transition cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={qty === 0 ? '' : qty}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                setDenominations((prev) => ({ ...prev, [item.key]: val }));
                              }}
                              placeholder="0"
                              className="w-10 text-center bg-slate-900 border border-slate-800 rounded-lg py-1 text-xs font-mono font-bold text-amber-300 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => updateDenominationQty(item.key, 1)}
                              className="h-7 w-7 rounded-lg bg-slate-850 hover:bg-slate-750 text-slate-300 flex items-center justify-center font-bold text-xs transition cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vouchers & Other Totals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Vouchers de Tarjetas Contados ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={declaredCardVouchers || ''}
                      onChange={(e) => setDeclaredCardVouchers(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-blue-300 outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Suma de comprobantes de terminales físicas en caja
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Otros Comprobantes / Vales ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={declaredOther || ''}
                      onChange={(e) => setDeclaredOther(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-300 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Observaciones del Cajero
                  </label>
                  <input
                    type="text"
                    value={cutNotes}
                    onChange={(e) => setCutNotes(e.target.value)}
                    placeholder="Ej. Faltaron $5 en monedas, sin incidentes en terminales"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCutModal(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className={`px-5 py-2.5 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-lg disabled:opacity-50 ${
                      cutMode === 'CORTE_Z'
                        ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 text-white shadow-red-500/20'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white shadow-blue-600/20'
                    }`}
                  >
                    {actionLoading
                      ? 'Procesando...'
                      : cutMode === 'CORTE_Z'
                      ? 'Confirmar Cierre Oficial (Corte Z)'
                      : 'Emitir Corte X Informativo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: TICKET TÉRMICO VIRTUAL (CORTE X / CORTE Z)                         */}
        {/* ========================================================================= */}
        {showTicketModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Ticket Térmico: {currentTicketCut ? `${currentTicketCut.cutType} #${currentTicketCut.cutNumber}` : 'Corte de Caja'}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Formato ESC/POS 80mm</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowTicketModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status Message */}
              {printStatusMsg && (
                <div
                  className={`px-4 py-2 text-xs font-bold ${
                    printStatusMsg.startsWith('✓')
                      ? 'bg-emerald-950 text-emerald-300 border-b border-emerald-800/40'
                      : 'bg-red-950 text-red-300 border-b border-red-800/40'
                  }`}
                >
                  {printStatusMsg}
                </div>
              )}

              {/* Ticket Preview Body (Monospaced Receipt) */}
              <div className="p-4 overflow-y-auto flex-1 bg-slate-950">
                <pre className="font-mono text-[11px] leading-tight text-slate-300 bg-slate-900 p-4 rounded-xl border border-slate-800 select-all whitespace-pre overflow-x-auto shadow-inner">
                  {currentTicketText}
                </pre>
              </div>

              {/* Actions Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleCopyTicket}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedTicket ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  {copiedTicket ? 'Copiado' : 'Copiar Texto'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const printWin = window.open('', '_blank');
                      if (printWin) {
                        printWin.document.write(`<pre style="font-family:monospace;font-size:12px;margin:20px;">${currentTicketText}</pre>`);
                        printWin.document.close();
                        printWin.focus();
                        printWin.print();
                        printWin.close();
                      }
                    }}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir en Navegador
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintToNetworkPrinter}
                    disabled={printingToNetwork}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="h-4 w-4" />
                    {printingToNetwork ? 'Enviando...' : 'Comandera ESC/POS'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardContainer>
  );
}
