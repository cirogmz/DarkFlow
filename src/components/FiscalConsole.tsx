'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Globe, 
  FileText, 
  RefreshCw, 
  Check, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Zap, 
  QrCode, 
  ExternalLink, 
  Copy, 
  Download, 
  XCircle, 
  Search, 
  Filter, 
  ShieldAlert, 
  Calendar, 
  FileCode,
  DollarSign
} from 'lucide-react';
import { 
  TAX_REGIMES, 
  GLOBAL_PERIODICITIES, 
  GLOBAL_MONTHS, 
  CANCELLATION_REASONS, 
  RFC_GENERICO_NACIONAL 
} from '@/lib/cfdi';

interface EligibleOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  subtotal: number;
  tax: number;
  paymentMethod: string | null;
  createdAt: string;
}

interface InvoiceListItem {
  id: string;
  uuid: string;
  folio: number;
  serie: string;
  isGlobal: boolean;
  globalPeriodicity?: string | null;
  globalMonth?: string | null;
  globalYear?: number | null;
  rfcReceptor: string;
  nombreReceptor: string;
  subtotal: number;
  iva: number;
  total: number;
  status: string; // 'TIMBRADO', 'CANCELADO'
  cancellationReason?: string | null;
  replacementUuid?: string | null;
  cancellationDate?: string | null;
  createdAt: string;
  order?: {
    id: string;
    orderNumber: string;
    total: number;
    customerName: string;
  } | null;
  _count?: {
    globalOrders: number;
  };
}

interface FiscalConsoleProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeBrand: any;
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onConfigUpdated?: () => void;
}

