'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Users,
  Utensils,
  Clock,
  RotateCcw,
  Sliders,
  Download,
  Calendar,
  Layers,
  ChefHat,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Save,
  X,
  Sparkles,
  PieChart as PieIcon,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

interface PnLSummary {
  date: string;
  shift: string;
  ordersCount: number;
  averageTicket: number;
  grossSales: number;
  netSales: number;
  discountsTotal: number;
  compsRetailTotal: number;
  taxesTotal: number;
  tipsTotal: number;
  deliveryFeesTotal: number;
  recipesCogs: number;
  wasteCost: number;
  compsFoodCost: number;
  totalCOGS: number;
  foodCostPct: number;
  foodCostVariance: number;
  targetFoodCostPct: number;
  totalLaborCost: number;
  totalLaborHours: number;
  headcount: number;
  laborCostPct: number;
  laborCostVariance: number;
  targetLaborCostPct: number;
  primeCostTotal: number;
  primeCostPct: number;
  primeCostVariance: number;
  targetPrimeCostPct: number;
  primeCostHealth: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  netContributionMargin: number;
  netContributionMarginPct: number;
  targetDailySales: number;
}

interface HourlyBucket {
  hour: string;
  hourNumber: number;
  netSales: number;
  cogs: number;
  labor: number;
  primeCost: number;
  netMargin: number;
  ordersCount: number;
}

interface TopDishMargin {
  productName: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  margin: number;
  marginPct: number;
}

interface WorkerShiftItem {
  userId: string;
  userName: string;
  role: string;
  clockIn: string;
  clockOut: string | null;
  status: string;
  hoursWorked: number;
  hourlyWage: number;
  totalCost: number;
}

