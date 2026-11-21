'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Award,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Printer,
  Plus,
  RefreshCw,
  Search,
  Filter,
  FileText,
  ShieldAlert,
  ChevronRight,
  Package,
  Layers,
  HelpCircle,
  Eye,
  AlertOctagon
} from 'lucide-react';

interface SupplierScorecard {
  id: string;
  name: string;
  code?: string | null;
  overallScore: number;
  ratingTier: 'A' | 'B' | 'C' | 'D';
  totalOrdersDelivered: number;
  onTimeDeliveries: number;
  inFullDeliveries: number;
  otifDeliveries: number;
  otifRatePct: number;
  avgPriceVariancePct: number;
  _count: {
    purchaseOrders: number;
    incidents: number;
    batches: number;
  };
  incidents: Array<{
    id: string;
    severity: string;
    incidentType: string;
    resolution: string;
    financialImpact: number;
    createdAt: string;
  }>;
}

interface ScorecardKpis {
  totalSuppliers: number;
  totalOrdersDelivered: number;
  globalOtifRatePct: number;
  onTimeRatePct: number;
  inFullRatePct: number;
  globalAvgPriceVariancePct: number;
  totalIncidentsCount: number;
  tierBreakdown: { A: number; B: number; C: number; D: number };
}

interface PurchaseOrderAudit {
  id: string;
  folio: string;
  status: string;
  expectedDate?: string | null;
  receivedDate?: string | null;
  isOnTime?: boolean | null;
  isInFull?: boolean | null;
  isOtif?: boolean | null;
  delayDays?: number | null;
  fulfillmentRatePct?: number | null;
  priceVarianceAmount?: number | null;
  priceVariancePct?: number | null;
  qualityScore?: number | null;
  total: number;
  items: Array<{
    id: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number;
    billedUnitCost?: number | null;
    priceVariance?: number | null;
    priceVariancePct?: number | null;
    rejectedQuantity?: number | null;
    rejectionReason?: string | null;
    ingredient: {
      name: string;
      unit: string;
    };
  }>;
}

interface SupplierIncident {
  id: string;
  incidentType: string;
  severity: string;
  description: string;
  quantityAffected?: number | null;
  financialImpact?: number | null;
  resolution?: string | null;
  reportedByName?: string | null;
  createdAt: string;
  purchaseOrder?: {
    folio: string;
  } | null;
}

