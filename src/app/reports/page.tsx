'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  TrendingUp, 
  Coins, 
  Package, 
  Filter,
  FileText,
  Star,
  Heart,
  Smile,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  X
} from 'lucide-react';
import InvoicePdfModal, { InvoiceOrderData } from '@/components/InvoicePdfModal';

interface BrandRef {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
}

interface OrderItemRef {
  id: string;
  quantity: number;
  price: number;
  product: {
    name: string;
  };
}

interface OrderReportRow {
  id: string;
  orderNumber: string;
  source: string;
  status: string;
  customerName: string;
  customerPhone?: string | null;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  diners?: number | null;
  createdAt: string;
  brand: BrandRef;
  table?: { name: string; number: string; zone: string } | null;
  driver?: { user: { name: string }; vehicleType: string } | null;
  items: OrderItemRef[];
}

interface CashSessionReportRow {
  id: string;
  openedAt: string;
  closedAt?: string | null;
  openingBalance: number;
  closingBalance?: number | null;
  expectedBalance?: number | null;
  actualBalance?: number | null;
  cashSales: number;
  cardSales: number;
  appsSales: number;
  status: string;
  notes?: string | null;
  brand: BrandRef;
  user: { name: string; email: string };
}

interface InventoryReportRow {
  id: string;
  name: string;
  stock: number;
  unit: string;
  cost: number;
  minStock: number;
  brand: BrandRef;
}

interface SurveyReportRow {
  id: string;
  orderId: string;
  brandId: string;
  customerId?: string | null;
  overallRating: number;
  npsScore: number;
  foodRating?: number | null;
  serviceRating?: number | null;
  speedRating?: number | null;
  cleanlinessRating?: number | null;
  tags?: string | null;
  comment?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  status: string;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  resolvedById?: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    source: string;
    status: string;
    total: number;
    createdAt: string;
  };
  customer?: {
    id: string;
    name: string;
    phone: string;
    tier: string;
  } | null;
  brand: {
    id: string;
    name: string;
  };
}

