'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wine, 
  RefreshCw, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Scale, 
  FileText, 
  Printer, 
  Trash2, 
  Eye, 
  Sparkles, 
  Copy, 
  Download, 
  TrendingDown, 
  Percent, 
  Activity, 
  GlassWater, 
  Layers, 
  X,
  Check
} from 'lucide-react';

interface BarBottleItem {
  id: string;
  ingredientId: string;
  bottleLabel: string;
  station: string;
  capacityMl: number;
  currentMl: number;
  tareWeightGrams: number;
  densityGramsPerMl: number;
  cost: number;
  status: string; // OPEN, SEALED, EMPTY, LOST
  openedAt?: string | null;
  openedByName?: string | null;
  ingredient: {
    id: string;
    name: string;
    cost: number;
    unit: string;
  };
}

interface BarAuditItem {
  id: string;
  ingredientId: string;
  bottleLabel: string;
  bottleCapacityMl: number;
  costPerMl: number;
  startLevelMl: number;
  endLevelMl: number;
  newBottlesAddedMl: number;
  actualPouredMl: number;
  theoreticalPouredMl: number;
  cocktailsSoldCount: number;
  varianceMl: number;
  variancePercentage: number;
  financialVariance: number;
  shrinkageReason: string;
  notes?: string | null;
  ingredient?: {
    name: string;
    unit: string;
  };
}

interface BarAuditRecord {
  id: string;
  folio: string;
  station: string;
  shift: string;
  periodStart: string;
  periodEnd: string;
  auditedByName: string;
  status: string; // COMPLETED, DISCREPANCY_FLAGGED
  totalCocktailsSold: number;
  totalTheoreticalMl: number;
  totalActualMl: number;
  varianceMl: number;
  overPourPercentage: number;
  financialLossAmount: number;
  notes?: string | null;
  items: BarAuditItem[];
  createdAt: string;
}