export default function VendorScorecardTab() {
  const [suppliers, setSuppliers] = useState<SupplierScorecard[]>([]);
  const [kpis, setKpis] = useState<ScorecardKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');

  // Audit Detail Modal
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<SupplierScorecard | null>(null);
  const [historicalOrders, setHistoricalOrders] = useState<PurchaseOrderAudit[]>([]);
  const [detailIncidents, setDetailIncidents] = useState<SupplierIncident[]>([]);
  const [detailTab, setDetailTab] = useState<'orders' | 'incidents'>('orders');
  const [detailLoading, setDetailLoading] = useState(false);

  // New Incident Modal
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [targetSupplierForIncident, setTargetSupplierForIncident] = useState<SupplierScorecard | null>(null);
  const [incidentForm, setIncidentForm] = useState({
    incidentType: 'DAMAGED_GOODS',
    severity: 'MEDIUM',
    description: '',
    quantityAffected: 0,
    financialImpact: 0,
    resolution: 'PENDING',
    purchaseOrderId: '',
  });
  const [submittingIncident, setSubmittingIncident] = useState(false);

  // Printable Ticket Modal
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [ticketContent, setTicketContent] = useState<string>('');
  const [printLoading, setPrintLoading] = useState(false);

  const fetchScorecard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/inventory/suppliers/scorecard');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
        setKpis(data.kpis || null);
      }
    } catch (err) {
      console.error('Error fetching scorecards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScorecard();
  }, [fetchScorecard]);

  // Load Supplier Audit Details
  const openSupplierAudit = async (sup: SupplierScorecard) => {
    setSelectedSupplierId(sup.id);
    setDetailSupplier(sup);
    setDetailTab('orders');
    try {
      setDetailLoading(true);
      const [scorecardRes, incidentsRes] = await Promise.all([
        fetch(`/api/inventory/suppliers/${sup.id}/scorecard`),
        fetch(`/api/inventory/suppliers/${sup.id}/incidents`),
      ]);

      if (scorecardRes.ok) {
        const data = await scorecardRes.json();
        setHistoricalOrders(data.purchaseOrders || []);
      }
      if (incidentsRes.ok) {
        const incData = await incidentsRes.json();
        setDetailIncidents(incData.incidents || []);
      }
    } catch (err) {
      console.error('Error loading supplier audit:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Incident Modal
  const openIncidentModal = (sup: SupplierScorecard) => {
    setTargetSupplierForIncident(sup);
    setIncidentForm({
      incidentType: 'DAMAGED_GOODS',
      severity: 'MEDIUM',
      description: '',
      quantityAffected: 0,
      financialImpact: 0,
      resolution: 'PENDING',
      purchaseOrderId: '',
    });
    setIncidentModalOpen(true);
  };

  // Submit Incident
  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSupplierForIncident || !incidentForm.description.trim()) return;

    try {
      setSubmittingIncident(true);
      const res = await fetch(`/api/inventory/suppliers/${targetSupplierForIncident.id}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentForm),
      });

      if (res.ok) {
        setIncidentModalOpen(false);
        fetchScorecard();
        if (selectedSupplierId === targetSupplierForIncident.id) {
          openSupplierAudit(targetSupplierForIncident);
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Error al guardar la incidencia');
      }
    } catch (err) {
      console.error('Error submitting incident:', err);
      alert('Error de conexión');
    } finally {
      setSubmittingIncident(false);
    }
  };

  // Open Ticket Print Modal
  const openPrintTicket = async (supId: string) => {
    try {
      setPrintLoading(true);
      setPrintModalOpen(true);
      setTicketContent('Cargando ticket de auditoría...');
      const res = await fetch(`/api/inventory/suppliers/${supId}/scorecard/print`);
      if (res.ok) {
        const data = await res.json();
        setTicketContent(data.ticket || '');
      } else {
        setTicketContent('No se pudo generar el reporte para impresión.');
      }
    } catch (err) {
      console.error('Error loading ticket:', err);
      setTicketContent('Error al comunicarse con el servidor.');
    } finally {
      setPrintLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTier = selectedTier === 'ALL' || s.ratingTier === selectedTier;
    return matchesSearch && matchesTier;
  });

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'A':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            Tier A · Estratégico
          </span>
        );
      case 'B':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40">
            Tier B · Confiable
          </span>
        );
      case 'C':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
            Tier C · Observación
          </span>
        );
      case 'D':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
            Tier D · Crítico
          </span>
        );
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600/30 text-rose-300 border border-rose-500/50">CRÍTICO</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-600/30 text-orange-300 border border-orange-500/50">ALTO</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600/30 text-amber-300 border border-amber-500/50">MEDIO</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-600/30 text-slate-300 border border-slate-500/50">BAJO</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Explanatory Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
              <Award className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                Auditoría y Evaluación de Proveedores (OTIF Scorecard)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Métricas On-Time In-Full (OTIF), variaciones de costos cotizados vs facturados (PPV) e incidentes de calidad.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchScorecard()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">OTIF Consolidado</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${kpis.globalOtifRatePct >= 90 ? 'text-emerald-400' : kpis.globalOtifRatePct >= 75 ? 'text-amber-400' : 'text-rose-400'}`}>
                {kpis.globalOtifRatePct}%
              </span>
            </div>
            <span className="text-[11px] text-slate-500">A tiempo & completo</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">A Tiempo (On-Time)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-blue-400">
                {kpis.onTimeRatePct}%
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Puntualidad en entrega</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Completo (In-Full)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-cyan-400">
                {kpis.inFullRatePct}%
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Cumplimiento &gt;=98%</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Discrepancia Precios</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${kpis.globalAvgPriceVariancePct <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {kpis.globalAvgPriceVariancePct >= 0 ? '+' : ''}{kpis.globalAvgPriceVariancePct}%
              </span>
            </div>
            <span className="text-[11px] text-slate-500">PPV Facturado vs OC</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Órdenes Auditadas</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-purple-400">
                {kpis.totalOrdersDelivered}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">{kpis.totalSuppliers} proveedores activos</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Riesgo Crítico</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${kpis.tierBreakdown.D > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {kpis.tierBreakdown.D}
              </span>
              <span className="text-xs text-slate-400">en Tier D</span>
            </div>
            <span className="text-[11px] text-slate-500">{kpis.totalIncidentsCount} incidencias reportadas</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o código de proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Tier:
          </span>
          {['ALL', 'A', 'B', 'C', 'D'].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedTier === tier
                  ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tier === 'ALL' ? 'Todos' : `Tier ${tier}`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Scorecard Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Proveedor</th>
                <th className="px-4 py-3.5 text-center">Nivel / Tier</th>
                <th className="px-4 py-3.5 text-center">Calificación</th>
                <th className="px-4 py-3.5 text-center">OTIF %</th>
                <th className="px-4 py-3.5 text-center">Puntualidad</th>
                <th className="px-4 py-3.5 text-center">Completitud</th>
                <th className="px-4 py-3.5 text-center">Variación Costos (PPV)</th>
                <th className="px-4 py-3.5 text-center">Incidencias</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    Cargando auditoría de proveedores...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    No se encontraron proveedores registrados con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white text-base">{sup.name}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        {sup.code && <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-300">{sup.code}</span>}
                        <span>{sup.totalOrdersDelivered} entregas procesadas</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      {getTierBadge(sup.ratingTier)}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span className={`text-base font-black ${
                          sup.overallScore >= 90 ? 'text-emerald-400' :
                          sup.overallScore >= 75 ? 'text-blue-400' :
                          sup.overallScore >= 60 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {sup.overallScore}
                        </span>
                        <span className="text-xs text-slate-500">/ 100</span>
                      </div>
                      <div className="w-20 bg-slate-800 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                        <div
                          className={`h-full ${
                            sup.overallScore >= 90 ? 'bg-emerald-500' :
                            sup.overallScore >= 75 ? 'bg-blue-500' :
                            sup.overallScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, sup.overallScore))}%` }}
                        />
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className={`font-bold ${sup.otifRatePct >= 90 ? 'text-emerald-400' : sup.otifRatePct >= 75 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {sup.otifRatePct}%
                      </span>
                      <div className="text-[11px] text-slate-500">{sup.otifDeliveries} de {sup.totalOrdersDelivered}</div>
                    </td>

                    <td className="px-4 py-4 text-center text-xs text-slate-300">
                      <span className="font-semibold text-slate-200">
                        {sup.totalOrdersDelivered > 0 ? Math.round((sup.onTimeDeliveries / sup.totalOrdersDelivered) * 100) : 100}%
                      </span>
                      <div className="text-[11px] text-slate-500">{sup.onTimeDeliveries} a tiempo</div>
                    </td>

                    <td className="px-4 py-4 text-center text-xs text-slate-300">
                      <span className="font-semibold text-slate-200">
                        {sup.totalOrdersDelivered > 0 ? Math.round((sup.inFullDeliveries / sup.totalOrdersDelivered) * 100) : 100}%
                      </span>
                      <div className="text-[11px] text-slate-500">{sup.inFullDeliveries} completas</div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className={`font-semibold text-xs px-2 py-0.5 rounded ${
                        sup.avgPriceVariancePct <= 0
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : sup.avgPriceVariancePct <= 2
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {sup.avgPriceVariancePct >= 0 ? '+' : ''}{sup.avgPriceVariancePct}%
                      </span>
                    </td>

                    <td className="px-4 py-4 text-center">
                      {sup._count.incidents > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          {sup._count.incidents}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">0</span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openSupplierAudit(sup)}
                          title="Ver Auditoría e Historial"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openIncidentModal(sup)}
                          title="Registrar Incidencia"
                          className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded-lg transition-colors border border-rose-800/40"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openPrintTicket(sup.id)}
                          title="Imprimir Scorecard 80mm"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Audit Detail Modal */}
      {selectedSupplierId && detailSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white">{detailSupplier.name}</h3>
                    {getTierBadge(detailSupplier.ratingTier)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Scorecard: <strong className="text-emerald-400">{detailSupplier.overallScore} / 100 pts</strong> · OTIF: <strong>{detailSupplier.otifRatePct}%</strong> · Variación PPV: <strong>{detailSupplier.avgPriceVariancePct}%</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openPrintTicket(detailSupplier.id)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Ticket
                </button>
                <button
                  onClick={() => openIncidentModal(detailSupplier)}
                  className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-rose-500/40"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Registrar Incidencia
                </button>
                <button
                  onClick={() => setSelectedSupplierId(null)}
                  className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Sub-Tabs: Orders vs Incidents */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 pt-2">
              <button
                onClick={() => setDetailTab('orders')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  detailTab === 'orders'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Package className="w-4 h-4" />
                Historial de Entregas y OTIF ({historicalOrders.length})
              </button>
              <button
                onClick={() => setDetailTab('incidents')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  detailTab === 'incidents'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                Incidencias de Calidad ({detailIncidents.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {detailLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-400" />
                  Cargando trazabilidad del proveedor...
                </div>
              ) : detailTab === 'orders' ? (
                historicalOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    No hay órdenes de compra recibidas para este proveedor aún.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historicalOrders.map((po) => (
                      <div key={po.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 shadow">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-white">{po.folio}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              po.isOtif ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}>
                              {po.isOtif ? 'OTIF CUMPLIDO' : 'OTIF INCUMPLIDO'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded font-medium ${po.isOnTime ? 'bg-blue-500/20 text-blue-300' : 'bg-rose-500/20 text-rose-300'}`}>
                              {po.isOnTime ? 'A tiempo' : `Tardío (+${po.delayDays} días)`}
                            </span>
                            <span className={`px-2 py-0.5 rounded font-medium ${po.isInFull ? 'bg-cyan-500/20 text-cyan-300' : 'bg-amber-500/20 text-amber-300'}`}>
                              {po.fulfillmentRatePct}% Completo
                            </span>
                            <span className={`px-2 py-0.5 rounded font-medium ${
                              (po.priceVariancePct ?? 0) <= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              PPV: {(po.priceVariancePct ?? 0) >= 0 ? '+' : ''}{po.priceVariancePct ?? 0}% (${po.priceVarianceAmount?.toFixed(2) ?? '0.00'})
                            </span>
                            <span className="text-slate-400">
                              Calidad: <strong className="text-white">{po.qualityScore ?? 100}/100</strong>
                            </span>
                          </div>
                        </div>

                        {/* Items in this PO */}
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-xs text-left text-slate-300">
                            <thead>
                              <tr className="text-slate-400 border-b border-slate-800/50 pb-1">
                                <th className="py-1">Insumo</th>
                                <th className="py-1 text-center">Ordenado</th>
                                <th className="py-1 text-center">Recibido</th>
                                <th className="py-1 text-center">Costo OC</th>
                                <th className="py-1 text-center">Costo Factura</th>
                                <th className="py-1 text-center">Variación</th>
                                <th className="py-1 text-right">Rechazo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900">
                              {po.items.map((it) => (
                                <tr key={it.id}>
                                  <td className="py-1.5 font-medium text-white">{it.ingredient.name}</td>
                                  <td className="py-1.5 text-center">{it.quantityOrdered} {it.ingredient.unit}</td>
                                  <td className="py-1.5 text-center font-semibold text-slate-200">{it.quantityReceived} {it.ingredient.unit}</td>
                                  <td className="py-1.5 text-center text-slate-400">${it.unitCost.toFixed(2)}</td>
                                  <td className="py-1.5 text-center font-mono text-white">
                                    ${(it.billedUnitCost ?? it.unitCost).toFixed(2)}
                                  </td>
                                  <td className="py-1.5 text-center">
                                    <span className={`font-semibold ${
                                      (it.priceVariancePct ?? 0) <= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}>
                                      {(it.priceVariancePct ?? 0) >= 0 ? '+' : ''}{(it.priceVariancePct ?? 0).toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="py-1.5 text-right">
                                    {(it.rejectedQuantity ?? 0) > 0 ? (
                                      <span className="text-rose-400 font-bold">
                                        {it.rejectedQuantity} {it.ingredient.unit} {it.rejectionReason ? `(${it.rejectionReason})` : ''}
                                      </span>
                                    ) : (
                                      <span className="text-slate-500">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                detailIncidents.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                    No se registran incidencias de calidad ni entregas para este proveedor.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailIncidents.map((inc) => (
                      <div key={inc.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 shadow">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(inc.severity)}
                            <span className="font-semibold text-white text-sm">{inc.incidentType}</span>
                            {inc.purchaseOrder && (
                              <span className="text-xs text-slate-400 font-mono">({inc.purchaseOrder.folio})</span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(inc.createdAt).toLocaleString('es-MX')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 mt-2">{inc.description}</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-3 pt-2 border-t border-slate-900">
                          {inc.quantityAffected ? (
                            <span>Cant. Afectada: <strong className="text-white">{inc.quantityAffected}</strong></span>
                          ) : null}
                          {inc.financialImpact ? (
                            <span>Impacto Económico: <strong className="text-rose-400">${inc.financialImpact.toFixed(2)} MXN</strong></span>
                          ) : null}
                          <span>Resolución: <strong className="text-slate-200">{inc.resolution}</strong></span>
                          {inc.reportedByName && <span>Reportó: {inc.reportedByName}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Incident Modal */}
      {incidentModalOpen && targetSupplierForIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Registrar Incidencia de Proveedor</h3>
              </div>
              <button
                onClick={() => setIncidentModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitIncident} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Proveedor</label>
                <input
                  type="text"
                  disabled
                  value={targetSupplierForIncident.name}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Incidencia *</label>
                  <select
                    value={incidentForm.incidentType}
                    onChange={(e) => setIncidentForm({ ...incidentForm, incidentType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="DAMAGED_GOODS">Producto Dañado / Golpeado</option>
                    <option value="TEMP_BREACH">Ruptura Cadena de Frío</option>
                    <option value="SHORT_EXPIRY">Caducidad Corta</option>
                    <option value="POOR_QUALITY">Baja Calidad Sensorial</option>
                    <option value="WRONG_ITEM">Insumo Incorrecto</option>
                    <option value="MISSING_DOCUMENTATION">Falta de Factura / Doc</option>
                    <option value="LATE_DELIVERY">Entrega Tardía Crítica</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Severidad *</label>
                  <select
                    value={incidentForm.severity}
                    onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Descripción de la Discrepancia *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detalla qué falló en la entrega o producto recibido..."
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Cantidad Afectada</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={incidentForm.quantityAffected}
                    onChange={(e) => setIncidentForm({ ...incidentForm, quantityAffected: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Impacto ($ MXN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={incidentForm.financialImpact}
                    onChange={(e) => setIncidentForm({ ...incidentForm, financialImpact: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Acción / Resolución</label>
                <select
                  value={incidentForm.resolution}
                  onChange={(e) => setIncidentForm({ ...incidentForm, resolution: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="PENDING">Pendiente de Aclaración</option>
                  <option value="CREDIT_NOTE">Nota de Crédito Solicitada</option>
                  <option value="REPLACEMENT">Reposición Inmediata de Mercancía</option>
                  <option value="ACCEPTED_WITH_CONCESSION">Aceptado con Descuento</option>
                  <option value="REJECTED">Rechazo Total en Andén</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIncidentModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingIncident}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
                >
                  {submittingIncident && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Guardar Incidencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Print Preview Modal */}
      {printModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Ticket Scorecard 80mm</h3>
              </div>
              <button
                onClick={() => setPrintModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-950">
              {printLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                  Generando ticket...
                </div>
              ) : (
                <pre className="font-mono text-xs text-emerald-400 bg-black/70 p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                  {ticketContent}
                </pre>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/70">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(ticketContent);
                  alert('Ticket copiado al portapapeles');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Copiar Texto
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-sm flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
