'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Zap,
  Clock,
  ArrowRight,
  Scale,
  Sparkles,
  Info,
  Layers,
  FileCheck2,
  BadgeAlert,
  Download
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface SettlementItem {
  id: string;
  brandId: string;
  platform: string;
  folio: string;
  periodStart: string;
  periodEnd: string;
  bankDepositDate: string | null;
  bankReference: string | null;
  status: string;
  ordersCount: number;
  grossSales: number;
  platformCommission: number;
  commissionTax: number;
  withholdingIsr: number;
  withholdingIva: number;
  promotionsFunded: number;
  adjustmentsRefunds: number;
  netPayoutCalculated: number;
  bankDepositAmount: number;
  variance: number;
  notes: string | null;
  reconciledByName: string | null;
  reconciledAt: string | null;
  createdAt: string;
  _count?: {
    orders: number;
    disputes: number;
  };
  disputes?: Array<{
    id: string;
    disputeType: string;
    claimedAmount: number;
    recoveredAmount: number;
    status: string;
  }>;
}

interface DisputeItem {
  id: string;
  platform: string;
  externalOrderId: string | null;
  disputeType: string;
  claimedAmount: number;
  recoveredAmount: number;
  status: string;
  ticketFolio: string | null;
  reason: string;
  resolutionNotes: string | null;
  createdAt: string;
  settlement?: {
    folio: string;
    platform: string;
  } | null;
  order?: {
    orderNumber: string;
    externalOrderId: string | null;
    total: number;
    customerName: string;
  } | null;
}

interface UnreconciledOrder {
  id: string;
  orderNumber: string;
  externalOrderId: string | null;
  source: string;
  customerName: string;
  customerPhone: string | null;
  total: number;
  subtotal: number;
  tax: number;
  platformCommission: number | null;
  platformCommissionRate: number | null;
  netPayout: number | null;
  createdAt: string;
  items: Array<{
    quantity: number;
    product: { name: string };
  }>;
}

interface MetricsData {
  totalSettledGrossSales: number;
  totalPlatformCommissions: number;
  totalTaxesWithheld: number;
  totalBankReceived: number;
  totalVariance: number;
  settlementsCount: number;
  openDisputesCount: number;
  unreconciledCount: number;
  unreconciledGrossSales: number;
  unreconciledByPlatform: Record<string, { count: number; total: number }>;
}

