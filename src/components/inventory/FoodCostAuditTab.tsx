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
  X
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
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);
  const [loadingAuditDetail, setLoadingAuditDetail] = useState(false);

  // New Blind Audit modal state
  const [showBlindAuditModal, setShowBlindAuditModal] = useState(false);
  const [auditType, setAuditType] = useState<'BLIND' | 'FULL'>('BLIND');
  const [auditWarehouseId, setAuditWarehouseId] = useState<string>('');
  const [auditNotes, setAuditNotes] = useState('');
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [blindAuditSearch, setBlindAuditSearch] = useState('');
  const [revealStockInModal, setRevealStockInModal] = useState(false);
  const [submittingAudit, setSubmittingAudit] = useState(false);
  const [applyingAuditId, setApplyingAuditId] = useState<string | null>(null);

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
        setAudits(data);
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

  // Aplicar ajuste de auditoría física a las existencias
  const handleApplyAudit = async (auditId: string) => {
    if (!confirm('¿Confirmas aplicar este arqueo físico a las existencias reales del inventario? Los faltantes se registrarán automáticamente en la bitácora de mermas.')) {
      return;
    }

    try {
      setApplyingAuditId(auditId);
      const res = await fetch(`/api/inventory/audit/${auditId}/apply`, {
        method: 'POST',
      });

      if (res.ok) {
        alert('Ajuste aplicado exitosamente a las existencias');
        await loadAudits();
        if (selectedAudit && selectedAudit.id === auditId) {
          await handleViewAuditDetail(auditId);
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
      setApplyingAuditId(null);
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
          notes: auditNotes || undefined,
          items: itemsToSubmit,
        }),
      });

      if (res.ok) {
        const created = await res.json();
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

  // Filtrado de insumos en la tabla de Food Cost
  const filteredIngredients = (report?.ingredientsConsumption || []).filter((item) =>
    item.name.toLowerCase().includes(ingredientSearch.toLowerCase())
  );

  // Filtrado de platillos en Ingeniería de Menú
  const filteredMenuItems = (report?.menuEngineering?.items || []).filter((item) => {
    if (menuFilter === 'ALL') return true;
    return item.classification === menuFilter;
  });

  // Filtrado de insumos para el modal de conteo ciego
  const filteredIngredientsForAudit = ingredients.filter((ing) =>
    ing.name.toLowerCase().includes(blindAuditSearch.toLowerCase())
  );

  const countedCount = Object.keys(countedQuantities).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Range Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-400" />
            Auditoría de Costos & Receta Teórica vs Consumo Real
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Análisis de Food Cost, control antifraude con inventario ciego y matriz BCG de rentabilidad
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Selector de Período */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setPeriodRange('today')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                periodRange === 'today'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setPeriodRange('week')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                periodRange === 'week'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Días
            </button>
            <button
              onClick={() => setPeriodRange('month')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                periodRange === 'month'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              30 Días
            </button>
            <button
              onClick={() => setPeriodRange('all')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                periodRange === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Histórico
            </button>
          </div>

          <button
            onClick={() => {
              loadFoodCostReport(periodRange);
              if (subTab === 'audits') loadAudits();
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Refrescar datos"
          >
            <RefreshCw className={`h-4 w-4 ${loadingReport ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setCountedQuantities({});
              setItemNotes({});
              setRevealStockInModal(false);
              setShowBlindAuditModal(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nuevo Arqueo Ciego
          </button>
        </div>
      </div>

      {/* KPI Banners - Financial Summary */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Ventas Netas */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Ventas Netas ({report.financialSummary.totalOrdersCount} ped.)</span>
            <div className="text-2xl font-black text-white mt-1">
              ${report.financialSummary.totalNetSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-500">Base para % Food Cost</span>
          </div>

          {/* Food Cost Teórico */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-medium">Food Cost Teórico</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                Fichas Técnicas
              </span>
            </div>
            <div className="text-2xl font-black text-blue-400 mt-1">
              {report.financialSummary.theoreticalFoodCostPct}%
            </div>
            <span className="text-[11px] text-slate-400">
              ${report.financialSummary.theoreticalFoodCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Food Cost Real */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-medium">Food Cost Real</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                report.financialSummary.health === 'EXCELLENT' ? 'bg-emerald-500/20 text-emerald-400' :
                report.financialSummary.health === 'GOOD' ? 'bg-blue-500/20 text-blue-400' :
                report.financialSummary.health === 'WARNING' ? 'bg-amber-500/20 text-amber-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {report.financialSummary.healthBadge}
              </span>
            </div>
            <div className={`text-2xl font-black mt-1 ${
              report.financialSummary.realFoodCostPct > 34 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {report.financialSummary.realFoodCostPct}%
            </div>
            <span className="text-[11px] text-slate-400">
              ${report.financialSummary.realFoodCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Desviación / Descuadre */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Varianza de Costo</span>
            <div className={`text-2xl font-black mt-1 flex items-center gap-1 ${
              report.financialSummary.variancePctPoints > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {report.financialSummary.variancePctPoints > 0 ? (
                <ArrowUpRight className="h-5 w-5" />
              ) : (
                <ArrowDownRight className="h-5 w-5" />
              )}
              {Math.abs(report.financialSummary.variancePctPoints)}%
            </div>
            <span className="text-[11px] text-slate-500">Puntos sobre el teórico</span>
          </div>

          {/* Mermas & Fugas Ocultas */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Mermas y Fugas en $</span>
            <div className="text-2xl font-black text-rose-400 mt-1">
              ${(report.financialSummary.registeredWasteCost + report.financialSummary.unregisteredDiscrepancyCost).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-500">
              Mermas: ${report.financialSummary.registeredWasteCost} | Descuadres: ${report.financialSummary.unregisteredDiscrepancyCost}
            </span>
          </div>
        </div>
      )}

      {/* Sub-tab Switcher: Food Cost vs Auditorías Físicas */}
      <div className="flex border-b border-slate-800 gap-4 text-xs font-bold">
        <button
          onClick={() => setSubTab('food-cost')}
          className={`pb-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            subTab === 'food-cost'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Scale className="h-4 w-4" />
          Ficha Técnica vs Consumo Real & Matriz BCG
        </button>
        <button
          onClick={() => setSubTab('audits')}
          className={`pb-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            subTab === 'audits'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Historial de Inventarios Físicos & Arqueos Ciegos
        </button>
      </div>

      {/* ===================== SUBTAB 1: FOOD COST & MENU ENGINEERING ===================== */}
      {subTab === 'food-cost' && (
        <div className="space-y-8">
          {/* SECTION 1: Matriz de Ingeniería de Menú (BCG Gastronómica) */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Matriz de Rentabilidad & Popularidad (Menú Engineering)
                </h3>
                <p className="text-xs text-slate-400">
                  Clasificación de platillos según margen de contribución y volumen de ventas
                </p>
              </div>

              {/* Badges de Cuadrantes BCG */}
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => setMenuFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                    menuFilter === 'ALL'
                      ? 'bg-slate-800 border-slate-600 text-white font-bold'
                      : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({report?.menuEngineering.items.length || 0})
                </button>
                <button
                  onClick={() => setMenuFilter('STAR')}
                  className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    menuFilter === 'STAR'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                      : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🌟 Estrellas</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">
                    {report?.menuEngineering.starsCount || 0}
                  </span>
                </button>
                <button
                  onClick={() => setMenuFilter('PLOWHORSE')}
                  className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    menuFilter === 'PLOWHORSE'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold'
                      : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🐎 Caballos de Batalla</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">
                    {report?.menuEngineering.plowhorsesCount || 0}
                  </span>
                </button>
                <button
                  onClick={() => setMenuFilter('PUZZLE')}
                  className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    menuFilter === 'PUZZLE'
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                      : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🧩 Rompecabezas</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">
                    {report?.menuEngineering.puzzlesCount || 0}
                  </span>
                </button>
                <button
                  onClick={() => setMenuFilter('DOG')}
                  className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    menuFilter === 'DOG'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                      : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🐶 Perros</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">
                    {report?.menuEngineering.dogsCount || 0}
                  </span>
                </button>
              </div>
            </div>

            {/* Tabla de Platillos y Rentabilidad */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Platillo</th>
                    <th className="p-3 text-right">Precio Venta</th>
                    <th className="p-3 text-right">Costo Receta</th>
                    <th className="p-3 text-right">Margen Bruto</th>
                    <th className="p-3 text-center">% Margen</th>
                    <th className="p-3 text-center">Unid. Vendidas</th>
                    <th className="p-3 text-right">Utilidad Total</th>
                    <th className="p-3 text-center">Clasificación BCG</th>
                    <th className="p-3">Recomendación Soft Restaurant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMenuItems.map((item) => {
                    let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
                    let label = 'DOG';
                    if (item.classification === 'STAR') {
                      badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                      label = '🌟 Estrella';
                    } else if (item.classification === 'PLOWHORSE') {
                      badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
                      label = '🐎 Caballo Batalla';
                    } else if (item.classification === 'PUZZLE') {
                      badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
                      label = '🧩 Rompecabezas';
                    } else {
                      badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
                      label = '🐶 Perro';
                    }

                    return (
                      <tr key={item.productId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-bold text-white">{item.name}</td>
                        <td className="p-3 text-right font-medium text-slate-200">
                          ${item.price.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-slate-400">
                          ${item.recipeCost.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-400">
                          ${item.margin.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            item.marginPct >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
                            item.marginPct >= 50 ? 'bg-blue-500/10 text-blue-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>
                            {item.marginPct}%
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-white">
                          {item.unitsSold}
                        </td>
                        <td className="p-3 text-right font-black text-amber-400">
                          ${item.totalProfit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${badgeClass}`}>
                            {label}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-400 max-w-xs">
                          {item.recommendation}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMenuItems.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-500">
                        No hay platillos en este cuadrante para el período seleccionado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 2: Consumo Teórico de Insumos vs Existencias & PPP */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-400" />
                  Consumo Teórico de Insumos vs Stock & Precio Promedio Ponderado (PPP)
                </h3>
                <p className="text-xs text-slate-400">
                  Explosión de materias primas por ventas vs compras y variaciones de costo en compras
                </p>
              </div>

              <div className="relative w-full sm:w-64">
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

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Insumo / Materia Prima</th>
                    <th className="p-3 text-right">Consumo Teórico</th>
                    <th className="p-3 text-right">Costo Teórico ($)</th>
                    <th className="p-3 text-right">Stock Actual</th>
                    <th className="p-3 text-right">Costo Estándar</th>
                    <th className="p-3 text-right">PPP (Compras)</th>
                    <th className="p-3 text-center">Variación Costo</th>
                    <th className="p-3 text-right">Mermas Reg.</th>
                    <th className="p-3 text-right">Descuadre Físico</th>
                    <th className="p-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredIngredients.map((ing) => (
                    <tr key={ing.ingredientId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white">{ing.name}</div>
                        <div className="text-[10px] text-slate-500">Unidad: {ing.unit}</div>
                      </td>
                      <td className="p-3 text-right font-medium text-slate-200">
                        {ing.theoreticalQty} {ing.unit}
                      </td>
                      <td className="p-3 text-right font-bold text-blue-400">
                        ${ing.theoreticalCost.toFixed(2)}
                      </td>
                      <td className="p-3 text-right">
                        <span className={`font-semibold ${
                          ing.currentStock <= ing.minStock ? 'text-red-400' : 'text-slate-200'
                        }`}>
                          {ing.currentStock} {ing.unit}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-400">
                        ${ing.unitCost.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-300">
                        ${ing.averagePurchaseCost.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          ing.costVariancePct > 10 ? 'bg-red-500/20 text-red-400' :
                          ing.costVariancePct < -5 ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {ing.costVariancePct > 0 ? `+${ing.costVariancePct}%` : `${ing.costVariancePct}%`}
                        </span>
                      </td>
                      <td className="p-3 text-right text-rose-400">
                        {ing.registeredWasteQty > 0 ? (
                          <span>${ing.registeredWasteCost.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {ing.discrepancyQty !== 0 ? (
                          <span className={`font-bold ${ing.discrepancyCost < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {ing.discrepancyQty > 0 ? `+${ing.discrepancyQty}` : ing.discrepancyQty} {ing.unit} (${ing.discrepancyCost.toFixed(2)})
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono">0.00</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ing.status === 'OPTIMAL' ? 'bg-emerald-500/20 text-emerald-400' :
                          ing.status === 'WARNING' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {ing.status === 'OPTIMAL' ? 'ÓPTIMO' : ing.status === 'WARNING' ? 'REVISAR' : 'CRÍTICO'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredIngredients.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-500">
                        No se encontraron insumos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SUBTAB 2: HISTORIAL DE ARQUEOS FÍSICOS ===================== */}
      {subTab === 'audits' && (
        <div className="space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                  Auditorías Físicas de Inventario (Arqueos Ciegos)
                </h3>
                <p className="text-xs text-slate-400">
                  Control inmutable de recuentos físicos para prevención de mermas ocultas y robo hormiga
                </p>
              </div>

              <button
                onClick={() => {
                  setCountedQuantities({});
                  setItemNotes({});
                  setRevealStockInModal(false);
                  setShowBlindAuditModal(true);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Registrar Nuevo Arqueo Ciego
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Folio</th>
                    <th className="p-3">Fecha y Hora</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Almacén / Bodega</th>
                    <th className="p-3">Auditor / Usuario</th>
                    <th className="p-3 text-right">Valor Teórico ($)</th>
                    <th className="p-3 text-right">Valor Físico ($)</th>
                    <th className="p-3 text-right">Descuadre ($)</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {audits.map((aud) => (
                    <tr key={aud.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-amber-400">
                        {aud.auditNumber}
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
                        {aud.conductedBy?.name || 'Sistema'}
                      </td>
                      <td className="p-3 text-right text-slate-400">
                        ${aud.totalExpectedValue?.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-bold text-white">
                        ${aud.totalCountedValue?.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-black">
                        <span className={aud.totalDiscrepancyValue < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                          ${aud.totalDiscrepancyValue?.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          aud.status === 'APPLIED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {aud.status === 'APPLIED' ? 'APLICADO A STOCK' : 'PENDIENTE / AUDITADO'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => handleViewAuditDetail(aud.id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded transition-colors cursor-pointer"
                          >
                            Ver Detalle
                          </button>
                          {aud.status !== 'APPLIED' && (
                            <button
                              onClick={() => handleApplyAudit(aud.id)}
                              disabled={applyingAuditId === aud.id}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {applyingAuditId === aud.id ? 'Aplicando...' : 'Aplicar a Stock'}
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
              <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Arqueo</label>
                  <select
                    value={auditType}
                    onChange={(e: any) => setAuditType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="BLIND">Arqueo Ciego (Recomendado Antifraude)</option>
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
                  Insumos contados: <strong className="text-amber-400">{countedCount}</strong> de {ingredients.length}
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
                  <div className={revealStockInModal ? 'col-span-2' : 'col-span-2'}>Notas</div>
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
                  Al guardar, el sistema calculará las diferencias teóricas y generará el reporte de auditoría.
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
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Auditoría {selectedAudit.auditNumber}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      selectedAudit.status === 'APPLIED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {selectedAudit.status === 'APPLIED' ? 'APLICADO A STOCK' : 'AUDITADO'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {new Date(selectedAudit.createdAt).toLocaleString('es-MX')} | Auditor: {selectedAudit.conductedBy?.name || 'Sistema'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedAudit(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Financial Summary KPIs */}
            <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400">Valor Esperado Sistema</span>
                <div className="text-lg font-bold text-slate-200 mt-0.5">
                  ${selectedAudit.totalExpectedValue?.toFixed(2)}
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400">Valor Físico Contado</span>
                <div className="text-lg font-bold text-white mt-0.5">
                  ${selectedAudit.totalCountedValue?.toFixed(2)}
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400">Descuadre / Varianza Total</span>
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
                    <th className="p-2.5 text-right">Costo Unitario</th>
                    <th className="p-2.5 text-right">Impacto Financiero</th>
                    <th className="p-2.5">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {selectedAudit.items?.map((item: any) => (
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
                  ))}
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
                    onClick={() => handleApplyAudit(selectedAudit.id)}
                    disabled={applyingAuditId === selectedAudit.id}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {applyingAuditId === selectedAudit.id ? 'Aplicando...' : 'Aplicar Ajuste a Stock Físico'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
