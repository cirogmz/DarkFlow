'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Clock,
  ShieldAlert,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Printer,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  ChefHat,
  Search,
  Filter,
  PackageCheck,
  TrendingUp,
  Sliders,
  Save,
  Check,
  X,
  Copy,
  Info
} from 'lucide-react';

interface HistoricalWeek {
  weekIndex: number;
  dateString: string;
  weight: number;
}

interface ProductForecast {
  productId: string;
  productName: string;
  kitchenStation: string;
  projectedUnits: number;
  roundedUnits: number;
}

interface UsedInProduct {
  productId: string;
  productName: string;
  qtyPerPortion: number;
  projectedDemand: number;
}

interface PrepItem {
  id?: string;
  ingredientId?: string;
  productId?: string;
  itemName: string;
  itemType: 'SUB_RECIPE' | 'INGREDIENT' | 'PRODUCT';
  station: string;
  unit: string;
  currentStock: number;
  minStock?: number;
  projectedDemand: number;
  safetyBufferQty?: number;
  grossTargetNeed?: number;
  suggestedPrepQty: number;
  actualPrepQty?: number;
  urgency: 'CRITICAL' | 'LOW_STOCK' | 'SUFFICIENT';
  isSubRecipe?: boolean;
  yieldQuantity?: number;
  yieldUnit?: string;
  status: 'PENDING' | 'IN_PREP' | 'COMPLETED';
  usedInProducts?: UsedInProduct[];
  notes?: string | null;
  productionBatchId?: string | null;
}

interface StationSummary {
  totalItems: number;
  pendingPrepCount: number;
  criticalCount: number;
}

const SHIFT_OPTIONS = [
  { id: 'ALL_DAY', label: 'Todo el Día (24h)', icon: '🕒' },
  { id: 'LUNCH', label: 'Almuerzo (11:00 - 17:00)', icon: '☀️' },
  { id: 'DINNER', label: 'Cena (17:00 - Cierre)', icon: '🌙' },
];

const STATIONS = [
  { id: 'ALL', label: 'Todas las Estaciones', icon: '🍽️' },
  { id: 'COCINA', label: 'Cocina Caliente', icon: '🍳' },
  { id: 'PARRILLA', label: 'Parrilla / Plancha', icon: '🥩' },
  { id: 'ENSALADAS', label: 'Barra Fría / Ensaladas', icon: '🥗' },
  { id: 'BARRA', label: 'Barra & Bebidas', icon: '🍹' },
  { id: 'POSTRES', label: 'Postres / Panadería', icon: '🍰' },
];