export default function RealtimePnLTab() {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedShift, setSelectedShift] = useState<string>('ALL_DAY');

  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<PnLSummary | null>(null);
  const [hourlyTimeline, setHourlyTimeline] = useState<HourlyBucket[]>([]);
  const [topDishesMargin, setTopDishesMargin] = useState<TopDishMargin[]>([]);
  const [workersShift, setWorkersShift] = useState<WorkerShiftItem[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  // Budget Modal State
  const [budgetModalOpen, setBudgetModalOpen] = useState<boolean>(false);
  const [targetFoodCost, setTargetFoodCost] = useState<number>(30);
  const [targetLaborCost, setTargetLaborCost] = useState<number>(20);
  const [targetPrimeCost, setTargetPrimeCost] = useState<number>(55);
  const [targetDailySales, setTargetDailySales] = useState<number>(15000);
  const [savingBudget, setSavingBudget] = useState<boolean>(false);

  // Active view tab in bottom section
  const [detailTab, setDetailTab] = useState<'dishes' | 'workers' | 'cogs'>('dishes');

  // Fetch PnL Data
  const fetchPnL = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/pnl?date=${selectedDate}&shift=${selectedShift}`
      );
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setHourlyTimeline(data.hourlyTimeline || []);
        setTopDishesMargin(data.topDishesMargin || []);
        setWorkersShift(data.workersShift || []);
        setInsights(data.insights || []);

        if (data.summary) {
          setTargetFoodCost(data.summary.targetFoodCostPct);
          setTargetLaborCost(data.summary.targetLaborCostPct);
          setTargetPrimeCost(data.summary.targetPrimeCostPct);
          setTargetDailySales(data.summary.targetDailySales);
        }
      }
    } catch (e) {
      console.error('Error fetching P&L data:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedShift]);

  useEffect(() => {
    fetchPnL();
  }, [fetchPnL]);

  // Handle Save Budget Targets
  const handleSaveBudget = async () => {
    setSavingBudget(true);
    try {
      const res = await fetch('/api/brand/budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetFoodCostPct: targetFoodCost,
          targetLaborCostPct: targetLaborCost,
          targetPrimeCostPct: targetPrimeCost,
          targetDailySales: targetDailySales,
        }),
      });

      if (res.ok) {
        alert('✅ Metas presupuestales actualizadas.');
        setBudgetModalOpen(false);
        fetchPnL();
      } else {
        alert('Error al actualizar metas presupuestales.');
      }
    } catch (e) {
      console.error('Save budget error', e);
    } finally {
      setSavingBudget(false);
    }
  };

  // Export CSV with UTF-8 BOM
  const handleExportCSV = () => {
    if (!summary) return;

    const rows: string[][] = [
      ['DARKFLOW MANAGER - REPORTE DE P&L OPERATIVO EN TIEMPO REAL'],
      ['Fecha:', summary.date],
      ['Turno:', summary.shift],
      ['Generado el:', new Date().toLocaleString('es-MX')],
      [],
      ['INDICADOR', 'MONTO ($)', '% S/VENTA NETA', 'META PRESUPUESTAL', 'DESVIO'],
      ['Ventas Brutas', summary.grossSales.toFixed(2), '', '', ''],
      ['Cortesias Concedidas', summary.compsRetailTotal.toFixed(2), '', '', ''],
      ['Ventas Netas Reales', summary.netSales.toFixed(2), '100.0%', `$${summary.targetDailySales.toFixed(2)}`, ''],
      ['Costo de Insumos (Recetas)', summary.recipesCogs.toFixed(2), '', '', ''],
      ['Mermas y Desperdicio', summary.wasteCost.toFixed(2), '', '', ''],
      ['Comida de Personal (Food Cost)', summary.compsFoodCost.toFixed(2), '', '', ''],
      ['Costo Total de Materia Prima (COGS)', summary.totalCOGS.toFixed(2), `${summary.foodCostPct.toFixed(1)}%`, `${summary.targetFoodCostPct}%`, `${summary.foodCostVariance >= 0 ? '+' : ''}${summary.foodCostVariance.toFixed(1)}%`],
      ['Mano de Obra Estimada (Labor Cost)', summary.totalLaborCost.toFixed(2), `${summary.laborCostPct.toFixed(1)}%`, `${summary.targetLaborCostPct}%`, `${summary.laborCostVariance >= 0 ? '+' : ''}${summary.laborCostVariance.toFixed(1)}%`],
      ['Prime Cost (COGS + Labor)', summary.primeCostTotal.toFixed(2), `${summary.primeCostPct.toFixed(1)}%`, `${summary.targetPrimeCostPct}%`, `${summary.primeCostVariance >= 0 ? '+' : ''}${summary.primeCostVariance.toFixed(1)}%`],
      ['Margen de Contribucion Operativo', summary.netContributionMargin.toFixed(2), `${summary.netContributionMarginPct.toFixed(1)}%`, '', ''],
      [],
      ['DESGLOSE POR HORA DEL DIA'],
      ['Hora', 'Venta Neta ($)', 'COGS ($)', 'Mano de Obra ($)', 'Prime Cost ($)', 'Margen Neto ($)', 'Comandas'],
      ...hourlyTimeline
        .filter((h) => h.netSales > 0 || h.labor > 0)
        .map((h) => [
          h.hour,
          h.netSales.toFixed(2),
          h.cogs.toFixed(2),
          h.labor.toFixed(2),
          h.primeCost.toFixed(2),
          h.netMargin.toFixed(2),
          h.ordersCount.toString(),
        ]),
      [],
      ['TOP PLATILLOS POR CONTRIBUCION'],
      ['Platillo', 'Unidades', 'Venta ($)', 'Costo Insumos ($)', 'Margen Bruto ($)', 'Margen %'],
      ...topDishesMargin.map((d) => [
        d.productName,
        d.unitsSold.toString(),
        d.revenue.toFixed(2),
        d.cogs.toFixed(2),
        d.margin.toFixed(2),
        `${d.marginPct.toFixed(1)}%`,
      ]),
    ];

    const csvContent = '\uFEFF' + rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pnl_${summary.date}_${summary.shift.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter timeline for non-zero hours or show operational hours (11:00 to 23:00)
  const chartData = useMemo(() => {
    return hourlyTimeline.filter((h) => (h.hourNumber >= 10 && h.hourNumber <= 23) || h.netSales > 0 || h.labor > 0);
  }, [hourlyTimeline]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & CONTROLS                                                 */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                P&L Dinámico & Rentabilidad en Vivo
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  Fase 43 Operativa
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Monitoreo en tiempo real de Ventas Netas, COGS por recetas, Mano de Obra activa y Prime Cost restaurantero.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchPnL}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              Actualizar
            </button>

            <button
              onClick={() => setBudgetModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Metas Presupuestales
            </button>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Date & Shift Selectors */}
        <div className="mt-5 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Input */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Fecha:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none"
              />
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="text-[11px] font-bold text-amber-400 hover:underline ml-1"
              >
                Hoy
              </button>
            </div>

            {/* Shift Select Buttons */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setSelectedShift('ALL_DAY')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  selectedShift === 'ALL_DAY' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todo el Día
              </button>
              <button
                onClick={() => setSelectedShift('LUNCH')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  selectedShift === 'LUNCH' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                ☀️ Almuerzo
              </button>
              <button
                onClick={() => setSelectedShift('DINNER')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  selectedShift === 'DINNER' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                🌙 Cena
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-3">
            <span>Comandas: <strong className="text-white">{summary?.ordersCount || 0}</strong></span>
            <span>•</span>
            <span>Ticket Promedio: <strong className="text-white">${summary?.averageTicket.toFixed(2) || '0.00'}</strong></span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. LIVE FINANCIAL KPI CARDS (THE BIG 5)                                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Net Sales */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
              <span>Ventas Netas</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-black text-white mt-1.5">
              ${summary?.netSales.toFixed(2) || '0.00'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Meta: ${summary?.targetDailySales.toFixed(0)}
            </p>
          </div>
          {/* Progress to target */}
          <div className="mt-3">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full"
                style={{
                  width: `${Math.min(100, summary && summary.targetDailySales > 0 ? (summary.netSales / summary.targetDailySales) * 100 : 0)}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-slate-400 text-right mt-1">
              {summary && summary.targetDailySales > 0 ? Math.round((summary.netSales / summary.targetDailySales) * 100) : 0}% de meta
            </p>
          </div>
        </div>

        {/* Card 2: Food Cost (COGS) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
              <span>Food Cost Real</span>
              <Utensils className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <h3 className="text-2xl font-black text-amber-400">
                {summary?.foodCostPct.toFixed(1) || '0.0'}%
              </h3>
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${
                  summary && summary.foodCostVariance <= 0
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {summary && summary.foodCostVariance <= 0 ? '' : '+'}
                {summary?.foodCostVariance.toFixed(1)}% vs meta
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              ${summary?.totalCOGS.toFixed(2) || '0.00'} insumos
            </p>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 border-t border-slate-800/80 pt-1 flex justify-between">
            <span>Meta: {summary?.targetFoodCostPct}%</span>
            <span>Mermas: ${summary?.wasteCost.toFixed(0)}</span>
          </div>
        </div>

        {/* Card 3: Labor Cost */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
              <span>Mano de Obra</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <h3 className="text-2xl font-black text-blue-400">
                {summary?.laborCostPct.toFixed(1) || '0.0'}%
              </h3>
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${
                  summary && summary.laborCostVariance <= 0
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {summary && summary.laborCostVariance <= 0 ? '' : '+'}
                {summary?.laborCostVariance.toFixed(1)}% vs meta
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              ${summary?.totalLaborCost.toFixed(2) || '0.00'} ({summary?.totalLaborHours} hrs)
            </p>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 border-t border-slate-800/80 pt-1 flex justify-between">
            <span>Meta: {summary?.targetLaborCostPct}%</span>
            <span>Personal: {summary?.headcount}</span>
          </div>
        </div>

        {/* Card 4: Prime Cost (Food + Labor) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
              <span>Prime Cost Total</span>
              <ShieldAlert className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <h3
                className={`text-2xl font-black ${
                  summary?.primeCostHealth === 'HEALTHY'
                    ? 'text-emerald-400'
                    : summary?.primeCostHealth === 'AT_RISK'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {summary?.primeCostPct.toFixed(1) || '0.0'}%
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  summary?.primeCostHealth === 'HEALTHY'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : summary?.primeCostHealth === 'AT_RISK'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                }`}
              >
                {summary?.primeCostHealth === 'HEALTHY' ? 'Saludable' : summary?.primeCostHealth === 'AT_RISK' ? 'En Riesgo' : 'Crítico'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              ${summary?.primeCostTotal.toFixed(2) || '0.00'} total
            </p>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 border-t border-slate-800/80 pt-1 flex justify-between">
            <span>Meta: &le; {summary?.targetPrimeCostPct}%</span>
            <span>Estándar: &le; 60%</span>
          </div>
        </div>

        {/* Card 5: Net Operating Margin */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
              <span>Margen Operativo</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <h3
              className={`text-2xl font-black mt-1.5 ${
                summary && summary.netContributionMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              ${summary?.netContributionMargin.toFixed(2) || '0.00'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              {summary?.netContributionMarginPct.toFixed(1)}% margen s/venta
            </p>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 border-t border-slate-800/80 pt-1 flex justify-between">
            <span>Ventas - Prime Cost</span>
            <span className="font-bold text-emerald-400">Net Contribution</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. AI ACTIONABLE PRESCRIPTIVE INSIGHTS                                     */}
      {/* ========================================================================= */}
      {insights.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-2.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Diagnóstico Operativo & Alertas Inteligentes de Turno
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 flex items-start gap-2.5"
              >
                <span className="text-base leading-none">💡</span>
                <span className="leading-relaxed">{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. HOURLY P&L TIMELINE CHART (BARS + LINES)                               */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Curva de Rentabilidad Hora por Hora
            </h3>
            <p className="text-xs text-slate-400">
              Correlación en vivo entre Venta Neta, Insumos (COGS), Costo Laboral y Margen Operativo.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-3 rounded bg-emerald-500/80" /> Venta Neta
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1 bg-amber-400" /> COGS (Insumos)
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1 bg-blue-400" /> Nómina (Labor)
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1 bg-purple-400 stroke-dasharray-2" /> Margen Neto
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Sin movimientos registrados en este turno
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any) => {
                    const labelMap: Record<string, string> = {
                      netSales: 'Venta Neta',
                      cogs: 'Insumos (COGS)',
                      labor: 'Mano de Obra',
                      netMargin: 'Margen Operativo',
                    };
                    return [`$${Number(value).toFixed(2)}`, labelMap[name] || name];
                  }}
                />
                <Bar dataKey="netSales" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.65} />
                <Line type="monotone" dataKey="cogs" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="labor" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="netMargin" stroke="#c084fc" strokeWidth={3} strokeDasharray="4 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. DETAILED BREAKDOWNS (DISHES, WORKERS, COGS STRUCTURE)                  */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-800 p-2 bg-slate-950/40 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setDetailTab('dishes')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                detailTab === 'dishes'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              ⭐ Top Platillos Generadores de Margen
            </button>
            <button
              onClick={() => setDetailTab('workers')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                detailTab === 'workers'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              👥 Personal en Turno & Horas ({workersShift.length})
            </button>
            <button
              onClick={() => setDetailTab('cogs')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                detailTab === 'cogs'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              🥩 Estructura de Costos del Turno
            </button>
          </div>
        </div>

        {/* Tab 1: Top Dishes */}
        {detailTab === 'dishes' && (
          <div className="p-4 overflow-x-auto">
            {topDishesMargin.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-500">No hay ventas registradas en el período</p>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Platillo</th>
                    <th className="py-2.5 px-3 text-right">Vendidos</th>
                    <th className="py-2.5 px-3 text-right">Venta Bruta</th>
                    <th className="py-2.5 px-3 text-right">Costo Insumos</th>
                    <th className="py-2.5 px-3 text-right">Margen Bruto</th>
                    <th className="py-2.5 px-3 text-right">Margen %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {topDishesMargin.map((d, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-white font-bold">{d.productName}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">{d.unitsSold} u.</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">${d.revenue.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-400">${d.cogs.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold">${d.margin.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                          {d.marginPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Workers on Shift */}
        {detailTab === 'workers' && (
          <div className="p-4 overflow-x-auto">
            {workersShift.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-500">
                No hay registros de asistencia en el reloj checador para este período
              </p>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Empleado</th>
                    <th className="py-2.5 px-3">Puesto / Rol</th>
                    <th className="py-2.5 px-3">Entrada</th>
                    <th className="py-2.5 px-3">Salida</th>
                    <th className="py-2.5 px-3 text-right">Horas Hoy</th>
                    <th className="py-2.5 px-3 text-right">Tarifa / h</th>
                    <th className="py-2.5 px-3 text-right">Costo Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {workersShift.map((w, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-white font-bold flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${w.status === 'ACTIVE' ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                        {w.userName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{w.role}</td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono">
                        {new Date(w.clockIn).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono">
                        {w.clockOut ? new Date(w.clockOut).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : (
                          <span className="text-emerald-400 font-bold">En turno</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">{w.hoursWorked} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">${w.hourlyWage.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-400 font-bold">${w.totalCost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: COGS Structure */}
        {detailTab === 'cogs' && summary && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <h4 className="font-bold text-white text-sm">Desglose de Costo de Materia Prima (COGS)</h4>
              <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-300">
                <span>Insumos consumidos por recetas de comandas:</span>
                <span className="font-mono font-bold text-white">${summary.recipesCogs.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-300">
                <span>Mermas y desperdicios de cocina:</span>
                <span className="font-mono font-bold text-rose-400">${summary.wasteCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-300">
                <span>Costo absorbido en comida de personal (Staff Meals):</span>
                <span className="font-mono font-bold text-amber-400">${summary.compsFoodCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-bold text-emerald-400">
                <span>Total COGS del Período:</span>
                <span className="font-mono">${summary.totalCOGS.toFixed(2)} ({summary.foodCostPct.toFixed(1)}%)</span>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <h4 className="font-bold text-white text-sm">Resumen Ejecutivo de Prime Cost</h4>
              <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-300">
                <span>Costo Total de Materia Prima:</span>
                <span className="font-mono font-bold text-white">${summary.totalCOGS.toFixed(2)} ({summary.foodCostPct.toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-300">
                <span>Costo Total de Mano de Obra:</span>
                <span className="font-mono font-bold text-white">${summary.totalLaborCost.toFixed(2)} ({summary.laborCostPct.toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-300 font-bold">
                <span>Prime Cost Total (COGS + Labor):</span>
                <span className="font-mono text-purple-400">${summary.primeCostTotal.toFixed(2)} ({summary.primeCostPct.toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-bold text-emerald-400">
                <span>Margen Operativo Neto Resultante:</span>
                <span className="font-mono">${summary.netContributionMargin.toFixed(2)} ({summary.netContributionMarginPct.toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. MODAL: BUDGET TARGETS CONFIGURATION                                    */}
      {/* ========================================================================= */}
      {budgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setBudgetModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Metas Presupuestales de Marca</h3>
                <p className="text-xs text-slate-400">Parámetros de comparación financiera para la cocina</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Meta de Food Cost (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={60}
                    value={targetFoodCost}
                    onChange={(e) => setTargetFoodCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-400 font-bold">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Estándar recomendado: 28% - 32%</p>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Meta de Mano de Obra / Labor Cost (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={50}
                    value={targetLaborCost}
                    onChange={(e) => setTargetLaborCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-400 font-bold">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Estándar recomendado: 18% - 22%</p>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Meta Máxima de Prime Cost (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={30}
                    max={75}
                    value={targetPrimeCost}
                    onChange={(e) => setTargetPrimeCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-400 font-bold">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Regla de oro: No debe superar el 55% - 60%</p>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Meta de Venta Diaria ($ MXN)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={targetDailySales}
                    onChange={(e) => setTargetDailySales(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBudgetModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingBudget}
                  onClick={handleSaveBudget}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingBudget ? 'Guardando...' : 'Guardar Metas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
