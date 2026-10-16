'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  HelpCircle, 
  AlertTriangle, 
  Download, 
  Search, 
  Filter, 
  RefreshCw, 
  Calculator, 
  DollarSign, 
  Percent, 
  Sliders, 
  ArrowUpRight, 
  ArrowDownRight, 
  ChefHat, 
  X, 
  Check, 
  Info,
  Layers,
  Flame,
  Award
} from 'lucide-react';

export type MenuQuadrant = 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';

interface DishAnalysis {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  imageUrl?: string | null;
  isActive: boolean;
  price: number;
  recipeCost: number;
  unitMargin: number;
  foodCostPct: number;
  targetFoodCostPct: number;
  foodCostGapPct: number;
  unitsSold: number;
  grossRevenue: number;
  totalCost: number;
  totalMargin: number;
  menuMixPct: number;
  quadrant: MenuQuadrant;
  quadrantLabel: string;
  isHighProfitability: boolean;
  isHighPopularity: boolean;
  recommendation: string;
  suggestedPriceForTargetCost: number;
  topCostIngredient?: {
    name: string;
    unit: string;
    quantity: number;
    cost: number;
    costSharePct: number;
  } | null;
}

interface MenuEngineeringSummary {
  totalProducts: number;
  totalUnitsSold: number;
  totalGrossRevenue: number;
  totalFoodCost: number;
  totalContributionMargin: number;
  overallFoodCostPct: number;
  averageContributionMargin: number;
  popularityThresholdPct: number;
  popularityThresholdUnits: number;
  period: {
    startDate: string;
    endDate: string;
  };
  distribution: {
    stars: { count: number; revenueSharePct: number; marginSharePct: number };
    plowhorses: { count: number; revenueSharePct: number; marginSharePct: number };
    puzzles: { count: number; revenueSharePct: number; marginSharePct: number };
    dogs: { count: number; revenueSharePct: number; marginSharePct: number };
  };
}

