'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingDown,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Plus,
  Download,
  Filter,
  Search,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  FileText,
  User,
  Building,
  Target,
  RefreshCw,
  X,
  Layers,
  Sparkles,
  CheckSquare
} from 'lucide-react';

interface WasteLogItem {
  id: string;
  ingredientId: string;
  quantity: number;
  costPerUnit: number;
  totalCost: number;
  reason: string;
  notes?: string | null;
  shift?: string | null;
  station?: string | null;
  rcaCategory?: string | null;
  rcaWhys?: string | null;
  correctiveAction?: string | null;
  capaStatus?: string | null;
  capaAssignee?: string | null;
  capaDueDate?: string | null;
  capaResolvedAt?: string | null;
  capaResolvedByName?: string | null;
  capaResolutionNotes?: string | null;
  createdAt: string;
  ingredient: {
    id: string;
    name: string;
    unit: string;
    cost: number;
  };
  warehouse?: {
    id: string;
    name: string;
  } | null;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
  paretoClass?: 'A' | 'B' | 'C';
}

interface ParetoItem {
  ingredient: {
    id: string;
    name: string;
    unit: string;
    cost: number;
  };
  totalCost: number;
  totalQuantity: number;
  events: number;
  pctOfTotal: number;
  cumulativePct: number;
  paretoClass: 'A' | 'B' | 'C';
}

interface WasteManagementHubTabProps {
  ingredients: Array<{
    id: string;
    name: string;
    unit: string;
    cost: number;
    stock: number;
  }>;
  warehouses: Array<{
    id: string;
    name: string;
  }>;
  onRefreshAll?: () => void;
}

