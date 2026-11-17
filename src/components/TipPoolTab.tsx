'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Coins,
  Calculator,
  History,
  Settings,
  Users,
  Clock,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Sliders,
  Check,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Eye,
  ShieldCheck,
  FileText,
} from 'lucide-react';

interface TipPoolRoleRule {
  id?: string;
  role: string;
  roleDisplayName: string;
  pointsWeight: number;
  percentageShare: number;
  isActive: boolean;
}

interface TipPoolConfig {
  id?: string;
  brandId: string;
  isEnabled: boolean;
  distributionModel: 'POINTS_HOURS' | 'PERCENTAGE_DIRECT' | 'EQUAL_SPLIT';
  includeCashTips: boolean;
  includeCardTips: boolean;
  includeDigitalTips: boolean;
  kitchenKickoutPct: number;
  barKickoutPct: number;
  minHoursRequired: number;
  roleRules: TipPoolRoleRule[];
}

interface DisbursementItem {
  id?: string;
  userId?: string | null;
  employeeName: string;
  role: string;
  hoursWorked: number;
  pointsWeight: number;
  weightedPoints: number;
  sharePercentage: number;
  allocatedAmount: number;
  adjustedAmount: number;
  adjustmentReason?: string;
  payoutMethod: 'CASH' | 'PAYROLL' | 'SPEI';
  payoutStatus: 'PENDING' | 'PAID';
}

interface TipSettlement {
  id: string;
  folio: string;
  brandId: string;
  shift: string;
  periodStart: string;
  periodEnd: string;
  cashTips: number;
  cardTips: number;
  digitalTips: number;
  totalTips: number;
  totalHoursWorked: number;
  totalPoints: number;
  status: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'DISPERSED' | 'CANCELLED';
  notes?: string;
  approvedByName?: string;
  approvedAt?: string;
  dispersedAt?: string;
  distributionDetails: DisbursementItem[];
  createdAt: string;
}

interface TipPoolTabProps {
  brandId: string;
}

