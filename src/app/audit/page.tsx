'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Search,
  Filter,
  Download,
  Eye,
  RefreshCw,
  X,
  Clock,
  Terminal,
  Activity,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Lock,
  UserX,
  FileWarning,
  CheckCircle,
  Ban,
  TrendingDown,
  Layers
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  brandId: string | null;
  userId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  brand?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface AuditSummary {
  totalEvents: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

interface SecurityIncidentItem {
  id: string;
  brandId: string;
  orderId?: string | null;
  type: string;
  severity: string;
  description: string;
  amountAtRisk: number;
  userId?: string | null;
  userName?: string | null;
  status: string;
  resolutionNotes?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  metadata?: string | null;
  createdAt: string;
  brand: { id: string; name: string; primaryColor: string };
  order?: {
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    customerName: string;
    prebillPrintedAt?: string | null;
    prebillPrintedCount?: number;
  } | null;
  user?: { id: string; name: string; role: string } | null;
}

interface LossPreventionMetrics {
  totalIncidents: number;
  totalAmountAtRisk: number;
  flaggedCount: number;
  confirmedFraudCount: number;
  postPrebillCount: number;
  excessiveDiscountCount: number;
  riskScore: number;
  riskLevel: 'BAJO' | 'MODERADO' | 'CRÍTICO';
}

export default function AuditPage() {
  const { activeBrand } = useAppStore();
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'loss_prevention' | 'logs'>('loss_prevention');
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AuditSummary>({
    totalEvents: 0,
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
  });

  // Loss Prevention State
  const [incidents, setIncidents] = useState<SecurityIncidentItem[]>([]);
  const [incidentMetrics, setIncidentMetrics] = useState<LossPreventionMetrics>({
    totalIncidents: 0,
    totalAmountAtRisk: 0,
    flaggedCount: 0,
    confirmedFraudCount: 0,
    postPrebillCount: 0,
    excessiveDiscountCount: 0,
    riskScore: 0,
    riskLevel: 'BAJO',
  });
  const [incidentTypeFilter, setIncidentTypeFilter] = useState<string>('ALL');
  const [incidentSeverityFilter, setIncidentSeverityFilter] = useState<string>('ALL');
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<string>('ALL');
  const [selectedIncidentForReview, setSelectedIncidentForReview] = useState<SecurityIncidentItem | null>(null);
  const [adjudicationStatus, setAdjudicationStatus] = useState<'JUSTIFIED' | 'CONFIRMED_FRAUD' | 'UNDER_REVIEW'>('JUSTIFIED');
  const [adjudicationNotes, setAdjudicationNotes] = useState<string>('');
  const [savingAdjudication, setSavingAdjudication] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Filters state
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  // Inspection modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      if (entityFilter !== 'ALL') params.set('entityType', entityFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (activeBrand?.id) params.set('brandId', activeBrand.id);

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, severityFilter, entityFilter, searchTerm, startDate, endDate, activeBrand?.id]);

  const fetchLossPrevention = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (incidentTypeFilter !== 'ALL') params.set('type', incidentTypeFilter);
      if (incidentSeverityFilter !== 'ALL') params.set('severity', incidentSeverityFilter);
      if (incidentStatusFilter !== 'ALL') params.set('status', incidentStatusFilter);
      if (activeBrand?.id) params.set('brandId', activeBrand.id);

      const res = await fetch(`/api/audit/loss-prevention?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
        if (data.metrics) {
          setIncidentMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error('Error fetching loss prevention data:', err);
    } finally {
      setLoading(false);
    }
  }, [incidentTypeFilter, incidentSeverityFilter, incidentStatusFilter, activeBrand?.id]);

  useEffect(() => {
    if (activeTab === 'loss_prevention') {
      fetchLossPrevention();
    } else {
      fetchLogs();
    }
  }, [activeTab, fetchLossPrevention, fetchLogs]);

  // Handle CSV export
  const exportToCSV = () => {
    if (logs.length === 0) return;

    const headers = ['ID', 'Fecha', 'Severidad', 'Accion', 'Entidad', 'Entidad_ID', 'Usuario', 'Rol', 'Marca', 'IP', 'Detalles'];
    const rows = logs.map((log) => [
      log.id,
      new Date(log.createdAt).toLocaleString('es-MX'),
      log.severity,
      log.action,
      log.entityType,
      log.entityId || '',
      log.user ? `${log.user.name} (${log.user.email})` : 'Sistema',
      log.user?.role || 'SYSTEM',
      log.brand?.name || 'Global',
      log.ipAddress || '',
      log.details ? `"${log.details.replace(/"/g, '""')}"` : '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `darkflow-audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportLossPreventionCSV = () => {
    if (incidents.length === 0) return;
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'REPORTE DE PREVENCIÓN DE PÉRDIDAS & AUDITORÍA ANTIFRAUDE - DARKFLOW\n';
    csv += `Fecha:;${new Date().toLocaleDateString('es-MX')};Riesgo Global:;${incidentMetrics.riskScore}/100 (${incidentMetrics.riskLevel});Monto en Riesgo:;$${incidentMetrics.totalAmountAtRisk.toFixed(2)}\n\n`;
    csv += 'ID Incidente;Fecha;Hora;Marca;Orden;Tipo Incidente;Monto en Riesgo;Severidad;Usuario Involucrado;Estado Dictamen;Resolucion\n';

    incidents.forEach((inc) => {
      const d = new Date(inc.createdAt);
      const resNotesClean = (inc.resolutionNotes || '').replace(/"/g, '""');
      const descClean = inc.description.replace(/"/g, '""');
      csv += `"${inc.id}";"${d.toLocaleDateString('es-MX')}";"${d.toLocaleTimeString('es-MX')}";"${inc.brand.name}";"${inc.order?.orderNumber || '-'}";"${inc.type}";${inc.amountAtRisk.toFixed(2)};"${inc.severity}";"${inc.userName || inc.user?.name || '-'}";"${inc.status}";"${resNotesClean || descClean}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `darkflow-antifraude-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveAdjudication = async () => {
    if (!selectedIncidentForReview) return;
    setSavingAdjudication(true);
    try {
      const res = await fetch(`/api/audit/loss-prevention/${selectedIncidentForReview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: adjudicationStatus,
          resolutionNotes: adjudicationNotes,
        }),
      });
      if (res.ok) {
        setSelectedIncidentForReview(null);
        setAdjudicationNotes('');
        fetchLossPrevention();
      } else {
        alert('Error al dictaminar incidente');
      }
    } catch {
      alert('Error de conexión al guardar dictamen');
    } finally {
      setSavingAdjudication(false);
    }
  };

  const getSeverityBadge = (severity: 'INFO' | 'WARNING' | 'CRITICAL') => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950/80 text-red-400 border border-red-800 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            CRÍTICO
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-400 border border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            ADVERTENCIA
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            INFO
          </span>
        );
    }
  };

  const parseLogDetails = (detailsStr: string | null) => {
    if (!detailsStr) return null;
    try {
      return JSON.parse(detailsStr);
    } catch {
      return detailsStr;
    }
  };

  // RBAC guard check
  const isAuthorized = !currentUser || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'BRAND_ADMIN';

  return (
    <DashboardContainer>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  Registro de Auditoría & Seguridad
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                    Inmutable
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Trazabilidad forense de acciones operativas, cambios de rol, aperturas de caja y movimientos críticos.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => (activeTab === 'loss_prevention' ? fetchLossPrevention() : fetchLogs())}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>

            <button
              onClick={activeTab === 'loss_prevention' ? exportLossPreventionCSV : exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-950/40 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Audit Tab Navigation Bar */}
        <div className="flex border-b border-slate-800 gap-3 pb-1">
          <button
            onClick={() => setActiveTab('loss_prevention')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              activeTab === 'loss_prevention'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Prevención de Fugas & Antifraude
            {incidentMetrics.flaggedCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'loss_prevention' ? 'bg-slate-950 text-amber-400' : 'bg-rose-500 text-white animate-pulse'
              }`}>
                {incidentMetrics.flaggedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-brand-primary text-slate-950 border-brand-primary shadow-lg'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Bitácora de Eventos del Sistema
          </button>
        </div>

        {!isAuthorized ? (
          <div className="p-8 bg-red-950/20 border border-red-900/50 rounded-2xl text-center space-y-3">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Acceso Restringido</h2>
            <p className="text-slate-400 max-w-md mx-auto text-sm">
              Esta sección requiere permisos de Super Administrador o Administrador de Marca para inspeccionar registros de seguridad.
            </p>
          </div>
        ) : activeTab === 'loss_prevention' ? (
          /* ============================================================ */
          /* LOSS PREVENTION & ANTI-FRAUD DASHBOARD VIEW                  */
          /* ============================================================ */
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Risk Score */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Índice Antifraude</p>
                  <p className={`text-2xl font-black font-mono mt-0.5 ${
                    incidentMetrics.riskLevel === 'CRÍTICO'
                      ? 'text-rose-400'
                      : incidentMetrics.riskLevel === 'MODERADO'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    {incidentMetrics.riskScore} <span className="text-xs font-medium text-slate-500">/ 100</span>
                  </p>
                  <span className={`inline-block mt-1 text-[9px] font-black px-1.5 py-0.2 rounded ${
                    incidentMetrics.riskLevel === 'CRÍTICO'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : incidentMetrics.riskLevel === 'MODERADO'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}>
                    RIESGO {incidentMetrics.riskLevel}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-amber-400 border border-slate-800">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>

              {/* Amount At Risk */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto en Riesgo</p>
                  <p className="text-2xl font-black font-mono text-rose-400 mt-0.5">
                    ${incidentMetrics.totalAmountAtRisk.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                  <span className="text-[10px] text-slate-500">En cancelaciones/descuentos</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-rose-400 border border-slate-800">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>

              {/* Post Pre-bill Cancellations */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Post Pre-cuenta</p>
                  <p className="text-2xl font-black font-mono text-amber-400 mt-0.5">
                    {incidentMetrics.postPrebillCount}
                  </p>
                  <span className="text-[10px] text-slate-500">Comandas anuladas tras ticket</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-amber-400 border border-slate-800">
                  <FileWarning className="w-5 h-5" />
                </div>
              </div>

              {/* Excessive Discounts */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descuentos &gt; 20%</p>
                  <p className="text-2xl font-black font-mono text-white mt-0.5">
                    {incidentMetrics.excessiveDiscountCount}
                  </p>
                  <span className="text-[10px] text-slate-500">Fuera de política autorizada</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-slate-400 border border-slate-800">
                  <Ban className="w-5 h-5" />
                </div>
              </div>

              {/* Flagged Incidents Pending Review */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Por Dictaminar</p>
                  <p className={`text-2xl font-black font-mono mt-0.5 ${incidentMetrics.flaggedCount > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                    {incidentMetrics.flaggedCount}
                  </p>
                  <span className="text-[10px] text-slate-500">Requieren dictamen gerencial</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-amber-400 border border-slate-800">
                  <Lock className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Sub-Filters for Loss Prevention Feed */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold uppercase text-[11px]">Tipo de Alerta:</span>
                  <select
                    value={incidentTypeFilter}
                    onChange={(e) => setIncidentTypeFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                  >
                    <option value="ALL">⭐ Todos los Tipos</option>
                    <option value="POST_PREBILL_CANCEL">🚨 Cancelación Post Pre-cuenta</option>
                    <option value="REOPEN_SETTLED_ORDER">⚠️ Reapertura de Comanda Pagada</option>
                    <option value="EXCESSIVE_DISCOUNT">💸 Descuento Excesivo / Fuera de Rango</option>
                    <option value="SUSPICIOUS_TRANSFER">🔀 Transferencia Sospechosa</option>
                    <option value="DRAWER_POP_NO_SALE">🔓 Apertura de Cajón sin Venta</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold uppercase text-[11px]">Severidad:</span>
                  <select
                    value={incidentSeverityFilter}
                    onChange={(e) => setIncidentSeverityFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                  >
                    <option value="ALL">Todas las Severidades</option>
                    <option value="CRITICAL">🔴 Crítica</option>
                    <option value="HIGH">🟠 Alta</option>
                    <option value="MEDIUM">🟡 Media</option>
                    <option value="LOW">🔵 Baja</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold uppercase text-[11px]">Estado:</span>
                  <select
                    value={incidentStatusFilter}
                    onChange={(e) => setIncidentStatusFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                  >
                    <option value="ALL">Todos los Estados</option>
                    <option value="FLAGGED">⚠️ Marcado / Pendiente</option>
                    <option value="UNDER_REVIEW">🔍 En Investigación</option>
                    <option value="JUSTIFIED">✓ Justificado</option>
                    <option value="CONFIRMED_FRAUD">🚨 Fraude Confirmado</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Incidents Forensic Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex justify-between items-center">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Bitácora de Incidentes & Eventos de Riesgo Financiero
                </h4>
                <span className="text-xs text-slate-400">{incidents.length} incidentes registrados</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Fecha / Hora</th>
                      <th className="py-3 px-4">Marca</th>
                      <th className="py-3 px-4">Comanda / Folio</th>
                      <th className="py-3 px-4">Tipo de Incidente</th>
                      <th className="py-3 px-4 text-right">Monto en Riesgo</th>
                      <th className="py-3 px-4">Usuario Responsable</th>
                      <th className="py-3 px-4 text-center">Severidad</th>
                      <th className="py-3 px-4 text-center">Dictamen</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {incidents.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          ✓ No se han detectado incidentes de riesgo financiero para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      incidents.map((inc) => {
                        const isPending = inc.status === 'FLAGGED' || inc.status === 'UNDER_REVIEW';
                        const isConfirmedFraud = inc.status === 'CONFIRMED_FRAUD';

                        return (
                          <tr key={inc.id} className="hover:bg-slate-900/70 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-mono text-slate-300 block">
                                {new Date(inc.createdAt).toLocaleDateString('es-MX')}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(inc.createdAt).toLocaleTimeString('es-MX')}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-300">
                              {inc.brand.name}
                            </td>
                            <td className="py-3 px-4">
                              {inc.order ? (
                                <div>
                                  <span className="font-mono font-bold text-white block">#{inc.order.orderNumber}</span>
                                  <span className="text-[10px] text-slate-400">{inc.order.customerName}</span>
                                </div>
                              ) : (
                                <span className="text-slate-500 font-mono">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 max-w-xs">
                              <span className="font-bold text-white block">
                                {inc.type === 'POST_PREBILL_CANCEL' && '🚨 Anulación Post Pre-cuenta'}
                                {inc.type === 'REOPEN_SETTLED_ORDER' && '⚠️ Reapertura de Comanda Cobrada'}
                                {inc.type === 'EXCESSIVE_DISCOUNT' && '💸 Descuento Excesivo'}
                                {inc.type === 'SUSPICIOUS_TRANSFER' && '🔀 Transferencia Sospechosa'}
                                {inc.type === 'DRAWER_POP_NO_SALE' && '🔓 Apertura de Cajón sin Venta'}
                                {inc.type === 'UNAUTHORIZED_VOID' && '❌ Anulación No Autorizada'}
                              </span>
                              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                                {inc.description}
                              </p>
                              {inc.resolutionNotes && (
                                <p className="text-[10px] text-emerald-400 mt-0.5 italic">
                                  Dictamen: &ldquo;{inc.resolutionNotes}&rdquo;
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-rose-400 text-sm">
                              ${inc.amountAtRisk.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              <span className="font-semibold block">{inc.user?.name || inc.userName || 'Sistema'}</span>
                              <span className="text-[10px] text-slate-500 uppercase">{inc.user?.role || 'Operativo'}</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                                inc.severity === 'CRITICAL'
                                  ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                  : inc.severity === 'HIGH'
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}>
                                {inc.severity}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isConfirmedFraud ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-400">
                                  <AlertTriangle className="w-3 h-3" /> FRAUDE CONFIRMADO
                                </span>
                              ) : inc.status === 'JUSTIFIED' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400">
                                  <CheckCircle className="w-3 h-3" /> JUSTIFICADO
                                </span>
                              ) : inc.status === 'UNDER_REVIEW' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-400">
                                  <Clock className="w-3 h-3" /> EN REVISIÓN
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-400 animate-pulse">
                                  <AlertTriangle className="w-3 h-3" /> PENDIENTE
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedIncidentForReview(inc);
                                  setAdjudicationStatus((inc.status as any) || 'JUSTIFIED');
                                  setAdjudicationNotes(inc.resolutionNotes || '');
                                }}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
                              >
                                {isPending ? 'Dictaminar' : 'Editar Dictamen'}
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
          </div>
        ) : (
          /* ============================================================ */
          /* RAW EVENT LOGS VIEW                                          */
          /* ============================================================ */
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Registros</p>
                  <p className="text-2xl font-bold text-white mt-1">{summary.totalEvents.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-slate-400" /> Eventos en bitácora
                  </p>
                </div>
                <div className="p-3 bg-slate-800 rounded-xl text-slate-400 border border-slate-700">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-slate-900 border border-red-900/30 p-5 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Eventos Críticos</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{summary.criticalCount.toLocaleString()}</p>
                  <p className="text-[11px] text-red-500/80 mt-1 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Cancelaciones & Descuadres
                  </p>
                </div>
                <div className="p-3 bg-red-950/50 rounded-xl text-red-400 border border-red-800">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-slate-900 border border-amber-900/30 p-5 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Advertencias</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{summary.warningCount.toLocaleString()}</p>
                  <p className="text-[11px] text-amber-500/80 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Ajustes manuales de stock
                  </p>
                </div>
                <div className="p-3 bg-amber-950/50 rounded-xl text-amber-400 border border-amber-800">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-slate-900 border border-emerald-900/30 p-5 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Informativos</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.infoCount.toLocaleString()}</p>
                  <p className="text-[11px] text-emerald-500/80 mt-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Aperturas & Compras regulares
                  </p>
                </div>
                <div className="p-3 bg-emerald-950/50 rounded-xl text-emerald-400 border border-emerald-800">
                  <Info className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Filter className="w-4 h-4 text-emerald-400" />
                Filtros de Búsqueda
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search Text */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Buscar acción, usuario, IP..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Severity */}
                <div>
                  <select
                    value={severityFilter}
                    onChange={(e) => {
                      setSeverityFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALL">Todas las Severidades</option>
                    <option value="CRITICAL">🔴 Crítico</option>
                    <option value="WARNING">🟡 Advertencia</option>
                    <option value="INFO">🟢 Informativo</option>
                  </select>
                </div>

                {/* Entity Type */}
                <div>
                  <select
                    value={entityFilter}
                    onChange={(e) => {
                      setEntityFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALL">Todas las Entidades</option>
                    <option value="ORDER">Pedidos (ORDER)</option>
                    <option value="CASH_SESSION">Caja (CASH_SESSION)</option>
                    <option value="INGREDIENT">Insumos (INGREDIENT)</option>
                    <option value="PURCHASE">Compras (PURCHASE)</option>
                    <option value="USER">Usuarios (USER)</option>
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* End Date */}
                <div>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Fecha & Hora</th>
                      <th className="px-4 py-3.5">Severidad</th>
                      <th className="px-4 py-3.5">Acción</th>
                      <th className="px-4 py-3.5">Entidad</th>
                      <th className="px-4 py-3.5">Usuario / Actor</th>
                      <th className="px-4 py-3.5">Marca</th>
                      <th className="px-4 py-3.5">IP</th>
                      <th className="px-4 py-3.5 text-right">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                          Cargando registros de auditoría...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                          <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                          No se encontraron eventos de auditoría con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-300 font-mono text-xs">
                            {new Date(log.createdAt).toLocaleString('es-MX', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {getSeverityBadge(log.severity)}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold text-white bg-slate-950 px-2 py-1 rounded border border-slate-800">
                              {log.action}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-slate-400">{log.entityType}</span>
                              {log.entityId && (
                                <span className="font-mono text-[11px] text-slate-500 max-w-[90px] truncate" title={log.entityId}>
                                  #{log.entityId.slice(0, 8)}...
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {log.user ? (
                              <div>
                                <p className="text-xs font-semibold text-white">{log.user.name}</p>
                                <p className="text-[10px] text-slate-400">{log.user.role}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 italic">Sistema</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-400">
                            {log.brand ? log.brand.name : 'Global / N/A'}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] text-slate-400">
                            {log.ipAddress || '127.0.0.1'}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap text-right">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-transparent hover:border-slate-700 transition"
                              title="Inspeccionar detalle completo"
                            >
                              <Eye className="w-4 h-4 text-emerald-400" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
                <p className="text-xs text-slate-400">
                  Mostrando <span className="font-semibold text-white">{logs.length}</span> de{' '}
                  <span className="font-semibold text-white">{total}</span> registros (Página {page} de {totalPages})
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-bold text-white px-2">
                    {page} / {totalPages}
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Inspect Modal */}
            {selectedLog && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                  {/* Modal Header */}
                  <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-800 rounded-lg text-emerald-400">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                          Detalle de Auditoría
                          <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                            {selectedLog.action}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400">ID: {selectedLog.id}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedLog(null)}
                      className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto space-y-6">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                      <div>
                        <p className="text-slate-500 font-semibold mb-0.5">Severidad</p>
                        <div>{getSeverityBadge(selectedLog.severity)}</div>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold mb-0.5">Fecha & Hora</p>
                        <p className="text-white font-mono">{new Date(selectedLog.createdAt).toLocaleString('es-MX')}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold mb-0.5">Actor / Usuario</p>
                        <p className="text-white font-medium">
                          {selectedLog.user ? `${selectedLog.user.name} (${selectedLog.user.role})` : 'Sistema Automático'}
                        </p>
                        {selectedLog.user?.email && (
                          <p className="text-slate-400 text-[11px]">{selectedLog.user.email}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold mb-0.5">Dirección IP</p>
                        <p className="text-white font-mono">{selectedLog.ipAddress || '127.0.0.1'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold mb-0.5">Entidad Afectada</p>
                        <p className="text-white font-mono">{selectedLog.entityType}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold mb-0.5">ID de la Entidad</p>
                        <p className="text-white font-mono break-all">{selectedLog.entityId || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Formatted JSON details */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        Carga Útil / Diferencias (Payload JSON)
                      </h4>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-60">
                        {selectedLog.details ? (
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(parseLogDetails(selectedLog.details), null, 2)}
                          </pre>
                        ) : (
                          <span className="text-slate-500 italic">Sin datos adicionales registrados</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
                    <button
                      onClick={() => setSelectedLog(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Adjudication Modal */}
            {selectedIncidentForReview && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">Dictamen de Incidente Antifraude</h3>
                        <p className="text-xs text-slate-400">
                          {selectedIncidentForReview.brand.name} • {selectedIncidentForReview.order ? `Orden #${selectedIncidentForReview.order.orderNumber}` : 'Operación General'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedIncidentForReview(null)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tipo:</span>
                      <span className="font-bold text-white">{selectedIncidentForReview.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Monto Involucrado:</span>
                      <span className="font-mono font-bold text-rose-400 text-sm">
                        ${selectedIncidentForReview.amountAtRisk.toFixed(2)} MXN
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Usuario Responsable:</span>
                      <span className="text-slate-200">
                        {selectedIncidentForReview.user?.name || selectedIncidentForReview.userName || 'No especificado'}
                      </span>
                    </div>
                    <div className="pt-1 border-t border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Descripción del Suceso:</span>
                      <p className="text-slate-300 italic mt-0.5">&ldquo;{selectedIncidentForReview.description}&rdquo;</p>
                    </div>
                  </div>

                  {/* Adjudication Decision Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Resolución del Dictamen:</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjudicationStatus('JUSTIFIED')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                          adjudicationStatus === 'JUSTIFIED'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        ✓ Justificado
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdjudicationStatus('UNDER_REVIEW')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                          adjudicationStatus === 'UNDER_REVIEW'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        🔍 En Revisión
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdjudicationStatus('CONFIRMED_FRAUD')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                          adjudicationStatus === 'CONFIRMED_FRAUD'
                            ? 'bg-rose-500 text-white border-rose-400 shadow'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        🚨 Fraude
                      </button>
                    </div>
                  </div>

                  {/* Resolution Notes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">
                      Notas de Dictamen & Acciones Tomadas:
                    </label>
                    <textarea
                      value={adjudicationNotes}
                      onChange={(e) => setAdjudicationNotes(e.target.value)}
                      placeholder="Ejemplo: Se revisaron cámaras de seguridad; el comensal devolvió el platillo por enfriamiento y el capitán autorizó la baja."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSaveAdjudication}
                      disabled={savingAdjudication}
                      className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {savingAdjudication ? 'Guardando...' : 'Aplicar Dictamen'}
                    </button>
                    <button
                      onClick={() => setSelectedIncidentForReview(null)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardContainer>
  );
}