export default function FiscalConsole({ activeBrand, addNotification, onConfigUpdated }: FiscalConsoleProps) {
  const [subTab, setSubTab] = useState<'CONFIG' | 'GLOBAL' | 'HISTORY'>('GLOBAL');

  // ==========================================
  // 1. CONFIGURATION STATE
  // ==========================================
  const [invoicingRfc, setInvoicingRfc] = useState('');
  const [invoicingLegalName, setInvoicingLegalName] = useState('');
  const [invoicingTaxRegime, setInvoicingTaxRegime] = useState('601');
  const [invoicingPostalCode, setInvoicingPostalCode] = useState('');
  const [invoicingSeries, setInvoicingSeries] = useState('FAC');
  const [invoicingNextFolio, setInvoicingNextFolio] = useState(1);
  const [invoicingPacEnvironment, setInvoicingPacEnvironment] = useState<'SANDBOX' | 'PRODUCTION'>('SANDBOX');
  const [invoicingCount, setInvoicingCount] = useState(0);
  const [savingConfig, setSavingConfig] = useState(false);
  const [copiedPortalUrl, setCopiedPortalUrl] = useState(false);

  // ==========================================
  // 2. GLOBAL INVOICING STATE
  // ==========================================
  const [eligibleOrders, setEligibleOrders] = useState<EligibleOrder[]>([]);
  const [eligibleSummary, setEligibleSummary] = useState({ count: 0, subtotal: 0, tax: 0, total: 0 });
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [globalPeriodicity, setGlobalPeriodicity] = useState('01'); // 01=Diario
  const [globalMonth, setGlobalMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [globalYear, setGlobalYear] = useState(new Date().getFullYear());
  const [globalStartDate, setGlobalStartDate] = useState('');
  const [globalEndDate, setGlobalEndDate] = useState('');
  const [generatingGlobal, setGeneratingGlobal] = useState(false);
  const [recentGlobalInvoices, setRecentGlobalInvoices] = useState<InvoiceListItem[]>([]);

  // ==========================================
  // 3. INVOICES HISTORY & CANCELLATIONS STATE
  // ==========================================
  const [invoicesList, setInvoicesList] = useState<InvoiceListItem[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GLOBAL' | 'INDIVIDUAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'TIMBRADO' | 'CANCELADO'>('ALL');
  const [cancellingInvoice, setCancellingInvoice] = useState<InvoiceListItem | null>(null);
  const [cancellationReason, setCancellationReason] = useState('02');
  const [replacementUuid, setReplacementUuid] = useState('');
  const [processingCancellation, setProcessingCancellation] = useState(false);

  // Load configuration from API
  const loadConfig = useCallback(async () => {
    if (!activeBrand?.id) return;
    try {
      const res = await fetch(`/api/integrations/invoicing?brandId=${activeBrand.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setInvoicingRfc(data.config.rfc || '');
          setInvoicingLegalName(data.config.legalName || '');
          setInvoicingTaxRegime(data.config.taxRegime || '601');
          setInvoicingPostalCode(data.config.postalCode || '');
          setInvoicingSeries(data.config.invoiceSeries || 'FAC');
          setInvoicingNextFolio(data.config.invoiceNextFolio || 1);
          setInvoicingPacEnvironment(data.config.pacEnvironment || 'SANDBOX');
          setInvoicingCount(data.config.invoiceCount || 0);
        }
      }
    } catch (err) {
      console.error('Error loading invoicing config', err);
    }
  }, [activeBrand?.id]);

  // Load preview of eligible unbilled orders for global invoicing
  const loadGlobalPreview = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoadingEligible(true);
    try {
      const params = new URLSearchParams();
      if (globalStartDate) params.set('startDate', globalStartDate);
      if (globalEndDate) params.set('endDate', globalEndDate);

      const res = await fetch(`/api/invoices/global?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const orders = data.eligibleOrders || [];
        setEligibleOrders(orders);
        setEligibleSummary(data.summary || { count: 0, subtotal: 0, tax: 0, total: 0 });
        setSelectedOrderIds(orders.map((o: EligibleOrder) => o.id)); // Default select all
        setRecentGlobalInvoices(data.recentGlobalInvoices || []);
      }
    } catch (err) {
      console.error('Error fetching global invoice preview', err);
      addNotification('Error al consultar comandas elegibles', 'error');
    } finally {
      setLoadingEligible(false);
    }
  }, [activeBrand?.id, globalStartDate, globalEndDate, addNotification]);

  // Load full invoices list with filters
  const loadInvoicesList = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoadingInvoices(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInvoicesList(data.invoices || []);
      }
    } catch (err) {
      console.error('Error fetching invoices list', err);
      addNotification('Error al consultar facturas', 'error');
    } finally {
      setLoadingInvoices(false);
    }
  }, [activeBrand?.id, searchQuery, typeFilter, statusFilter, addNotification]);

  // Effects
  useEffect(() => {
    loadConfig();
    loadGlobalPreview();
  }, [loadConfig, loadGlobalPreview]);

  useEffect(() => {
    if (subTab === 'HISTORY') {
      loadInvoicesList();
    }
  }, [subTab, loadInvoicesList]);

  // Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBrand?.id) return;
    setSavingConfig(true);
    try {
      const res = await fetch('/api/integrations/invoicing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrand.id,
          rfc: invoicingRfc.trim().toUpperCase(),
          legalName: invoicingLegalName.trim().toUpperCase(),
          taxRegime: invoicingTaxRegime,
          postalCode: invoicingPostalCode.trim(),
          invoiceSeries: invoicingSeries.trim().toUpperCase(),
          invoiceNextFolio: Number(invoicingNextFolio),
          pacEnvironment: invoicingPacEnvironment,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification('Configuración fiscal CFDI 4.0 guardada correctamente', 'success');
        loadConfig();
        if (onConfigUpdated) onConfigUpdated();
      } else {
        addNotification(data.error || 'Error al guardar configuración fiscal', 'error');
      }
    } catch {
      addNotification('Error de conexión al guardar configuración fiscal', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Stamp Global Invoice
  const handleGenerateGlobalInvoice = async () => {
    if (!activeBrand?.id) return;
    if (selectedOrderIds.length === 0) {
      addNotification('Selecciona al menos una comanda para incluir en la Factura Global', 'warning');
      return;
    }

    if (!invoicingRfc || !invoicingLegalName || !invoicingPostalCode) {
      addNotification('Configura primero los datos fiscales del emisor (RFC, Razón Social, CP)', 'warning');
      setSubTab('CONFIG');
      return;
    }

    const confirmMsg = `¿Deseas emitir y timbrar la Factura Global CFDI 4.0 con ${selectedOrderIds.length} comandas por un total de $${eligibleSummary.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN?`;
    if (!confirm(confirmMsg)) return;

    setGeneratingGlobal(true);
    try {
      const res = await fetch('/api/invoices/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodicity: globalPeriodicity,
          month: globalMonth,
          year: globalYear,
          orderIds: selectedOrderIds,
          startDate: globalStartDate || undefined,
          endDate: globalEndDate || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addNotification(`¡Factura Global timbrada con éxito! Folio: ${data.invoice.serie}-${data.invoice.folio} (${data.consolidatedCount} tickets consolidados)`, 'success');
        loadGlobalPreview();
        loadConfig();
        setSubTab('HISTORY');
      } else {
        addNotification(data.error || 'Error al emitir factura global', 'error');
      }
    } catch {
      addNotification('Error de conexión al timbrar factura global', 'error');
    } finally {
      setGeneratingGlobal(false);
    }
  };

  // Cancel Invoice with SAT Acuse
  const handleConfirmCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingInvoice) return;

    if (cancellationReason === '01' && !replacementUuid.trim()) {
      addNotification('Para el motivo 01, ingresa el UUID de la factura que la sustituye', 'warning');
      return;
    }

    setProcessingCancellation(true);
    try {
      const res = await fetch(`/api/invoices/${cancellingInvoice.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo: cancellationReason,
          replacementUuid: replacementUuid.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addNotification('Factura cancelada exitosamente ante el SAT con Acuse digital generado', 'success');
        setCancellingInvoice(null);
        setReplacementUuid('');
        loadInvoicesList();
        loadGlobalPreview();
      } else {
        addNotification(data.error || 'Error al cancelar factura ante el SAT', 'error');
      }
    } catch {
      addNotification('Error de conexión al procesar la cancelación fiscal', 'error');
    } finally {
      setProcessingCancellation(false);
    }
  };

  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/facturacion`
    : 'https://darkflow.app/facturacion';

  const handleCopyPortal = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedPortalUrl(true);
    addNotification('URL copiada al portapapeles', 'info');
    setTimeout(() => setCopiedPortalUrl(false), 2000);
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === eligibleOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(eligibleOrders.map((o) => o.id));
    }
  };

  const toggleSelectOrder = (id: string) => {
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(selectedOrderIds.filter((item) => item !== id));
    } else {
      setSelectedOrderIds([...selectedOrderIds, id]);
    }
  };

  // Filter calculation for selected orders
  const selectedSubtotal = eligibleOrders
    .filter((o) => selectedOrderIds.includes(o.id))
    .reduce((sum, o) => sum + o.subtotal, 0);
  const selectedTax = eligibleOrders
    .filter((o) => selectedOrderIds.includes(o.id))
    .reduce((sum, o) => sum + o.tax, 0);
  const selectedTotal = eligibleOrders
    .filter((o) => selectedOrderIds.includes(o.id))
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6">
      {/* Fiscal Console Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('GLOBAL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              subTab === 'GLOBAL'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Cierre & Factura Global (Público en General)
            {eligibleOrders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-950 text-purple-300 font-mono text-[10px] border border-purple-800">
                {eligibleOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('HISTORY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              subTab === 'HISTORY'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Bitácora de CFDIs & Cancelaciones SAT
          </button>

          <button
            type="button"
            onClick={() => setSubTab('CONFIG')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              subTab === 'CONFIG'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Configuración del Emisor SAT
          </button>
        </div>

        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
          invoicingPacEnvironment === 'PRODUCTION'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          {invoicingPacEnvironment === 'PRODUCTION' ? 'PAC: Producción SAT' : 'PAC: Modo Sandbox'}
        </span>
      </div>

      {/* ============================================================ */}
      {/* SUB-TAB 1: GLOBAL INVOICE (CIERRE DIARIO / FIN DE MES)        */}
      {/* ============================================================ */}
      {subTab === 'GLOBAL' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-400" />
                Facturación Global de Ventas al Público en General (CFDI 4.0)
              </h3>
              <p className="text-xs text-slate-400 max-w-2xl">
                Consolida automáticamente todos los tickets y comandas cobradas del día o periodo que no fueron facturadas individualmente por comensales, emitiendo el comprobante oficial con RFC genérico <span className="font-mono text-purple-300 font-bold">{RFC_GENERICO_NACIONAL}</span> bajo la Regla 2.7.1.21 de la RMF del SAT.
              </p>
            </div>
            <button
              onClick={loadGlobalPreview}
              disabled={loadingEligible}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingEligible ? 'animate-spin' : ''}`} />
              Actualizar Comandas
            </button>
          </div>

          {/* 4 Financial KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tickets Sin Facturar</p>
                <p className="text-2xl font-black font-mono text-white mt-0.5">
                  {eligibleSummary.count} <span className="text-xs text-slate-500 font-normal">comandas</span>
                </p>
                <span className="text-[10px] text-slate-500">Cobradas y sin CFDI individual</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl text-purple-400 border border-slate-800">
                <FileCode className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subtotal a Consolidar</p>
                <p className="text-2xl font-black font-mono text-purple-300 mt-0.5">
                  ${eligibleSummary.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-slate-500">Base gravable de impuestos</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl text-purple-400 border border-slate-800">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IVA Trasladado (16%)</p>
                <p className="text-2xl font-black font-mono text-indigo-300 mt-0.5">
                  ${eligibleSummary.tax.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-slate-500">Impuesto fiscal acumulado</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl text-indigo-400 border border-slate-800">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Factura Global</p>
                <p className="text-2xl font-black font-mono text-emerald-400 mt-0.5">
                  ${eligibleSummary.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-slate-500">Monto total a timbrar en el SAT</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl text-emerald-400 border border-slate-800">
                <Zap className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Period Configuration & Filters */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              Parámetros de la Factura Global SAT
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Periodicidad SAT *
                </label>
                <select
                  value={globalPeriodicity}
                  onChange={(e) => setGlobalPeriodicity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-purple-500"
                >
                  {GLOBAL_PERIODICITIES.map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Mes del Ejercicio *
                </label>
                <select
                  value={globalMonth}
                  onChange={(e) => setGlobalMonth(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-purple-500"
                >
                  {GLOBAL_MONTHS.map((m) => (
                    <option key={m.code} value={m.code}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Año *
                </label>
                <input
                  type="number"
                  value={globalYear}
                  onChange={(e) => setGlobalYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Fecha Inicial (Opcional)
                </label>
                <input
                  type="date"
                  value={globalStartDate}
                  onChange={(e) => setGlobalStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Fecha Final (Opcional)
                </label>
                <input
                  type="date"
                  value={globalEndDate}
                  onChange={(e) => setGlobalEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Eligible Tickets Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-0">
            <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition cursor-pointer"
                >
                  {selectedOrderIds.length === eligibleOrders.length ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
                </button>
                <span className="text-xs text-slate-400">
                  {selectedOrderIds.length} de {eligibleOrders.length} comandas seleccionadas para consolidar
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold text-slate-400 mr-2">Total Seleccionado:</span>
                <span className="font-mono font-black text-sm text-emerald-400">
                  ${selectedTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                </span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">Sel</th>
                    <th className="py-2.5 px-3">Folio Comanda</th>
                    <th className="py-2.5 px-3">Fecha & Hora</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Método Pago</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                    <th className="py-2.5 px-3 text-right">IVA</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {loadingEligible ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
                        Cargando comandas pendientes de facturar...
                      </td>
                    </tr>
                  ) : eligibleOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-300">¡Todo al día!</p>
                        <p className="text-xs text-slate-500 mt-0.5">No hay comandas pendientes de facturación global en este periodo.</p>
                      </td>
                    </tr>
                  ) : (
                    eligibleOrders.map((o) => {
                      const isSelected = selectedOrderIds.includes(o.id);
                      return (
                        <tr
                          key={o.id}
                          onClick={() => toggleSelectOrder(o.id)}
                          className={`hover:bg-slate-800/40 transition cursor-pointer ${
                            isSelected ? 'bg-purple-950/15' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOrder(o.id)}
                              className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 bg-slate-900 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-white">{o.orderNumber}</td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {new Date(o.createdAt).toLocaleString('es-MX', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 max-w-[140px] truncate">{o.customerName}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {o.paymentMethod || 'EFECTIVO'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">${o.subtotal.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">${o.tax.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">${o.total.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Action Bar */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                Se timbrará 1 concepto por cada comanda con Clave SAT <span className="font-mono text-purple-300">01010101</span> y unidad <span className="font-mono text-purple-300">ACT</span>.
              </div>

              <button
                type="button"
                onClick={handleGenerateGlobalInvoice}
                disabled={generatingGlobal || selectedOrderIds.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl text-sm shadow-xl shadow-purple-600/30 flex items-center gap-2 transition cursor-pointer"
              >
                {generatingGlobal ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {generatingGlobal
                  ? 'Timbrando Factura Global...'
                  : `Emitir Factura Global (${selectedOrderIds.length} tickets - $${selectedTotal.toFixed(2)} MXN)`}
              </button>
            </div>
          </div>

          {/* Recent Global Invoices Feed */}
          {recentGlobalInvoices.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Historial de Facturas Globales Emitidas Recientemente
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentGlobalInvoices.map((inv) => (
                  <div key={inv.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white text-xs">
                        {inv.serie}-{inv.folio}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        inv.status === 'TIMBRADO'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{inv._count?.globalOrders || 0} tickets consolidados</span>
                      <span className="font-mono font-bold text-emerald-400">${inv.total.toFixed(2)} MXN</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">
                      UUID: {inv.uuid}
                    </div>
                    <div className="pt-1 flex items-center gap-2">
                      <a
                        href={`/api/invoices/${inv.id}?format=xml`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded text-center transition"
                      >
                        Descargar XML
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 2: INVOICES HISTORY & SAT CANCELLATIONS               */}
      {/* ============================================================ */}
      {subTab === 'HISTORY' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por UUID, RFC, receptor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Tipo:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                >
                  <option value="ALL">Todas las Facturas</option>
                  <option value="GLOBAL">🌐 Facturas Globales</option>
                  <option value="INDIVIDUAL">📄 Facturas Individuales</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Estado:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="TIMBRADO">🟢 Timbradas (Activas)</option>
                  <option value="CANCELADO">🔴 Canceladas ante SAT</option>
                </select>
              </div>

              <button
                onClick={loadInvoicesList}
                disabled={loadingInvoices}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingInvoices ? 'animate-spin' : ''}`} />
                Refrescar
              </button>
            </div>
          </div>

          {/* Invoices List Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Folio Fiscal</th>
                    <th className="py-3 px-4">Tipo Comprobante</th>
                    <th className="py-3 px-4">Receptor Fiscal</th>
                    <th className="py-3 px-4">Fecha Timbrado</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Estado SAT</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {loadingInvoices ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
                        Consultando historial de facturación...
                      </td>
                    </tr>
                  ) : invoicesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-300">No se encontraron facturas</p>
                        <p className="text-xs text-slate-500 mt-0.5">Genera tu primera Factura Global o timbre facturas individuales.</p>
                      </td>
                    </tr>
                  ) : (
                    invoicesList.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <p className="font-mono font-bold text-white text-xs">{inv.serie}-{inv.folio}</p>
                          <p className="font-mono text-[10px] text-purple-400 truncate max-w-[160px]" title={inv.uuid}>
                            {inv.uuid}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          {inv.isGlobal ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                              <Globe className="w-3 h-3" />
                              Global ({inv._count?.globalOrders || 0} tickets)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              <FileText className="w-3 h-3" />
                              Individual ({inv.order?.orderNumber || 'Ticket'})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-mono font-bold text-slate-200">{inv.rfcReceptor}</p>
                          <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{inv.nombreReceptor}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-xs">
                          {new Date(inv.createdAt).toLocaleString('es-MX', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-xs">
                          ${inv.total.toFixed(2)} MXN
                        </td>
                        <td className="py-3 px-4 text-center">
                          {inv.status === 'TIMBRADO' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> TIMBRADO
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                              <XCircle className="w-3 h-3" /> CANCELADO SAT
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={`/api/invoices/${inv.id}?format=xml`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1"
                              title="Descargar XML CFDI 4.0"
                            >
                              <Download className="w-3 h-3 text-purple-400" /> XML
                            </a>

                            {inv.status === 'CANCELADO' ? (
                              <a
                                href={`/api/invoices/${inv.id}?format=acuse`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-semibold rounded-lg border border-rose-800 transition flex items-center gap-1"
                                title="Descargar Acuse de Cancelación SAT"
                              >
                                <Download className="w-3 h-3 text-rose-400" /> Acuse SAT
                              </a>
                            ) : (
                              <button
                                onClick={() => {
                                  setCancellingInvoice(inv);
                                  setCancellationReason('02');
                                  setReplacementUuid('');
                                }}
                                className="px-2.5 py-1 bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 text-xs font-semibold rounded-lg border border-rose-900/50 transition flex items-center gap-1 cursor-pointer"
                                title="Cancelar comprobante ante el SAT"
                              >
                                <XCircle className="w-3 h-3" /> Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cancellation Modal */}
          {cancellingInvoice && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-rose-950 text-rose-400 rounded-xl border border-rose-800">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Cancelación Fiscal ante el SAT</h3>
                      <p className="text-xs text-slate-400">Folio: {cancellingInvoice.serie}-{cancellingInvoice.folio}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCancellingInvoice(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
                  <p className="text-slate-400"><span className="text-slate-500 font-bold">UUID:</span> <span className="font-mono text-white">{cancellingInvoice.uuid}</span></p>
                  <p className="text-slate-400"><span className="text-slate-500 font-bold">Total:</span> <span className="font-mono text-emerald-400 font-bold">${cancellingInvoice.total.toFixed(2)} MXN</span></p>
                  <p className="text-slate-400"><span className="text-slate-500 font-bold">Tipo:</span> {cancellingInvoice.isGlobal ? 'Factura Global (liberará los tickets consolidados)' : 'Factura Individual'}</p>
                </div>

                <form onSubmit={handleConfirmCancellation} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1.5">
                      Motivo de Cancelación (Catálogo Oficial SAT) *
                    </label>
                    <select
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-semibold focus:outline-none focus:border-rose-500"
                    >
                      {CANCELLATION_REASONS.map((r) => (
                        <option key={r.code} value={r.code}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  {cancellationReason === '01' && (
                    <div>
                      <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1.5">
                        Folio Fiscal que Sustituye (UUID Nuevo) *
                      </label>
                      <input
                        type="text"
                        value={replacementUuid}
                        onChange={(e) => setReplacementUuid(e.target.value.toUpperCase())}
                        placeholder="Ej: 4A7B2C1D-89EF-4A0B-9C1D-123456789ABC"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-rose-500"
                        required
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Obligatorio por el SAT para motivo 01.</p>
                    </div>
                  )}

                  <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl text-[11px] text-amber-300 leading-relaxed flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      Esta acción emitirá un <strong>Acuse de Cancelación de CFDI</strong> oficial firmado digitalmente. Si se cancela una Factura Global, las comandas asociadas quedarán liberadas automáticamente para ser re-facturadas en el siguiente periodo.
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCancellingInvoice(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition cursor-pointer"
                    >
                      Cerrar
                    </button>
                    <button
                      type="submit"
                      disabled={processingCancellation}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {processingCancellation ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      {processingCancellation ? 'Cancelando ante SAT...' : 'Confirmar Cancelación'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 3: ISSUER FISCAL CONFIGURATION (EMISOR SAT)          */}
      {/* ============================================================ */}
      {subTab === 'CONFIG' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Configuration Form */}
          <div className="lg:col-span-2 space-y-5">
            <form onSubmit={handleSaveConfig} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Datos Fiscales del Emisor</h3>
                    <p className="text-xs text-slate-400">Requerido por el SAT según la Reforma Fiscal CFDI versión 4.0</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    RFC del Contribuyente *
                  </label>
                  <input
                    type="text"
                    value={invoicingRfc}
                    onChange={(e) => setInvoicingRfc(e.target.value.toUpperCase())}
                    placeholder="Ej: DFL230518AA1"
                    maxLength={13}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">12 caracteres para Morales, 13 para Físicas</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Razón Social Oficial *
                  </label>
                  <input
                    type="text"
                    value={invoicingLegalName}
                    onChange={(e) => setInvoicingLegalName(e.target.value.toUpperCase())}
                    placeholder="Ej: RESTAURANTES DEL NORTE SA DE CV"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Nombre registrado tal como aparece en la Constancia Fiscal</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Régimen Fiscal (Catálogo SAT) *
                  </label>
                  <select
                    value={invoicingTaxRegime}
                    onChange={(e) => setInvoicingTaxRegime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    {TAX_REGIMES.map((reg) => (
                      <option key={reg.code} value={reg.code}>{reg.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Lugar de Expedición (Código Postal) *
                  </label>
                  <input
                    type="text"
                    value={invoicingPostalCode}
                    onChange={(e) => setInvoicingPostalCode(e.target.value.trim())}
                    placeholder="Ej: 06700"
                    maxLength={5}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Serie
                    </label>
                    <input
                      type="text"
                      value={invoicingSeries}
                      onChange={(e) => setInvoicingSeries(e.target.value.toUpperCase())}
                      maxLength={5}
                      placeholder="FAC"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Próximo Folio
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={invoicingNextFolio}
                      onChange={(e) => setInvoicingNextFolio(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500 text-center"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 pt-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Ambiente de Timbrado PAC
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setInvoicingPacEnvironment('SANDBOX')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        invoicingPacEnvironment === 'SANDBOX'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Zap className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                      <div>
                        <p className="text-sm font-bold">Modo Sandbox (Pruebas)</p>
                        <p className="text-xs text-slate-400 mt-0.5">Genera timbres y sellos de prueba sin efectos fiscales reales</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInvoicingPacEnvironment('PRODUCTION')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        invoicingPacEnvironment === 'PRODUCTION'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                      <div>
                        <p className="text-sm font-bold">Modo Producción (SAT Real)</p>
                        <p className="text-xs text-slate-400 mt-0.5">Envía el CFDI 4.0 al PAC certificado para timbrado fiscal</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-purple-600/20 flex items-center gap-2 transition cursor-pointer"
                >
                  {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {savingConfig ? 'Guardando...' : 'Guardar Configuración Fiscal'}
                </button>
              </div>
            </form>
          </div>

          {/* Right: Portal and Status cards */}
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Portal de Auto-Facturación</h4>
                  <p className="text-[11px] text-slate-400">Acceso público para comensales</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Tus comensales pueden facturar sus tickets en menos de 1 minuto desde cualquier dispositivo. El enlace se imprime automáticamente al pie de los tickets térmicos.
              </p>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-purple-300 truncate">{portalUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyPortal}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedPortalUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedPortalUrl ? 'Copiado' : 'Copiar'}
                </button>
              </div>

              <a
                href="/facturacion"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir Portal de Clientes
              </a>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
                Estado del Módulo Fiscal
              </h4>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                  <span className="text-slate-400">Facturas Timbradas</span>
                  <span className="font-mono font-bold text-purple-400">{invoicingCount} CFDIs</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                  <span className="text-slate-400">Versión CFDI</span>
                  <span className="font-mono font-bold text-white">4.0 (Anexo 20 SAT)</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                  <span className="text-slate-400">Formato de Sello</span>
                  <span className="font-mono text-slate-300">SHA256withRSA</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                  <span className="text-slate-400">Complementos</span>
                  <span className="font-mono text-emerald-400">tfd:TimbreFiscalDigital 1.1</span>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  💡 Cumple con los requisitos del SAT para restaurantes, dark kitchens y servicios de comida para llevar.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
