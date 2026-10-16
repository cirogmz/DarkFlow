'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Trash2,
  Plus,
  Search,
  ArrowUpDown,
  Layers,
  Flame,
  RefreshCw,
  Warehouse,
  Boxes,
  Tag,
  DollarSign,
  Info,
  X,
  FileSpreadsheet,
} from 'lucide-react';

interface BatchItem {
  id: string;
  batchNumber: string;
  initialQuantity: number;
  currentQuantity: number;
  unitCost: number;
  expirationDate: string;
  receivedDate: string;
  status: string;
  notes?: string | null;
  daysRemaining: number;
  urgency: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'GOOD';
  isFefoPick: boolean;
  batchValue: number;
  ingredient: {
    id: string;
    name: string;
    unit: string;
    cost: number;
    stock: number;
    type: string;
    allergens?: string | null;
  };
  supplier?: {
    id: string;
    name: string;
    contactName?: string | null;
    phone?: string | null;
  } | null;
  warehouse?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  wasteLogs?: Array<{
    id: string;
    quantity: number;
    totalCost: number;
    reason: string;
    createdAt: string;
  }>;
}

interface BatchStats {
  totalBatches: number;
  activeBatches: number;
  expiredCount: number;
  expiringSoon7Days: number;
  expiringSoon30Days: number;
  atRiskValue: number;
  totalActiveValue: number;
}

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  cost: number;
}