export default function DeliveryReconciliationTab() {
  const { activeBrand, addNotification } = useAppStore();
  const [subTab, setSubTab] = useState<'SETTLEMENTS' | 'UNRECONCILED' | 'DISPUTES' | 'SIMULATOR'>('SETTLEMENTS');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [unreconciledOrders, setUnreconciledOrders] = useState<UnreconciledOrder[]>([]);
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);

  // Filters
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // New Settlement Modal State
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [formPlatform, setFormPlatform] = useState('UBER_EATS');
  const [formPeriodStart, setFormPeriodStart] = useState('');
  const [formPeriodEnd, setFormPeriodEnd] = useState('');
  const [formBankDeposit, setFormBankDeposit] = useState('');
  const [formBankRef, setFormBankRef] = useState('');
  const [formPromos, setFormPromos] = useState('0');
  const [formAdjustments, setFormAdjustments] = useState('0');
  const [formIsrRate, setFormIsrRate] = useState('1.0');
  const [formIvaRate, setFormIvaRate] = useState('8.0');
  const [formNotes, setFormNotes] = useState('');
  const [submittingSettlement, setSubmittingSettlement] = useState(false);

  // Settlement Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementItem | null>(null);
  const [settlementOrders, setSettlementOrders] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Dispute Modal State
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [editingDispute, setEditingDispute] = useState<DisputeItem | null>(null);
  const [disputeStatus, setDisputeStatus] = useState('OPEN');
  const [disputeRecovered, setDisputeRecovered] = useState('');
  const [disputeNotes, setDisputeNotes] = useState('');
  const [disputeTicket, setDisputeTicket] = useState('');
  const [savingDispute, setSavingDispute] = useState(false);

  // Simulator actions state
  const [simulating, setSimulating] = useState(false);

  // Load Settlements and Global Metrics
  const loadSettlements = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/settlements?platform=${platformFilter}&status=${statusFilter}`);
      const data = await res.json();
      if (res.ok) {
        setSettlements(data.settlements || []);
        setMetrics(data.metrics || null);
      } else {
        addNotification(data.error || 'Error al cargar liquidaciones', 'error');
      }
    } catch (err) {
      console.error('Error fetching settlements:', err);
      addNotification('Error de red al consultar liquidaciones', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeBrand?.id, platformFilter, statusFilter, addNotification]);

  // Load Unreconciled Orders
  const loadUnreconciled = useCallback(async () => {
    if (!activeBrand?.id) return;
    try {
      const res = await fetch(`/api/delivery/settlements/unreconciled?platform=${platformFilter}`);
      const data = await res.json();
      if (res.ok) {
        setUnreconciledOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Error fetching unreconciled orders:', err);
    }
  }, [activeBrand?.id, platformFilter]);

  // Load Disputes
  const loadDisputes = useCallback(async () => {
    if (!activeBrand?.id) return;
    try {
      const res = await fetch(`/api/delivery/disputes?platform=${platformFilter}`);
      const data = await res.json();
      if (res.ok) {
        setDisputes(data.disputes || []);
      }
    } catch (err) {
      console.error('Error fetching disputes:', err);
    }
  }, [activeBrand?.id, platformFilter]);

  useEffect(() => {
    loadSettlements();
    loadUnreconciled();
    loadDisputes();
  }, [loadSettlements, loadUnreconciled, loadDisputes]);

  // Initialize dates for new settlement modal
  const openNewSettlementModal = () => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    setFormPeriodStart(start.toISOString().slice(0, 10));
    setFormPeriodEnd(end.toISOString().slice(0, 10));
    setFormBankDeposit('');
    setFormBankRef('');
    setFormPromos('0');
    setFormAdjustments('0');
    setFormNotes('');
    setNewModalOpen(true);
  };

  // Submit New Settlement
  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPeriodStart || !formPeriodEnd || !formBankDeposit) {
      addNotification('Por favor completa las fechas y el monto de depósito bancario', 'warning');
      return;
    }

    setSubmittingSettlement(true);
    try {
      const res = await fetch('/api/delivery/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: formPlatform,
          periodStart: formPeriodStart,
          periodEnd: `${formPeriodEnd}T23:59:59.999Z`,
          bankDepositAmount: parseFloat(formBankDeposit),
          bankReference: formBankRef || 'SPEI DEPÓSITO BANCARIO',
          promotionsFunded: parseFloat(formPromos || '0'),
          adjustmentsRefunds: parseFloat(formAdjustments || '0'),
          withholdingIsrRate: parseFloat(formIsrRate || '1.0'),
          withholdingIvaRate: parseFloat(formIvaRate || '8.0'),
          notes: formNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(data.message, 'success');
        setNewModalOpen(false);
        loadSettlements();
        loadUnreconciled();
        loadDisputes();
      } else {
        addNotification(data.error || 'Error al conciliar liquidación', 'error');
      }
    } catch (err) {
      console.error('Error creating settlement:', err);
      addNotification('Error al enviar liquidación', 'error');
    } finally {
      setSubmittingSettlement(false);
    }
  };

  // Open Settlement Detail Modal
  const handleViewDetail = async (settlement: SettlementItem) => {
    setSelectedSettlement(settlement);
    setDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/delivery/settlements/${settlement.id}`);
      const data = await res.json();
      if (res.ok && data.settlement) {
        setSettlementOrders(data.settlement.orders || []);
      }
    } catch (err) {
      console.error('Error fetching settlement detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Delete Settlement
  const handleDeleteSettlement = async (id: string, folio: string) => {
    if (!confirm(`¿Eliminar la liquidación ${folio}? Las comandas volverán al estado pendiente sin liquidar.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/delivery/settlements/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        addNotification(data.message || 'Liquidación eliminada', 'success');
        loadSettlements();
        loadUnreconciled();
        loadDisputes();
      } else {
        addNotification(data.error || 'Error al eliminar', 'error');
      }
    } catch (err) {
      console.error('Error deleting settlement:', err);
    }
  };

  // Open Edit Dispute Modal
  const handleOpenDisputeModal = (dispute: DisputeItem) => {
    setEditingDispute(dispute);
    setDisputeStatus(dispute.status);
    setDisputeRecovered(dispute.recoveredAmount.toString());
    setDisputeTicket(dispute.ticketFolio || '');
    setDisputeNotes(dispute.resolutionNotes || '');
    setDisputeModalOpen(true);
  };

  // Save Dispute Changes
  const handleSaveDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDispute) return;

    setSavingDispute(true);
    try {
      const res = await fetch(`/api/delivery/disputes/${editingDispute.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: disputeStatus,
          recoveredAmount: parseFloat(disputeRecovered || '0'),
          ticketFolio: disputeTicket,
          resolutionNotes: disputeNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(data.message || 'Disputa actualizada', 'success');
        setDisputeModalOpen(false);
        loadDisputes();
        loadSettlements();
      } else {
        addNotification(data.error || 'Error al actualizar disputa', 'error');
      }
    } catch (err) {
      console.error('Error updating dispute:', err);
    } finally {
      setSavingDispute(false);
    }
  };

  // Run Simulator Actions
  const runSimulatorAction = async (action: string, scenario?: string, platform?: string) => {
    setSimulating(true);
    try {
      const res = await fetch('/api/delivery/settlements/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, scenario, platform }),
      });
      const data = await res.json();
      if (res.ok) {
        addNotification(data.message, 'success');
        loadSettlements();
        loadUnreconciled();
        loadDisputes();
      } else {
        addNotification(data.error || 'Error en el simulador', 'error');
      }
    } catch (err) {
      console.error('Error running simulator action:', err);
    } finally {
      setSimulating(false);
    }
  };

  const getPlatformMeta = (plat: string) => {
    switch (plat) {
      case 'UBER_EATS':
        return {
          name: 'Uber Eats',
          badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          dot: 'bg-emerald-400',
          commissionRate: 28,
        };
      case 'RAPPI':
        return {
          name: 'Rappi',
          badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
          dot: 'bg-orange-400',
          commissionRate: 25,
        };
      case 'DIDI_FOOD':
        return {
          name: 'DiDi Food',
          badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          dot: 'bg-amber-400',
          commissionRate: 22,
        };
      default:
        return {
          name: plat,
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
          commissionRate: 25,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Settled Gross Sales */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Ventas Liquidadas</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            ${(metrics?.totalSettledGrossSales || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
            <span>{metrics?.settlementsCount || 0} liquidaciones procesadas</span>
          </div>
        </div>

        {/* Aggregator Commissions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Comisiones + IVA</span>
            <Scale className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-black text-red-400 font-mono">
            -${(metrics?.totalPlatformCommissions || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-red-400/80">
            <span>Retención por plataformas delivery</span>
          </div>
        </div>

        {/* Tax Withholdings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Retenciones ISR/IVA</span>
            <Building2 className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-300 font-mono">
            -${(metrics?.totalTaxesWithheld || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-purple-400/80">
            <span>SAT Art. 113-A plataformas</span>
          </div>
        </div>

        {/* Real Bank Deposits */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Depósito Banco Real</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono">
            ${(metrics?.totalBankReceived || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-500/90 font-medium">
            <span>Dinero neto en cuenta bancaria</span>
          </div>
        </div>

        {/* Net Variance / Discrepancies */}
        <div className={`bg-slate-900 border rounded-2xl p-4 relative overflow-hidden ${
          (metrics?.totalVariance || 0) < -1 
            ? 'border-red-500/40 bg-red-950/10' 
            : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Varianza Neta</span>
            <AlertTriangle className={`w-4 h-4 ${(metrics?.totalVariance || 0) < -1 ? 'text-red-400' : 'text-slate-400'}`} />
          </div>
          <p className={`text-2xl font-black font-mono ${
            (metrics?.totalVariance || 0) < -1 ? 'text-red-400' : 'text-slate-200'
          }`}>
            {(metrics?.totalVariance || 0) >= 0 ? '+' : ''}${(metrics?.totalVariance || 0).toFixed(2)}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[11px]">
            {(metrics?.totalVariance || 0) < -1 ? (
              <span className="text-red-400 font-bold">Faltante detectado vs cálculo</span>
            ) : (
              <span className="text-emerald-400 font-medium">Cuadre exacto con banco</span>
            )}
          </div>
        </div>
      </div>

      {/* Unreconciled Orders Attention Banner */}
      {(metrics?.unreconciledCount || 0) > 0 && (
        <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <BadgeAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                {metrics?.unreconciledCount} comandas pendientes de conciliar (${metrics?.unreconciledGrossSales.toFixed(2)} MXN)
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Uber Eats: {metrics?.unreconciledByPlatform?.UBER_EATS?.count || 0} (${metrics?.unreconciledByPlatform?.UBER_EATS?.total.toFixed(2) || 0}) | 
                Rappi: {metrics?.unreconciledByPlatform?.RAPPI?.count || 0} (${metrics?.unreconciledByPlatform?.RAPPI?.total.toFixed(2) || 0}) | 
                DiDi: {metrics?.unreconciledByPlatform?.DIDI_FOOD?.count || 0} (${metrics?.unreconciledByPlatform?.DIDI_FOOD?.total.toFixed(2) || 0})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSubTab('UNRECONCILED')}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/30 transition-all flex items-center gap-1.5"
            >
              Auditar Comandas <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={openNewSettlementModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Conciliar Corte
            </button>
          </div>
        </div>
      )}

      {/* Sub Tab Navigation and Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setSubTab('SETTLEMENTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'SETTLEMENTS'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            Liquidaciones & Depósitos ({settlements.length})
          </button>
          <button
            onClick={() => setSubTab('UNRECONCILED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'UNRECONCILED'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            Comandas Pendientes ({metrics?.unreconciledCount || 0})
          </button>
          <button
            onClick={() => setSubTab('DISPUTES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'DISPUTES'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-red-400" />
            Centro de Disputas & Reclamos {disputes.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 font-mono">
                {disputes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setSubTab('SIMULATOR')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'SIMULATOR'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            Banco de Pruebas IoT/App
          </button>
        </div>

        {/* Platform & Refresh Controls */}
        <div className="flex items-center gap-3">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-slate-700"
          >
            <option value="ALL">Todas las Plataformas</option>
            <option value="UBER_EATS">Uber Eats</option>
            <option value="RAPPI">Rappi</option>
            <option value="DIDI_FOOD">DiDi Food</option>
          </select>

          <button
            onClick={() => {
              loadSettlements();
              loadUnreconciled();
              loadDisputes();
            }}
            disabled={loading}
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={openNewSettlementModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-900/30 flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nueva Conciliación
          </button>
        </div>
      </div>

      {/* SUBTAB 1: SETTLEMENTS LIST */}
      {subTab === 'SETTLEMENTS' && (
        <div className="space-y-4">
          {settlements.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <FileCheck2 className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No hay liquidaciones registradas</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Registra un depósito bancario semanal para conciliar automáticamente tus pedidos de Uber Eats, Rappi o DiDi Food.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={openNewSettlementModal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Conciliación Manual
                </button>
                <button
                  onClick={() => setSubTab('SIMULATOR')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-cyan-400" /> Abrir Simulador
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Liquidación / Folio</th>
                    <th className="py-3 px-4">Plataforma</th>
                    <th className="py-3 px-4">Período Auditado</th>
                    <th className="py-3 px-4 text-center">Comandas</th>
                    <th className="py-3 px-4 text-right">Venta Bruta</th>
                    <th className="py-3 px-4 text-right">Comisión + Imp</th>
                    <th className="py-3 px-4 text-right">Neto Teórico</th>
                    <th className="py-3 px-4 text-right">Depósito Banco</th>
                    <th className="py-3 px-4 text-right">Varianza</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {settlements.map((s) => {
                    const meta = getPlatformMeta(s.platform);
                    const totalDeductions = s.platformCommission + s.commissionTax + s.withholdingIsr + s.withholdingIva + s.promotionsFunded + s.adjustmentsRefunds;

                    return (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-white font-mono">{s.folio}</p>
                          <p className="text-[10px] text-slate-500 font-sans truncate max-w-[150px]">
                            {s.bankReference || 'Sin ref. bancaria'}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${meta.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}></span>
                            {meta.name}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-300">
                          <p className="text-xs">
                            {new Date(s.periodStart).toLocaleDateString('es-MX')} al {new Date(s.periodEnd).toLocaleDateString('es-MX')}
                          </p>
                          {s.bankDepositDate && (
                            <p className="text-[10px] text-slate-500">
                              Depósito: {new Date(s.bankDepositDate).toLocaleDateString('es-MX')}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-200">
                          {s.ordersCount}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-200">
                          ${s.grossSales.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-red-400">
                          -${totalDeductions.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-300">
                          ${s.netPayoutCalculated.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          ${s.bankDepositAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            Math.abs(s.variance) <= 1.0
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {s.variance >= 0 ? '+' : ''}${s.variance.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            s.status === 'RECONCILED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : s.status === 'DISCREPANCY'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {s.status === 'RECONCILED' ? 'Conciliado' : s.status === 'DISCREPANCY' ? 'Discrepancia' : s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleViewDetail(s)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all"
                              title="Ver detalle de comandas auditadas"
                            >
                              Detalle
                            </button>
                            <a
                              href={`/api/delivery/settlements/${s.id}/export`}
                              download
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 rounded-lg transition-all"
                              title="Descargar CSV oficial"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleDeleteSettlement(s.id, s.folio)}
                              className="p-1 bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg transition-all"
                              title="Eliminar liquidación"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: UNRECONCILED ORDERS */}
      {subTab === 'UNRECONCILED' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div>
              <h3 className="font-bold text-white text-base">Comandas de Delivery Pendientes de Corte</h3>
              <p className="text-xs text-slate-400">
                Estas órdenes fueron recibidas y despachadas en la cocina, pero aún no han sido incluidas en un depósito bancario de corte semanal.
              </p>
            </div>
            <button
              onClick={openNewSettlementModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" /> Conciliar este Lote
            </button>
          </div>

          {unreconciledOrders.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              No hay pedidos pendientes de liquidar. Todas tus ventas de delivery están al día.
            </div>
          ) : (
            <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Canal</th>
                    <th className="py-3 px-4">ID Pedido / Externo</th>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Productos</th>
                    <th className="py-3 px-4 text-right">Venta Bruta</th>
                    <th className="py-3 px-4 text-right">Comisión App</th>
                    <th className="py-3 px-4 text-right">Neto Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {unreconciledOrders.map((o) => {
                    const meta = getPlatformMeta(o.source);
                    const comm = o.platformCommission ?? ((o.total * (o.platformCommissionRate || meta.commissionRate)) / 100);
                    const net = o.netPayout ?? (o.total - comm);

                    return (
                      <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${meta.badge}`}>
                            {meta.name}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-white font-mono">{o.externalOrderId || '-'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{o.orderNumber}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(o.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-200">{o.customerName}</p>
                          <p className="text-[10px] text-slate-500">{o.customerPhone || 'Sin teléfono'}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {o.items.map((it, idx) => (
                            <span key={idx} className="block text-[11px] truncate max-w-[180px]">
                              {it.quantity}x {it.product.name}
                            </span>
                          ))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          ${o.total.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-red-400">
                          -${comm.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          ${net.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: DISPUTES CENTER */}
      {subTab === 'DISPUTES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div>
              <h3 className="font-bold text-white text-base">Disputas y Reclamos por Faltantes de Delivery</h3>
              <p className="text-xs text-slate-400">
                Monitorea cargos indebidos, pedidos entregados a repartidores pero no liquidados por la app, y cancelaciones tardías.
              </p>
            </div>
          </div>

          {disputes.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              No tienes disputas abiertas con las plataformas de delivery.
            </div>
          ) : (
            <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Ticket / Plataforma</th>
                    <th className="py-3 px-4">Tipo de Disputa</th>
                    <th className="py-3 px-4">Motivo / Reclamo</th>
                    <th className="py-3 px-4 text-right">Monto Reclamado</th>
                    <th className="py-3 px-4 text-right">Recuperado</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {disputes.map((d) => {
                    const meta = getPlatformMeta(d.platform);

                    return (
                      <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-white font-mono">{d.ticketFolio || d.id.slice(0, 8)}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 border ${meta.badge}`}>
                            {meta.name}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-200 block">
                            {d.disputeType === 'UNPAID_ORDER' ? 'Orden No Pagada' :
                             d.disputeType === 'WRONGFUL_REFUND' ? 'Reembolso Indebido' :
                             d.disputeType === 'COMMISSION_OVERCHARGE' ? 'Cobro Excesivo de Comisión' :
                             'Cancelado sin Pago'}
                          </span>
                          {d.externalOrderId && (
                            <span className="text-[10px] text-slate-500 font-mono">ID Ext: {d.externalOrderId}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300 max-w-xs truncate" title={d.reason}>
                          {d.reason}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-red-400">
                          ${d.claimedAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          ${d.recoveredAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            d.status === 'RESOLVED_WON' ? 'bg-emerald-500/20 text-emerald-300' :
                            d.status === 'RESOLVED_LOST' ? 'bg-red-500/20 text-red-300' :
                            d.status === 'SUBMITTED_TO_APP' ? 'bg-blue-500/20 text-blue-300' :
                            'bg-amber-500/20 text-amber-300'
                          }`}>
                            {d.status === 'RESOLVED_WON' ? 'Recuperado' :
                             d.status === 'RESOLVED_LOST' ? 'Perdido' :
                             d.status === 'SUBMITTED_TO_APP' ? 'Enviado a Soporte' : 'Abierto'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenDisputeModal(d)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all"
                          >
                            Gestionar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: SIMULATOR & TEST BENCH */}
      {subTab === 'SIMULATOR' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Generador de Comandas Delivery</h3>
                <p className="text-xs text-slate-400">Genera 15 pedidos sintéticos realistas en Uber, Rappi y DiDi Food</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Crea comandas simuladas distribuidas durante la última semana con platillos reales de tu menú, comisiones contractuales y clientes de prueba listos para ser auditados.
            </p>

            <button
              onClick={() => runSimulatorAction('SEED_DELIVERY_WEEK')}
              disabled={simulating}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30"
            >
              {simulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Sembrar 15 Comandas de Delivery
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Simulador de Liquidaciones de Plataforma</h3>
                <p className="text-xs text-slate-400">Crea cortes semanales con diferentes escenarios de auditoría</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                onClick={() => runSimulatorAction('SIMULATE_SETTLEMENT', 'EXACT_MATCH', 'UBER_EATS')}
                disabled={simulating}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl text-xs font-bold text-left transition-all flex items-center justify-between border border-slate-700"
              >
                <span>Simular Liquidación Uber Eats (Cuadre Exacto $0 Varianza)</span>
                <Check className="w-4 h-4" />
              </button>

              <button
                onClick={() => runSimulatorAction('SIMULATE_SETTLEMENT', 'MISSING_PAYOUT', 'RAPPI')}
                disabled={simulating}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold text-left transition-all flex items-center justify-between border border-slate-700"
              >
                <span>Simular Liquidación Rappi con Faltante Bancario (-$420 MXN)</span>
                <AlertTriangle className="w-4 h-4" />
              </button>

              <button
                onClick={() => runSimulatorAction('SIMULATE_SETTLEMENT', 'UNJUSTIFIED_REFUND', 'DIDI_FOOD')}
                disabled={simulating}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-xl text-xs font-bold text-left transition-all flex items-center justify-between border border-slate-700"
              >
                <span>Simular DiDi Food con Deducción por Reclamo (-$280 MXN)</span>
                <Scale className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => runSimulatorAction('RESET_SETTLEMENTS')}
                disabled={simulating}
                className="w-full py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 rounded-xl text-xs font-bold transition-all border border-red-900/30"
              >
                Limpiar Liquidaciones y Resetear Comandas a Pendientes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: NUEVA CONCILIACIÓN MANUAL */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl space-y-5 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Scale className="w-5 h-5 text-emerald-400" />
                  Nueva Conciliación de Liquidación Delivery
                </h3>
                <p className="text-xs text-slate-400">
                  Ingresa los datos del depósito bancario y DarkFlow auditará las comandas
                </p>
              </div>
              <button
                onClick={() => setNewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSettlement} className="space-y-4">
              {/* Platform selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Plataforma de Delivery
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['UBER_EATS', 'RAPPI', 'DIDI_FOOD'].map((p) => {
                    const isSelected = formPlatform === p;
                    const meta = getPlatformMeta(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormPlatform(p)}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                          isSelected
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500 shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {meta.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Período Inicio</label>
                  <input
                    type="date"
                    required
                    value={formPeriodStart}
                    onChange={(e) => setFormPeriodStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Período Fin</label>
                  <input
                    type="date"
                    required
                    value={formPeriodEnd}
                    onChange={(e) => setFormPeriodEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Bank Deposit and Ref */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Depósito Real en Banco ($ MXN)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ej. 4850.50"
                    value={formBankDeposit}
                    onChange={(e) => setFormBankDeposit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Referencia / Folio Bancario</label>
                  <input
                    type="text"
                    placeholder="SPEI BBVA 91024..."
                    value={formBankRef}
                    onChange={(e) => setFormBankRef(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Tax withholdings rates */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Retención ISR % (SAT)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formIsrRate}
                    onChange={(e) => setFormIsrRate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Retención IVA % (SAT)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formIvaRate}
                    onChange={(e) => setFormIvaRate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Promos & Deductions */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Promociones Absorbidas ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPromos}
                    onChange={(e) => setFormPromos(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Ajustes / Reembolsos App ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formAdjustments}
                    onChange={(e) => setFormAdjustments(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notas de Auditoría</label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre el corte, número de transferencia, etc."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingSettlement}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-2"
                >
                  {submittingSettlement ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
                  Conciliar y Cuadrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DETALLE DE LIQUIDACIÓN AUDITADA */}
      {detailModalOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">{selectedSettlement.folio}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getPlatformMeta(selectedSettlement.platform).badge}`}>
                    {getPlatformMeta(selectedSettlement.platform).name}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Período: {new Date(selectedSettlement.periodStart).toLocaleDateString('es-MX')} al {new Date(selectedSettlement.periodEnd).toLocaleDateString('es-MX')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/delivery/settlements/${selectedSettlement.id}/export`}
                  download
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                </a>
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Financial Breakdown Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Venta Bruta ({selectedSettlement.ordersCount} pedidos)</span>
                <span className="font-bold text-white text-sm">${selectedSettlement.grossSales.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Comisión App + IVA</span>
                <span className="font-bold text-red-400 text-sm">-${(selectedSettlement.platformCommission + selectedSettlement.commissionTax).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Retenciones Fiscales</span>
                <span className="font-bold text-purple-300 text-sm">-${(selectedSettlement.withholdingIsr + selectedSettlement.withholdingIva).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Depósito Recibido</span>
                <span className="font-bold text-emerald-400 text-sm">${selectedSettlement.bankDepositAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Orders list in settlement */}
            <div className="flex-1 overflow-y-auto space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comandas Conciliadas en este Corte:</h4>
              {loadingDetail ? (
                <div className="p-8 text-center text-slate-500">Cargando comandas...</div>
              ) : settlementOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No hay comandas registradas en esta liquidación.</div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] bg-slate-950">
                        <th className="py-2.5 px-3">Ticket DF</th>
                        <th className="py-2.5 px-3">ID App</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3 text-right">Venta Total</th>
                        <th className="py-2.5 px-3 text-right">Comisión</th>
                        <th className="py-2.5 px-3 text-right">Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {settlementOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 text-white font-bold">{o.orderNumber}</td>
                          <td className="py-2 px-3 text-slate-400">{o.externalOrderId || '-'}</td>
                          <td className="py-2 px-3 font-sans text-slate-300">{o.customerName}</td>
                          <td className="py-2 px-3 text-right text-white">${o.total.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-red-400">-${(o.platformCommission || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-emerald-400 font-bold">${(o.netPayout || (o.total - (o.platformCommission || 0))).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: GESTIÓN DE DISPUTA */}
      {disputeModalOpen && editingDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Gestionar Disputa / Reclamo</h3>
                <p className="text-xs text-slate-400">{editingDispute.ticketFolio || 'Sin folio'}</p>
              </div>
              <button
                onClick={() => setDisputeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDispute} className="space-y-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs">
                <p className="text-slate-400">Motivo inicial: <span className="text-white font-medium">{editingDispute.reason}</span></p>
                <p className="text-slate-400">Monto reclamado: <span className="text-red-400 font-bold font-mono">${editingDispute.claimedAmount.toFixed(2)} MXN</span></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Estado de la Disputa</label>
                <select
                  value={disputeStatus}
                  onChange={(e) => setDisputeStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                >
                  <option value="OPEN">Abierto / En revisión interna</option>
                  <option value="SUBMITTED_TO_APP">Enviado a Soporte de la App</option>
                  <option value="RESOLVED_WON">Resuelto / Reembolso Ganado</option>
                  <option value="RESOLVED_LOST">Cerrado / Rechazado por la App</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Monto Recuperado / Reembolsado ($ MXN)</label>
                <input
                  type="number"
                  step="0.01"
                  value={disputeRecovered}
                  onChange={(e) => setDisputeRecovered(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Folio de Ticket de Soporte</label>
                <input
                  type="text"
                  placeholder="UBER-SUPP-19284..."
                  value={disputeTicket}
                  onChange={(e) => setDisputeTicket(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notas de Resolución</label>
                <textarea
                  rows={3}
                  placeholder="Detalles de la llamada con el ejecutivo de cuenta, nota de crédito aplicada, etc."
                  value={disputeNotes}
                  onChange={(e) => setDisputeNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDisputeModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDispute}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/30 flex items-center gap-2"
                >
                  {savingDispute ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Guardar Dictamen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