export default function WasteManagementHubTab({
  ingredients,
  warehouses,
  onRefreshAll,
}: WasteManagementHubTabProps) {
  // Navigation Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'pareto' | 'logs' | 'capa'>('pareto');

  // Data states
  const [wasteLogs, setWasteLogs] = useState<WasteLogItem[]>([]);
  const [summary, setSummary] = useState<any>({
    totalWasteCost: 0,
    totalWasteQuantity: 0,
    totalEvents: 0,
    reasonBreakdown: {},
    stationBreakdown: {},
    shiftBreakdown: {},
    rcaBreakdown: {},
    capaMetrics: { open: 0, inProgress: 0, resolved: 0, totalAtRisk: 0 },
    paretoAnalysis: [],
    paretoSummary: { classACount: 0, classBCount: 0, classCCount: 0, classACost: 0 },
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [filterStation, setFilterStation] = useState<string>('ALL');
  const [filterShift, setFilterShift] = useState<string>('ALL');
  const [filterReason, setFilterReason] = useState<string>('ALL');
  const [filterCapa, setFilterCapa] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLogForCapa, setSelectedLogForCapa] = useState<WasteLogItem | null>(null);
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<WasteLogItem | null>(null);

  // Form states for creation
  const [newIngredientId, setNewIngredientId] = useState('');
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [newReason, setNewReason] = useState('KITCHEN_ERROR');
  const [newWarehouseId, setNewWarehouseId] = useState('');
  const [newShift, setNewShift] = useState('MORNING');
  const [newStation, setNewStation] = useState('KITCHEN_HOT');
  const [newNotes, setNewNotes] = useState('');
  // 5-Whys in creation
  const [showWhysAssistant, setShowWhysAssistant] = useState(false);
  const [newRcaCategory, setNewRcaCategory] = useState('');
  const [why1, setWhy1] = useState('');
  const [why2, setWhy2] = useState('');
  const [why3, setWhy3] = useState('');
  const [why4, setWhy4] = useState('');
  const [why5, setWhy5] = useState('');
  const [newCorrectiveAction, setNewCorrectiveAction] = useState('');
  const [newCapaAssignee, setNewCapaAssignee] = useState('');
  const [newCapaDueDate, setNewCapaDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Resolution modal state
  const [resolveStatus, setResolveStatus] = useState<'IN_PROGRESS' | 'RESOLVED'>('RESOLVED');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  // Fetch data
  const fetchWasteData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('timeframe', timeframe);
      if (filterStation !== 'ALL') params.append('station', filterStation);
      if (filterShift !== 'ALL') params.append('shift', filterShift);
      if (filterReason !== 'ALL') params.append('reason', filterReason);
      if (filterCapa !== 'ALL') params.append('capaStatus', filterCapa);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/inventory/waste?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setWasteLogs(data.wasteLogs || []);
        setSummary(data.summary || {});
      }
    } catch (err) {
      console.error('Error fetching waste data:', err);
    } finally {
      setLoading(false);
    }
  }, [timeframe, filterStation, filterShift, filterReason, filterCapa, searchTerm]);

  useEffect(() => {
    fetchWasteData();
  }, [fetchWasteData]);

  // Labels and Badges
  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'EXPIRATION':
        return 'Caducidad';
      case 'KITCHEN_ERROR':
        return 'Error Cocina';
      case 'PREPARATION_WASTE':
        return 'Porcionado / Merma Técnica';
      case 'DAMAGE_SPILL':
        return 'Accidente / Caída';
      case 'TEMPERATURE_ABUSE':
        return 'Abuso Temperatura (HACCP)';
      case 'AUDIT_DISCREPANCY':
        return 'Faltante en Arqueo Físico';
      case 'OTHER':
        return 'Otro Motivo';
      default:
        return reason;
    }
  };

  const getStationLabel = (st?: string | null) => {
    switch (st) {
      case 'KITCHEN_HOT':
        return 'Cocina Caliente';
      case 'GRILL':
        return 'Parrilla / Plancha';
      case 'BAR':
        return 'Barra / Bebidas';
      case 'COLD_PREP':
        return 'Preparación Fría / Ensaladas';
      case 'EXPO':
        return 'Pase / Expediter';
      case 'WAREHOUSE':
        return 'Almacén / Cámaras';
      default:
        return 'Cocina General';
    }
  };

  const getShiftLabel = (sh?: string | null) => {
    switch (sh) {
      case 'MORNING':
        return 'Matutino (Apertura)';
      case 'AFTERNOON':
        return 'Vespertino (Pico)';
      case 'NIGHT':
        return 'Nocturno (Cierre)';
      default:
        return 'Turno General';
    }
  };

  const getRcaCategoryLabel = (cat?: string | null) => {
    switch (cat) {
      case 'RAW_MATERIAL_QUALITY':
        return 'Calidad / Estado de Materia Prima';
      case 'EQUIPMENT_FAILURE':
        return 'Falla de Equipo / Refrigerador / Fuego';
      case 'OVERPRODUCTION':
        return 'Sobreproducción / Mal Pronóstico';
      case 'TRAINING_GAP':
        return 'Brecha de Capacitación / Técnica';
      case 'STORAGE_CONDITION':
        return 'Condición Almacenaje / Rotación FIFO';
      case 'HUMAN_ERROR':
        return 'Descuido / Error Humano';
      case 'THEFT_SHRINKAGE':
        return 'Robo Hormiga / Pérdida No Explicada';
      case 'RECIPE_NON_COMPLIANCE':
        return 'Desvío de Receta / Estandarización';
      default:
        return cat || 'No Clasificado';
    }
  };

  // Submit new waste with RCA
  const handleCreateWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngredientId || newQuantity <= 0) {
      alert('Selecciona un insumo y una cantidad válida');
      return;
    }

    try {
      setSubmitting(true);
      const whysArray = [why1, why2, why3, why4, why5].filter((w) => w.trim() !== '');
      const rcaWhysText = whysArray.length > 0 ? whysArray.map((w, idx) => `P${idx + 1}: ${w}`).join(' | ') : undefined;

      const payload = {
        ingredientId: newIngredientId,
        quantity: newQuantity,
        reason: newReason,
        warehouseId: newWarehouseId || undefined,
        shift: newShift,
        station: newStation,
        notes: newNotes || undefined,
        rcaCategory: newRcaCategory || undefined,
        rcaWhys: rcaWhysText,
        correctiveAction: newCorrectiveAction || undefined,
        capaAssignee: newCapaAssignee || undefined,
        capaDueDate: newCapaDueDate || undefined,
        capaStatus: newCorrectiveAction || newCapaAssignee ? 'OPEN' : undefined,
      };

      const res = await fetch('/api/inventory/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al registrar merma');
      }

      setShowCreateModal(false);
      resetCreateForm();
      fetchWasteData();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setNewIngredientId('');
    setNewQuantity(1);
    setNewReason('KITCHEN_ERROR');
    setNewWarehouseId('');
    setNewShift('MORNING');
    setNewStation('KITCHEN_HOT');
    setNewNotes('');
    setNewRcaCategory('');
    setWhy1('');
    setWhy2('');
    setWhy3('');
    setWhy4('');
    setWhy5('');
    setNewCorrectiveAction('');
    setNewCapaAssignee('');
    setNewCapaDueDate('');
    setShowWhysAssistant(false);
  };

  // Resolve CAPA Plan
  const handleResolveCapa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLogForCapa) return;

    try {
      setResolving(true);
      const res = await fetch(`/api/inventory/waste/${selectedLogForCapa.id}/rca`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capaStatus: resolveStatus,
          capaResolutionNotes: resolutionNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar CAPA');
      }

      setSelectedLogForCapa(null);
      setResolutionNotes('');
      fetchWasteData();
    } catch (err: any) {
      alert(err.message || 'Error al resolver CAPA');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER WITH ACTIONS */}
      <div className="glass-panel border border-slate-800 rounded-2xl p-6 bg-slate-900/60 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                Centro de Control de Mermas & Análisis Causa-Raíz (RCA)
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40">
                  Pareto 80/20 Activo
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Diagnóstico de pérdidas con el método de los 5 Porqués, clasificación Pareto y planes de acción correctiva (CAPA).
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Refresh */}
          <button
            onClick={() => fetchWasteData()}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer"
            title="Actualizar datos"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export CSV */}
          <a
            href={`/api/inventory/waste/export?timeframe=${timeframe}`}
            download
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 shadow-sm transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span>Exportar CSV Pareto</span>
          </a>

          {/* Register Waste */}
          <button
            onClick={() => {
              if (ingredients.length > 0) {
                setNewIngredientId(ingredients[0].id);
              }
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs rounded-xl shadow-lg shadow-red-900/30 transition transform hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3px]" />
            <span>Registrar Merma con RCA</span>
          </button>
        </div>
      </div>

      {/* KPI RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Loss */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-5 bg-slate-900/40 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Pérdida Financiera Neta</p>
            <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <TrendingDown className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-white mt-2 tracking-tight">
            ${summary.totalWasteCost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span>{summary.totalEvents} incidentes de merma</span>
            <span className="font-bold text-red-400">-{summary.totalWasteQuantity.toFixed(1)} uds totales</span>
          </div>
        </div>

        {/* Card 2: Pareto Class A (Vital Few) */}
        <div className="glass-panel border border-amber-900/40 rounded-2xl p-5 bg-gradient-to-br from-amber-950/20 to-slate-900/40 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" /> Pareto A (Pocos Vitales)
            </p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
              80% Pérdida
            </span>
          </div>
          <p className="text-2xl font-black text-amber-200 mt-2 tracking-tight">
            ${(summary.paretoSummary?.classACost || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-amber-900/30">
            <span>{summary.paretoSummary?.classACount || 0} insumos críticos</span>
            <span className="font-bold text-amber-300">Concentran el 80% del impacto</span>
          </div>
        </div>

        {/* Card 3: Top Station Leak */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-5 bg-slate-900/40 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Estación Mayor Desperdicio</p>
            <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Flame className="h-4 w-4" />
            </span>
          </div>
          {Object.entries(summary.stationBreakdown || {}).length > 0 ? (
            (() => {
              const topStation = Object.entries(summary.stationBreakdown as Record<string, { cost: number; count: number }>)
                .sort((a, b) => b[1].cost - a[1].cost)[0];
              return (
                <>
                  <p className="text-lg font-black text-white mt-2 truncate">
                    {getStationLabel(topStation[0])}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
                    <span className="font-mono text-orange-400">${topStation[1].cost.toFixed(2)}</span>
                    <span>{topStation[1].count} eventos</span>
                  </div>
                </>
              );
            })()
          ) : (
            <p className="text-sm font-bold text-slate-500 mt-3">Sin registros</p>
          )}
        </div>

        {/* Card 4: CAPA Actions */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-5 bg-slate-900/40 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Planes CAPA Abiertos</p>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldAlert className="h-4 w-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-black text-indigo-200 tracking-tight">
              {(summary.capaMetrics?.open || 0) + (summary.capaMetrics?.inProgress || 0)}
            </p>
            <span className="text-xs text-slate-400 font-medium">por dictaminar</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span className="text-emerald-400 font-bold">{summary.capaMetrics?.resolved || 0} resueltos</span>
            <span className="text-indigo-400 font-bold">${(summary.capaMetrics?.totalAtRisk || 0).toFixed(2)} en riesgo</span>
          </div>
        </div>
      </div>

      {/* SUB-TABS NAVIGATION & TIMEFRAME SELECTOR */}
      <div className="glass-panel border border-slate-800 rounded-2xl p-2 bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveSubTab('pareto')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSubTab === 'pareto'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Target className="h-4 w-4" />
            <span>Análisis Pareto 80/20</span>
          </button>

          <button
            onClick={() => setActiveSubTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSubTab === 'logs'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Bitácora de Mermas ({wasteLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('capa')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSubTab === 'capa'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Planes de Acción Correctiva (CAPA)</span>
            {(summary.capaMetrics?.open || 0) > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-500 text-white animate-pulse">
                {summary.capaMetrics.open}
              </span>
            )}
          </button>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-1.5 self-end sm:self-center">
          <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Período:
          </span>
          {(['7d', '30d', '90d', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                timeframe === tf
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf === '7d' ? '7 Días' : tf === '30d' ? '30 Días' : tf === '90d' ? '90 Días' : 'Todo'}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: PARETO ANALYSIS & MULTIDIMENSIONAL BREAKDOWN */}
      {activeSubTab === 'pareto' && (
        <div className="space-y-6">
          {/* PARETO 80/20 DISTRIBUTION SECTION */}
          <div className="glass-panel border border-slate-800 rounded-2xl p-6 bg-slate-900/40 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-800/80">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Target className="h-5 w-5 text-amber-400" />
                  Distribución Pareto 80/20 de Insumos (Curva ABC)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Principio de Vilfredo Pareto: El 80% del valor total de mermas proviene del ~20% de los insumos (Clase A). Enfoca auditorías y acciones correctivas aquí.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-bold text-amber-400">
                  <span className="h-3 w-3 rounded bg-amber-500/30 border border-amber-500 inline-block" />
                  Clase A (0-80%)
                </span>
                <span className="flex items-center gap-1.5 font-bold text-blue-400">
                  <span className="h-3 w-3 rounded bg-blue-500/30 border border-blue-500 inline-block" />
                  Clase B (80-95%)
                </span>
                <span className="flex items-center gap-1.5 font-bold text-slate-400">
                  <span className="h-3 w-3 rounded bg-slate-700 border border-slate-600 inline-block" />
                  Clase C (95-100%)
                </span>
              </div>
            </div>

            {/* Pareto Ranking Table */}
            {summary.paretoAnalysis && summary.paretoAnalysis.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                      <th className="p-3.5">Ranking / Insumo</th>
                      <th className="p-3.5">Clasificación ABC</th>
                      <th className="p-3.5 text-right">Pérdida ($)</th>
                      <th className="p-3.5 text-right">% Individual</th>
                      <th className="p-3.5 w-1/3">Curva Acumulada (%)</th>
                      <th className="p-3.5 text-right">Volumen Merma</th>
                      <th className="p-3.5 text-center">Eventos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {summary.paretoAnalysis.map((p: ParetoItem, index: number) => {
                      const isClassA = p.paretoClass === 'A';
                      const isClassB = p.paretoClass === 'B';
                      return (
                        <tr
                          key={p.ingredient.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isClassA ? 'bg-amber-950/10' : ''
                          }`}
                        >
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-6 w-6 rounded-lg flex items-center justify-center font-black text-xs ${
                                  index < 3
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                #{index + 1}
                              </span>
                              <div>
                                <p className="font-bold text-white text-xs">{p.ingredient.name}</p>
                                <p className="text-[10px] text-slate-400">Costo Unit: ${p.ingredient.cost.toFixed(2)}/{p.ingredient.unit}</p>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border ${
                                isClassA
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : isClassB
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {isClassA ? '🌟 CLASE A (Vital)' : isClassB ? '🔹 CLASE B (Medio)' : '◽ CLASE C (Trivial)'}
                            </span>
                          </td>

                          <td className="p-3.5 text-right font-black text-white text-sm">
                            ${p.totalCost.toFixed(2)}
                          </td>

                          <td className="p-3.5 text-right font-bold text-slate-300">
                            {p.pctOfTotal}%
                          </td>

                          <td className="p-3.5">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Acumulado:</span>
                                <span className="font-mono font-bold text-slate-200">{p.cumulativePct}%</span>
                              </div>
                              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isClassA
                                      ? 'bg-amber-500'
                                      : isClassB
                                      ? 'bg-blue-500'
                                      : 'bg-slate-600'
                                  }`}
                                  style={{ width: `${Math.min(p.cumulativePct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 text-right font-mono font-bold text-red-400">
                            -{p.totalQuantity} {p.ingredient.unit}
                          </td>

                          <td className="p-3.5 text-center font-bold text-slate-400">
                            {p.events}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No hay datos suficientes para calcular la curva de Pareto en este período.</p>
              </div>
            )}
          </div>

          {/* MULTI-DIMENSIONAL BREAKDOWN (STATIONS & SHIFTS & REASONS) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Box 1: By Station */}
            <div className="glass-panel border border-slate-800 rounded-2xl p-5 bg-slate-900/40 space-y-4">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-400" />
                Pérdida por Estación de Cocina
              </h4>
              <div className="space-y-3">
                {Object.entries(summary.stationBreakdown || {}).length > 0 ? (
                  Object.entries(summary.stationBreakdown as Record<string, { cost: number; count: number }>)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .map(([stKey, stData]) => {
                      const pct = summary.totalWasteCost > 0 ? (stData.cost / summary.totalWasteCost) * 100 : 0;
                      return (
                        <div key={stKey} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-200">{getStationLabel(stKey)}</span>
                            <span className="font-black text-white">${stData.cost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                            <span>{stData.count} incidentes</span>
                            <span>{pct.toFixed(1)}% del total</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-700 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">Sin datos de estación</p>
                )}
              </div>
            </div>

            {/* Box 2: By Shift */}
            <div className="glass-panel border border-slate-800 rounded-2xl p-5 bg-slate-900/40 space-y-4">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" />
                Pérdida por Turno Operativo
              </h4>
              <div className="space-y-3">
                {Object.entries(summary.shiftBreakdown || {}).length > 0 ? (
                  Object.entries(summary.shiftBreakdown as Record<string, { cost: number; count: number }>)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .map(([shKey, shData]) => {
                      const pct = summary.totalWasteCost > 0 ? (shData.cost / summary.totalWasteCost) * 100 : 0;
                      return (
                        <div key={shKey} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-200">{getShiftLabel(shKey)}</span>
                            <span className="font-black text-white">${shData.cost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                            <span>{shData.count} incidentes</span>
                            <span>{pct.toFixed(1)}% del total</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-700 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">Sin datos de turno</p>
                )}
              </div>
            </div>

            {/* Box 3: By Reason */}
            <div className="glass-panel border border-slate-800 rounded-2xl p-5 bg-slate-900/40 space-y-4">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Pérdida por Motivo Tipificado
              </h4>
              <div className="space-y-3">
                {Object.entries(summary.reasonBreakdown || {}).length > 0 ? (
                  Object.entries(summary.reasonBreakdown as Record<string, { cost: number; count: number }>)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .map(([rKey, rData]) => {
                      const pct = summary.totalWasteCost > 0 ? (rData.cost / summary.totalWasteCost) * 100 : 0;
                      return (
                        <div key={rKey} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-200">{getReasonLabel(rKey)}</span>
                            <span className="font-black text-white">${rData.cost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                            <span>{rData.count} incidentes</span>
                            <span>{pct.toFixed(1)}% del total</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-700 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">Sin datos de motivo</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DETAILED WASTE LOGS */}
      {activeSubTab === 'logs' && (
        <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar insumo, nota o acción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 w-48 sm:w-60"
                />
              </div>

              {/* Station Filter */}
              <select
                value={filterStation}
                onChange={(e) => setFilterStation(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todas las Estaciones</option>
                <option value="KITCHEN_HOT">Cocina Caliente</option>
                <option value="GRILL">Parrilla / Plancha</option>
                <option value="BAR">Barra / Bebidas</option>
                <option value="COLD_PREP">Preparación Fría</option>
                <option value="EXPO">Pase / Expo</option>
                <option value="WAREHOUSE">Almacén / Cámaras</option>
              </select>

              {/* Shift Filter */}
              <select
                value={filterShift}
                onChange={(e) => setFilterShift(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todos los Turnos</option>
                <option value="MORNING">Matutino</option>
                <option value="AFTERNOON">Vespertino</option>
                <option value="NIGHT">Nocturno</option>
              </select>

              {/* Reason Filter */}
              <select
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todos los Motivos</option>
                <option value="EXPIRATION">Caducidad</option>
                <option value="KITCHEN_ERROR">Error Cocina</option>
                <option value="PREPARATION_WASTE">Porcionado</option>
                <option value="DAMAGE_SPILL">Accidente / Derrame</option>
                <option value="TEMPERATURE_ABUSE">Abuso Temperatura</option>
                <option value="AUDIT_DISCREPANCY">Faltante Arqueo</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 font-bold">
              Mostrando {wasteLogs.length} incidentes
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                  <th className="p-3.5">Fecha / Turno</th>
                  <th className="p-3.5">Insumo</th>
                  <th className="p-3.5">Pareto</th>
                  <th className="p-3.5">Cantidad</th>
                  <th className="p-3.5">Costo Pérdida</th>
                  <th className="p-3.5">Estación</th>
                  <th className="p-3.5">Motivo & Causa Raíz</th>
                  <th className="p-3.5">Estatus CAPA</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {wasteLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-500">
                      No se encontraron registros de mermas con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  wasteLogs.map((log) => {
                    const isParetoA = log.paretoClass === 'A';
                    return (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5">
                          <p className="font-mono text-white text-xs">
                            {new Date(log.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {new Date(log.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} • {getShiftLabel(log.shift)}
                          </p>
                        </td>

                        <td className="p-3.5">
                          <p className="font-bold text-white text-xs">{log.ingredient.name}</p>
                          <p className="text-[10px] text-slate-400">{log.warehouse?.name || 'Almacén General'}</p>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black border ${
                              isParetoA
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : log.paretoClass === 'B'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {log.paretoClass || 'C'}
                          </span>
                        </td>

                        <td className="p-3.5 font-bold font-mono text-red-400">
                          -{log.quantity} {log.ingredient.unit}
                        </td>

                        <td className="p-3.5 font-black text-white text-sm">
                          ${log.totalCost.toFixed(2)}
                        </td>

                        <td className="p-3.5 text-slate-300">
                          {getStationLabel(log.station)}
                        </td>

                        <td className="p-3.5 max-w-xs">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {getReasonLabel(log.reason)}
                          </span>
                          {log.rcaCategory && (
                            <p className="text-[10px] text-amber-400/90 mt-1 truncate">
                              🔍 {getRcaCategoryLabel(log.rcaCategory)}
                            </p>
                          )}
                        </td>

                        <td className="p-3.5">
                          {log.capaStatus === 'OPEN' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                              <AlertTriangle className="h-3 w-3" /> ABIERTO
                            </span>
                          ) : log.capaStatus === 'IN_PROGRESS' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                              <Clock className="h-3 w-3" /> EN PROGRESO
                            </span>
                          ) : log.capaStatus === 'RESOLVED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              <CheckCircle2 className="h-3 w-3" /> RESUELTO
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Sin Acción</span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => setSelectedLogForDetail(log)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                            title="Ver Diagnóstico RCA Completo"
                          >
                            <FileText className="h-4 w-4" />
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
      )}

      {/* TAB 3: CAPA ACTION PLANS HUB */}
      {activeSubTab === 'capa' && (
        <div className="space-y-6">
          <div className="glass-panel border border-slate-800 rounded-2xl p-6 bg-slate-900/40 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-800/80">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-indigo-400" />
                  Planes de Acción Correctiva y Preventiva (CAPA)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Seguimiento de incidentes con impacto económico crítico. Asegura que la causa raíz sea eliminada para evitar recurrencias.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  Total Pendientes: {(summary.capaMetrics?.open || 0) + (summary.capaMetrics?.inProgress || 0)}
                </span>
              </div>
            </div>

            {/* CAPA Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wasteLogs
                .filter((w) => w.capaStatus && w.capaStatus !== 'NONE')
                .map((log) => {
                  const isOpen = log.capaStatus === 'OPEN';
                  const isInProgress = log.capaStatus === 'IN_PROGRESS';
                  const isResolved = log.capaStatus === 'RESOLVED';

                  return (
                    <div
                      key={log.id}
                      className={`glass-panel border rounded-2xl p-5 space-y-4 transition ${
                        isOpen
                          ? 'border-red-500/40 bg-red-950/10'
                          : isInProgress
                          ? 'border-indigo-500/40 bg-indigo-950/10'
                          : 'border-emerald-500/40 bg-emerald-950/10'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-white text-sm">{log.ingredient.name}</h4>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                isOpen
                                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                  : isInProgress
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {isOpen ? 'ABIERTO' : isInProgress ? 'EN PROGRESO' : 'RESUELTO'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Pérdida: <strong className="text-white">${log.totalCost.toFixed(2)}</strong> (-{log.quantity} {log.ingredient.unit}) • {getStationLabel(log.station)}
                          </p>
                        </div>

                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(log.createdAt).toLocaleDateString('es-MX')}
                        </span>
                      </div>

                      {/* RCA Diagnosis Preview */}
                      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                        <p className="text-[11px] font-bold text-amber-400">
                          Causa Raíz: {getRcaCategoryLabel(log.rcaCategory)}
                        </p>
                        {log.rcaWhys && (
                          <p className="text-slate-300 text-[11px] italic line-clamp-2">
                            {log.rcaWhys}
                          </p>
                        )}
                        {log.correctiveAction ? (
                          <div className="pt-1.5 border-t border-slate-800/60">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Plan Correctivo:</p>
                            <p className="text-slate-200 text-xs font-medium">{log.correctiveAction}</p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-red-400 font-bold">⚠️ Sin plan de acción formulado aún</p>
                        )}
                      </div>

                      {/* Meta Footer & Resolution Button */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
                        <div className="text-[11px] text-slate-400">
                          <span>Responsable: <strong className="text-slate-200">{log.capaAssignee || 'Sin Asignar'}</strong></span>
                          {log.capaDueDate && (
                            <span className="ml-2 font-mono text-amber-400">
                              Límite: {new Date(log.capaDueDate).toLocaleDateString('es-MX')}
                            </span>
                          )}
                        </div>

                        {!isResolved ? (
                          <button
                            onClick={() => {
                              setSelectedLogForCapa(log);
                              setResolveStatus('RESOLVED');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                          >
                            <CheckSquare className="h-3.5 w-3.5" />
                            <span>Dictaminar / Resolver</span>
                          </button>
                        ) : (
                          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Cerrado por {log.capaResolvedByName || 'Gerencia'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {wasteLogs.filter((w) => w.capaStatus && w.capaStatus !== 'NONE').length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />
                <p>Excelente: No hay planes de acción pendientes de resolución en este período.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTRAR MERMA CON ASISTENTE RCA (5 PORQUÉS) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel border border-slate-800 rounded-3xl w-full max-w-2xl bg-slate-900 p-6 shadow-2xl space-y-5 my-8">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                  <TrendingDown className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Registrar Merma Operativa con RCA</h3>
                  <p className="text-xs text-slate-400">Captura de pérdidas con diagnóstico de causa raíz y plan preventivo</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWaste} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Insumo */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Insumo Desperdiciado *</label>
                  <select
                    value={newIngredientId}
                    onChange={(e) => setNewIngredientId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                    required
                  >
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} (Stock: {ing.stock} {ing.unit} • ${ing.cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cantidad */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Cantidad a Mermar *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Estación */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Estación de Cocina *</label>
                  <select
                    value={newStation}
                    onChange={(e) => setNewStation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="KITCHEN_HOT">Cocina Caliente</option>
                    <option value="GRILL">Parrilla / Plancha</option>
                    <option value="BAR">Barra / Bebidas</option>
                    <option value="COLD_PREP">Preparación Fría</option>
                    <option value="EXPO">Pase / Expediter</option>
                    <option value="WAREHOUSE">Almacén / Cámaras</option>
                  </select>
                </div>

                {/* Turno */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Turno Operativo *</label>
                  <select
                    value={newShift}
                    onChange={(e) => setNewShift(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="MORNING">Matutino</option>
                    <option value="AFTERNOON">Vespertino</option>
                    <option value="NIGHT">Nocturno</option>
                  </select>
                </div>

                {/* Motivo */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Motivo Principal *</label>
                  <select
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="KITCHEN_ERROR">Error de Cocina / Sobre-cocción</option>
                    <option value="EXPIRATION">Caducidad / Vencimiento</option>
                    <option value="PREPARATION_WASTE">Porcionado / Merma Técnica</option>
                    <option value="DAMAGE_SPILL">Accidente / Derrame en Pase</option>
                    <option value="TEMPERATURE_ABUSE">Abuso de Temperatura (HACCP)</option>
                    <option value="OTHER">Otro Motivo</option>
                  </select>
                </div>
              </div>

              {/* Bodega opcional */}
              {warehouses.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Bodega / Almacén Específico</label>
                  <select
                    value={newWarehouseId}
                    onChange={(e) => setNewWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="">Almacén General (Default)</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Observaciones Inmediatas</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Detalles de lo sucedido..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              {/* 5-WHYS ASSISTANT COLLAPSIBLE */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
                <button
                  type="button"
                  onClick={() => setShowWhysAssistant(!showWhysAssistant)}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                        Asistente de Causa-Raíz (Método 5-Porqués & CAPA)
                      </span>
                      <p className="text-[10px] text-slate-400">Recomendado para mermas de alto valor o fallas recurrentes</p>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 text-slate-400 transition-transform ${showWhysAssistant ? 'rotate-90' : ''}`}
                  />
                </button>

                {showWhysAssistant && (
                  <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-900/40">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Categoría Causa-Raíz (RCA)
                      </label>
                      <select
                        value={newRcaCategory}
                        onChange={(e) => setNewRcaCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Seleccionar Categoría de Causa Raíz...</option>
                        <option value="TRAINING_GAP">Brecha de Capacitación / Técnica del Cocinero</option>
                        <option value="EQUIPMENT_FAILURE">Falla de Equipo (Termostato, Plancha, Frio)</option>
                        <option value="RAW_MATERIAL_QUALITY">Calidad Deficiente de Proveedor</option>
                        <option value="STORAGE_CONDITION">Mala Rotación FIFO / Descuido en Bodega</option>
                        <option value="OVERPRODUCTION">Sobreproducción por Prep List Inadecuada</option>
                        <option value="RECIPE_NON_COMPLIANCE">Desvío del Procedimiento / Receta Estándar</option>
                        <option value="HUMAN_ERROR">Distracción / Error Humano Aislado</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-amber-400">Escalamiento de los 5 Porqués:</p>
                      <input
                        type="text"
                        placeholder="1. ¿Por qué ocurrió el desperdicio? (Síntoma visible)"
                        value={why1}
                        onChange={(e) => setWhy1(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="2. ¿Por qué sucedió lo anterior?"
                        value={why2}
                        onChange={(e) => setWhy2(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="3. ¿Por qué no se previno a tiempo?"
                        value={why3}
                        onChange={(e) => setWhy3(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-indigo-300 mb-1">
                          Plan de Acción Correctiva / Preventiva (CAPA)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Calibrar termostato de freidora y capacitar a turnos en timer..."
                          value={newCorrectiveAction}
                          onChange={(e) => setNewCorrectiveAction(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">Responsable CAPA</label>
                          <input
                            type="text"
                            placeholder="Nombre del supervisor o cocinero"
                            value={newCapaAssignee}
                            onChange={(e) => setNewCapaAssignee(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">Fecha Límite</label>
                          <input
                            type="date"
                            value={newCapaDueDate}
                            onChange={(e) => setNewCapaDueDate(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Guardar y Aplicar a Inventario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESOLVER / DICTAMINAR CAPA */}
      {selectedLogForCapa && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-3xl w-full max-w-lg bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">Dictaminar Plan de Acción (CAPA)</h3>
              </div>
              <button
                onClick={() => setSelectedLogForCapa(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs space-y-1">
              <p className="font-bold text-white">{selectedLogForCapa.ingredient.name}</p>
              <p className="text-slate-400">
                Pérdida: ${selectedLogForCapa.totalCost.toFixed(2)} (-{selectedLogForCapa.quantity} {selectedLogForCapa.ingredient.unit})
              </p>
              {selectedLogForCapa.correctiveAction && (
                <p className="text-indigo-300 pt-1 border-t border-slate-800 mt-1">
                  Acción Comprometida: {selectedLogForCapa.correctiveAction}
                </p>
              )}
            </div>

            <form onSubmit={handleResolveCapa} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Estatus del Plan *</label>
                <select
                  value={resolveStatus}
                  onChange={(e) => setResolveStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="IN_PROGRESS">En Progreso (Acciones en ejecución)</option>
                  <option value="RESOLVED">Resuelto / Concluido Satisfactoriamente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Notas de Cierre / Evidencia de Cumplimiento
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Detalla cómo se validó la eliminación de la causa raíz..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedLogForCapa(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2"
                >
                  {resolving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Guardar Dictamen</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VER DETALLE COMPLETO DE INCIDENTE & RCA */}
      {selectedLogForDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-3xl w-full max-w-lg bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-red-400" />
                <h3 className="text-base font-black text-white">Detalle de Incidente & Análisis Causa-Raíz</h3>
              </div>
              <button
                onClick={() => setSelectedLogForDetail(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 text-[10px]">Insumo:</span>
                  <p className="font-bold text-white">{selectedLogForDetail.ingredient.name}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">Pérdida Económica:</span>
                  <p className="font-black text-red-400 text-sm">${selectedLogForDetail.totalCost.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">Cantidad Desperdiciada:</span>
                  <p className="font-bold text-slate-200">-{selectedLogForDetail.quantity} {selectedLogForDetail.ingredient.unit}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">Estación / Turno:</span>
                  <p className="font-bold text-slate-200">{getStationLabel(selectedLogForDetail.station)} • {getShiftLabel(selectedLogForDetail.shift)}</p>
                </div>
              </div>

              {/* RCA Whys */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5">
                <p className="font-bold text-amber-400">Diagnóstico de Causa Raíz (5-Porqués):</p>
                <p className="text-slate-300">
                  {selectedLogForDetail.rcaWhys || 'No se registraron respuestas específicas de 5-Porqués.'}
                </p>
                {selectedLogForDetail.rcaCategory && (
                  <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                    Categoría: <strong className="text-white">{getRcaCategoryLabel(selectedLogForDetail.rcaCategory)}</strong>
                  </p>
                )}
              </div>

              {/* CAPA Plan */}
              {selectedLogForDetail.correctiveAction && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-indigo-900/40 space-y-1">
                  <p className="font-bold text-indigo-400">Plan de Acción Correctiva (CAPA):</p>
                  <p className="text-slate-200">{selectedLogForDetail.correctiveAction}</p>
                  <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                    <span>Responsable: {selectedLogForDetail.capaAssignee || 'N/A'}</span>
                    <span>Estado: {selectedLogForDetail.capaStatus || 'NONE'}</span>
                  </div>
                </div>
              )}

              {/* Resolution Notes */}
              {selectedLogForDetail.capaResolutionNotes && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-emerald-900/40 space-y-1">
                  <p className="font-bold text-emerald-400">Resolución Gerencial:</p>
                  <p className="text-slate-200">{selectedLogForDetail.capaResolutionNotes}</p>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    Resuelto por {selectedLogForDetail.capaResolvedByName} el{' '}
                    {selectedLogForDetail.capaResolvedAt ? new Date(selectedLogForDetail.capaResolvedAt).toLocaleString('es-MX') : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedLogForDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