interface WarehouseOption {
  id: string;
  name: string;
  code?: string | null;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface BatchTrackingTabProps {
  ingredients: IngredientOption[];
  warehouses: WarehouseOption[];
  onStockUpdated?: () => void;
}

export function BatchTrackingTab({
  ingredients,
  warehouses,
  onStockUpdated,
}: BatchTrackingTabProps) {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [stats, setStats] = useState<BatchStats>({
    totalBatches: 0,
    activeBatches: 0,
    expiredCount: 0,
    expiringSoon7Days: 0,
    expiringSoon30Days: 0,
    atRiskValue: 0,
    totalActiveValue: 0,
  });
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'ACTIVE_ONLY' | 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'GOOD'>('ALL');
  const [ingredientFilter, setIngredientFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'FEFO' | 'FIFO' | 'STOCK_DESC'>('FEFO');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [selectedBatchForDiscard, setSelectedBatchForDiscard] = useState<BatchItem | null>(null);

  // Create Form State
  const [createIngredientId, setCreateIngredientId] = useState('');
  const [createBatchNumber, setCreateBatchNumber] = useState('');
  const [createQuantity, setCreateQuantity] = useState(1);
  const [createUnitCost, setCreateUnitCost] = useState(0);
  const [createExpirationDate, setCreateExpirationDate] = useState('');
  const [createReceivedDate, setCreateReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [createSupplierId, setCreateSupplierId] = useState('');
  const [createWarehouseId, setCreateWarehouseId] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createAddToStock, setCreateAddToStock] = useState(true);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Discard Form State
  const [discardQuantity, setDiscardQuantity] = useState(1);
  const [discardReason, setDiscardReason] = useState('CADUCIDAD / VENCIMIENTO');
  const [discardNotes, setDiscardNotes] = useState('');
  const [submittingDiscard, setSubmittingDiscard] = useState(false);

  // Fetch batches & stats
  const fetchBatches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (ingredientFilter !== 'ALL') params.append('ingredientId', ingredientFilter);
      if (searchQuery) params.append('search', searchQuery);
      params.append('sort', sortBy);

      const res = await fetch(`/api/inventory/batches?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch suppliers list
  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/inventory/suppliers');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchSuppliers();
  }, [ingredientFilter, sortBy]);

  // Handle ingredient selection in Create Modal
  const handleSelectIngredient = (ingId: string) => {
    setCreateIngredientId(ingId);
    const ing = ingredients.find((i) => i.id === ingId);
    if (ing) {
      setCreateUnitCost(ing.cost || 0);
      // Default expiration date: +30 days
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setCreateExpirationDate(d.toISOString().slice(0, 10));
    }
  };

  // Submit Create Batch
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createIngredientId || !createExpirationDate || createQuantity <= 0) {
      alert('Por favor complete los campos obligatorios: insumo, fecha de caducidad y cantidad > 0.');
      return;
    }

    setSubmittingCreate(true);
    try {
      const res = await fetch('/api/inventory/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: createIngredientId,
          batchNumber: createBatchNumber,
          initialQuantity: createQuantity,
          unitCost: createUnitCost,
          expirationDate: createExpirationDate,
          receivedDate: createReceivedDate,
          supplierId: createSupplierId || null,
          warehouseId: createWarehouseId || null,
          notes: createNotes,
          addToStock: createAddToStock,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setCreateIngredientId('');
        setCreateBatchNumber('');
        setCreateQuantity(1);
        setCreateUnitCost(0);
        setCreateExpirationDate('');
        setCreateNotes('');
        fetchBatches();
        if (onStockUpdated) onStockUpdated();
      } else {
        const err = await res.json();
        alert(`Error al registrar lote: ${err.error || 'Ocurrió un error'}`);
      }
    } catch {
      alert('Error de red al registrar lote');
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Open Discard Modal
  const openDiscardModal = (batch: BatchItem) => {
    setSelectedBatchForDiscard(batch);
    setDiscardQuantity(batch.currentQuantity);
    setDiscardReason(batch.daysRemaining <= 0 ? 'CADUCIDAD / VENCIMIENTO' : 'DETERIORO / MAL ESTADO');
    setDiscardNotes('');
    setShowDiscardModal(true);
  };

  // Submit Discard Batch
  const handleDiscardBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForDiscard) return;

    if (discardQuantity <= 0 || discardQuantity > selectedBatchForDiscard.currentQuantity) {
      alert(`La cantidad debe ser entre 0.01 y ${selectedBatchForDiscard.currentQuantity}`);
      return;
    }

    setSubmittingDiscard(true);
    try {
      const res = await fetch(`/api/inventory/batches/${selectedBatchForDiscard.id}/discard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: discardQuantity,
          reason: discardReason,
          notes: discardNotes,
        }),
      });

      if (res.ok) {
        setShowDiscardModal(false);
        setSelectedBatchForDiscard(null);
        fetchBatches();
        if (onStockUpdated) onStockUpdated();
      } else {
        const err = await res.json();
        alert(`Error al descartar lote: ${err.error || 'Ocurrió un error'}`);
      }
    } catch {
      alert('Error de red al descartar lote');
    } finally {
      setSubmittingDiscard(false);
    }
  };

  // Filter batches client-side for fast responsiveness
  const displayedBatches = useMemo(() => {
    return batches.filter((b) => {
      // Urgency / status filter
      if (urgencyFilter === 'ACTIVE_ONLY') {
        if (b.status !== 'ACTIVE' || b.currentQuantity <= 0) return false;
      } else if (urgencyFilter !== 'ALL') {
        if (b.urgency !== urgencyFilter || b.status !== 'ACTIVE' || b.currentQuantity <= 0) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = b.batchNumber.toLowerCase();
        const ing = b.ingredient.name.toLowerCase();
        const sup = b.supplier?.name.toLowerCase() || '';
        if (!num.includes(q) && !ing.includes(q) && !sup.includes(q)) return false;
      }

      return true;
    });
  }, [batches, urgencyFilter, searchQuery]);

  // Top FEFO recommendations (active batches with urgency <= WARNING)
  const fefoHighlights = useMemo(() => {
    return batches
      .filter((b) => b.isFefoPick && b.status === 'ACTIVE' && b.currentQuantity > 0 && b.daysRemaining <= 15)
      .slice(0, 4);
  }, [batches]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
              <Boxes className="h-3 w-3" /> Trazabilidad & Caducidad
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Método FEFO / FIFO
            </span>
          </div>
          <h2 className="text-xl font-black text-white mt-2">Control de Lotes & Vencimiento en Almacén</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Semáforo preventivo de caducidad, consumo guiado por prioridad FEFO (First Expired, First Out) y descarte atómico directo a mermas.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchBatches()}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border border-slate-700/80 disabled:opacity-50"
            title="Refrescar lotes"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand-primary' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            onClick={() => {
              if (ingredients.length > 0) {
                handleSelectIngredient(ingredients[0].id);
              }
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-brand-primary to-orange-500 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-primary/20 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Lote</span>
          </button>
        </div>
      </div>

      {/* Freshness Radar KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* EXPIRED */}
        <div
          onClick={() => setUrgencyFilter(urgencyFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            urgencyFilter === 'EXPIRED'
              ? 'bg-red-950/40 border-red-500 ring-2 ring-red-500/30'
              : 'bg-slate-900/40 border-slate-800 hover:border-red-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" /> Lotes Vencidos
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-red-500/20 text-red-300 border border-red-500/30">
              {stats.expiredCount}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {stats.expiredCount}{' '}
              <span className="text-xs font-normal text-slate-400">lotes</span>
            </div>
            <p className="text-xs text-red-400/90 mt-1 font-medium flex items-center gap-1">
              Descarte inmediato requerido
            </p>
          </div>
        </div>

        {/* CRITICAL <= 7 DAYS */}
        <div
          onClick={() => setUrgencyFilter(urgencyFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            urgencyFilter === 'CRITICAL'
              ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-slate-900/40 border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-amber-500" /> Vence ≤ 7 Días
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {stats.expiringSoon7Days}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {stats.expiringSoon7Days}{' '}
              <span className="text-xs font-normal text-slate-400">lotes</span>
            </div>
            <p className="text-xs text-amber-300/80 mt-1 font-medium">
              ⚡ Prioridad FEFO de consumo
            </p>
          </div>
        </div>

        {/* WARNING 8-30 DAYS */}
        <div
          onClick={() => setUrgencyFilter(urgencyFilter === 'WARNING' ? 'ALL' : 'WARNING')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            urgencyFilter === 'WARNING'
              ? 'bg-yellow-950/30 border-yellow-500 ring-2 ring-yellow-500/30'
              : 'bg-slate-900/40 border-slate-800 hover:border-yellow-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Vence 8 a 30 Días
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
              {stats.expiringSoon30Days}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {stats.expiringSoon30Days}{' '}
              <span className="text-xs font-normal text-slate-400">lotes</span>
            </div>
            <p className="text-xs text-yellow-300/80 mt-1 font-medium">
              Planificar producción próxima
            </p>
          </div>
        </div>

        {/* FINANCIAL RISK */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-emerald-400" /> Valor en Riesgo
            </span>
            <span className="text-[11px] text-slate-500">
              {stats.activeBatches} activos
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              ${stats.atRiskValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              De ${stats.totalActiveValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })} total loteado
            </p>
          </div>
        </div>
      </div>

      {/* FEFO Dispatch Recommendation Banner */}
      {fefoHighlights.length > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
              <Flame className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">Recomendación FEFO para Cocina & Comandero</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 uppercase">
                  Consumo Inmediato
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Despache o consuma preferentemente estos lotes antes que existencias de mayor vigencia:
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {fefoHighlights.map((fh) => (
              <div
                key={fh.id}
                className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-amber-500/40 text-xs flex items-center gap-2 shadow-sm"
              >
                <span className="font-bold text-amber-300">{fh.ingredient.name}:</span>
                <span className="font-mono text-slate-300">{fh.batchNumber}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  fh.daysRemaining <= 0 ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {fh.daysRemaining <= 0 ? 'Vencido' : `${fh.daysRemaining}d`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Bar: Filters, Search & Sort */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-slate-900/40">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por lote, insumo o proveedor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Ingredient Filter */}
          <select
            value={ingredientFilter}
            onChange={(e) => setIngredientFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
          >
            <option value="ALL">Todos los Insumos</option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name}
              </option>
            ))}
          </select>

          {/* Urgency Filter */}
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="ACTIVE_ONLY">Solo con Existencia (&gt;0)</option>
            <option value="EXPIRED">Vencidos (≤ 0 días)</option>
            <option value="CRITICAL">Críticos (≤ 7 días)</option>
            <option value="WARNING">Próximos (8-30 días)</option>
            <option value="GOOD">Frescos (&gt;30 días)</option>
          </select>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <ArrowUpDown className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-400">Orden:</span>
          <div className="flex rounded-lg border border-slate-800 overflow-hidden text-xs">
            <button
              onClick={() => setSortBy('FEFO')}
              className={`px-3 py-1.5 font-bold transition-colors cursor-pointer ${
                sortBy === 'FEFO'
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
              title="First Expired, First Out (Recomendado para alimentos y perecederos)"
            >
              FEFO (Caducidad)
            </button>
            <button
              onClick={() => setSortBy('FIFO')}
              className={`px-3 py-1.5 font-bold transition-colors cursor-pointer ${
                sortBy === 'FIFO'
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
              title="First In, First Out (Fecha de recepción)"
            >
              FIFO (Entrada)
            </button>
            <button
              onClick={() => setSortBy('STOCK_DESC')}
              className={`px-3 py-1.5 font-bold transition-colors cursor-pointer ${
                sortBy === 'STOCK_DESC'
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              Mayor Stock
            </button>
          </div>
        </div>
      </div>

      {/* Batch Table */}
      <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Lote / Folio</th>
                <th className="py-3.5 px-4">Insumo</th>
                <th className="py-3.5 px-4">Semáforo de Caducidad</th>
                <th className="py-3.5 px-4">Prioridad FEFO</th>
                <th className="py-3.5 px-4">Stock del Lote</th>
                <th className="py-3.5 px-4">Costo & Valuación</th>
                <th className="py-3.5 px-4">Recepción / Proveedor</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {displayedBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Boxes className="h-10 w-10 mx-auto text-slate-600 mb-2 stroke-[1.5]" />
                    <p className="font-semibold text-slate-400">No se encontraron lotes con los filtros aplicados</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Haga clic en &quot;Registrar Lote&quot; o reciba una orden de compra para ingresar trazabilidad.
                    </p>
                  </td>
                </tr>
              ) : (
                displayedBatches.map((b) => {
                  const isDepleted = b.currentQuantity <= 0;
                  const ratio = b.initialQuantity > 0 ? (b.currentQuantity / b.initialQuantity) * 100 : 0;

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        b.urgency === 'EXPIRED' && !isDepleted ? 'bg-red-950/10' : ''
                      }`}
                    >
                      {/* Lote Folio */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                          <span>{b.batchNumber}</span>
                        </div>
                        {b.warehouse && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Warehouse className="h-3 w-3" /> {b.warehouse.name}
                          </div>
                        )}
                      </td>

                      {/* Ingredient */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{b.ingredient.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {b.ingredient.type === 'PREPARED' ? 'Sub-receta' : 'Materia Prima'}
                        </div>
                      </td>

                      {/* Expiration Semaphore */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                              b.urgency === 'EXPIRED'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : b.urgency === 'CRITICAL'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : b.urgency === 'WARNING'
                                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            <Calendar className="h-3 w-3" />
                            {new Date(b.expirationDate).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold mt-1">
                          {isDepleted ? (
                            <span className="text-slate-500">Lote agotado</span>
                          ) : b.daysRemaining <= 0 ? (
                            <span className="text-red-400 font-bold">
                              Vencido hace {Math.abs(b.daysRemaining)} días
                            </span>
                          ) : b.daysRemaining <= 7 ? (
                            <span className="text-amber-400 font-bold">
                              Vence en {b.daysRemaining} días (¡Crítico!)
                            </span>
                          ) : b.daysRemaining <= 30 ? (
                            <span className="text-yellow-400">
                              Vence en {b.daysRemaining} días
                            </span>
                          ) : (
                            <span className="text-emerald-400">
                              Vence en {b.daysRemaining} días
                            </span>
                          )}
                        </div>
                      </td>

                      {/* FEFO Priority Badge */}
                      <td className="py-3.5 px-4">
                        {isDepleted ? (
                          <span className="text-slate-600 text-[11px]">—</span>
                        ) : b.isFefoPick ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                            <Flame className="h-3.5 w-3.5 text-amber-400" /> CONSUMIR 1º
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Respaldo</span>
                        )}
                      </td>

                      {/* Stock Info with Progress */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-baseline gap-1.5 font-bold">
                          <span className={isDepleted ? 'text-slate-500' : 'text-white'}>
                            {b.currentQuantity}
                          </span>
                          <span className="text-slate-500 font-normal text-[11px]">
                            / {b.initialQuantity} {b.ingredient.unit}
                          </span>
                        </div>
                        <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full transition-all ${
                              ratio <= 10
                                ? 'bg-red-500'
                                : ratio <= 40
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }}
                          />
                        </div>
                      </td>

                      {/* Cost & Valuation */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">
                          ${b.batchValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          ${b.unitCost.toFixed(2)} / {b.ingredient.unit}
                        </div>
                      </td>

                      {/* Received Date & Supplier */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-300">
                          {new Date(b.receivedDate).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                          {b.supplier?.name || 'Interno / General'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isDepleted && (
                            <button
                              onClick={() => openDiscardModal(b)}
                              className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Descartar lote o registrar merma"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Merma</span>
                            </button>
                          )}
                          {isDepleted && (
                            <span className="px-2 py-0.5 rounded text-[10px] text-slate-500 bg-slate-900 border border-slate-800">
                              Agotado
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: REGISTRAR NUEVO LOTE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Registrar Nuevo Lote</h3>
                  <p className="text-xs text-slate-400">Ingreso de trazabilidad con fecha de vencimiento</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="p-6 space-y-4">
              {/* Ingredient Select */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Insumo <span className="text-red-400">*</span>
                </label>
                <select
                  value={createIngredientId}
                  onChange={(e) => handleSelectIngredient(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
                  required
                >
                  <option value="">Selecciona un insumo...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Folio / Lote Number & Expiration Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Número de Lote (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto: LOT-YYYYMMDD-..."
                    value={createBatchNumber}
                    onChange={(e) => setCreateBatchNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Fecha de Caducidad <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={createExpirationDate}
                    onChange={(e) => setCreateExpirationDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
                    required
                  />
                </div>
              </div>

              {/* Quantity & Unit Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Cantidad Inicial <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={createQuantity}
                    onChange={(e) => setCreateQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Costo Unitario ($ MXN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={createUnitCost}
                    onChange={(e) => setCreateUnitCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* Warehouse & Supplier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Almacén / Bodega
                  </label>
                  <select
                    value={createWarehouseId}
                    onChange={(e) => setCreateWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
                  >
                    <option value="">Almacén Principal</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Proveedor
                  </label>
                  <select
                    value={createSupplierId}
                    onChange={(e) => setCreateSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
                  >
                    <option value="">Sin proveedor especificado</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Notas o Especificaciones
                </label>
                <input
                  type="text"
                  placeholder="Ej. Temperatura de refrigeración 4°C, empaque al vacío..."
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Add to stock checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={createAddToStock}
                  onChange={(e) => setCreateAddToStock(e.target.checked)}
                  className="rounded border-slate-700 text-brand-primary focus:ring-0"
                />
                <span className="text-xs text-slate-300">
                  Sumar automáticamente esta cantidad al stock general del insumo
                </span>
              </label>

              {/* Actions */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-5 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-primary/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingCreate ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar Lote'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DESCARTAR LOTE POR MERMA / VENCIMIENTO */}
      {showDiscardModal && selectedBatchForDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-red-950/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Descartar Lote por Merma</h3>
                  <p className="text-xs text-red-300/80">Salida por caducidad o merma directa</p>
                </div>
              </div>
              <button
                onClick={() => setShowDiscardModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDiscardBatch} className="p-6 space-y-4">
              {/* Batch Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Insumo:</span>
                  <span className="font-bold text-white">{selectedBatchForDiscard.ingredient.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Lote:</span>
                  <span className="font-mono text-slate-300">{selectedBatchForDiscard.batchNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Stock Disponible:</span>
                  <span className="font-bold text-amber-400">
                    {selectedBatchForDiscard.currentQuantity} {selectedBatchForDiscard.ingredient.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Costo Unitario:</span>
                  <span className="text-slate-300">${selectedBatchForDiscard.unitCost.toFixed(2)}</span>
                </div>
              </div>

              {/* Discard Quantity */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-300">
                    Cantidad a Descartar <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDiscardQuantity(selectedBatchForDiscard.currentQuantity)}
                    className="text-[11px] font-bold text-brand-primary hover:underline cursor-pointer"
                  >
                    Descartar Todo ({selectedBatchForDiscard.currentQuantity})
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedBatchForDiscard.currentQuantity}
                  value={discardQuantity}
                  onChange={(e) => setDiscardQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              {/* Financial Impact preview */}
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex justify-between items-center text-xs">
                <span className="text-red-400 font-semibold">Costo Total de la Merma:</span>
                <span className="text-sm font-black text-white">
                  ${(discardQuantity * selectedBatchForDiscard.unitCost).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Motivo de Merma <span className="text-red-400">*</span>
                </label>
                <select
                  value={discardReason}
                  onChange={(e) => setDiscardReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
                  required
                >
                  <option value="CADUCIDAD / VENCIMIENTO">Caducidad / Vencimiento de Fecha</option>
                  <option value="DETERIORO / MAL ESTADO">Deterioro / Descomposición Orgánica</option>
                  <option value="CONTAMINACION CRUZADA">Contaminación Cruzada / Alérgenos</option>
                  <option value="ROTURA O DERRAME">Rotura de Empaque / Derrame</option>
                  <option value="FALLA DE REFRIGERACION">Falla de Cadena de Frío / Refrigeración</option>
                </select>
              </div>

              {/* Justification Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Detalles o Justificación
                </label>
                <input
                  type="text"
                  placeholder="Ej. Revisión sanitaria de almacén, empaque roto..."
                  value={discardNotes}
                  onChange={(e) => setDiscardNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDiscardModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingDiscard}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {submittingDiscard ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Procesando...
                    </>
                  ) : (
                    'Confirmar Merma'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