interface SurveysReportData {
  surveys: SurveyReportRow[];
  stats: {
    score: number;
    total: number;
    promoters: number;
    passives: number;
    detractors: number;
    promoterPct: number;
    passivePct: number;
    detractorPct: number;
    avgOverallRating: number;
    avgFoodRating: number;
    avgServiceRating: number;
    avgSpeedRating: number;
    avgCleanlinessRating: number;
  };
  pendingDetractorsCount: number;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'cash' | 'inventory' | 'satisfaction'>('sales');
  const [brands, setBrands] = useState<BrandRef[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('ALL');

  // Date range presets
  const [datePreset, setDatePreset] = useState<string>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Report Data
  const [loading, setLoading] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<InvoiceOrderData | null>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [salesReport, setSalesReport] = useState<{
    summary: {
      totalOrders: number;
      totalRevenue: number;
      totalTax: number;
      totalTip: number;
      totalDiners: number;
      avgTicket: number;
      salesBySource: Record<string, { count: number; total: number }>;
      salesByBrand: Record<string, { name: string; count: number; total: number }>;
    };
    data: OrderReportRow[];
  } | null>(null);

  const [cashReport, setCashReport] = useState<{
    summary: {
      totalSessions: number;
      totalCashSales: number;
      totalCardSales: number;
      totalAppsSales: number;
      totalDiscrepancies: number;
    };
    data: CashSessionReportRow[];
  } | null>(null);

  const [inventoryReport, setInventoryReport] = useState<{
    summary: {
      totalItems: number;
      totalInventoryValuation: number;
      lowStockCount: number;
    };
    data: InventoryReportRow[];
  } | null>(null);

  const [surveysReport, setSurveysReport] = useState<SurveysReportData | null>(null);
  const [surveyFilterStatus, setSurveyFilterStatus] = useState<'ALL' | 'PENDING_RESOLUTION' | 'RESOLVED'>('ALL');
  const [surveyFilterCategory, setSurveyFilterCategory] = useState<'ALL' | 'PROMOTER' | 'PASSIVE' | 'DETRACTOR'>('ALL');
  const [selectedSurveyForResolution, setSelectedSurveyForResolution] = useState<SurveyReportRow | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  // Setup initial date presets
  const applyDatePreset = useCallback((preset: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'TODAY') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (preset === 'YESTERDAY') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    } else if (preset === 'LAST_7_DAYS') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = new Date();
    } else if (preset === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (preset === 'LAST_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (preset === 'THIS_YEAR') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    setDatePreset(preset);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  // Initial load
  useEffect(() => {
    applyDatePreset('THIS_MONTH');
    fetch('/api/brands')
      .then(res => res.json())
      .then(data => setBrands(data.brands || []))
      .catch(err => console.error(err));
  }, [applyDatePreset]);

  // Fetch Report Data
  const fetchReportData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);

    try {
      if (activeTab === 'satisfaction') {
        const brandParam = selectedBrandId !== 'ALL' ? `&brandId=${selectedBrandId}` : '';
        const statusParam = surveyFilterStatus !== 'ALL' ? `&status=${surveyFilterStatus}` : '';
        const categoryParam = surveyFilterCategory !== 'ALL' ? `&npsCategory=${surveyFilterCategory}` : '';
        const url = `/api/surveys?startDate=${startDate}&endDate=${endDate}${brandParam}${statusParam}${categoryParam}&limit=100`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setSurveysReport(json);
        }
      } else {
        const url = `/api/reports?type=${activeTab}&startDate=${startDate}T00:00:00.000Z&endDate=${endDate}T23:59:59.999Z&brandId=${selectedBrandId}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (activeTab === 'sales') setSalesReport(json);
          if (activeTab === 'cash') setCashReport(json);
          if (activeTab === 'inventory') setInventoryReport(json);
        }
      }
    } catch (err) {
      console.error('Failed to fetch report', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, selectedBrandId, surveyFilterStatus, surveyFilterCategory]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // CSV Export Function (With UTF-8 BOM for Microsoft Excel compatibility)
  const handleExportCSV = () => {
    let csvContent = '\uFEFF'; // UTF-8 BOM

    if (activeTab === 'sales' && salesReport) {
      csvContent += 'REPORTE FINANCIERO DE VENTAS Y COMANDAS - DARKFLOW MANAGER\n';
      csvContent += `Rango de Fechas:;${startDate} al ${endDate}\n`;
      csvContent += `Total Ventas:;$${salesReport.summary.totalRevenue.toFixed(2)};Total Pedidos:;${salesReport.summary.totalOrders};Ticket Promedio:;$${salesReport.summary.avgTicket.toFixed(2)}\n\n`;
      csvContent += 'Folio;Fecha;Hora;Marca;Canal/Origen;Cliente;Mesa/Chofer;Subtotal;Impuestos;Propina;Total;Estado;Platillos\n';

      salesReport.data.forEach((o) => {
        const dateObj = new Date(o.createdAt);
        const dateStr = dateObj.toLocaleDateString('es-MX');
        const timeStr = dateObj.toLocaleTimeString('es-MX');
        const locationInfo = o.table ? `Mesa ${o.table.name} (${o.table.zone})` : o.driver ? `Chofer: ${o.driver.user.name}` : '-';
        const itemsList = o.items.map(i => `${i.quantity}x ${i.product.name}`).join(' | ');

        csvContent += `"${o.orderNumber}";"${dateStr}";"${timeStr}";"${o.brand.name}";"${o.source}";"${o.customerName}";"${locationInfo}";${o.subtotal.toFixed(2)};${o.tax.toFixed(2)};${o.tip.toFixed(2)};${o.total.toFixed(2)};"${o.status}";"${itemsList}"\n`;
      });
    } else if (activeTab === 'cash' && cashReport) {
      csvContent += 'REPORTE DE CORTES DE CAJA Y ARQUEOS - DARKFLOW MANAGER\n';
      csvContent += `Rango de Fechas:;${startDate} al ${endDate}\n`;
      csvContent += `Total Turnos:;${cashReport.summary.totalSessions};Ventas Efectivo:;$${cashReport.summary.totalCashSales.toFixed(2)};Ventas Tarjeta:;$${cashReport.summary.totalCardSales.toFixed(2)};Ventas Apps:;$${cashReport.summary.totalAppsSales.toFixed(2)}\n\n`;
      csvContent += 'ID Sesion;Marca;Cajero;Apertura;Cierre;Fondo Inicial;Ventas Efectivo;Ventas Tarjeta;Ventas Apps;Esperado;Real en Caja;Diferencia;Estado\n';

      cashReport.data.forEach((s) => {
        const openStr = new Date(s.openedAt).toLocaleString('es-MX');
        const closeStr = s.closedAt ? new Date(s.closedAt).toLocaleString('es-MX') : 'Abierto';
        const diff = (s.actualBalance != null && s.expectedBalance != null) ? (s.actualBalance - s.expectedBalance) : 0;

        csvContent += `"${s.id.slice(0, 8)}";"${s.brand.name}";"${s.user.name}";"${openStr}";"${closeStr}";${s.openingBalance.toFixed(2)};${s.cashSales.toFixed(2)};${s.cardSales.toFixed(2)};${s.appsSales.toFixed(2)};${(s.expectedBalance || 0).toFixed(2)};${(s.actualBalance || 0).toFixed(2)};${diff.toFixed(2)};"${s.status}"\n`;
      });
    } else if (activeTab === 'inventory' && inventoryReport) {
      csvContent += 'REPORTE DE VALUACION DE INVENTARIO Y MATERIA PRIMA - DARKFLOW MANAGER\n';
      csvContent += `Fecha Generacion:;${new Date().toLocaleString('es-MX')}\n`;
      csvContent += `Total Insumos:;${inventoryReport.summary.totalItems};Valuacion Total Bodega:;$${inventoryReport.summary.totalInventoryValuation.toFixed(2)};Insumos Bajo Minimo:;${inventoryReport.summary.lowStockCount}\n\n`;
      csvContent += 'Insumo;Cocina / Marca;Stock Actual;Unidad;Costo Unitario;Valuacion Total;Stock Minimo;Estado\n';

      inventoryReport.data.forEach((ing) => {
        const valuation = ing.stock * ing.cost;
        const status = ing.stock <= ing.minStock ? 'URGENTE / BAJO' : 'OPTIMO';

        csvContent += `"${ing.name}";"${ing.brand.name}";${ing.stock};"${ing.unit}";${ing.cost.toFixed(2)};${valuation.toFixed(2)};${ing.minStock};"${status}"\n`;
      });
    } else if (activeTab === 'satisfaction' && surveysReport) {
      csvContent += 'REPORTE DE SATISFACCIÓN DEL COMENSAL & NPS - DARKFLOW MANAGER\n';
      csvContent += `Rango de Fechas:;${startDate} al ${endDate}\n`;
      csvContent += `NPS Score Global:;${surveysReport.stats.score};Promotores:;${surveysReport.stats.promoters} (${surveysReport.stats.promoterPct}%);Pasivos:;${surveysReport.stats.passives} (${surveysReport.stats.passivePct}%);Detractores:;${surveysReport.stats.detractors} (${surveysReport.stats.detractorPct}%);Promedio Estrellas:;${surveysReport.stats.avgOverallRating}★\n\n`;
      csvContent += 'Folio Orden;Fecha;Hora;Marca;Comensal;Telefono;Calif General;NPS Score;Sabor;Servicio;Rapidez;Higiene;Aspectos;Comentarios;Estado;Resolucion\n';

      surveysReport.surveys.forEach((s) => {
        const dateObj = new Date(s.createdAt);
        const dateStr = dateObj.toLocaleDateString('es-MX');
        const timeStr = dateObj.toLocaleTimeString('es-MX');
        let tagsClean = '';
        if (s.tags) {
          try {
            tagsClean = (JSON.parse(s.tags) as string[]).join(' | ');
          } catch {
            tagsClean = s.tags;
          }
        }
        const commentClean = (s.comment || '').replace(/"/g, '""');
        const resNotesClean = (s.resolutionNotes || '').replace(/"/g, '""');

        csvContent += `"${s.order.orderNumber}";"${dateStr}";"${timeStr}";"${s.brand.name}";"${s.customerName || '-'}";"${s.customerPhone || '-'}";${s.overallRating};${s.npsScore};${s.foodRating || '-'};${s.serviceRating || '-'};${s.speedRating || '-'};${s.cleanlinessRating || '-'};"${tagsClean}";"${commentClean}";"${s.status}";"${resNotesClean}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_${activeTab}_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResolveSurvey = async () => {
    if (!selectedSurveyForResolution) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/surveys/${selectedSurveyForResolution.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RESOLVED',
          resolutionNotes,
        }),
      });
      if (res.ok) {
        setSelectedSurveyForResolution(null);
        setResolutionNotes('');
        fetchReportData();
      } else {
        alert('Error al resolver caso');
      }
    } catch {
      alert('Error de conexión al guardar resolución');
    } finally {
      setResolving(false);
    }
  };

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Header with Title and Global Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Centro de Reportes & Exportación</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Auditoría financiera, arqueos de caja y valuación de insumos en CSV y formato imprimible
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 font-bold text-xs rounded-lg border border-slate-750 transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4 text-slate-400" /> Imprimir / PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg shadow-lg transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" /> Exportar a Excel (CSV)
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="glass-panel border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-2">
                <Filter className="h-3.5 w-3.5" /> Período:
              </span>
              {[
                { id: 'TODAY', label: 'Hoy' },
                { id: 'YESTERDAY', label: 'Ayer' },
                { id: 'LAST_7_DAYS', label: '7 Días' },
                { id: 'THIS_MONTH', label: 'Este Mes' },
                { id: 'LAST_MONTH', label: 'Mes Pasado' },
                { id: 'THIS_YEAR', label: 'Año' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyDatePreset(p.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    datePreset === p.id
                      ? 'bg-brand-primary border-brand-primary text-slate-950'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Dates & Brand Select */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setDatePreset('CUSTOM');
                    setStartDate(e.target.value);
                  }}
                  className="bg-transparent text-slate-200 outline-none text-xs"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setDatePreset('CUSTOM');
                    setEndDate(e.target.value);
                  }}
                  className="bg-transparent text-slate-200 outline-none text-xs"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Marca:</span>
                <select
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value)}
                  className="bg-transparent text-slate-200 outline-none font-bold text-xs"
                >
                  <option value="ALL">⭐ Todas las Marcas</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Report Tab Selector */}
          <div className="flex border-t border-slate-800 pt-3 gap-2 overflow-x-auto pb-1">
            {[
              { id: 'sales', label: '📊 Ventas & Comandas', icon: TrendingUp },
              { id: 'cash', label: '💰 Cortes de Caja & Arqueos', icon: Coins },
              { id: 'inventory', label: '📦 Valuación de Inventarios', icon: Package },
              { id: 'satisfaction', label: '⭐ Satisfacción & NPS', icon: Star },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'sales' | 'cash' | 'inventory' | 'satisfaction')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-slate-800 border-brand-primary text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 text-brand-primary" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex h-64 items-center justify-center flex-col gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-800 border-t-brand-primary"></div>
            <p className="text-xs text-slate-400">Generando reporte y calculando balances...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. SALES REPORT VIEW */}
            {activeTab === 'sales' && salesReport && (
              <div className="space-y-4">
                {/* Sales Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Ventas Brutas</span>
                    <p className="text-2xl font-black text-emerald-400 mt-1">
                      ${salesReport.summary.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-slate-500">Impuestos: ${salesReport.summary.totalTax.toFixed(2)}</span>
                  </div>

                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Comandas</span>
                    <p className="text-2xl font-black text-white mt-1">{salesReport.summary.totalOrders}</p>
                    <span className="text-[10px] text-slate-500">Comensales: {salesReport.summary.totalDiners}</span>
                  </div>

                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Ticket Promedio</span>
                    <p className="text-2xl font-black text-brand-primary mt-1">
                      ${salesReport.summary.avgTicket.toFixed(2)}
                    </p>
                    <span className="text-[10px] text-slate-500">Por comanda generada</span>
                  </div>

                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Propinas Registradas</span>
                    <p className="text-2xl font-black text-amber-400 mt-1">
                      ${salesReport.summary.totalTip.toFixed(2)}
                    </p>
                    <span className="text-[10px] text-slate-500">Salón & Reparto</span>
                  </div>
                </div>

                {/* Detailed Sales Table */}
                <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Detalle de Comandas Registradas</h4>
                    <span className="text-xs text-slate-400">{salesReport.data.length} órdenes encontradas</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Folio</th>
                          <th className="py-3 px-4">Fecha & Hora</th>
                          <th className="py-3 px-4">Cocina / Marca</th>
                          <th className="py-3 px-4">Canal</th>
                          <th className="py-3 px-4">Cliente / Mesa</th>
                          <th className="py-3 px-4 text-right">Subtotal</th>
                          <th className="py-3 px-4 text-right">Total</th>
                          <th className="py-3 px-4 text-center">Estado</th>
                          <th className="py-3 px-4 text-center">Factura</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {salesReport.data.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-white">{o.orderNumber}</td>
                            <td className="py-3 px-4 text-slate-400">
                              {new Date(o.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.brand.primaryColor }} />
                                {o.brand.name}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                                {o.source}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-200">{o.customerName}</div>
                              {o.table && <span className="text-[10px] text-brand-primary">Mesa {o.table.name}</span>}
                              {o.driver && <span className="text-[10px] text-cyan-400">🛵 {o.driver.user.name}</span>}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-400 font-mono">${o.subtotal.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">${o.total.toFixed(2)}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                {o.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => {
                                  setSelectedOrderForInvoice(o as unknown as InvoiceOrderData);
                                  setIsInvoiceOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer shadow-sm group"
                                title="Ver / Imprimir Factura o Comprobante PDF"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-950 font-bold border-t border-slate-800 text-slate-200">
                        <tr>
                          <td colSpan={5} className="py-3 px-4 text-right">TOTAL GENERAL:</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">
                            ${salesReport.data.reduce((acc, curr) => acc + curr.subtotal, 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                            ${salesReport.summary.totalRevenue.toFixed(2)}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. CASH SESSIONS REPORT VIEW */}
            {activeTab === 'cash' && cashReport && (
              <div className="space-y-4">
                {/* Cash Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Efectivo</span>
                    <p className="text-2xl font-black text-emerald-400 mt-1">
                      ${cashReport.summary.totalCashSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-slate-500">Cobrado en caja</span>
                  </div>

                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Tarjetas</span>
                    <p className="text-2xl font-black text-blue-400 mt-1">
                      ${cashReport.summary.totalCardSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-slate-500">Terminales bancarias</span>
                  </div>

                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Delivery Apps</span>
                    <p className="text-2xl font-black text-amber-400 mt-1">
                      ${cashReport.summary.totalAppsSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-slate-500">Uber Eats / Rappi</span>
                  </div>

                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Descuadre Neto</span>
                    <p className={`text-2xl font-black mt-1 ${cashReport.summary.totalDiscrepancies < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                      ${cashReport.summary.totalDiscrepancies.toFixed(2)}
                    </p>
                    <span className="text-[10px] text-slate-500">{cashReport.summary.totalSessions} arqueos realizados</span>
                  </div>
                </div>

                {/* Detailed Cash Table */}
                <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Histórico de Turnos y Arqueos</h4>
                    <span className="text-xs text-slate-400">{cashReport.data.length} sesiones</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Marca</th>
                          <th className="py-3 px-4">Cajero</th>
                          <th className="py-3 px-4">Apertura</th>
                          <th className="py-3 px-4">Cierre</th>
                          <th className="py-3 px-4 text-right">Efectivo</th>
                          <th className="py-3 px-4 text-right">Tarjetas</th>
                          <th className="py-3 px-4 text-right">Esperado</th>
                          <th className="py-3 px-4 text-right">Real en Caja</th>
                          <th className="py-3 px-4 text-right">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {cashReport.data.map((s) => {
                          const diff = (s.actualBalance != null && s.expectedBalance != null) ? (s.actualBalance - s.expectedBalance) : 0;
                          return (
                            <tr key={s.id} className="hover:bg-slate-900/50 transition-colors">
                              <td className="py-3 px-4 font-semibold text-white">{s.brand.name}</td>
                              <td className="py-3 px-4 text-slate-300">{s.user.name}</td>
                              <td className="py-3 px-4 text-slate-400">
                                {new Date(s.openedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td className="py-3 px-4 text-slate-400">
                                {s.closedAt ? new Date(s.closedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : 'Abierto'}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-emerald-400">${s.cashSales.toFixed(2)}</td>
                              <td className="py-3 px-4 text-right font-mono text-blue-400">${s.cardSales.toFixed(2)}</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-300">${(s.expectedBalance || 0).toFixed(2)}</td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-white">${(s.actualBalance || 0).toFixed(2)}</td>
                              <td className={`py-3 px-4 text-right font-mono font-bold ${diff < 0 ? 'text-red-400' : diff > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                ${diff.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. INVENTORY REPORT VIEW */}
            {activeTab === 'inventory' && inventoryReport && (
              <div className="space-y-4">
                {/* Inventory Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Valuación Total en Bodega</span>
                    <p className="text-2xl font-black text-emerald-400 mt-1">
                      ${inventoryReport.summary.totalInventoryValuation.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-slate-500">Valor de insumos en stock</span>
                  </div>

                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Insumos Registrados</span>
                    <p className="text-2xl font-black text-white mt-1">{inventoryReport.summary.totalItems}</p>
                    <span className="text-[10px] text-slate-500">Materias primas activas</span>
                  </div>

                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] text-amber-400 font-semibold uppercase">Insumos Bajo Mínimo</span>
                    <p className="text-2xl font-black text-amber-400 mt-1">{inventoryReport.summary.lowStockCount}</p>
                    <span className="text-[10px] text-slate-500">Requieren orden de compra</span>
                  </div>
                </div>

                {/* Detailed Inventory Table */}
                <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Valuación por Insumo</h4>
                    <span className="text-xs text-slate-400">{inventoryReport.data.length} insumos</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Insumo</th>
                          <th className="py-3 px-4">Cocina / Marca</th>
                          <th className="py-3 px-4 text-right">Stock Actual</th>
                          <th className="py-3 px-4">Unidad</th>
                          <th className="py-3 px-4 text-right">Costo Unitario</th>
                          <th className="py-3 px-4 text-right">Valuación Total</th>
                          <th className="py-3 px-4 text-center">Estado Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {inventoryReport.data.map((ing) => {
                          const val = ing.stock * ing.cost;
                          const isLow = ing.stock <= ing.minStock;
                          return (
                            <tr key={ing.id} className="hover:bg-slate-900/50 transition-colors">
                              <td className="py-3 px-4 font-bold text-white">{ing.name}</td>
                              <td className="py-3 px-4 text-slate-300">{ing.brand.name}</td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">{ing.stock}</td>
                              <td className="py-3 px-4 text-slate-400 font-mono">{ing.unit}</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-400">${ing.cost.toFixed(2)}</td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">${val.toFixed(2)}</td>
                              <td className="py-3 px-4 text-center">
                                {isLow ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 border border-amber-900 text-amber-400">
                                    BAJO MÍNIMO
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-900 text-emerald-400">
                                    ÓPTIMO
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-950 font-bold border-t border-slate-800 text-slate-200">
                        <tr>
                          <td colSpan={5} className="py-3 px-4 text-right">VALUACIÓN TOTAL BODEGA:</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                            ${inventoryReport.summary.totalInventoryValuation.toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 4. SATISFACTION & NPS REPORT VIEW */}
            {activeTab === 'satisfaction' && surveysReport && (
              <div className="space-y-6">
                {/* Executive NPS & Quality KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  {/* NPS Global Score Card */}
                  <div className="glass-panel border border-slate-800 rounded-xl p-4 lg:col-span-2 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Net Promoter Score (NPS)
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        surveysReport.stats.score >= 50
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : surveysReport.stats.score >= 0
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {surveysReport.stats.score >= 50 ? 'EXCELENTE' : surveysReport.stats.score >= 0 ? 'ACEPTABLE' : 'CRÍTICO'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className={`text-4xl font-black font-mono ${
                        surveysReport.stats.score >= 50
                          ? 'text-emerald-400'
                          : surveysReport.stats.score >= 0
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {surveysReport.stats.score > 0 ? `+${surveysReport.stats.score}` : surveysReport.stats.score}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">de -100 a +100</span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1">
                      {surveysReport.stats.promoterPct}% Promotores - {surveysReport.stats.detractorPct}% Detractores
                    </p>

                    {/* Progress Bar of NPS Distribution */}
                    <div className="w-full bg-slate-950 h-2 rounded-full mt-3 overflow-hidden flex border border-slate-800">
                      <div
                        style={{ width: `${surveysReport.stats.promoterPct}%` }}
                        className="bg-emerald-500 h-full"
                        title={`Promotores: ${surveysReport.stats.promoterPct}%`}
                      />
                      <div
                        style={{ width: `${surveysReport.stats.passivePct}%` }}
                        className="bg-amber-500 h-full"
                        title={`Pasivos: ${surveysReport.stats.passivePct}%`}
                      />
                      <div
                        style={{ width: `${surveysReport.stats.detractorPct}%` }}
                        className="bg-rose-500 h-full"
                        title={`Detractores: ${surveysReport.stats.detractorPct}%`}
                      />
                    </div>
                  </div>

                  {/* Promoters Card */}
                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-emerald-400">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Promotores (9-10)</span>
                      <ThumbsUp className="w-4 h-4" />
                    </div>
                    <p className="text-2xl font-black text-emerald-400 mt-1">{surveysReport.stats.promoters}</p>
                    <span className="text-[10px] text-slate-500 font-mono font-semibold">
                      {surveysReport.stats.promoterPct}% del total
                    </span>
                  </div>

                  {/* Passives Card */}
                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-amber-400">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Pasivos (7-8)</span>
                      <Smile className="w-4 h-4" />
                    </div>
                    <p className="text-2xl font-black text-amber-400 mt-1">{surveysReport.stats.passives}</p>
                    <span className="text-[10px] text-slate-500 font-mono font-semibold">
                      {surveysReport.stats.passivePct}% del total
                    </span>
                  </div>

                  {/* Detractors Card */}
                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-rose-400">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Detractores (0-6)</span>
                      <ThumbsDown className="w-4 h-4" />
                    </div>
                    <p className="text-2xl font-black text-rose-400 mt-1">{surveysReport.stats.detractors}</p>
                    <span className="text-[10px] text-slate-500 font-mono font-semibold">
                      {surveysReport.stats.detractorPct}% del total
                    </span>
                  </div>

                  {/* Urgent Detractor Alerts Card */}
                  <div className="glass-panel border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-amber-400">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Recuperación</span>
                      <AlertTriangle className={`w-4 h-4 ${surveysReport.pendingDetractorsCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
                    </div>
                    <p className={`text-2xl font-black mt-1 ${surveysReport.pendingDetractorsCount > 0 ? 'text-amber-400' : 'text-white'}`}>
                      {surveysReport.pendingDetractorsCount}
                    </p>
                    <span className="text-[10px] text-slate-500">
                      {surveysReport.pendingDetractorsCount > 0 ? '⚠️ Casos por resolver' : '✓ Al día'}
                    </span>
                  </div>
                </div>

                {/* Experience Breakdown by Area */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-slate-400">Sabor & Calidad:</span>
                    <span className="font-bold text-amber-400 flex items-center gap-1 font-mono">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {surveysReport.stats.avgFoodRating > 0 ? `${surveysReport.stats.avgFoodRating} / 5` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <span className="text-slate-400">Tiempo & Rapidez:</span>
                    <span className="font-bold text-amber-400 flex items-center gap-1 font-mono">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {surveysReport.stats.avgSpeedRating > 0 ? `${surveysReport.stats.avgSpeedRating} / 5` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <span className="text-slate-400">Atención & Servicio:</span>
                    <span className="font-bold text-amber-400 flex items-center gap-1 font-mono">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {surveysReport.stats.avgServiceRating > 0 ? `${surveysReport.stats.avgServiceRating} / 5` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <span className="text-slate-400">Higiene & Empaque:</span>
                    <span className="font-bold text-amber-400 flex items-center gap-1 font-mono">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {surveysReport.stats.avgCleanlinessRating > 0 ? `${surveysReport.stats.avgCleanlinessRating} / 5` : '-'}
                    </span>
                  </div>
                </div>

                {/* Sub-Filters for Survey Feed */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-bold uppercase">Estado:</span>
                    {(['ALL', 'PENDING_RESOLUTION', 'RESOLVED'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setSurveyFilterStatus(st)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          surveyFilterStatus === st
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {st === 'ALL' ? 'Todos' : st === 'PENDING_RESOLUTION' ? '🚨 Por Resolver' : '✓ Resueltos'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-bold uppercase">NPS:</span>
                    {(['ALL', 'PROMOTER', 'PASSIVE', 'DETRACTOR'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSurveyFilterCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          surveyFilterCategory === cat
                            ? 'bg-brand-primary text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {cat === 'ALL' ? 'Todos' : cat === 'PROMOTER' ? '💚 Promotores' : cat === 'PASSIVE' ? '💛 Pasivos' : '🚨 Detractores'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Detailed Reviews & Surveys Feed Table */}
                <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                  <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-amber-400" />
                      Bitácora de Encuestas & Reseñas del Comensal
                    </h4>
                    <span className="text-xs text-slate-400">{surveysReport.surveys.length} reseñas registradas</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Orden / Fecha</th>
                          <th className="py-3 px-4">Marca</th>
                          <th className="py-3 px-4">Comensal</th>
                          <th className="py-3 px-4 text-center">Calif. General</th>
                          <th className="py-3 px-4 text-center">NPS</th>
                          <th className="py-3 px-4">Aspectos & Comentarios</th>
                          <th className="py-3 px-4 text-center">Estado</th>
                          <th className="py-3 px-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {surveysReport.surveys.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-500">
                              No hay encuestas registradas para el rango y filtros seleccionados.
                            </td>
                          </tr>
                        ) : (
                          surveysReport.surveys.map((survey) => {
                            let tags: string[] = [];
                            if (survey.tags) {
                              try {
                                tags = JSON.parse(survey.tags);
                              } catch {
                                tags = [survey.tags];
                              }
                            }
                            const isDetractor = survey.overallRating <= 3 || survey.npsScore <= 6;
                            const isPending = survey.status === 'PENDING_RESOLUTION';

                            return (
                              <tr key={survey.id} className="hover:bg-slate-900/60 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="font-mono font-bold text-white">#{survey.order.orderNumber}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {new Date(survey.createdAt).toLocaleString('es-MX')}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-300 font-medium">
                                  {survey.brand.name}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-white">{survey.customerName || 'Anónimo'}</div>
                                  {survey.customerPhone && (
                                    <div className="text-[10px] text-slate-400 font-mono">{survey.customerPhone}</div>
                                  )}
                                  {survey.customer?.tier && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      VIP {survey.customer.tier}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex justify-center items-center gap-0.5 text-amber-400">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star
                                        key={s}
                                        className={`w-3 h-3 ${
                                          s <= survey.overallRating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400">{survey.overallRating}/5</span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-xs ${
                                    survey.npsScore >= 9
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                      : survey.npsScore >= 7
                                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                                  }`}>
                                    {survey.npsScore}/10
                                  </span>
                                </td>
                                <td className="py-3 px-4 max-w-xs">
                                  {tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-1">
                                      {tags.map((t) => (
                                        <span key={t} className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded border border-slate-700">
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {survey.comment && (
                                    <p className="text-[11px] text-slate-300 italic bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                                      &ldquo;{survey.comment}&rdquo;
                                    </p>
                                  )}
                                  {survey.resolutionNotes && (
                                    <p className="text-[10px] text-emerald-400 mt-1">
                                      <strong>Resolución:</strong> {survey.resolutionNotes}
                                    </p>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {isPending ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-400 animate-pulse">
                                      <AlertTriangle className="w-3 h-3" /> ATENCIÓN REQUERIDA
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400">
                                      <CheckCircle className="w-3 h-3" /> RESUELTO
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => {
                                      setSelectedSurveyForResolution(survey);
                                      setResolutionNotes(survey.resolutionNotes || '');
                                    }}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                                  >
                                    {isPending ? 'Resolver Queja' : 'Editar Nota'}
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
            )}
          </div>
        )}
      </div>

      {/* Customer Recovery & Complaint Resolution Modal */}
      {selectedSurveyForResolution && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Atención y Recuperación de Comensal</h3>
                  <p className="text-xs text-slate-400">Orden #{selectedSurveyForResolution.order.orderNumber} - {selectedSurveyForResolution.brand.name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSurveyForResolution(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Comensal:</span>
                <span className="font-bold text-white">
                  {selectedSurveyForResolution.customerName || 'Anónimo'} ({selectedSurveyForResolution.customerPhone || 'Sin teléfono'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Calificación:</span>
                <span className="font-bold text-amber-400">{selectedSurveyForResolution.overallRating}★ | NPS {selectedSurveyForResolution.npsScore}/10</span>
              </div>
              {selectedSurveyForResolution.comment && (
                <div className="pt-1 border-t border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Comentario del Comensal:</span>
                  <p className="text-slate-200 italic mt-0.5">&ldquo;{selectedSurveyForResolution.comment}&rdquo;</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Acción de Recuperación / Notas Gerenciales:
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Ejemplo: Se contactó vía WhatsApp y se compensó con cortesía del 20% en su próxima visita. Cliente satisfecho."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleResolveSurvey}
                disabled={resolving}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {resolving ? 'Guardando...' : 'Marcar Caso como Resuelto'}
              </button>
              <button
                onClick={() => setSelectedSurveyForResolution(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Commercial Invoice & Sales Receipt Modal */}
      <InvoicePdfModal
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        order={selectedOrderForInvoice}
      />
    </DashboardContainer>
  );
}