export default function TipPoolTab({ brandId }: TipPoolTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'calculator' | 'history' | 'rules'>('calculator');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estado de Configuración
  const [config, setConfig] = useState<TipPoolConfig | null>(null);

  // Estado del Calculador / Liquidación Actual
  const [selectedShift, setSelectedShift] = useState<string>('ALL_DAY');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [manualCashTips, setManualCashTips] = useState<string>('');
  const [overrideModel, setOverrideModel] = useState<'POINTS_HOURS' | 'PERCENTAGE_DIRECT' | 'EQUAL_SPLIT'>('POINTS_HOURS');
  
  // Datos calculados
  const [calculationResult, setCalculationResult] = useState<{
    cashTips: number;
    cardTips: number;
    digitalTips: number;
    totalTips: number;
    totalHoursWorked: number;
    totalPoints: number;
    items: DisbursementItem[];
    savedSettlementId?: string;
    folio?: string;
    status?: string;
  } | null>(null);

  // Historial de liquidaciones
  const [settlements, setSettlements] = useState<TipSettlement[]>([]);
  const [metrics, setMetrics] = useState({
    totalSettlements: 0,
    totalDispersedAmount: 0,
    totalPendingApproval: 0,
  });

  // Modal de Ticket Térmico ESC/POS
  const [printModal, setPrintModal] = useState<{
    isOpen: boolean;
    title: string;
    receiptText: string;
  }>({
    isOpen: false,
    title: '',
    receiptText: '',
  });

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // 1. Cargar Configuración de Marca
  const fetchConfig = useCallback(async () => {
    if (!brandId) return;
    try {
      const res = await fetch(`/api/tips/config?brandId=${brandId}`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        if (data.distributionModel) {
          setOverrideModel(data.distributionModel);
        }
      }
    } catch (err) {
      console.error('Error al cargar configuración de propinas:', err);
    }
  }, [brandId]);

  // 2. Cargar Historial de Liquidaciones
  const fetchSettlements = useCallback(async () => {
    if (!brandId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/tips/settlements?brandId=${brandId}`);
      if (res.ok) {
        const data = await res.json();
        setSettlements(data.settlements || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Error al cargar historial de liquidaciones:', err);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    fetchConfig();
    fetchSettlements();
  }, [fetchConfig, fetchSettlements]);

  // 3. Previsualizar / Calcular Reparto
  const handleCalculate = async (saveToDb = false) => {
    if (!brandId) return;
    try {
      setLoading(true);

      const start = new Date(`${selectedDate}T00:00:00.000`);
      const end = new Date(`${selectedDate}T23:59:59.999`);

      const res = await fetch('/api/tips/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          shift: selectedShift,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          manualCashTips: manualCashTips ? parseFloat(manualCashTips) : undefined,
          preview: !saveToDb,
          overrideModel,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al calcular reparto');
      }

      const data = await res.json();

      if (!saveToDb) {
        setCalculationResult({
          cashTips: data.cashTips,
          cardTips: data.cardTips,
          digitalTips: data.digitalTips,
          totalTips: data.totalTips,
          totalHoursWorked: data.totalHoursWorked,
          totalPoints: data.totalPoints,
          items: data.items || [],
        });
        showFeedback('success', `Cálculo generado: $${data.totalTips.toFixed(2)} MXN entre ${data.items.length} colaboradores`);
      } else {
        setCalculationResult({
          cashTips: data.cashTips,
          cardTips: data.cardTips,
          digitalTips: data.digitalTips,
          totalTips: data.totalTips,
          totalHoursWorked: data.totalHoursWorked,
          totalPoints: data.totalPoints,
          items: data.distributionDetails || [],
          savedSettlementId: data.id,
          folio: data.folio,
          status: data.status,
        });
        showFeedback('success', `¡Liquidación ${data.folio} guardada exitosamente!`);
        fetchSettlements();
      }
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Aprobar Liquidación Oficial
  const handleApproveSettlement = async (settlementId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tips/settlements/${settlementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'APPROVED',
          approvedByName: 'Gerente en Turno',
        }),
      });

      if (!res.ok) throw new Error('No se pudo aprobar la liquidación');
      const updated = await res.json();
      showFeedback('success', `Liquidación ${updated.folio} aprobada`);
      fetchSettlements();
      if (calculationResult?.savedSettlementId === settlementId) {
        setCalculationResult((prev) => prev ? { ...prev, status: 'APPROVED' } : null);
      }
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Dispersar y Pagar a Todo el Equipo
  const handleDisperseSettlement = async (settlementId: string) => {
    if (!confirm('¿Confirmas la dispersión y entrega de propinas a todos los colaboradores de este turno?')) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/tips/settlements/${settlementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DISPERSED',
        }),
      });

      if (!res.ok) throw new Error('No se pudo completar la dispersión');
      const updated = await res.json();
      showFeedback('success', `¡Bolsa de propinas de ${updated.folio} dispersada exitosamente!`);
      fetchSettlements();
      if (calculationResult?.savedSettlementId === settlementId) {
        setCalculationResult((prev) => prev ? { ...prev, status: 'DISPERSED' } : null);
      }
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 6. Marcar Pago a un Colaborador Individual
  const handleMarkItemPaid = async (settlementId: string, itemId: string, isPaid: boolean) => {
    try {
      const res = await fetch(`/api/tips/settlements/${settlementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedItems: [
            {
              id: itemId,
              payoutStatus: isPaid ? 'PAID' : 'PENDING',
            },
          ],
        }),
      });

      if (!res.ok) throw new Error('Error al actualizar estado de pago');
      const updated = await res.json();
      
      // Actualizar estado local
      if (calculationResult && calculationResult.savedSettlementId === settlementId) {
        setCalculationResult((prev) => prev ? {
          ...prev,
          items: updated.distributionDetails,
        } : null);
      }
      fetchSettlements();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // 7. Modificar Ajuste Manual a un Colaborador
  const handleAdjustItemAmount = (index: number, newAmount: number, reason: string) => {
    if (!calculationResult) return;
    const updated = [...calculationResult.items];
    updated[index].adjustedAmount = Number(newAmount.toFixed(2));
    updated[index].adjustmentReason = reason;
    setCalculationResult({
      ...calculationResult,
      items: updated,
    });
  };

  // 8. Visualizar e Imprimir Ticket Térmico 80mm
  const handlePrintReceipt = async (settlementId: string, itemId?: string, empName?: string) => {
    try {
      const url = `/api/tips/settlements/${settlementId}/print${itemId ? `?itemId=${itemId}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al generar comprobante térmico');
      const text = await res.text();

      setPrintModal({
        isOpen: true,
        title: itemId ? `Recibo de Entrega: ${empName}` : 'Hoja General de Reparto del Turno',
        receiptText: text,
      });
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // 9. Guardar Configuración de Reglas
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !brandId) return;

    try {
      setSaving(true);
      const res = await fetch('/api/tips/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          brandId,
        }),
      });

      if (!res.ok) throw new Error('Error al guardar configuración');
      const updated = await res.json();
      setConfig(updated);
      showFeedback('success', 'Configuración de reglas de propinas guardada correctamente');
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  // Helpers de badges de roles
  const getRoleBadge = (role: string) => {
    const r = role.toUpperCase();
    if (r === 'WAITER') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Mesero</span>;
    if (r === 'BARTENDER') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">Barra</span>;
    if (r === 'KITCHEN') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">Cocina</span>;
    if (r === 'RUNNER') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">Garrotero</span>;
    if (r === 'HOSTESS') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">Hostess</span>;
    if (r === 'DISHWASHER') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Lavalozas</span>;
    return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-500/20 text-slate-300 border border-slate-500/30">{role}</span>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">BORRADOR</span>;
      case 'CALCULATED':
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">CALCULADO</span>;
      case 'APPROVED':
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">APROBADO</span>;
      case 'DISPERSED':
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> DISPERSADO</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ALERTA / TOAST */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{feedback.message}</span>
        </div>
      )}

      {/* HEADER DE CONTROL & METRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute right-3 top-3 p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Dispersado Histórico</p>
          <h3 className="text-2xl font-black text-white mt-2">
            ${metrics.totalDispersedAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            <span className="text-xs font-normal text-slate-400 ml-1">MXN</span>
          </h3>
          <p className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Liquidaciones cerradas y pagadas
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute right-3 top-3 p-2 bg-amber-500/10 rounded-xl text-amber-400">
            <Coins className="w-6 h-6" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Bolsa Pendiente Aprobación</p>
          <h3 className="text-2xl font-black text-white mt-2">
            ${metrics.totalPendingApproval.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            <span className="text-xs font-normal text-slate-400 ml-1">MXN</span>
          </h3>
          <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Turnos en espera de dispersión
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute right-3 top-3 p-2 bg-blue-500/10 rounded-xl text-blue-400">
            <History className="w-6 h-6" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Cierres Realizados</p>
          <h3 className="text-2xl font-black text-white mt-2">
            {metrics.totalSettlements}
            <span className="text-xs font-normal text-slate-400 ml-1">turnos</span>
          </h3>
          <p className="text-xs text-blue-400/80 mt-1">Con folio auditable</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute right-3 top-3 p-2 bg-purple-500/10 rounded-xl text-purple-400">
            <Sliders className="w-6 h-6" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Modelo Activo</p>
          <h3 className="text-base font-bold text-white mt-2 truncate">
            {config?.distributionModel === 'POINTS_HOURS'
              ? 'Puntos × Horas'
              : config?.distributionModel === 'PERCENTAGE_DIRECT'
              ? 'Porcentajes Directos'
              : 'Partes Iguales'}
          </h3>
          <p className="text-xs text-purple-400/80 mt-1">
            {config?.isEnabled ? '🟢 Tip pooling activo' : '🔴 Tip pooling pausado'}
          </p>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveSubTab('calculator')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all ${
            activeSubTab === 'calculator'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Liquidación de Turno en Vivo
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all ${
            activeSubTab === 'history'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Historial de Cierres ({settlements.length})
        </button>

        <button
          onClick={() => setActiveSubTab('rules')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all ${
            activeSubTab === 'rules'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          Matriz de Puntos & Reglas por Puesto
        </button>
      </div>

      {/* =========================================================================
          SUB-TAB 1: CALCULADOR & LIQUIDACIÓN DE TURNO
      ========================================================================= */}
      {activeSubTab === 'calculator' && (
        <div className="space-y-6">
          {/* BARRA DE FILTROS & ACCIÓN */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Fecha de Operación</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Turno / Servicio</label>
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL_DAY">Todo el Día (Jornada Completa)</option>
                <option value="MORNING">Turno Matutino / Desayunos</option>
                <option value="EVENING">Turno Tarde / Comida</option>
                <option value="NIGHT">Turno Nocturno / Cena & Bar</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Modelo de Reparto</label>
              <select
                value={overrideModel}
                onChange={(e) => setOverrideModel(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="POINTS_HOURS">Puntos Ponderados por Horas (Estándar)</option>
                <option value="PERCENTAGE_DIRECT">Porcentajes Directos por Puesto</option>
                <option value="EQUAL_SPLIT">Partes Iguales por Horas</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                Propina en Efectivo (Opcional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 text-xs">$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Auto corte caja"
                  value={manualCashTips}
                  onChange={(e) => setManualCashTips(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white rounded-xl pl-7 pr-3 py-2 text-sm w-36 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => handleCalculate(false)}
                disabled={loading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 border border-slate-700 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Previsualizar
              </button>

              <button
                type="button"
                onClick={() => handleCalculate(true)}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all"
              >
                <Coins className="w-4 h-4" />
                Generar & Guardar Cierre
              </button>
            </div>
          </div>

          {/* RESUMEN DE LA BOLSA CALCULADA */}
          {calculationResult && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-6 bg-gradient-to-r from-slate-950 to-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-white">
                      Bolsa Total de Propinas:
                    </span>
                    <span className="text-3xl font-black text-emerald-400">
                      ${calculationResult.totalTips.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                    </span>
                    {calculationResult.status && getStatusBadge(calculationResult.status)}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                    <span className="flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                      Efectivo: <strong>${calculationResult.cashTips.toFixed(2)}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                      Terminales / Tarjeta: <strong>${calculationResult.cardTips.toFixed(2)}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                      Digital / QR: <strong>${calculationResult.digitalTips.toFixed(2)}</strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-300" />
                      Horas del Equipo: <strong>{calculationResult.totalHoursWorked} hrs</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-300" />
                      Personal: <strong>{calculationResult.items.length} colaboradores</strong>
                    </span>
                  </div>
                </div>

                {calculationResult.savedSettlementId && (
                  <div className="flex items-center gap-2">
                    {calculationResult.status === 'CALCULATED' && (
                      <button
                        onClick={() => handleApproveSettlement(calculationResult.savedSettlementId!)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Aprobar Cierre
                      </button>
                    )}

                    {calculationResult.status === 'APPROVED' && (
                      <button
                        onClick={() => handleDisperseSettlement(calculationResult.savedSettlementId!)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Dispersar a Todo el Equipo
                      </button>
                    )}

                    <button
                      onClick={() => handlePrintReceipt(calculationResult.savedSettlementId!)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                    >
                      <Printer className="w-4 h-4" />
                      Hoja Reparto 80mm
                    </button>

                    <a
                      href={`/api/tips/settlements/${calculationResult.savedSettlementId}/export`}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                    >
                      <Download className="w-4 h-4" />
                      CSV Nómina
                    </a>
                  </div>
                )}
              </div>

              {/* TABLA DE DESGLOSE POR COLABORADOR */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Colaborador</th>
                      <th className="py-3.5 px-4 font-semibold">Puesto</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Horas</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Factor Pts</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Puntos Ponderados</th>
                      <th className="py-3.5 px-4 font-semibold text-center">% Part.</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Monto Calculado</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Monto Final</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Estado Pago</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {calculationResult.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                            {item.employeeName.slice(0, 2).toUpperCase()}
                          </div>
                          {item.employeeName}
                        </td>
                        <td className="py-3 px-4">
                          {getRoleBadge(item.role)}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-300">
                          {item.hoursWorked} hrs
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400 font-mono">
                          {item.pointsWeight} pts
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-white font-mono">
                          {item.weightedPoints.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-400 font-mono">
                          {item.sharePercentage}%
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 font-mono">
                          ${item.allocatedAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <input
                            type="number"
                            step="0.50"
                            value={item.adjustedAmount}
                            onChange={(e) => handleAdjustItemAmount(idx, parseFloat(e.target.value) || 0, 'Ajuste manual de supervisor')}
                            className="bg-slate-950 border border-slate-700 text-emerald-300 font-bold font-mono text-sm rounded-lg px-2 py-1 w-24 text-right focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.payoutStatus === 'PAID' ? (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300">PAGADO</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300">PENDIENTE</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {calculationResult.savedSettlementId && item.id && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMarkItemPaid(
                                    calculationResult.savedSettlementId!,
                                    item.id!,
                                    item.payoutStatus !== 'PAID'
                                  )}
                                  title={item.payoutStatus === 'PAID' ? 'Marcar pendiente' : 'Marcar como pagado'}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    item.payoutStatus === 'PAID'
                                      ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                      : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600 hover:text-white'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handlePrintReceipt(
                                    calculationResult.savedSettlementId!,
                                    item.id!,
                                    item.employeeName
                                  )}
                                  title="Imprimir Recibo de Firma 80mm"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 2: HISTORIAL DE LIQUIDACIONES
      ========================================================================= */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                Bitácora de Cierres de Propinas
              </h3>
              <button
                onClick={fetchSettlements}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Folio</th>
                    <th className="py-3 px-4 font-semibold">Fecha / Periodo</th>
                    <th className="py-3 px-4 font-semibold">Turno</th>
                    <th className="py-3 px-4 font-semibold text-right">Efectivo</th>
                    <th className="py-3 px-4 font-semibold text-right">Tarjeta / Terminal</th>
                    <th className="py-3 px-4 font-semibold text-right">Bolsa Total</th>
                    <th className="py-3 px-4 font-semibold text-center">Colaboradores</th>
                    <th className="py-3 px-4 font-semibold text-center">Estatus</th>
                    <th className="py-3 px-4 font-semibold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {settlements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        No hay cierres de propinas registrados aún. Realiza tu primera liquidación en la pestaña "Liquidación de Turno".
                      </td>
                    </tr>
                  ) : (
                    settlements.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {s.folio}
                        </td>
                        <td className="py-3 px-4 text-slate-300 text-xs">
                          {new Date(s.periodStart).toLocaleDateString('es-MX')}
                        </td>
                        <td className="py-3 px-4 text-slate-300 text-xs font-semibold">
                          {s.shift}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 font-mono text-xs">
                          ${s.cashTips.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 font-mono text-xs">
                          ${s.cardTips.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-white font-mono">
                          ${s.totalTips.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center text-xs text-slate-300">
                          {s.distributionDetails?.length || 0} personas
                        </td>
                        <td className="py-3 px-4 text-center">
                          {getStatusBadge(s.status)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setCalculationResult({
                                  cashTips: s.cashTips,
                                  cardTips: s.cardTips,
                                  digitalTips: s.digitalTips,
                                  totalTips: s.totalTips,
                                  totalHoursWorked: s.totalHoursWorked,
                                  totalPoints: s.totalPoints,
                                  items: s.distributionDetails,
                                  savedSettlementId: s.id,
                                  folio: s.folio,
                                  status: s.status,
                                });
                                setActiveSubTab('calculator');
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                              title="Ver Detalle"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handlePrintReceipt(s.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                              title="Imprimir Hoja de Reparto"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <a
                              href={`/api/tips/settlements/${s.id}/export`}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                              title="Descargar CSV Nómina"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 3: CONFIGURACIÓN & MATRIZ DE PUNTOS POR PUESTO
      ========================================================================= */}
      {activeSubTab === 'rules' && config && (
        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 p-6 rounded-2xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                Parámetros Generales de Tip Pooling
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Define las fuentes de propinas a integrar y el modelo matemático de distribución entre los colaboradores.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  Estado del Módulo
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Habilitar cálculo y cierres</span>
                  <input
                    type="checkbox"
                    checked={config.isEnabled}
                    onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded bg-slate-900 border-slate-700"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <label className="block text-sm font-semibold text-white mb-2">
                  Modelo por Defecto
                </label>
                <select
                  value={config.distributionModel}
                  onChange={(e) => setConfig({ ...config, distributionModel: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="POINTS_HOURS">Puntos Ponderados por Horas</option>
                  <option value="PERCENTAGE_DIRECT">Porcentajes Directos por Rol</option>
                  <option value="EQUAL_SPLIT">Partes Iguales</option>
                </select>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <label className="block text-sm font-semibold text-white mb-2">
                  Horas Mínimas en Turno
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={config.minHoursRequired}
                  onChange={(e) => setConfig({ ...config, minHoursRequired: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Para participar en la bolsa</span>
              </div>
            </div>

            {/* FUENTES INCLUIDAS */}
            <div className="border-t border-slate-800 pt-5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
                Fuentes de Recaudación en la Bolsa
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeCashTips}
                    onChange={(e) => setConfig({ ...config, includeCashTips: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Propinas en Efectivo</span>
                    <span className="text-[11px] text-slate-500">Corte X / Z de caja</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeCardTips}
                    onChange={(e) => setConfig({ ...config, includeCardTips: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Terminales & Tarjeta</span>
                    <span className="text-[11px] text-slate-500">Clip, Mercado Pago, POS</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeDigitalTips}
                    onChange={(e) => setConfig({ ...config, includeDigitalTips: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Digitales & Split Bill</span>
                    <span className="text-[11px] text-slate-500">Menú QR y auto-pago móvil</span>
                  </div>
                </label>
              </div>
            </div>

            {/* MATRIZ DE PUNTOS POR PUESTO */}
            <div className="border-t border-slate-800 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Matriz de Factores y Puntos por Puesto</h4>
                  <p className="text-xs text-slate-400">
                    En el modelo de puntos, la fórmula es: <code className="bg-slate-950 px-2 py-0.5 rounded text-emerald-400">Propina = Bolsa × (Horas × Puntos) ÷ PuntosTotales</code>
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Puesto / Rol</th>
                      <th className="py-2.5 px-3">Nombre Visible</th>
                      <th className="py-2.5 px-3 text-center">Puntos (Pts)</th>
                      <th className="py-2.5 px-3 text-center">% Part. (Modelo %)</th>
                      <th className="py-2.5 px-3 text-center">Activo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {config.roleRules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-mono font-bold text-xs text-slate-300">
                          {rule.role}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={rule.roleDisplayName}
                            onChange={(e) => {
                              const updated = [...config.roleRules];
                              updated[idx].roleDisplayName = e.target.value;
                              setConfig({ ...config, roleRules: updated });
                            }}
                            className="bg-slate-950 border border-slate-700 text-white text-xs rounded px-2.5 py-1 w-44 focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            step="0.5"
                            value={rule.pointsWeight}
                            onChange={(e) => {
                              const updated = [...config.roleRules];
                              updated[idx].pointsWeight = parseFloat(e.target.value) || 0;
                              setConfig({ ...config, roleRules: updated });
                            }}
                            className="bg-slate-950 border border-slate-700 text-emerald-400 font-bold text-xs rounded px-2.5 py-1 w-20 text-center focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            step="1"
                            value={rule.percentageShare}
                            onChange={(e) => {
                              const updated = [...config.roleRules];
                              updated[idx].percentageShare = parseFloat(e.target.value) || 0;
                              setConfig({ ...config, roleRules: updated });
                            }}
                            className="bg-slate-950 border border-slate-700 text-purple-400 font-bold text-xs rounded px-2.5 py-1 w-20 text-center focus:outline-none"
                          />
                          <span className="text-xs text-slate-500 ml-1">%</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={rule.isActive}
                            onChange={(e) => {
                              const updated = [...config.roleRules];
                              updated[idx].isActive = e.target.checked;
                              setConfig({ ...config, roleRules: updated });
                            }}
                            className="w-4 h-4 text-emerald-600 rounded bg-slate-900 border-slate-700"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar Reglas de Reparto'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* =========================================================================
          MODAL DE TICKET TÉRMICO 80MM
      ========================================================================= */}
      {printModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                {printModal.title}
              </h3>
              <button
                onClick={() => setPrintModal({ ...printModal, isOpen: false })}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto bg-slate-950 font-mono text-xs text-emerald-300 whitespace-pre leading-relaxed border-b border-slate-800 select-all">
              {printModal.receiptText}
            </div>

            <div className="p-4 flex items-center justify-between gap-3 bg-slate-900">
              <span className="text-xs text-slate-400">
                Formato listo para comanderas térmicas de 80mm
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(printModal.receiptText);
                    alert('¡Recibo copiado al portapapeles!');
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700"
                >
                  Copiar Texto
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Comprobante
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