interface BarLiquorAuditTabProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeBrand: any;
  addNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function BarLiquorAuditTab({ activeBrand, addNotification }: BarLiquorAuditTabProps) {
  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    if (addNotification) {
      notify(message, type);
    } else {
      if (type === 'error' || type === 'warning') {
        alert(message);
      }
    }
  }, [addNotification]);
  const [innerTab, setInnerTab] = useState<'AUDIT_LOG' | 'BOTTLES' | 'RADAR'>('AUDIT_LOG');

  // Audit Log State
  const [audits, setAudits] = useState<BarAuditRecord[]>([]);
  const [metrics, setMetrics] = useState({
    totalAudits: 0,
    totalLossAmount: 0,
    totalVarianceMl: 0,
    totalCocktails: 0,
    discrepanciesCount: 0,
  });
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [stationFilter, setStationFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');

  // Bottles State
  const [bottles, setBottles] = useState<BarBottleItem[]>([]);
  const [stations, setStations] = useState<string[]>([]);
  const [loadingBottles, setLoadingBottles] = useState(false);

  // New Bottle Modal State
  const [bottleModalOpen, setBottleModalOpen] = useState(false);
  const [bottleLabel, setBottleLabel] = useState('');
  const [bottleStation, setBottleStation] = useState('Barra Principal');
  const [bottleIngredientId, setBottleIngredientId] = useState('');
  const [bottleCapacityMl, setBottleCapacityMl] = useState('750');
  const [bottleTareGrams, setBottleTareGrams] = useState('450');
  const [bottleDensity, setBottleDensity] = useState('0.95');
  const [bottleCost, setBottleCost] = useState('350');
  const [savingBottle, setSavingBottle] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ingredientsCatalog, setIngredientsCatalog] = useState<any[]>([]);

  // New Audit Modal State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditStation, setAuditStation] = useState('Barra Principal');
  const [auditShift, setAuditShift] = useState('NOCHE');
  const [auditPeriodHours, setAuditPeriodHours] = useState('12');
  const [auditAuditorName, setAuditAuditorName] = useState('Capitán de Barra');
  const [auditNotes, setAuditNotes] = useState('');
  const [submittingAudit, setSubmittingAudit] = useState(false);

  // Audit Form Dynamic Rows
  const [auditRows, setAuditRows] = useState<Array<{
    ingredientId: string;
    bottleLabel: string;
    capacityMl: number;
    costPerMl: number;
    startLevelMl: number;
    newBottlesAddedMl: number;
    endLevelMl: number;
    method: 'WEIGHING' | 'TENTHS' | 'DIRECT_ML';
    weightGrams: number;
    tareGrams: number;
    density: number;
    tenths: number;
    reason: string;
  }>>([]);

  // Detail & Ticket Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<BarAuditRecord | null>(null);
  const [thermalTicketText, setThermalTicketText] = useState('');
  const [loadingTicket, setLoadingTicket] = useState(false);

  // Cargar Auditorías
  const loadAudits = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoadingAudits(true);
    try {
      const res = await fetch(`/api/bar/audits?station=${stationFilter}&shift=${shiftFilter}`);
      const data = await res.json();
      if (res.ok) {
        setAudits(data.audits || []);
        if (data.metrics) setMetrics(data.metrics);
      } else {
        notify(data.error || 'Error al cargar auditorías de barra', 'error');
      }
    } catch (err) {
      console.error('Error fetching bar audits:', err);
    } finally {
      setLoadingAudits(false);
    }
  }, [activeBrand?.id, stationFilter, shiftFilter, notify]);

  // Cargar Botellas
  const loadBottles = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoadingBottles(true);
    try {
      const res = await fetch('/api/bar/bottles');
      const data = await res.json();
      if (res.ok) {
        setBottles(data.bottles || []);
        if (data.stations) setStations(data.stations);
      }
    } catch (err) {
      console.error('Error fetching bar bottles:', err);
    } finally {
      setLoadingBottles(false);
    }
  }, [activeBrand?.id]);

  // Cargar Insumos de la marca para el selector
  const loadIngredients = useCallback(async () => {
    if (!activeBrand?.id) return;
    try {
      const res = await fetch(`/api/inventory?brandId=${activeBrand.id}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar ingredientes que típicamente son líquidos o licores
        const ings = (data.ingredients || []).filter((i: any) => {
          const u = (i.unit || '').toLowerCase();
          return u.includes('ml') || u.includes('oz') || u.includes('l') || u.includes('bot');
        });
        setIngredientsCatalog(ings.length > 0 ? ings : (data.ingredients || []));
      }
    } catch (err) {
      console.error('Error fetching ingredients:', err);
    }
  }, [activeBrand?.id]);

  useEffect(() => {
    loadAudits();
    loadBottles();
    loadIngredients();
  }, [loadAudits, loadBottles, loadIngredients]);

  // Abrir modal de nueva auditoría inicializando con botellas existentes o muestra
  const openNewAuditModal = () => {
    if (bottles.length > 0) {
      const rows = bottles.map((b) => ({
        ingredientId: b.ingredientId,
        bottleLabel: b.bottleLabel,
        capacityMl: b.capacityMl,
        costPerMl: b.capacityMl > 0 ? b.cost / b.capacityMl : 0.5,
        startLevelMl: b.currentMl,
        newBottlesAddedMl: 0,
        endLevelMl: Math.max(0, b.currentMl - 120), // default estimación
        method: 'TENTHS' as const,
        weightGrams: 850,
        tareGrams: b.tareWeightGrams || 450,
        density: b.densityGramsPerMl || 0.95,
        tenths: Math.round(((b.currentMl - 120) / b.capacityMl) * 10) / 10,
        reason: 'OVER_POUR',
      }));
      setAuditRows(rows);
    } else {
      loadSampleAuditPreset();
    }
    setAuditModalOpen(true);
  };

  // Cargar preset de simulación realista con 4 licores clave
  const loadSampleAuditPreset = () => {
    const defaultIngId = ingredientsCatalog[0]?.id || 'SAMPLE-ING-001';
    setAuditRows([
      {
        ingredientId: defaultIngId,
        bottleLabel: 'Tequila Reposado 750ml (Don Julio)',
        capacityMl: 750,
        costPerMl: 0.85,
        startLevelMl: 750,
        newBottlesAddedMl: 0,
        endLevelMl: 280,
        method: 'WEIGHING',
        weightGrams: 716, // (716 - 450) / 0.95 = ~280 mL
        tareGrams: 450,
        density: 0.95,
        tenths: 0.4,
        reason: 'OVER_POUR',
      },
      {
        ingredientId: defaultIngId,
        bottleLabel: 'Mezcal Espadín 750ml (400 Conejos)',
        capacityMl: 750,
        costPerMl: 0.72,
        startLevelMl: 650,
        newBottlesAddedMl: 750, // 1 botella abierta en el turno
        endLevelMl: 550,
        method: 'TENTHS',
        weightGrams: 972,
        tareGrams: 450,
        density: 0.95,
        tenths: 0.7,
        reason: 'SPILLAGE',
      },
      {
        ingredientId: defaultIngId,
        bottleLabel: 'Gin London Dry 750ml (Tanqueray)',
        capacityMl: 750,
        costPerMl: 0.65,
        startLevelMl: 500,
        newBottlesAddedMl: 0,
        endLevelMl: 310,
        method: 'DIRECT_ML',
        weightGrams: 744,
        tareGrams: 450,
        density: 0.95,
        tenths: 0.4,
        reason: 'ACCURATE',
      },
      {
        ingredientId: defaultIngId,
        bottleLabel: 'Vodka Premium 1000ml (Absolut)',
        capacityMl: 1000,
        costPerMl: 0.48,
        startLevelMl: 900,
        newBottlesAddedMl: 0,
        endLevelMl: 420,
        method: 'TENTHS',
        weightGrams: 850,
        tareGrams: 450,
        density: 0.95,
        tenths: 0.4,
        reason: 'OVER_POUR',
      },
    ]);
  };

  // Guardar nueva botella en barra
  const handleSaveBottle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBrand?.id) return;
    try {
      setSavingBottle(true);
      const res = await fetch('/api/bar/bottles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: bottleIngredientId,
          bottleLabel,
          station: bottleStation,
          capacityMl: parseFloat(bottleCapacityMl),
          tareWeightGrams: parseFloat(bottleTareGrams),
          densityGramsPerMl: parseFloat(bottleDensity),
          cost: parseFloat(bottleCost),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar botella');

      notify('Botella registrada exitosamente en estación de barra', 'success');
      setBottleModalOpen(false);
      setBottleLabel('');
      loadBottles();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSavingBottle(false);
    }
  };

  // Enviar y Reconciliar Auditoría de Cierre de Turno
  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBrand?.id) return;
    if (auditRows.length === 0) {
      notify('Agrega al menos una botella para auditar', 'warning');
      return;
    }

    try {
      setSubmittingAudit(true);
      const hours = parseInt(auditPeriodHours) || 12;
      const periodEnd = new Date();
      const periodStart = new Date(periodEnd.getTime() - hours * 60 * 60 * 1000);

      const itemsPayload = auditRows.map((r) => {
        let finalEndMl = r.endLevelMl;
        if (r.method === 'WEIGHING') {
          const net = Math.max(0, r.weightGrams - r.tareGrams);
          finalEndMl = Math.round((net / r.density) * 10) / 10;
        } else if (r.method === 'TENTHS') {
          finalEndMl = Math.round(r.tenths * r.capacityMl * 10) / 10;
        }

        return {
          ingredientId: r.ingredientId,
          bottleLabel: r.bottleLabel,
          bottleCapacityMl: r.capacityMl,
          costPerMl: r.costPerMl,
          startLevelMl: r.startLevelMl,
          newBottlesAddedMl: r.newBottlesAddedMl,
          endLevelMl: finalEndMl,
          shrinkageReason: r.reason,
        };
      });

      const res = await fetch('/api/bar/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station: auditStation,
          shift: auditShift,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          auditedByName: auditAuditorName,
          notes: auditNotes,
          items: itemsPayload,
          saveAudit: true,
          syncBottleInventory: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar auditoría');

      notify(`Auditoría de barra ${data.audit?.folio} registrada exitosamente`, 'success');
      setAuditModalOpen(false);
      loadAudits();
      loadBottles();

      if (data.thermalTicket) {
        setThermalTicketText(data.thermalTicket);
        setSelectedAudit(data.audit);
        setDetailModalOpen(true);
      }
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSubmittingAudit(false);
    }
  };

  // Ver Detalle y Ticket de Auditoría previa
  const handleViewAuditDetail = async (audit: BarAuditRecord) => {
    setSelectedAudit(audit);
    setDetailModalOpen(true);
    setLoadingTicket(true);
    try {
      const res = await fetch(`/api/bar/audits/${audit.id}/print`);
      if (res.ok) {
        const data = await res.json();
        setThermalTicketText(data.ticketText || '');
      }
    } catch (err) {
      console.error('Error fetching ticket text:', err);
    } finally {
      setLoadingTicket(false);
    }
  };

  // Eliminar Auditoría
  const handleDeleteAudit = async (id: string, folio: string) => {
    if (!confirm(`¿Eliminar la auditoría de barra ${folio}?`)) return;
    try {
      const res = await fetch(`/api/bar/audits/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        notify(data.message || 'Auditoría eliminada', 'success');
        loadAudits();
      } else {
        notify(data.error || 'Error al eliminar', 'error');
      }
    } catch (err) {
      console.error('Error deleting audit:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Wine className="w-4 h-4" />
            Control de Barra & Escandallo de Licores
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Pérdidas de Licor y Sobre-Vertido (Liquor Shrinkage)
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Compara onza por onza el consumo real de destilados y botellas contra las recetas de cócteles vendidas en KDS de barra y POS para erradicar fugas de alcohol y mermas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openNewAuditModal}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Scale className="w-4 h-4" />
            Nueva Auditoría de Cierre
          </button>

          <button
            type="button"
            onClick={() => {
              if (ingredientsCatalog.length > 0) {
                setBottleIngredientId(ingredientsCatalog[0].id);
              }
              setBottleModalOpen(true);
            }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Alta de Botella
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pérdida Financiera */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Pérdida por Merma de Licor</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-400">
              ${metrics.totalLossAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400">MXN</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {metrics.discrepanciesCount} cierres con discrepancia grave
          </p>
        </div>

        {/* Card 2: Varianza de Licor */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Varianza Neta en Barra</span>
            <GlassWater className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400">
              {metrics.totalVarianceMl > 0 ? `+${metrics.totalVarianceMl}` : metrics.totalVarianceMl}
            </span>
            <span className="text-xs text-slate-400">mL servidos en exceso</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Equivalente a {(Math.abs(metrics.totalVarianceMl) / 45).toFixed(1)} shots no cobrados
          </p>
        </div>

        {/* Card 3: Cócteles Auditados */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Cócteles Conciliados</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-purple-400">
              {metrics.totalCocktails}
            </span>
            <span className="text-xs text-slate-400">tragos en POS/KDS</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {metrics.totalAudits} auditorías realizadas
          </p>
        </div>

        {/* Card 4: Botellas en Barra */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Botellas Monitoreadas</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {bottles.filter((b) => b.status === 'OPEN').length}
            </span>
            <span className="text-xs text-slate-400">abiertas / {bottles.length} totales</span>
          </div>
          <p className="text-[11px] text-slate-500">
            En {stations.length || 1} estaciones de servicio
          </p>
        </div>
      </div>

      {/* Subtab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setInnerTab('AUDIT_LOG')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            innerTab === 'AUDIT_LOG'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Bitácora de Cierres de Barra ({audits.length})
        </button>

        <button
          type="button"
          onClick={() => setInnerTab('BOTTLES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            innerTab === 'BOTTLES'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Wine className="w-3.5 h-3.5" />
          Botellas en Estación ({bottles.length})
        </button>

        <button
          type="button"
          onClick={() => setInnerTab('RADAR')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            innerTab === 'RADAR'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          Radar de Sobre-Vertido (Over-Pour)
        </button>
      </div>

      {/* SUBTAB 1: BITÁCORA DE CIERRES */}
      {innerTab === 'AUDIT_LOG' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Estación:</span>
              <select
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="ALL">Todas las Estaciones</option>
                {stations.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <span className="text-xs text-slate-400 font-semibold ml-2">Turno:</span>
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="ALL">Todos los Turnos</option>
                <option value="MATUTINO">Matutino</option>
                <option value="VESPERTINO">Vespertino</option>
                <option value="NOCHE">Noche</option>
                <option value="TURNO_COMPLETO">Turno Completo</option>
              </select>
            </div>

            <button
              type="button"
              onClick={loadAudits}
              disabled={loadingAudits}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudits ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {audits.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
              <Wine className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-400">Sin auditorías de barra registradas</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Realiza el primer corte de turno pesando botellas o usando la escala de décimos para medir el sobre-vertido de licores.
              </p>
              <button
                type="button"
                onClick={openNewAuditModal}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition"
              >
                Auditar Primer Turno
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] bg-slate-950">
                    <th className="py-3 px-4">Folio</th>
                    <th className="py-3 px-4">Estación / Turno</th>
                    <th className="py-3 px-4 text-center">Tragos Vendidos</th>
                    <th className="py-3 px-4 text-right">Consumo Teórico</th>
                    <th className="py-3 px-4 text-right">Consumo Real</th>
                    <th className="py-3 px-4 text-right">Varianza</th>
                    <th className="py-3 px-4 text-right">Pérdida ($ MXN)</th>
                    <th className="py-3 px-4 text-center">Estatus</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {audits.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 text-white font-bold">{a.folio}</td>
                      <td className="py-3 px-4 font-sans">
                        <div className="font-semibold text-white">{a.station}</div>
                        <div className="text-[11px] text-slate-400">{a.shift} &bull; {a.auditedByName}</div>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300 font-bold">
                        {a.totalCocktailsSold}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        {a.totalTheoreticalMl} mL
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        {a.totalActualMl} mL
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        a.varianceMl > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {a.varianceMl > 0 ? `+${a.varianceMl}` : a.varianceMl} mL
                        <span className="text-[10px] block text-slate-500 font-sans">
                          {a.overPourPercentage > 0 ? `+${a.overPourPercentage}%` : `${a.overPourPercentage}%`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-rose-400 font-bold">
                        ${a.financialLossAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {a.status === 'COMPLETED' ? 'OK / TOLERANCIA' : 'DISCREPANCIA'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewAuditDetail(a)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                            title="Ver Detalle y Ticket Térmico"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAudit(a.id, a.folio)}
                            className="p-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 rounded-lg transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: BOTELLAS EN ESTACIÓN */}
      {innerTab === 'BOTTLES' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bottles.map((b) => {
              const pct = b.capacityMl > 0 ? Math.round((b.currentMl / b.capacityMl) * 100) : 0;
              return (
                <div key={b.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{b.bottleLabel}</h4>
                      <p className="text-xs text-slate-400">{b.station} &bull; {b.ingredient?.name}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      b.status === 'OPEN'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : b.status === 'SEALED'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {b.status === 'OPEN' ? 'ABIERTA' : b.status === 'SEALED' ? 'SELLADA' : 'VACÍA'}
                    </span>
                  </div>

                  {/* Barra visual de nivel */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">{b.currentMl} / {b.capacityMl} mL</span>
                      <span className={`font-bold ${pct < 20 ? 'text-rose-400' : pct < 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all ${
                          pct < 20 ? 'bg-rose-500' : pct < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Tara: {b.tareWeightGrams}g</span>
                    <span>Costo: ${b.cost.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 3: RADAR DE SOBRE-VERTIDO */}
      {innerTab === 'RADAR' && (
        <div className="space-y-4">
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Percent className="w-4 h-4 text-amber-400" />
              Diagnóstico de Sobre-Vertido por Botella / Licor
            </h3>
            <p className="text-xs text-slate-400">
              Clasificación heurística de desvíos en coctelería para entrenamiento de bartenders y prevención de mermas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-rose-400 uppercase">🚨 Sobre-vertido Crítico (&gt;15%)</span>
                <p className="text-xs text-slate-300">
                  Pérdida acelerada de margen. Requiere uso mandatorio de jigger (dosificador) o capacitación de vertido libre.
                </p>
              </div>
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase">⚠️ Sobre-vertido Moderado (5-15%)</span>
                <p className="text-xs text-slate-300">
                  Merma acumulativa aceptable en servicio de alta demanda pero corregible con boquillas dosificadoras.
                </p>
              </div>
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase">🎯 Porcionamiento Exacto (±5%)</span>
                <p className="text-xs text-slate-300">
                  Estándar de calidad óptimo. El sabor del cóctel respeta la ficha técnica y el costo unitario coincide.
                </p>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-blue-400 uppercase">🔻 Sub-vertido (&lt;-5%)</span>
                <p className="text-xs text-slate-300">
                  Riesgo de queja de comensal por cóctel aguado o con poco licor. Revisar receta en barra.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: NUEVA AUDITORÍA DE BARRA */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Auditoría de Cierre de Turno de Barra</h3>
                  <p className="text-xs text-slate-400">Medición de botellas vs recetas de cócteles servidos</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadSampleAuditPreset}
                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Cargar Simulación
                </button>
                <button
                  onClick={() => setAuditModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveAudit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Controles de Estación y Turno */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Estación de Barra</label>
                  <input
                    type="text"
                    value={auditStation}
                    onChange={(e) => setAuditStation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Turno</label>
                  <select
                    value={auditShift}
                    onChange={(e) => setAuditShift(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="MATUTINO">Matutino</option>
                    <option value="VESPERTINO">Vespertino</option>
                    <option value="NOCHE">Noche</option>
                    <option value="TURNO_COMPLETO">Turno Completo</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Ventana de Comandas</label>
                  <select
                    value={auditPeriodHours}
                    onChange={(e) => setAuditPeriodHours(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="6">Últimas 6 horas</option>
                    <option value="12">Últimas 12 horas</option>
                    <option value="24">Últimas 24 horas</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Auditor / Capitán</label>
                  <input
                    type="text"
                    value={auditAuditorName}
                    onChange={(e) => setAuditAuditorName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Tabla de Botellas a Medir */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-400" />
                    Medición Física al Cierre de Turno
                  </h4>
                  <span className="text-xs text-slate-400 font-mono">
                    {auditRows.length} botellas seleccionadas
                  </span>
                </div>

                <div className="space-y-3">
                  {auditRows.map((row, idx) => (
                    <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                        <span className="text-xs font-bold text-white">{row.bottleLabel}</span>
                        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                          <span>Capacidad: {row.capacityMl} mL</span>
                          <span>Inicio: {row.startLevelMl} mL</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        {/* Selector de Método de Medición */}
                        <div>
                          <label className="block text-slate-400 text-[11px] mb-1">Método de Medición</label>
                          <select
                            value={row.method}
                            onChange={(e) => {
                              const method = e.target.value as any;
                              const updated = [...auditRows];
                              updated[idx].method = method;
                              setAuditRows(updated);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
                          >
                            <option value="WEIGHING">⚖️ Báscula (Gramos)</option>
                            <option value="TENTHS">📏 Décimos (Visual 0.1-1.0)</option>
                            <option value="DIRECT_ML">🧪 Medición Directa (mL)</option>
                          </select>
                        </div>

                        {/* Input según método */}
                        {row.method === 'WEIGHING' && (
                          <div>
                            <label className="block text-slate-400 text-[11px] mb-1">Peso Bruto Báscula (g)</label>
                            <input
                              type="number"
                              value={row.weightGrams}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const updated = [...auditRows];
                                updated[idx].weightGrams = val;
                                const net = Math.max(0, val - row.tareGrams);
                                updated[idx].endLevelMl = Math.round((net / row.density) * 10) / 10;
                                setAuditRows(updated);
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none"
                            />
                            <span className="text-[10px] text-slate-500">Tara: {row.tareGrams}g &bull; Dens: {row.density}</span>
                          </div>
                        )}

                        {row.method === 'TENTHS' && (
                          <div>
                            <label className="block text-slate-400 text-[11px] mb-1">Nivel en Décimos (0.1 a 1.0)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              value={row.tenths}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const updated = [...auditRows];
                                updated[idx].tenths = val;
                                updated[idx].endLevelMl = Math.round(val * row.capacityMl * 10) / 10;
                                setAuditRows(updated);
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none"
                            />
                            <span className="text-[10px] text-slate-500">Ej: 0.5 = media botella</span>
                          </div>
                        )}

                        {row.method === 'DIRECT_ML' && (
                          <div>
                            <label className="block text-slate-400 text-[11px] mb-1">mL Finales Medidos</label>
                            <input
                              type="number"
                              value={row.endLevelMl}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const updated = [...auditRows];
                                updated[idx].endLevelMl = val;
                                setAuditRows(updated);
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none"
                            />
                          </div>
                        )}

                        {/* Botellas nuevas abiertas */}
                        <div>
                          <label className="block text-slate-400 text-[11px] mb-1">Botellas Nuevas Abiertas (mL)</label>
                          <input
                            type="number"
                            value={row.newBottlesAddedMl}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = [...auditRows];
                              updated[idx].newBottlesAddedMl = val;
                              setAuditRows(updated);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none"
                            placeholder="0"
                          />
                        </div>

                        {/* Causa del Desvío */}
                        <div>
                          <label className="block text-slate-400 text-[11px] mb-1">Motivo Principal</label>
                          <select
                            value={row.reason}
                            onChange={(e) => {
                              const updated = [...auditRows];
                              updated[idx].reason = e.target.value;
                              setAuditRows(updated);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
                          >
                            <option value="OVER_POUR">Sobre-vertido en preparación</option>
                            <option value="SPILLAGE">Derrame accidental en barra</option>
                            <option value="BROKEN_BOTTLE">Botella rota</option>
                            <option value="UNRECORDED_COURTESY">Cortesía no registrada en POS</option>
                            <option value="ACCURATE">Dentro de tolerancia normal</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notas de Cierre de Barra</label>
                <textarea
                  rows={2}
                  placeholder="Observaciones de mermas, botellas rotas o evento especial..."
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAuditModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAudit}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {submittingAudit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Procesando Cierre de Barra...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Guardar y Generar Ticket
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ALTA DE BOTELLA EN BARRA */}
      {bottleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wine className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Alta de Botella en Barra</h3>
              </div>
              <button
                onClick={() => setBottleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBottle} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Insumo del Catálogo</label>
                <select
                  value={bottleIngredientId}
                  onChange={(e) => {
                    setBottleIngredientId(e.target.value);
                    const selected = ingredientsCatalog.find((i) => i.id === e.target.value);
                    if (selected) {
                      setBottleLabel(`${selected.name} #1`);
                      setBottleCost(String(selected.cost || 300));
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none"
                >
                  {ingredientsCatalog.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} (${i.cost} / {i.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Etiqueta / Identificador de Botella</label>
                <input
                  type="text"
                  placeholder="Tequila Don Julio 70 #1"
                  value={bottleLabel}
                  onChange={(e) => setBottleLabel(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Estación de Barra</label>
                <input
                  type="text"
                  placeholder="Barra Principal"
                  value={bottleStation}
                  onChange={(e) => setBottleStation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Capacidad (mL)</label>
                  <input
                    type="number"
                    value={bottleCapacityMl}
                    onChange={(e) => setBottleCapacityMl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tara Vidrio Vacío (g)</label>
                  <input
                    type="number"
                    value={bottleTareGrams}
                    onChange={(e) => setBottleTareGrams(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Densidad (g/mL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bottleDensity}
                    onChange={(e) => setBottleDensity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Costo Botella ($ MXN)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bottleCost}
                    onChange={(e) => setBottleCost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setBottleModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBottle}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold flex items-center gap-1.5"
                >
                  {savingBottle ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Guardar Botella
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: COMPROBANTE TÉRMICO DE AUDITORÍA */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Ticket Térmico ESC/POS de Cierre de Barra</h3>
                  <p className="text-xs text-slate-400">Comprobante de arqueo de licores y firmas de conformidad</p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
              {loadingTicket ? (
                <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                  <p className="text-xs font-medium">Generando ticket térmico...</p>
                </div>
              ) : thermalTicketText ? (
                <pre className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-all">
                  {thermalTicketText}
                </pre>
              ) : (
                <p className="text-xs text-slate-500 text-center py-10">No se encontró contenido para este ticket.</p>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (thermalTicketText) {
                      navigator.clipboard.writeText(thermalTicketText);
                      notify('Ticket copiado al portapapeles', 'success');
                    }
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <Copy className="w-4 h-4 text-amber-400" />
                  Copiar Texto
                </button>
                <button
                  onClick={() => {
                    if (!thermalTicketText) return;
                    const blob = new Blob([thermalTicketText], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `cierre_barra_${selectedAudit?.folio || 'auditoria'}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                    notify('Archivo descargado con éxito', 'success');
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar (.txt)
                </button>
              </div>

              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
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
