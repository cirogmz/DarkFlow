'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  Plus,
  Search,
  FileSpreadsheet,
  CheckSquare,
  ArrowUpRight,
  ArrowDownRight,
  ChefHat,
  Package,
  Layers,
  HelpCircle,
  X,
  Printer,
  Download,
  ShieldAlert,
  FileText,
  Copy,
  Check
} from 'lucide-react';
import { FoodCostReport, TheoreticalIngredientConsumption, MenuEngineeringItem } from '@/lib/costAudit';

interface FoodCostAuditTabProps {
  ingredients: Array<{
    id: string;
    name: string;
    stock: number;
    unit: string;
    cost: number;
    minStock: number;
    type?: string;
  }>;
  warehouses: Array<{
    id: string;
    name: string;
    code?: string | null;
  }>;
  onRefreshAll?: () => void;
}

export default function FoodCostAuditTab({
  ingredients,
  warehouses,
  onRefreshAll,
}: FoodCostAuditTabProps) {
  const [subTab, setSubTab] = useState<'food-cost' | 'audits'>('food-cost');
  const [periodRange, setPeriodRange] = useState<'today' | 'week' | 'month' | 'all'>('month');
  
  // Food cost report state
  const [report, setReport] = useState<FoodCostReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [menuFilter, setMenuFilter] = useState<'ALL' | 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG'>('ALL');

  // Audits list state
  const [audits, setAudits] = useState<any[]>([]);
  const [auditMetrics, setAuditMetrics] = useState<{
    totalAudits: number;
    appliedAudits: number;
    pendingAudits: number;
    totalDiscrepancy: number;
    totalLoss: number;
    totalSurplus: number;
  } | null>(null);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);
  const [loadingAuditDetail, setLoadingAuditDetail] = useState(false);

  // New Blind Audit modal state
  const [showBlindAuditModal, setShowBlindAuditModal] = useState(false);
  const [auditType, setAuditType] = useState<'BLIND' | 'FULL'>('BLIND');
  const [auditWarehouseId, setAuditWarehouseId] = useState<string>('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('ALL');
  const [auditNotes, setAuditNotes] = useState('');
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [blindAuditSearch, setBlindAuditSearch] = useState('');
  const [revealStockInModal, setRevealStockInModal] = useState(false);
  const [submittingAudit, setSubmittingAudit] = useState(false);

  // Manager Approval Modal State
  const [approvalModalAudit, setApprovalModalAudit] = useState<any | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [applyingAudit, setApplyingAudit] = useState(false);

  // Thermal Print Voucher Modal State
  const [thermalPrintAudit, setThermalPrintAudit] = useState<{
    auditNumber: string;
    adjustmentFolio?: string | null;
    ticketText: string;
  } | null>(null);
  const [loadingThermal, setLoadingThermal] = useState(false);
  const [copiedThermal, setCopiedThermal] = useState(false);

  // Cargar reporte de Food Cost
  const loadFoodCostReport = useCallback(async (range: string) => {
    try {
      setLoadingReport(true);
      const res = await fetch(`/api/inventory/food-cost?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error('Error fetching food cost report:', err);
    } finally {
      setLoadingReport(false);
    }
  }, []);

  // Cargar lista de auditorías físicas
  const loadAudits = useCallback(async () => {
    try {
      setLoadingAudits(true);
      const res = await fetch('/api/inventory/audit');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAudits(data);
        } else {
          setAudits(data.audits || []);
          if (data.metrics) {
            setAuditMetrics(data.metrics);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching inventory audits:', err);
    } finally {
      setLoadingAudits(false);
    }
  }, []);

  useEffect(() => {
    loadFoodCostReport(periodRange);
  }, [periodRange, loadFoodCostReport]);

  useEffect(() => {
    if (subTab === 'audits') {
      loadAudits();
    }
  }, [subTab, loadAudits]);

  // Abrir detalle de auditoría
  const handleViewAuditDetail = async (auditId: string) => {
    try {
      setLoadingAuditDetail(true);
      const res = await fetch(`/api/inventory/audit/${auditId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAudit(data);
      }
    } catch (err) {
      console.error('Error loading audit detail:', err);
    } finally {
      setLoadingAuditDetail(false);
    }
  };

  // Abrir modal de aprobación gerencial para aplicar a stock
  const handleOpenApprovalModal = (audit: any) => {
    setApprovalModalAudit(audit);
    setApprovalNotes('');
  };

  // Confirmar y aplicar ajuste de auditoría física a las existencias
  const handleConfirmApproval = async () => {
    if (!approvalModalAudit) return;

    try {
      setApplyingAudit(true);
      const res = await fetch(`/api/inventory/audit/${approvalModalAudit.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: approvalNotes || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message || 'Ajuste aplicado exitosamente a las existencias');
        setApprovalModalAudit(null);
        await loadAudits();
        if (selectedAudit && selectedAudit.id === approvalModalAudit.id) {
          await handleViewAuditDetail(approvalModalAudit.id);
        }
        if (onRefreshAll) onRefreshAll();
        loadFoodCostReport(periodRange);
      } else {
        const err = await res.json();
        alert(err.error || 'Error al aplicar auditoría');
      }
    } catch (error) {
      console.error('Error applying audit:', error);
      alert('Error de red al aplicar auditoría');
    } finally {
      setApplyingAudit(false);
    }
  };

  // Enviar nuevo arqueo físico ciego
  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemsToSubmit = Object.entries(countedQuantities)
      .filter(([_, qty]) => typeof qty === 'number' && !isNaN(qty))
      .map(([ingredientId, countedStock]) => ({
        ingredientId,
        countedStock,
        notes: itemNotes[ingredientId] || undefined,
      }));

    if (itemsToSubmit.length === 0) {
      alert('Debes ingresar el conteo físico de al menos 1 insumo.');
      return;
    }

    try {
      setSubmittingAudit(true);
      const res = await fetch('/api/inventory/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: auditType,
          warehouseId: auditWarehouseId || undefined,
          categoryFilter: auditCategoryFilter,
          notes: auditNotes || undefined,
          items: itemsToSubmit,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        const created = result.audit || result;
        alert(`Arqueo de inventario ${created.auditNumber} registrado exitosamente.`);
        setShowBlindAuditModal(false);
        setCountedQuantities({});
        setItemNotes({});
        setAuditNotes('');
        setSubTab('audits');
        await loadAudits();
        loadFoodCostReport(periodRange);
        if (onRefreshAll) onRefreshAll();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al registrar arqueo');
      }
    } catch (error) {
      console.error('Error creating audit:', error);
      alert('Error de conexión al guardar arqueo');
    } finally {
      setSubmittingAudit(false);
    }
  };

  // Imprimir comprobante térmico ESC/POS
  const handlePrintAuditTicket = async (auditId: string) => {
    try {
      setLoadingThermal(true);
      const res = await fetch(`/api/inventory/audit/${auditId}/print`);
      if (res.ok) {
        const data = await res.json();
        setThermalPrintAudit(data);
      } else {
        alert('Error al generar comprobante térmico');
      }
    } catch {
      alert('Error de red al generar ticket');
    } finally {
      setLoadingThermal(false);
    }
  };

  // Descargar hoja física de conteo ciego en CSV
  const handleDownloadBlindSheet = () => {
    window.open('/api/inventory/audit/worksheet?format=csv', '_blank');
  };

  // Filtrado de insumos en la tabla de Food Cost
  const filteredIngredients = (report?.ingredientsConsumption || []).filter((item) =>
    item.name.toLowerCase().includes(ingredientSearch.toLowerCase())
  );

  // Filtrado de menú engineering
  const filteredMenu = (report?.menuEngineering?.items || []).filter((item: MenuEngineeringItem) => {
    if (menuFilter === 'ALL') return true;
    return item.classification === menuFilter;
  });

  // Filtrado de insumos para el modal de conteo físico
  const filteredIngredientsForAudit = ingredients.filter((ing) => {
    const matchesSearch = ing.name.toLowerCase().includes(blindAuditSearch.toLowerCase());
    const matchesCategory =
      auditCategoryFilter === 'ALL'
        ? true
        : auditCategoryFilter === 'PREPARED'
        ? ing.type === 'PREPARED'
        : ing.type !== 'PREPARED';
    return matchesSearch && matchesCategory;
  });

  const countedCount = Object.keys(countedQuantities).length;

  return (
    <div className="space-y-6">
      {/* Selector de Sub-pestañas */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-wrap gap-3">
        <div className="flex gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setSubTab('food-cost')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'food-cost'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Análisis de Food Cost Teórico
          </button>
          <button
            onClick={() => setSubTab('audits')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'audits'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Scale className="h-4 w-4" />
            Arqueos Físicos & Auditoría Ciega
          </button>
        </div>

        {subTab === 'food-cost' ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Periodo:
            </span>
            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
              {(['today', 'week', 'month', 'all'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setPeriodRange(r)}
                  className={`px-3 py-1 rounded-md capitalize transition-colors cursor-pointer ${
                    periodRange === r
                      ? 'bg-slate-800 text-amber-400 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r === 'today' ? 'Hoy' : r === 'week' ? 'Semana' : r === 'month' ? 'Mes' : 'Histórico'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadBlindSheet}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              title="Descargar hoja en blanco sin existencias para conteo en bodega"
            >
              <Download className="h-3.5 w-3.5 text-blue-400" />
              <span>Hoja de Toma Ciega (CSV)</span>
            </button>

            <button
              onClick={() => {
                setCountedQuantities({});
                setItemNotes({});
                setRevealStockInModal(false);
                setShowBlindAuditModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Arqueo Físico Ciego</span>
            </button>
          </div>
        )}
      </div>

      {/* ===================== SUBTAB 1: FOOD COST TEÓRICO ===================== */}
      {subTab === 'food-cost' && (
        <div className="space-y-6">
          {loadingReport ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
              <p className="text-xs">Calculando explosión de recetas y consumo teórico...</p>
            </div>
          ) : report ? (
            <>
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400 font-medium">Ventas Netas Totales</span>
                  <div className="text-2xl font-bold text-white mt-1">
                    ${report.financialSummary.totalNetSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-slate-500">{report.financialSummary.totalOrdersCount} comandas en el periodo</span>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400 font-medium">Costo Teórico de Alimentos (COGS)</span>
                  <div className="text-2xl font-bold text-amber-400 mt-1">
                    ${report.financialSummary.theoreticalFoodCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-slate-500">Explosión de fichas técnicas</span>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400 font-medium">Food Cost % Teórico</span>
                  <div className="text-2xl font-black mt-1 flex items-baseline gap-2">
                    <span className={report.financialSummary.theoreticalFoodCostPct > 35 ? 'text-rose-400' : 'text-emerald-400'}>
                      {report.financialSummary.theoreticalFoodCostPct.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-500 font-normal">
                      Meta: {report.financialSummary.targetFoodCostPct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        report.financialSummary.theoreticalFoodCostPct > 35
                          ? 'bg-rose-500'
                          : report.financialSummary.theoreticalFoodCostPct > 30
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(report.financialSummary.theoreticalFoodCostPct * 2, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400 font-medium">Margen Bruto de Utilidad</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    ${(report.financialSummary.totalNetSales - report.financialSummary.theoreticalFoodCost).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {(100 - report.financialSummary.theoreticalFoodCostPct).toFixed(1)}% margen sobre ventas
                  </span>
                </div>
              </div>

              {/* Insumos Consumidos Teóricamente */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center gap-4 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Scale className="h-4 w-4 text-amber-400" />
                      Consumo Teórico de Materias Primas por Recetas
                    </h3>
                    <p className="text-xs text-slate-400">
                      Explosión matemática del insumo descontado por cada orden vendida
                    </p>
                  </div>

                  <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar insumo..."
                      value={ingredientSearch}
                      onChange={(e) => setIngredientSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="p-3">Insumo</th>
                        <th className="p-3 text-right">Cantidad Teórica</th>
                        <th className="p-3 text-right">Costo Promedio</th>
                        <th className="p-3 text-right">Costo Total ($)</th>
                        <th className="p-3 text-right">Stock Actual en Bodega</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredIngredients.map((item) => (
                        <tr key={item.ingredientId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-bold text-white flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            {item.name}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-200">
                            {item.theoreticalQty.toFixed(2)} {item.unit}
                          </td>
                          <td className="p-3 text-right text-slate-400">
                            ${item.unitCost.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-bold text-amber-400">
                            ${item.theoreticalCost.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-300">
                            {item.currentStock.toFixed(2)} {item.unit}
                          </td>
                        </tr>
                      ))}
                      {filteredIngredients.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-500">
                            No hay consumo registrado en este periodo para el insumo buscado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ===================== SUBTAB 2: HISTORIAL DE ARQUEOS FÍSICOS ===================== */}
      {subTab === 'audits' && (
        <div className="space-y-4">
          {/* KPI Summary Cards for Physical Audits */}
          {auditMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Auditorías Realizadas</span>
                <p className="text-xl font-black text-white">{auditMetrics.totalAudits}</p>
                <span className="text-[10px] text-slate-500">
                  {auditMetrics.appliedAudits} aplicadas • {auditMetrics.pendingAudits} pendientes
                </span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Faltantes / Mermas</span>
                <p className="text-xl font-black text-rose-400">-${auditMetrics.totalLoss.toFixed(2)}</p>
                <span className="text-[10px] text-rose-500/80">Absorbido en bitácora de merma</span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Sobrantes Registrados</span>
                <p className="text-xl font-black text-emerald-400">+${auditMetrics.totalSurplus.toFixed(2)}</p>
                <span className="text-[10px] text-emerald-500/80">Stock físico mayor a teórico</span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Varianza Neta Global</span>
                <p className={`text-xl font-black ${auditMetrics.totalDiscrepancy < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  ${auditMetrics.totalDiscrepancy.toFixed(2)}
                </p>
                <span className="text-[10px] text-slate-500">Balance final del inventario</span>
              </div>
            </div>
          )}

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                  Auditorías Físicas de Inventario (Arqueos Ciegos)
                </h3>
                <p className="text-xs text-slate-400">
                  Control inmutable de recuentos físicos para prevención de mermas ocultas y fugas
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadBlindSheet}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                  title="Descargar hoja en blanco para conteo manual en bodega"
                >
                  <Download className="h-3.5 w-3.5 text-blue-400" />
                  <span>Hoja Ciega (CSV)</span>
                </button>

                <button
                  onClick={() => {
                    setCountedQuantities({});
                    setItemNotes({});
                    setRevealStockInModal(false);
                    setShowBlindAuditModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Arqueo Ciego
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Folio</th>
                    <th className="p-3">Fecha y Hora</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Almacén / Bodega</th>
                    <th className="p-3">Auditor / Aprobador</th>
                    <th className="p-3 text-right">Valor Teórico ($)</th>
                    <th className="p-3 text-right">Valor Físico ($)</th>
                    <th className="p-3 text-right">Descuadre ($ y %)</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {audits.map((aud) => (
                    <tr key={aud.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <div className="font-mono font-bold text-amber-400">{aud.auditNumber}</div>
                        {aud.adjustmentFolio && (
                          <div className="font-mono text-[10px] text-emerald-400">{aud.adjustmentFolio}</div>
                        )}
                      </td>
                      <td className="p-3 text-slate-300">
                        {new Date(aud.createdAt).toLocaleString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          aud.type === 'BLIND' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {aud.type === 'BLIND' ? 'ARQUEO CIEGO' : 'PARCIAL'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {aud.warehouse ? aud.warehouse.name : 'Almacén General'}
                      </td>
                      <td className="p-3 text-slate-300 font-medium">
                        <div>{aud.conductedBy?.name || 'Sistema'}</div>
                        {aud.approvedByName && (
                          <div className="text-[10px] text-slate-500">Aprobó: {aud.approvedByName}</div>
                        )}
                      </td>
                      <td className="p-3 text-right text-slate-400">
                        ${aud.totalExpectedValue?.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-bold text-white">
                        ${aud.totalCountedValue?.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-black">
                        <div className={aud.totalDiscrepancyValue < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                          ${aud.totalDiscrepancyValue?.toFixed(2)}
                        </div>
                        {aud.variancePct !== null && aud.variancePct !== undefined && (
                          <div className={`text-[10px] ${aud.variancePct < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {aud.variancePct > 0 ? `+${aud.variancePct.toFixed(1)}%` : `${aud.variancePct.toFixed(1)}%`}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          aud.status === 'APPLIED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {aud.status === 'APPLIED' ? 'APLICADO A STOCK' : 'AUDITADO / PENDIENTE'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            onClick={() => handleViewAuditDetail(aud.id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded transition-colors cursor-pointer"
                            title="Ver desglose átomo a átomo"
                          >
                            Detalle
                          </button>

                          <button
                            onClick={() => handlePrintAuditTicket(aud.id)}
                            disabled={loadingThermal}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
                            title="Imprimir Comprobante Térmico ESC/POS"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>

                          {aud.status !== 'APPLIED' && (
                            <button
                              onClick={() => handleOpenApprovalModal(aud)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-colors cursor-pointer"
                              title="Aplicar ajuste contable definitivo al stock"
                            >
                              Aplicar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {audits.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        No hay auditorías físicas registradas. Haz clic en "Nuevo Arqueo Ciego" para auditar insumos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 1: REGISTRO DE ARQUEO FÍSICO CIEGO ===================== */}
      {showBlindAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Nuevo Arqueo Físico de Inventario
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Modo Ciego Antifraude
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ingresa el conteo físico real de los insumos sin ver las existencias previas del sistema
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Toggle Revelar Stock (para supervisores) */}
                <button
                  type="button"
                  onClick={() => setRevealStockInModal(!revealStockInModal)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                >
                  {revealStockInModal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {revealStockInModal ? 'Ocultar Stock Sistema' : 'Revelar Stock (Supervisor)'}
                </button>

                <button
                  onClick={() => setShowBlindAuditModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateAudit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Arqueo</label>
                  <select
                    value={auditType}
                    onChange={(e: any) => setAuditType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="BLIND">Arqueo Ciego (Antifraude)</option>
                    <option value="FULL">Inventario Completo Mensual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Almacén / Bodega</label>
                  <select
                    value={auditWarehouseId}
                    onChange={(e) => setAuditWarehouseId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Almacén General (Cocina Principal)</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.code ? `(${w.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Categoría</label>
                  <select
                    value={auditCategoryFilter}
                    onChange={(e) => setAuditCategoryFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="ALL">Todos los Insumos</option>
                    <option value="RAW">Materias Primas Solamente</option>
                    <option value="PREPARED">Sub-Recetas / Producción</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Notas / Motivo</label>
                  <input
                    type="text"
                    placeholder="Ej. Cierre quincenal de cocina"
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Insumos Search Bar */}
              <div className="px-5 pt-3 pb-2 flex justify-between items-center gap-4 bg-slate-900">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar insumo para conteo..."
                    value={blindAuditSearch}
                    onChange={(e) => setBlindAuditSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="text-xs text-slate-400">
                  Insumos contados: <strong className="text-amber-400">{countedCount}</strong> de {filteredIngredientsForAudit.length}
                </div>
              </div>

              {/* Items List for Counting */}
              <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
                <div className="grid grid-cols-12 text-[11px] font-semibold text-slate-400 px-3 py-1.5 bg-slate-950/60 rounded-lg">
                  <div className="col-span-5">Insumo / Unidad</div>
                  {revealStockInModal && <div className="col-span-2 text-right">Stock Sistema</div>}
                  <div className={revealStockInModal ? 'col-span-3 text-right' : 'col-span-5 text-right'}>
                    Conteo Físico Real
                  </div>
                  <div className="col-span-2">Notas</div>
                </div>

                {filteredIngredientsForAudit.map((ing) => {
                  const currentCount = countedQuantities[ing.id];
                  const hasCount = typeof currentCount === 'number';

                  return (
                    <div
                      key={ing.id}
                      className={`grid grid-cols-12 items-center px-3 py-2 rounded-lg border transition-colors ${
                        hasCount
                          ? 'bg-amber-500/5 border-amber-500/30'
                          : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="col-span-5">
                        <div className="font-bold text-white text-xs">{ing.name}</div>
                        <div className="text-[10px] text-slate-400">
                          Unidad: {ing.unit} | Costo unitario: ${ing.cost.toFixed(2)}
                        </div>
                      </div>

                      {revealStockInModal && (
                        <div className="col-span-2 text-right font-mono text-xs text-slate-400 pr-2">
                          {ing.stock} {ing.unit}
                        </div>
                      )}

                      <div className={revealStockInModal ? 'col-span-3 flex justify-end pr-2' : 'col-span-5 flex justify-end pr-2'}>
                        <div className="relative w-32">
                          <input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={currentCount ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                              setCountedQuantities((prev) => {
                                const next = { ...prev };
                                if (val === undefined) {
                                  delete next[ing.id];
                                } else {
                                  next[ing.id] = val;
                                }
                                return next;
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2.5 text-right font-mono text-xs text-amber-300 font-bold focus:border-amber-500 focus:outline-none"
                          />
                          <span className="absolute right-2 top-2 text-[10px] text-slate-500 pointer-events-none">
                            {ing.unit}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Obs..."
                          value={itemNotes[ing.id] || ''}
                          onChange={(e) =>
                            setItemNotes((prev) => ({
                              ...prev,
                              [ing.id]: e.target.value,
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded py-1 px-2 text-[11px] text-slate-300 focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
                <div className="text-xs text-slate-400">
                  Al guardar, el sistema calculará las diferencias teóricas y generará el reporte de varianza.
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBlindAuditModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAudit || countedCount === 0}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submittingAudit ? 'Guardando Arqueo...' : `Guardar Arqueo (${countedCount} Insumos)`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL 2: DETALLE DE AUDITORÍA ===================== */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Auditoría {selectedAudit.auditNumber}
                    {selectedAudit.adjustmentFolio && (
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                        {selectedAudit.adjustmentFolio}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      selectedAudit.status === 'APPLIED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {selectedAudit.status === 'APPLIED' ? 'APLICADO A STOCK' : 'AUDITADO'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {new Date(selectedAudit.createdAt).toLocaleString('es-MX')} | Auditor: {selectedAudit.conductedBy?.name || 'Sistema'}
                    {selectedAudit.approvedByName && ` • Aprobó: ${selectedAudit.approvedByName}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintAuditTicket(selectedAudit.id)}
                  disabled={loadingThermal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-amber-400" />
                  <span>Imprimir Ticket</span>
                </button>

                <button
                  onClick={() => setSelectedAudit(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Financial Summary KPIs */}
            <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 font-semibold">Valor Esperado Sistema</span>
                <div className="text-lg font-bold text-slate-200 mt-0.5">
                  ${selectedAudit.totalExpectedValue?.toFixed(2)}
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 font-semibold">Valor Físico Contado</span>
                <div className="text-lg font-bold text-white mt-0.5">
                  ${selectedAudit.totalCountedValue?.toFixed(2)}
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 font-semibold">Descuadre / Varianza Total</span>
                <div className={`text-lg font-black mt-0.5 ${
                  selectedAudit.totalDiscrepancyValue < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  ${selectedAudit.totalDiscrepancyValue?.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto p-5">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Insumo</th>
                    <th className="p-2.5 text-right">Stock Esperado</th>
                    <th className="p-2.5 text-right">Conteo Físico</th>
                    <th className="p-2.5 text-right">Diferencia</th>
                    <th className="p-2.5 text-center">Diagnóstico Varianza</th>
                    <th className="p-2.5 text-right">Costo Unitario</th>
                    <th className="p-2.5 text-right">Impacto Financiero</th>
                    <th className="p-2.5">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {selectedAudit.items?.map((item: any) => {
                    const isTheftSuspect = item.varianceType === 'THEFT_SUSPECT' || (item.discrepancyCost <= -500);
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/30">
                        <td className="p-2.5 font-bold text-white">
                          {item.ingredient?.name}
                        </td>
                        <td className="p-2.5 text-right text-slate-400">
                          {item.expectedStock} {item.ingredient?.unit}
                        </td>
                        <td className="p-2.5 text-right font-bold text-white">
                          {item.countedStock} {item.ingredient?.unit}
                        </td>
                        <td className="p-2.5 text-right font-bold">
                          <span className={item.discrepancy < 0 ? 'text-rose-400' : item.discrepancy > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                            {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy} {item.ingredient?.unit}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          {isTheftSuspect ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                              ⚠️ ALERTA FUGA
                            </span>
                          ) : item.discrepancy < 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              MERMA OCULTA
                            </span>
                          ) : item.discrepancy > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              SOBRANTE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                              EXACTO
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right text-slate-400">
                          ${item.unitCost?.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-black">
                          <span className={item.discrepancyCost < 0 ? 'text-rose-400' : item.discrepancyCost > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                            ${item.discrepancyCost?.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-500">
                          {item.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                {selectedAudit.notes ? `Nota: ${selectedAudit.notes}` : 'Sin observaciones adicionales'}
              </span>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedAudit(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                {selectedAudit.status !== 'APPLIED' && (
                  <button
                    onClick={() => handleOpenApprovalModal(selectedAudit)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    Aplicar Ajuste a Stock Físico
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 3: APROBACIÓN GERENCIAL DE AJUSTE CONTABLE ===================== */}
      {approvalModalAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Aprobación de Ajuste Físico</h3>
                  <p className="text-xs text-slate-400">
                    Folio Auditoría: {approvalModalAudit.auditNumber}
                  </p>
                </div>
              </div>
              <button onClick={() => setApprovalModalAudit(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Almacén a Afectar:</span>
                <span className="font-bold text-white">{approvalModalAudit.warehouse?.name || 'Almacén General'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Descuadre Neto:</span>
                <span className={`font-mono font-bold ${approvalModalAudit.totalDiscrepancyValue < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  ${approvalModalAudit.totalDiscrepancyValue?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Impacto en Mermas:</span>
                <span className="font-bold text-amber-300">
                  {approvalModalAudit.totalDiscrepancyValue < 0 ? `Se generará asiento en WasteLog` : 'Sin pérdidas registradas'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">
                Observaciones del Dictamen Gerencial (Opcional):
              </label>
              <textarea
                rows={2}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Ej. Aprobado ajuste tras arqueo quincenal. Se identificó merma por evaporación en cámara fría."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApprovalModalAudit(null)}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={applyingAudit}
                className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>{applyingAudit ? 'Aplicando...' : 'Autorizar y Ajustar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 4: COMPROBANTE TÉRMICO ESC/POS ===================== */}
      {thermalPrintAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Comprobante Térmico ESC/POS</h3>
                  <p className="text-xs text-slate-400">
                    Formato de 80mm para comanderas y archivo de bodega
                  </p>
                </div>
              </div>
              <button onClick={() => setThermalPrintAudit(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Receipt Preview */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl max-h-72 overflow-y-auto">
              <pre className="font-mono text-[11px] leading-tight text-amber-200/90 whitespace-pre">
                {thermalPrintAudit.ticketText}
              </pre>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(thermalPrintAudit.ticketText);
                  setCopiedThermal(true);
                  setTimeout(() => setCopiedThermal(false), 2000);
                }}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedThermal ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                <span>{copiedThermal ? 'Copiado' : 'Copiar Texto'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="w-1/2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