export default function MenuEngineeringTab() {
  const [data, setData] = useState<{
    summary: MenuEngineeringSummary;
    products: DishAnalysis[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [datePreset, setDatePreset] = useState<'LAST_30_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_90_DAYS' | 'CUSTOM'>('LAST_30_DAYS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedQuadrant, setSelectedQuadrant] = useState<'ALL' | MenuQuadrant>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [viewMode, setViewMode] = useState<'MATRIX' | 'TABLE'>('MATRIX');

  // Simulator Modal State
  const [simulatingDish, setSimulatingDish] = useState<DishAnalysis | null>(null);
  const [simPrice, setSimPrice] = useState<number>(0);
  const [simCostReduction, setSimCostReduction] = useState<number>(0);
  const [simResult, setSimResult] = useState<{
    newMargin: number;
    deltaMargin: number;
    newFoodCostPct: number;
    deltaFoodCostPct: number;
    annualGain: number;
  } | null>(null);

  // Apply date preset
  const applyPreset = useCallback((preset: 'LAST_30_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_90_DAYS' | 'CUSTOM') => {
    setDatePreset(preset);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'LAST_30_DAYS') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      end = now;
    } else if (preset === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (preset === 'LAST_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (preset === 'LAST_90_DAYS') {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      end = now;
    }

    if (preset !== 'CUSTOM') {
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, []);

  useEffect(() => {
    applyPreset('LAST_30_DAYS');
  }, [applyPreset]);

  // Fetch API
  const fetchAnalysis = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const url = `/api/menu-engineering?startDate=${startDate}&endDate=${endDate}${selectedCategory !== 'ALL' ? `&categoryId=${selectedCategory}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Error fetching menu engineering:', e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedCategory]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // Available categories extracted from products
  const categoriesList = useMemo(() => {
    if (!data?.products) return [];
    const set = new Set<string>();
    data.products.forEach(p => set.add(p.category));
    return Array.from(set).sort();
  }, [data?.products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    return data.products.filter(p => {
      if (selectedQuadrant !== 'ALL' && p.quadrant !== selectedQuadrant) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCat = p.category.toLowerCase().includes(q);
        if (!matchesName && !matchesCat) return false;
      }
      return true;
    });
  }, [data?.products, selectedQuadrant, searchQuery]);

  // Open simulator for a dish
  const handleOpenSimulator = (dish: DishAnalysis) => {
    setSimulatingDish(dish);
    setSimPrice(dish.price);
    setSimCostReduction(0);
    calculateLocalSimulation(dish, dish.price, 0);
  };

  const calculateLocalSimulation = (dish: DishAnalysis, price: number, costReductionPct: number) => {
    const originalMargin = dish.unitMargin;
    const originalFoodCostPct = dish.foodCostPct;

    const simulatedCost = dish.recipeCost * (1 - costReductionPct / 100);
    const simulatedMargin = price - simulatedCost;
    const simulatedFoodCostPct = price > 0 ? (simulatedCost / price) * 100 : 0;

    const deltaMargin = simulatedMargin - originalMargin;
    const deltaFoodCostPct = simulatedFoodCostPct - originalFoodCostPct;
    // Assuming monthly volume equals dish.unitsSold or minimum 30
    const monthlyVolume = Math.max(dish.unitsSold, 25);
    const annualGain = deltaMargin * monthlyVolume * 12;

    setSimResult({
      newMargin: parseFloat(simulatedMargin.toFixed(2)),
      deltaMargin: parseFloat(deltaMargin.toFixed(2)),
      newFoodCostPct: parseFloat(simulatedFoodCostPct.toFixed(1)),
      deltaFoodCostPct: parseFloat(deltaFoodCostPct.toFixed(1)),
      annualGain: parseFloat(annualGain.toFixed(2)),
    });
  };

  // Export to Excel / CSV with UTF-8 BOM
  const handleExportCSV = () => {
    if (!data || !data.products.length) return;
    let csv = '\uFEFF';
    csv += 'INGENIERIA DE MENU - MATRIZ BCG DE RENTABILIDAD (DARKFLOW)\n';
    csv += `Periodo:;${startDate} al ${endDate}\n`;
    csv += `Venta Total:;$${data.summary.totalGrossRevenue.toFixed(2)};Costo Total Insumos:;$${data.summary.totalFoodCost.toFixed(2)};Margen Total:;$${data.summary.totalContributionMargin.toFixed(2)};Food Cost Global:;${data.summary.overallFoodCostPct}%\n`;
    csv += `Margen Contribucion Promedio (Umbral Rentabilidad):;$${data.summary.averageContributionMargin.toFixed(2)};Umbral Popularidad (70% Media):;${data.summary.popularityThresholdPct}%\n\n`;

    csv += 'Platillo;Categoria;Precio Venta;Costo Receta;Margen Unitario ($);Food Cost %;Target %;Brecha %;Unidades Vendidas;Venta Bruta;Margen Total;Mix Ventas %;Cuadrante BCG;Rentabilidad;Popularidad;Recomendacion Estrategica\n';

    data.products.forEach(p => {
      csv += `"${p.name}";"${p.category}";${p.price.toFixed(2)};${p.recipeCost.toFixed(2)};${p.unitMargin.toFixed(2)};${p.foodCostPct}%;${p.targetFoodCostPct}%;${p.foodCostGapPct}%;${p.unitsSold};${p.grossRevenue.toFixed(2)};${p.totalMargin.toFixed(2)};${p.menuMixPct}%;"${p.quadrantLabel}";"${p.isHighProfitability ? 'Alta' : 'Baja'}";"${p.isHighPopularity ? 'Alta' : 'Baja'}";"${p.recommendation.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ingenieria_menu_bcg_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Strategy Description */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-indigo-950/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Calculator className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-white">Matriz BCG de Ingeniería de Menú (Miller & Kasavana)</h3>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/20">
              Fase 41
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
            Analiza el cruce entre el <strong className="text-slate-200">Margen de Contribución Unitario ($)</strong> y el <strong className="text-slate-200">Volumen de Demanda (Popularidad %)</strong> para identificar qué platillos impulsan las ganancias y cuáles erosionan el costo de materia prima.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setViewMode(viewMode === 'MATRIX' ? 'TABLE' : 'MATRIX')}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-brand-primary" />
            <span>{viewMode === 'MATRIX' ? 'Ver Tabla Detallada' : 'Ver Matriz 2x2'}</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!data || !data.products.length}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Date Presets & Filters */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Período:
          </span>
          {[
            { id: 'LAST_30_DAYS', label: 'Últimos 30 días' },
            { id: 'THIS_MONTH', label: 'Este Mes' },
            { id: 'LAST_MONTH', label: 'Mes Anterior' },
            { id: 'LAST_90_DAYS', label: '90 Días' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                datePreset === p.id
                  ? 'bg-brand-primary text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date Inputs & Category Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setDatePreset('CUSTOM');
                setStartDate(e.target.value);
              }}
              className="bg-transparent text-slate-200 outline-none text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setDatePreset('CUSTOM');
                setEndDate(e.target.value);
              }}
              className="bg-transparent text-slate-200 outline-none text-xs font-mono"
            />
          </div>

          {categoriesList.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="ALL">Todas las Categorías</option>
              {categoriesList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          <button
            onClick={fetchAnalysis}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
            title="Refrescar cálculo"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center flex-col gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-800 border-t-brand-primary"></div>
          <p className="text-xs text-slate-400">Calculando escandallos, margen de contribución y popularidad relativa...</p>
        </div>
      ) : !data || data.products.length === 0 ? (
        <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center space-y-2">
          <ChefHat className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">Sin datos suficientes en este rango</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No se encontraron platillos con ventas u órdenes en el período seleccionado. Prueba ampliando las fechas a los últimos 30 o 90 días.
          </p>
        </div>
      ) : (
        <>
          {/* Top 4 BCG Quadrant Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Stars */}
            <div 
              onClick={() => setSelectedQuadrant(selectedQuadrant === 'STAR' ? 'ALL' : 'STAR')}
              className={`glass-panel p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                selectedQuadrant === 'STAR'
                  ? 'border-emerald-500 bg-emerald-950/20 ring-2 ring-emerald-500/20'
                  : 'border-slate-800 hover:border-emerald-500/50 bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> 🌟 Estrellas (Stars)
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {data.summary.distribution.stars.count} platillos
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <p className="text-2xl font-black text-white">{data.summary.distribution.stars.count}</p>
                <span className="text-[11px] font-bold text-emerald-400 font-mono">
                  {data.summary.distribution.stars.revenueSharePct}% de ventas
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Alto Margen · Alta Venta. Proteger calidad y posición en carta.
              </p>
            </div>

            {/* Plowhorses */}
            <div 
              onClick={() => setSelectedQuadrant(selectedQuadrant === 'PLOWHORSE' ? 'ALL' : 'PLOWHORSE')}
              className={`glass-panel p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                selectedQuadrant === 'PLOWHORSE'
                  ? 'border-blue-500 bg-blue-950/20 ring-2 ring-blue-500/20'
                  : 'border-slate-800 hover:border-blue-500/50 bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4" /> 🐎 Caballos (Plowhorses)
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {data.summary.distribution.plowhorses.count} platillos
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <p className="text-2xl font-black text-white">{data.summary.distribution.plowhorses.count}</p>
                <span className="text-[11px] font-bold text-blue-400 font-mono">
                  {data.summary.distribution.plowhorses.revenueSharePct}% de ventas
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Bajo Margen · Alta Venta. Oportunidad de subir precio o bajar costo.
              </p>
            </div>

            {/* Puzzles */}
            <div 
              onClick={() => setSelectedQuadrant(selectedQuadrant === 'PUZZLE' ? 'ALL' : 'PUZZLE')}
              className={`glass-panel p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                selectedQuadrant === 'PUZZLE'
                  ? 'border-amber-500 bg-amber-950/20 ring-2 ring-amber-500/20'
                  : 'border-slate-800 hover:border-amber-500/50 bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" /> 🧩 Rompecabezas (Puzzles)
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {data.summary.distribution.puzzles.count} platillos
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <p className="text-2xl font-black text-white">{data.summary.distribution.puzzles.count}</p>
                <span className="text-[11px] font-bold text-amber-400 font-mono">
                  {data.summary.distribution.puzzles.revenueSharePct}% de ventas
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Alto Margen · Baja Venta. Requieren mercadotecnia y up-selling.
              </p>
            </div>

            {/* Dogs */}
            <div 
              onClick={() => setSelectedQuadrant(selectedQuadrant === 'DOG' ? 'ALL' : 'DOG')}
              className={`glass-panel p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                selectedQuadrant === 'DOG'
                  ? 'border-red-500 bg-red-950/20 ring-2 ring-red-500/20'
                  : 'border-slate-800 hover:border-red-500/50 bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> 🐶 Perros (Dogs)
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {data.summary.distribution.dogs.count} platillos
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <p className="text-2xl font-black text-white">{data.summary.distribution.dogs.count}</p>
                <span className="text-[11px] font-bold text-red-400 font-mono">
                  {data.summary.distribution.dogs.revenueSharePct}% de ventas
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Bajo Margen · Baja Venta. Candidatos a reformulación o retiro.
              </p>
            </div>
          </div>

          {/* Global Summary Bar: Benchmarks & KPIs */}
          <div className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Venta Bruta:</span>
              <strong className="text-emerald-400 text-sm font-bold">${data.summary.totalGrossRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Costo Insumos:</span>
              <strong className="text-amber-400 text-sm font-bold">${data.summary.totalFoodCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
              <span className="text-[10px] bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20">
                {data.summary.overallFoodCostPct}% FC
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Margen Contribución Total:</span>
              <strong className="text-white text-sm font-bold">${data.summary.totalContributionMargin.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Umbral Margen Promedio:</span>
              <strong className="text-brand-primary text-sm font-bold">${data.summary.averageContributionMargin.toFixed(2)}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Umbral Popularidad (70%):</span>
              <strong className="text-purple-400 text-sm font-bold">{data.summary.popularityThresholdPct}% ({data.summary.popularityThresholdUnits} u)</strong>
            </div>
          </div>

          {/* 1. VISUAL 2x2 BCG MATRIX */}
          {viewMode === 'MATRIX' && (
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand-primary" />
                    Plano Cartesiano de Menú (Margen vs Popularidad)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Cada tarjeta representa un platillo posicionado en su cuadrante según el umbral promedio (${data.summary.averageContributionMargin.toFixed(2)} y {data.summary.popularityThresholdPct}% mix).
                  </p>
                </div>
                {selectedQuadrant !== 'ALL' && (
                  <button
                    onClick={() => setSelectedQuadrant('ALL')}
                    className="text-xs text-brand-primary hover:underline font-bold"
                  >
                    Mostrar Todos
                  </button>
                )}
              </div>

              {/* 2x2 Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cuadrante 2: PUZZLES (Alto Margen / Baja Venta) */}
                <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-slate-900/60 to-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧩</span>
                      <div>
                        <h5 className="font-bold text-amber-300 text-xs uppercase tracking-wider">Rompecabezas (Puzzles)</h5>
                        <p className="text-[10px] text-slate-400">Alto Margen [▲] · Baja Venta [▼]</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      {data.products.filter(p => p.quadrant === 'PUZZLE').length}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {data.products.filter(p => p.quadrant === 'PUZZLE').length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-6 text-center">No hay platillos en este cuadrante.</p>
                    ) : (
                      data.products.filter(p => p.quadrant === 'PUZZLE').map(p => (
                        <div key={p.id} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-amber-500/50 transition flex items-center justify-between gap-3 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              ${p.price.toFixed(2)} · Margen: <span className="text-emerald-400 font-bold">+${p.unitMargin.toFixed(2)}</span> ({p.foodCostPct}% FC)
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              {p.unitsSold} u ({p.menuMixPct}%)
                            </span>
                            <button
                              onClick={() => handleOpenSimulator(p)}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                              title="Simular precio/costo"
                            >
                              <Calculator className="w-3.5 h-3.5 text-brand-primary" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Cuadrante 1: STARS (Alto Margen / Alta Venta) */}
                <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-slate-900/60 to-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌟</span>
                      <div>
                        <h5 className="font-bold text-emerald-300 text-xs uppercase tracking-wider">Estrellas (Stars)</h5>
                        <p className="text-[10px] text-slate-400">Alto Margen [▲] · Alta Venta [▲]</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {data.products.filter(p => p.quadrant === 'STAR').length}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {data.products.filter(p => p.quadrant === 'STAR').length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-6 text-center">No hay platillos en este cuadrante.</p>
                    ) : (
                      data.products.filter(p => p.quadrant === 'STAR').map(p => (
                        <div key={p.id} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-emerald-500/50 transition flex items-center justify-between gap-3 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              ${p.price.toFixed(2)} · Margen: <span className="text-emerald-400 font-bold">+${p.unitMargin.toFixed(2)}</span> ({p.foodCostPct}% FC)
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              {p.unitsSold} u ({p.menuMixPct}%)
                            </span>
                            <button
                              onClick={() => handleOpenSimulator(p)}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                              title="Simular precio/costo"
                            >
                              <Calculator className="w-3.5 h-3.5 text-brand-primary" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Cuadrante 3: DOGS (Bajo Margen / Baja Venta) */}
                <div className="rounded-xl border border-red-500/30 bg-gradient-to-br from-red-950/20 via-slate-900/60 to-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-red-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🐶</span>
                      <div>
                        <h5 className="font-bold text-red-300 text-xs uppercase tracking-wider">Perros (Dogs)</h5>
                        <p className="text-[10px] text-slate-400">Bajo Margen [▼] · Baja Venta [▼]</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                      {data.products.filter(p => p.quadrant === 'DOG').length}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {data.products.filter(p => p.quadrant === 'DOG').length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-6 text-center">No hay platillos en este cuadrante.</p>
                    ) : (
                      data.products.filter(p => p.quadrant === 'DOG').map(p => (
                        <div key={p.id} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-red-500/50 transition flex items-center justify-between gap-3 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              ${p.price.toFixed(2)} · Margen: <span className="text-slate-300 font-bold">+${p.unitMargin.toFixed(2)}</span> ({p.foodCostPct}% FC)
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                              {p.unitsSold} u ({p.menuMixPct}%)
                            </span>
                            <button
                              onClick={() => handleOpenSimulator(p)}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                              title="Simular precio/costo"
                            >
                              <Calculator className="w-3.5 h-3.5 text-brand-primary" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Cuadrante 4: PLOWHORSES (Bajo Margen / Alta Venta) */}
                <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-950/20 via-slate-900/60 to-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🐎</span>
                      <div>
                        <h5 className="font-bold text-blue-300 text-xs uppercase tracking-wider">Caballos de Batalla (Plowhorses)</h5>
                        <p className="text-[10px] text-slate-400">Bajo Margen [▼] · Alta Venta [▲]</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                      {data.products.filter(p => p.quadrant === 'PLOWHORSE').length}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {data.products.filter(p => p.quadrant === 'PLOWHORSE').length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-6 text-center">No hay platillos en este cuadrante.</p>
                    ) : (
                      data.products.filter(p => p.quadrant === 'PLOWHORSE').map(p => (
                        <div key={p.id} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-blue-500/50 transition flex items-center justify-between gap-3 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              ${p.price.toFixed(2)} · Margen: <span className="text-slate-300 font-bold">+${p.unitMargin.toFixed(2)}</span> ({p.foodCostPct}% FC)
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                              {p.unitsSold} u ({p.menuMixPct}%)
                            </span>
                            <button
                              onClick={() => handleOpenSimulator(p)}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                              title="Simular precio/costo"
                            >
                              <Calculator className="w-3.5 h-3.5 text-brand-primary" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. TABULAR MATRIX & STRATEGY TABLE */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden space-y-3">
            <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Detalle Prescriptivo por Platillo
                </span>
                <span className="text-xs text-slate-400">({filteredProducts.length} platillos)</span>
              </div>

              {/* Search & Quadrant Filter Chips */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar platillo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-primary w-44"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {[
                    { id: 'ALL', label: 'Todos' },
                    { id: 'STAR', label: '🌟 Estrellas' },
                    { id: 'PLOWHORSE', label: '🐎 Caballos' },
                    { id: 'PUZZLE', label: '🧩 Rompecabezas' },
                    { id: 'DOG', label: '🐶 Perros' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedQuadrant(tab.id as any)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                        selectedQuadrant === tab.id
                          ? 'bg-slate-800 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Platillo & Categoría</th>
                    <th className="py-3 px-3 text-right">Precio</th>
                    <th className="py-3 px-3 text-right">Costo Receta</th>
                    <th className="py-3 px-3 text-center">Food Cost %</th>
                    <th className="py-3 px-3 text-right">Margen Unit. ($)</th>
                    <th className="py-3 px-3 text-center">Ventas & Mix</th>
                    <th className="py-3 px-3 text-center">Cuadrante BCG</th>
                    <th className="py-3 px-4">Diagnóstico & Recomendación Estratégica</th>
                    <th className="py-3 px-3 text-center">Simulador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        No hay platillos que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => {
                      const isHighFC = p.foodCostPct > p.targetFoodCostPct;
                      return (
                        <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-bold text-white text-xs">{p.name}</p>
                            <span className="text-[10px] text-slate-400 block">{p.category}</span>
                            {p.topCostIngredient && (
                              <span className="text-[9px] text-slate-500 block truncate max-w-xs">
                                Insumo mayor: {p.topCostIngredient.name} ({p.topCostIngredient.costSharePct}% del costo)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-white">
                            ${p.price.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            ${p.recipeCost.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.foodCostPct <= 28
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : p.foodCostPct <= 35
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {p.foodCostPct}%
                            </span>
                            {isHighFC && (
                              <span className="text-[9px] text-red-400 block mt-0.5">
                                +{p.foodCostGapPct}% vs meta
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold">
                            <span className={p.isHighProfitability ? 'text-emerald-400' : 'text-slate-300'}>
                              +${p.unitMargin.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            <span className="font-bold text-white">{p.unitsSold} u</span>
                            <span className="text-[10px] text-slate-400 block font-semibold">{p.menuMixPct}% mix</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block ${
                              p.quadrant === 'STAR'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : p.quadrant === 'PLOWHORSE'
                                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                : p.quadrant === 'PUZZLE'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : 'bg-red-500/10 text-red-300 border-red-500/30'
                            }`}>
                              {p.quadrantLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-md">
                            <p className="text-[11px] text-slate-300 leading-snug">
                              {p.recommendation}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleOpenSimulator(p)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-brand-primary hover:text-slate-950 text-brand-primary text-[10px] font-bold rounded-lg border border-slate-700 transition cursor-pointer flex items-center gap-1 mx-auto"
                            >
                              <Calculator className="w-3 h-3" />
                              <span>Simular</span>
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
        </>
      )}

      {/* WHAT-IF SCENARIO SIMULATOR MODAL */}
      {simulatingDish && simResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl border border-brand-primary/20">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">Simulador de Precio & Margen</h4>
                  <p className="text-xs text-slate-400">Platillo: <strong className="text-white">{simulatingDish.name}</strong></p>
                </div>
              </div>
              <button
                onClick={() => setSimulatingDish(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current vs Simulated Cards */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Situación Actual</span>
                <div className="flex justify-between">
                  <span className="text-slate-400">Precio:</span>
                  <strong className="text-white">${simulatingDish.price.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Costo Receta:</span>
                  <strong className="text-slate-300">${simulatingDish.recipeCost.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Margen Unitario:</span>
                  <strong className="text-brand-primary font-bold">+${simulatingDish.unitMargin.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Food Cost:</span>
                  <span className="text-amber-400 font-bold">{simulatingDish.foodCostPct}%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-950/40 to-slate-950 border border-indigo-500/40 space-y-1.5">
                <span className="text-[10px] text-indigo-400 font-bold uppercase block">Simulación Proyectada</span>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nuevo Precio:</span>
                  <strong className="text-white">${simPrice.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nuevo Costo:</span>
                  <strong className="text-slate-300">
                    ${(simulatingDish.recipeCost * (1 - simCostReduction / 100)).toFixed(2)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nuevo Margen:</span>
                  <strong className="text-emerald-400 font-bold">+${simResult.newMargin.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nuevo FC:</span>
                  <span className="text-emerald-400 font-bold">{simResult.newFoodCostPct}%</span>
                </div>
              </div>
            </div>

            {/* Interactive Sliders / Inputs */}
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="font-bold text-slate-300">Ajuste de Precio de Venta ($ MXN):</label>
                  <span className="font-mono font-bold text-brand-primary">${simPrice.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={Math.max(1, Math.floor(simulatingDish.price * 0.7))}
                    max={Math.ceil(simulatingDish.price * 1.5)}
                    step={1}
                    value={simPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setSimPrice(val);
                      calculateLocalSimulation(simulatingDish, val, simCostReduction);
                    }}
                    className="flex-1 accent-amber-500 cursor-pointer"
                  />
                  <input
                    type="number"
                    value={simPrice}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setSimPrice(val);
                      calculateLocalSimulation(simulatingDish, val, simCostReduction);
                    }}
                    className="w-20 bg-slate-950 border border-slate-750 rounded-lg px-2 py-1 text-center font-mono text-xs text-white outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="font-bold text-slate-300">Optimización de Insumos / Reducción de Costo (%):</label>
                  <span className="font-mono font-bold text-emerald-400">{simCostReduction}% ahorro</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={simCostReduction}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setSimCostReduction(val);
                      calculateLocalSimulation(simulatingDish, simPrice, val);
                    }}
                    className="flex-1 accent-emerald-500 cursor-pointer"
                  />
                  <span className="w-16 font-mono text-xs text-center text-slate-400">
                    -{simCostReduction}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  Lograble renegociando con proveedores, ajustando mermas o cambiando gramajes de guarnición.
                </p>
              </div>
            </div>

            {/* Impact Projection Callout */}
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                  Beneficio Financiero Estimado
                </span>
                <p className="text-slate-200 mt-0.5">
                  Incremento de margen: <strong className="text-white">+${simResult.deltaMargin.toFixed(2)}</strong> por platillo vendido
                </p>
              </div>
              <div className="text-right font-mono">
                <span className="text-[10px] text-slate-400 block">Ganancia Anual Proyectada:</span>
                <span className="text-base font-black text-emerald-400">
                  +${simResult.annualGain.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSimulatingDish(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
              >
                Cerrar Simulador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