export default function DailyPrepStationView() {
  // Query parameters state
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [targetDate, setTargetDate] = useState<string>(todayStr);
  const [shift, setShift] = useState<string>('ALL_DAY');
  const [lookbackWeeks, setLookbackWeeks] = useState<number>(4);
  const [bufferPct, setBufferPct] = useState<number>(15);

  // Data state
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedPrepListId, setSavedPrepListId] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    targetDate: string;
    dayOfWeekName: string;
    totalProjectedDishes: number;
    totalPrepItems: number;
    criticalItemsCount: number;
    lowStockItemsCount: number;
    itemsRequiringPrepCount: number;
  } | null>(null);

  const [prepItems, setPrepItems] = useState<PrepItem[]>([]);
  const [productsForecast, setProductsForecast] = useState<ProductForecast[]>([]);
  const [stationBreakdown, setStationBreakdown] = useState<Record<string, StationSummary>>({});

  // Filtering & View state
  const [selectedStation, setSelectedStation] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PREP' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Batch Production Modal state
  const [batchModalItem, setBatchModalItem] = useState<PrepItem | null>(null);
  const [produceQty, setProduceQty] = useState<number>(1);
  const [produceNotes, setProduceNotes] = useState<string>('');
  const [producing, setProducing] = useState<boolean>(false);

  // Print Ticket Modal state
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [printTicketText, setPrintTicketText] = useState<string>('');
  const [ticketCopied, setTicketCopied] = useState<boolean>(false);

  // Fetch forecast data
  const fetchForecast = useCallback(async () => {
    setLoading(true);
    try {
      // First check if an existing saved list exists for this date and shift
      const savedRes = await fetch(`/api/kitchen/prep-list?date=${targetDate}&shift=${shift}`);
      let existingSavedItems: PrepItem[] = [];
      let currentListId: string | null = null;

      if (savedRes.ok) {
        const savedData = await savedRes.json();
        if (savedData.prepLists && savedData.prepLists.length > 0) {
          const firstList = savedData.prepLists[0];
          currentListId = firstList.id;
          setSavedPrepListId(firstList.id);
          existingSavedItems = firstList.items.map((i: any) => ({
            id: i.id,
            ingredientId: i.ingredientId,
            productId: i.productId,
            itemName: i.itemName,
            itemType: i.itemType,
            station: i.station,
            unit: i.unit,
            currentStock: i.currentStock,
            projectedDemand: i.projectedDemand,
            suggestedPrepQty: i.suggestedPrepQty,
            actualPrepQty: i.actualPrepQty,
            status: i.status,
            urgency: i.currentStock <= 0 ? 'CRITICAL' : i.currentStock < i.projectedDemand ? 'LOW_STOCK' : 'SUFFICIENT',
            notes: i.notes,
            productionBatchId: i.productionBatchId,
          }));
        } else {
          setSavedPrepListId(null);
        }
      }

      // Fetch dynamic forecast algorithm results
      const res = await fetch(
        `/api/kitchen/forecast?date=${targetDate}&shift=${shift}&lookbackWeeks=${lookbackWeeks}&bufferPct=${bufferPct}`
      );

      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setProductsForecast(data.productsForecast || []);
        setStationBreakdown(data.stationBreakdown || {});

        // If we have saved items, merge status and IDs
        if (existingSavedItems.length > 0) {
          const merged = data.prepItems.map((genItem: PrepItem) => {
            const matched = existingSavedItems.find(
              (si) => (si.ingredientId && si.ingredientId === genItem.ingredientId) || si.itemName === genItem.itemName
            );
            if (matched) {
              return {
                ...genItem,
                id: matched.id,
                status: matched.status,
                actualPrepQty: matched.actualPrepQty,
                notes: matched.notes,
                productionBatchId: matched.productionBatchId,
              };
            }
            return {
              ...genItem,
              status: 'PENDING' as const,
            };
          });
          setPrepItems(merged);
        } else {
          setPrepItems(
            data.prepItems.map((item: PrepItem) => ({
              ...item,
              status: 'PENDING' as const,
            }))
          );
        }
      }
    } catch (e) {
      console.error('Error fetching kitchen forecast:', e);
    } finally {
      setLoading(false);
    }
  }, [targetDate, shift, lookbackWeeks, bufferPct]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  // Handle Save / Persist Prep List
  const handleSavePrepList = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/kitchen/prep-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: targetDate,
          shift,
          bufferPct,
          lookbackWeeks,
          items: prepItems.map((item) => ({
            ingredientId: item.ingredientId,
            productId: item.productId,
            itemName: item.itemName,
            itemType: item.itemType,
            station: item.station,
            unit: item.unit,
            currentStock: item.currentStock,
            projectedDemand: item.projectedDemand,
            suggestedPrepQty: item.suggestedPrepQty,
            actualPrepQty: item.actualPrepQty || 0,
            status: item.status,
            notes: item.notes,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.prepList) {
          setSavedPrepListId(data.prepList.id);
          // Sync items with generated IDs
          if (data.prepList.items) {
            setPrepItems((prev) =>
              prev.map((item) => {
                const found = data.prepList.items.find(
                  (i: any) =>
                    (i.ingredientId && i.ingredientId === item.ingredientId) || i.itemName === item.itemName
                );
                return found ? { ...item, id: found.id } : item;
              })
            );
          }
        }
        alert('✅ Lista de preparación guardada con éxito.');
      } else {
        const err = await res.json();
        alert(`Error al guardar: ${err.error || 'Error desconocido'}`);
      }
    } catch (e) {
      console.error('Failed to save prep list', e);
      alert('Error de conexión al guardar la lista de preparación.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Item Status (PENDING -> IN_PREP -> COMPLETED)
  const handleToggleStatus = async (item: PrepItem) => {
    let nextStatus: 'PENDING' | 'IN_PREP' | 'COMPLETED' = 'PENDING';
    if (item.status === 'PENDING') nextStatus = 'IN_PREP';
    else if (item.status === 'IN_PREP') nextStatus = 'COMPLETED';
    else nextStatus = 'PENDING';

    // Optimistic UI update
    setPrepItems((prev) =>
      prev.map((p) => (p.itemName === item.itemName ? { ...p, status: nextStatus } : p))
    );

    // If persisted, call backend PATCH
    if (savedPrepListId && item.id) {
      try {
        await fetch(`/api/kitchen/prep-list/${savedPrepListId}/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: nextStatus,
            actualPrepQty: nextStatus === 'COMPLETED' ? item.suggestedPrepQty : item.actualPrepQty,
          }),
        });
      } catch (e) {
        console.error('Failed to update status on server', e);
      }
    }
  };

  // Open Batch Production Modal
  const openProduceBatchModal = (item: PrepItem) => {
    setBatchModalItem(item);
    setProduceQty(item.suggestedPrepQty > 0 ? item.suggestedPrepQty : (item.yieldQuantity || 1));
    setProduceNotes('');
  };

  // Execute Batch Production
  const handleExecuteBatchProduction = async () => {
    if (!batchModalItem) return;
    setProducing(true);

    try {
      // If list is not saved yet, save it first to get an ID
      let listId = savedPrepListId;
      let itemId = batchModalItem.id;

      if (!listId || !itemId) {
        const saveRes = await fetch('/api/kitchen/prep-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: targetDate,
            shift,
            bufferPct,
            lookbackWeeks,
            items: prepItems.map((item) => ({
              ingredientId: item.ingredientId,
              productId: item.productId,
              itemName: item.itemName,
              itemType: item.itemType,
              station: item.station,
              unit: item.unit,
              currentStock: item.currentStock,
              projectedDemand: item.projectedDemand,
              suggestedPrepQty: item.suggestedPrepQty,
              status: item.status,
            })),
          }),
        });

        if (saveRes.ok) {
          const saveJson = await saveRes.json();
          listId = saveJson.prepList.id;
          setSavedPrepListId(listId);
          const found = saveJson.prepList.items.find(
            (i: any) =>
              (i.ingredientId && i.ingredientId === batchModalItem.ingredientId) ||
              i.itemName === batchModalItem.itemName
          );
          if (found) itemId = found.id;
        }
      }

      if (!listId || !itemId) {
        alert('No se pudo vincular el ítem de la lista para la orden de producción.');
        setProducing(false);
        return;
      }

      const res = await fetch(`/api/kitchen/prep-list/${listId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'convert_batch',
          actualPrepQty: produceQty,
          notes: produceNotes || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`✅ ${data.message}`);

        // Update local state
        setPrepItems((prev) =>
          prev.map((p) =>
            p.itemName === batchModalItem.itemName
              ? {
                  ...p,
                  status: 'COMPLETED',
                  actualPrepQty: produceQty,
                  currentStock: p.currentStock + produceQty,
                  productionBatchId: data.item?.productionBatchId,
                }
              : p
          )
        );
        setBatchModalItem(null);
      } else {
        const err = await res.json();
        alert(`❌ Error al producir: ${err.error || 'Stock insuficiente de ingredientes base'}`);
      }
    } catch (e) {
      console.error('Failed to produce batch', e);
      alert('Error de conexión al procesar el lote de producción.');
    } finally {
      setProducing(false);
    }
  };

  // Generate & Open Print Ticket
  const handlePrintPrepTicket = async () => {
    // If not saved, ask to save first
    let listId = savedPrepListId;
    if (!listId) {
      await handleSavePrepList();
      listId = savedPrepListId;
    }

    try {
      const res = await fetch('/api/kitchen/prep-list/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prepListId: listId || 'DRAFT',
          station: selectedStation,
          paperWidth: '80mm',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPrintTicketText(data.textTicket || '');
        setPrintModalOpen(true);
      } else {
        alert('No se pudo generar el ticket de impresión. Guarda la lista primero.');
      }
    } catch (e) {
      console.error('Print ticket error', e);
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return prepItems.filter((item) => {
      // Station filter
      if (selectedStation !== 'ALL' && item.station.toUpperCase() !== selectedStation.toUpperCase()) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.itemName.toLowerCase().includes(q);
        const matchesDish = item.usedInProducts?.some((d) => d.productName.toLowerCase().includes(q));
        if (!matchesName && !matchesDish) return false;
      }
      return true;
    });
  }, [prepItems, selectedStation, statusFilter, searchQuery]);

  // Overall Completion Stats
  const completionStats = useMemo(() => {
    const total = prepItems.length;
    const completed = prepItems.filter((i) => i.status === 'COMPLETED').length;
    const inPrep = prepItems.filter((i) => i.status === 'IN_PREP').length;
    const pending = prepItems.filter((i) => i.status === 'PENDING').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inPrep, pending, pct };
  }, [prepItems]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & CONTROLS BAR                                             */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          {/* Title & Description */}
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Pronóstico & Prep List Predictiva
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                    Fase 42 Inteligente
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Estimación de demanda basada en media móvil ponderada ({lookbackWeeks} semanas) y explosión automática de recetas.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchForecast}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              Recalcular
            </button>

            <button
              onClick={handlePrintPrepTicket}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              Imprimir Guía
            </button>

            <button
              onClick={handleSavePrepList}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : savedPrepListId ? 'Actualizar Prep List' : 'Guardar Prep List'}
            </button>
          </div>
        </div>

        {/* Parameter Sliders & Selectors */}
        <div className="mt-5 pt-5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Día a Planificar
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
              />
              <button
                onClick={() => setTargetDate(todayStr)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-medium"
              >
                Hoy
              </button>
            </div>
          </div>

          {/* Shift Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Turno Operativo
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {SHIFT_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setShift(s.id)}
                  className={`py-1 text-center rounded-lg text-[11px] font-medium transition-all ${
                    shift === s.id
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Safety Buffer Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                Margen de Seguridad
              </span>
              <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                +{bufferPct}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={5}
              value={bufferPct}
              onChange={(e) => setBufferPct(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
            />
          </div>

          {/* Lookback Weeks */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              Historial de Análisis
            </label>
            <select
              value={lookbackWeeks}
              onChange={(e) => setLookbackWeeks(parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value={2}>Últimas 2 semanas (Ponderación 67% / 33%)</option>
              <option value={4}>Últimas 4 semanas (Estándar 40/30/20/10)</option>
              <option value={6}>Últimas 6 semanas (Mayor estabilidad)</option>
              <option value={8}>Últimas 8 semanas (Gran volumen)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STATS & URGENCY KPI BAR                                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Critical Card */}
        <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Crítico / Sin Stock
            </p>
            <h3 className="text-2xl font-black text-rose-100 mt-1">
              {summary?.criticalItemsCount || 0}
            </h3>
            <p className="text-[11px] text-rose-300/70 mt-0.5">Demanda proyectada sin stock</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-xl font-bold">
            🚨
          </div>
        </div>

        {/* Requiring Prep Card */}
        <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <ChefHat className="w-3.5 h-3.5" />
              Ítems por Preparar
            </p>
            <h3 className="text-2xl font-black text-amber-100 mt-1">
              {summary?.itemsRequiringPrepCount || 0}
            </h3>
            <p className="text-[11px] text-amber-300/70 mt-0.5">Sub-recetas & materias con faltante</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl font-bold">
            ⚠️
          </div>
        </div>

        {/* Completion Progress Card */}
        <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Progreso del Turno
            </p>
            <h3 className="text-2xl font-black text-emerald-100 mt-1">
              {completionStats.pct}%
            </h3>
            <p className="text-[11px] text-emerald-300/70 mt-0.5">
              {completionStats.completed} de {completionStats.total} ítems listos
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold">
            ✅
          </div>
        </div>

        {/* Forecasted Dishes Card */}
        <div className="bg-blue-950/20 border border-blue-900/40 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Platillos Estimados
            </p>
            <h3 className="text-2xl font-black text-blue-100 mt-1">
              {summary?.totalProjectedDishes || 0}
            </h3>
            <p className="text-[11px] text-blue-300/70 mt-0.5">
              Para {summary?.dayOfWeekName || 'hoy'} ({shift})
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xl font-bold">
            📈
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. STATION SELECTOR TABS & SEARCH / FILTER BAR                            */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Station Badges */}
        <div className="flex flex-wrap gap-1.5">
          {STATIONS.map((st) => {
            const count = st.id === 'ALL' ? prepItems.length : stationBreakdown[st.id]?.totalItems || 0;
            const critical = st.id === 'ALL' ? summary?.criticalItemsCount : stationBreakdown[st.id]?.criticalCount || 0;
            const isSelected = selectedStation === st.id;

            return (
              <button
                key={st.id}
                onClick={() => setSelectedStation(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                }`}
              >
                <span>{st.icon}</span>
                <span>{st.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-slate-950/30 text-slate-950'
                      : critical && critical > 0
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center gap-2">
          {/* Status filter buttons */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex text-[11px]">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'PENDING' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Listos
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar insumo o platillo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 lg:w-60 bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PREP ITEMS CHECKLIST & ACCORDION CARDS                                */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400 font-medium">
            Procesando algoritmos de media móvil ponderada y explosión de recetas...
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <ChefHat className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-300">No hay tareas de preparación que coincidan</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Todos los insumos de esta estación cuentan con stock suficiente para cubrir la demanda proyectada con el margen de seguridad.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isCritical = item.urgency === 'CRITICAL';
            const isLow = item.urgency === 'LOW_STOCK';
            const isCompleted = item.status === 'COMPLETED';
            const isInPrep = item.status === 'IN_PREP';
            const isExpanded = expandedItem === item.itemName;

            return (
              <div
                key={item.itemName}
                className={`bg-slate-900/80 backdrop-blur-md rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isCompleted
                    ? 'border-emerald-900/30 opacity-75'
                    : isCritical
                    ? 'border-rose-900/60 shadow-lg shadow-rose-950/20'
                    : isLow
                    ? 'border-amber-900/50 shadow-md shadow-amber-950/10'
                    : 'border-slate-800/90'
                }`}
              >
                {/* Header Bar of Card */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                          {item.station}
                        </span>
                        {item.isSubRecipe ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                            Sub-receta
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                            Materia Prima
                          </span>
                        )}
                        {isCritical && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                            Sin Stock
                          </span>
                        )}
                        {isLow && !isCritical && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                            Stock Bajo
                          </span>
                        )}
                      </div>
                      <h4
                        className={`text-base font-bold transition-all ${
                          isCompleted ? 'text-slate-400 line-through' : 'text-white'
                        }`}
                      >
                        {item.itemName}
                      </h4>
                    </div>

                    {/* Status Toggle Button */}
                    <button
                      onClick={() => handleToggleStatus(item)}
                      title="Cambiar estado"
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isCompleted
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                          : isInPrep
                          ? 'bg-amber-500 text-slate-950 animate-pulse'
                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5 stroke-[3]" />
                      ) : isInPrep ? (
                        <Play className="w-4 h-4 fill-current" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border-2 border-slate-500" />
                      )}
                    </button>
                  </div>

                  {/* Stock vs Demand Matrix */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/60 bg-slate-950/40 p-2.5 rounded-xl">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Stock Actual</p>
                      <p
                        className={`text-xs font-bold mt-0.5 ${
                          item.currentStock <= 0 ? 'text-rose-400' : 'text-slate-200'
                        }`}
                      >
                        {item.currentStock} {item.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Demanda Proy.</p>
                      <p className="text-xs font-bold text-slate-200 mt-0.5">
                        {item.projectedDemand} {item.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Sugerido Prep</p>
                      <p className="text-sm font-black text-amber-400 mt-0.5">
                        {item.suggestedPrepQty > 0 ? `+${item.suggestedPrepQty}` : '0'} {item.unit}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-recipe batch action & accordion toggle */}
                <div className="px-4 py-2.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Convert to Production Batch Button */}
                    {item.isSubRecipe && (
                      <button
                        onClick={() => openProduceBatchModal(item)}
                        className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ChefHat className="w-3 h-3" />
                        Producir Lote
                      </button>
                    )}

                    {item.productionBatchId && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Lote Producido
                      </span>
                    )}
                  </div>

                  {/* Expand dish breakdown */}
                  {item.usedInProducts && item.usedInProducts.length > 0 && (
                    <button
                      onClick={() => setExpandedItem(isExpanded ? null : item.itemName)}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span>{item.usedInProducts.length} platillos</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Expanded Dish Breakdown */}
                {isExpanded && item.usedInProducts && (
                  <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs space-y-1.5 animate-in fade-in duration-150">
                    <p className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                      Platillos que requieren este insumo:
                    </p>
                    <div className="space-y-1">
                      {item.usedInProducts.map((d) => (
                        <div key={d.productId} className="flex justify-between items-center text-slate-300">
                          <span className="truncate pr-2 font-medium">• {d.productName}</span>
                          <span className="text-slate-400 font-mono text-[11px] whitespace-nowrap">
                            {d.qtyPerPortion} {item.unit} / comanda ({d.projectedDemand} {item.unit})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TOP DISHES FORECAST RADAR                                              */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          Top Platillos Proyectados para {summary?.dayOfWeekName || 'el Turno'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {productsForecast.slice(0, 6).map((prod) => (
            <div key={prod.productId} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                {prod.kitchenStation}
              </span>
              <h5 className="text-xs font-bold text-slate-200 mt-1 truncate" title={prod.productName}>
                {prod.productName}
              </h5>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-black text-amber-400">{prod.roundedUnits}</span>
                <span className="text-[10px] text-slate-500">unidades</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. MODAL: ONE-CLICK BATCH PRODUCTION                                      */}
      {/* ========================================================================= */}
      {batchModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setBatchModalItem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Producir Lote de Sub-receta</h3>
                <p className="text-xs text-slate-400">{batchModalItem.itemName}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Stock Actual:</span>
                  <span className="font-bold text-white">
                    {batchModalItem.currentStock} {batchModalItem.unit}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Demanda Proyectada:</span>
                  <span className="font-bold text-amber-400">
                    {batchModalItem.projectedDemand} {batchModalItem.unit}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Faltante Sugerido:</span>
                  <span className="font-bold text-emerald-400">
                    {batchModalItem.suggestedPrepQty} {batchModalItem.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Cantidad a Producir ({batchModalItem.unit})
                </label>
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={produceQty}
                  onChange={(e) => setProduceQty(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Se descontarán automáticamente las materias primas del inventario según el escandallo.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Notas de Producción / Cocinero (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Tanda matutina preparada por Chef Carlos"
                  value={produceNotes}
                  onChange={(e) => setProduceNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBatchModalItem(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={producing || produceQty <= 0}
                  onClick={handleExecuteBatchProduction}
                  className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {producing ? 'Produciendo...' : 'Confirmar & Descontar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: PRINT PREP TICKET (ESC/POS PREVIEW)                             */}
      {/* ========================================================================= */}
      {printModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setPrintModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Guía de Producción Térmica</h3>
                <p className="text-xs text-slate-400">Formato ESC/POS 80mm para comanderas de cocina</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap max-h-96 overflow-y-auto select-all">
              {printTicketText}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(printTicketText);
                  setTicketCopied(true);
                  setTimeout(() => setTicketCopied(false), 2000);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {ticketCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {ticketCopied ? '¡Copiado al Portapapeles!' : 'Copiar Texto ESC/POS'}
              </button>

              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir en Navegador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
