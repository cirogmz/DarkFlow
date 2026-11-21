'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Snowflake,
  Fan,
  Coffee,
  Layers,
  CheckSquare,
  Square,
  Eye,
  FileText,
  AlertOctagon,
  ChevronRight,
  ExternalLink,
  Sliders
} from 'lucide-react';
import { ChecklistItem } from '@/lib/equipmentMaintenance';

interface EquipmentItem {
  id: string;
  name: string;
  code: string;
  category: string;
  location?: string | null;
  brandModel?: string | null;
  serialNumber?: string | null;
  vendorName?: string | null;
  vendorContact?: string | null;
  status: 'OPERATIONAL' | 'MAINTENANCE_REQUIRED' | 'UNDER_REPAIR' | 'DECOMMISSIONED';
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  warrantyExpiration?: string | null;
  lastMaintenanceDate?: string | null;
  nextMaintenanceDate?: string | null;
  maintenanceFrequencyDays?: number | null;
  notes?: string | null;
  health?: {
    totalWorkOrders: number;
    preventiveCompleted: number;
    correctiveBreakdowns: number;
    totalMaintenanceCost: number;
    totalDowntimeHours: number;
    mttrHours: number;
    mtbfDays: number;
    warrantyStatus: 'ACTIVE' | 'EXPIRED' | 'NO_WARRANTY';
    warrantyDaysRemaining?: number;
    preventiveStatus: 'UP_TO_DATE' | 'DUE_SOON' | 'OVERDUE' | 'NOT_SCHEDULED';
    daysUntilNextMaintenance?: number;
  };
}

interface WorkOrderItem {
  id: string;
  folio: string;
  orderType: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  symptomsOrFailure?: string | null;
  actionTaken?: string | null;
  technicianName?: string | null;
  serviceCompany?: string | null;
  laborCost?: number | null;
  partsCost?: number | null;
  totalCost?: number | null;
  downtimeHours?: number | null;
  partsReplaced?: string | null;
  checklistJson?: string | null;
  scheduledDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
  equipment: {
    id: string;
    name: string;
    code: string;
    category: string;
    location?: string | null;
    status: string;
  };
}

interface EquipmentKpis {
  totalAssets: number;
  operationalCount: number;
  underRepairCount: number;
  maintenanceRequiredCount: number;
  overdueCount: number;
  dueSoonCount: number;
  totalYtdCost: number;
  totalDowntimeHours: number;
}

export default function EquipmentMaintenanceTab() {
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'workOrders' | 'calendar'>('inventory');
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [kpis, setKpis] = useState<EquipmentKpis | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [woStatusFilter, setWoStatusFilter] = useState('ALL');

  // Modals
  const [newEquipmentModalOpen, setNewEquipmentModalOpen] = useState(false);
  const [equipmentForm, setEquipmentForm] = useState({
    name: '',
    code: '',
    category: 'COOKING',
    location: 'Cocina Principal',
    brandModel: '',
    serialNumber: '',
    vendorName: '',
    vendorContact: '',
    criticality: 'HIGH',
    purchaseDate: '',
    purchaseCost: 0,
    warrantyExpiration: '',
    maintenanceFrequencyDays: 90,
    notes: '',
  });

  const [newWoModalOpen, setNewWoModalOpen] = useState(false);
  const [targetEquipmentForWo, setTargetEquipmentForWo] = useState<EquipmentItem | null>(null);
  const [woForm, setWoForm] = useState({
    equipmentId: '',
    orderType: 'PREVENTIVE',
    priority: 'MEDIUM',
    title: '',
    description: '',
    symptomsOrFailure: '',
    technicianName: '',
    serviceCompany: '',
    scheduledDate: new Date().toISOString().split('T')[0],
  });

  const [completeWoModalOpen, setCompleteWoModalOpen] = useState(false);
  const [targetWoForComplete, setTargetWoForComplete] = useState<WorkOrderItem | null>(null);
  const [completeForm, setCompleteForm] = useState({
    laborCost: 0,
    partsCost: 0,
    downtimeHours: 0,
    partsReplaced: '',
    actionTaken: '',
    checklist: [] as ChecklistItem[],
  });

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [ticketContent, setTicketContent] = useState('');
  const [printLoading, setPrintLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Fetch Data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [eqRes, woRes] = await Promise.all([
        fetch('/api/equipment'),
        fetch('/api/equipment/work-orders'),
      ]);

      if (eqRes.ok) {
        const eqData = await eqRes.json();
        setEquipmentList(eqData.equipment || []);
        setKpis(eqData.kpis || null);
      }
      if (woRes.ok) {
        const woData = await woRes.json();
        setWorkOrders(woData.workOrders || []);
      }
    } catch (err) {
      console.error('Error fetching CMMS data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create Equipment
  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentForm.name.trim() || !equipmentForm.code.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(equipmentForm),
      });

      if (res.ok) {
        setNewEquipmentModalOpen(false);
        setEquipmentForm({
          name: '',
          code: '',
          category: 'COOKING',
          location: 'Cocina Principal',
          brandModel: '',
          serialNumber: '',
          vendorName: '',
          vendorContact: '',
          criticality: 'HIGH',
          purchaseDate: '',
          purchaseCost: 0,
          warrantyExpiration: '',
          maintenanceFrequencyDays: 90,
          notes: '',
        });
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al registrar equipo');
      }
    } catch (err) {
      console.error('Error saving equipment:', err);
      alert('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // Open New Work Order Modal
  const openNewWo = (eq?: EquipmentItem) => {
    const selected = eq || equipmentList[0];
    setTargetEquipmentForWo(selected || null);
    setWoForm({
      equipmentId: selected ? selected.id : '',
      orderType: 'PREVENTIVE',
      priority: 'MEDIUM',
      title: selected ? `Mantenimiento Preventivo - ${selected.name}` : '',
      description: '',
      symptomsOrFailure: '',
      technicianName: selected?.vendorName || '',
      serviceCompany: selected?.vendorName || '',
      scheduledDate: new Date().toISOString().split('T')[0],
    });
    setNewWoModalOpen(true);
  };

  // Submit Work Order
  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!woForm.equipmentId || !woForm.title.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/equipment/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(woForm),
      });

      if (res.ok) {
        setNewWoModalOpen(false);
        fetchData();
        setActiveSubTab('workOrders');
      } else {
        const err = await res.json();
        alert(err.error || 'Error al generar orden de trabajo');
      }
    } catch (err) {
      console.error('Error creating work order:', err);
      alert('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Complete Work Order Modal
  const openCompleteModal = (wo: WorkOrderItem) => {
    setTargetWoForComplete(wo);
    let chkList: ChecklistItem[] = [];
    if (wo.checklistJson) {
      try {
        chkList = JSON.parse(wo.checklistJson);
      } catch {}
    }
    setCompleteForm({
      laborCost: wo.laborCost || 0,
      partsCost: wo.partsCost || 0,
      downtimeHours: wo.downtimeHours || 0,
      partsReplaced: wo.partsReplaced || '',
      actionTaken: wo.actionTaken || '',
      checklist: chkList,
    });
    setCompleteWoModalOpen(true);
  };

  // Submit Complete Work Order
  const handleCompleteWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWoForComplete) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/equipment/work-orders/${targetWoForComplete.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          laborCost: completeForm.laborCost,
          partsCost: completeForm.partsCost,
          downtimeHours: completeForm.downtimeHours,
          partsReplaced: completeForm.partsReplaced,
          actionTaken: completeForm.actionTaken,
          checklistJson: JSON.stringify(completeForm.checklist),
        }),
      });

      if (res.ok) {
        setCompleteWoModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al liquidar orden de trabajo');
      }
    } catch (err) {
      console.error('Error completing work order:', err);
      alert('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Ticket Print Modal
  const openPrintTicket = async (woId: string) => {
    try {
      setPrintLoading(true);
      setPrintModalOpen(true);
      setTicketContent('Cargando orden de servicio...');
      const res = await fetch(`/api/equipment/work-orders/${woId}/print`);
      if (res.ok) {
        const data = await res.json();
        setTicketContent(data.ticket || '');
      } else {
        setTicketContent('No se pudo generar el comprobante.');
      }
    } catch (err) {
      console.error('Error printing ticket:', err);
      setTicketContent('Error de comunicación con el servidor.');
    } finally {
      setPrintLoading(false);
    }
  };

  // Filtered Equipment
  const filteredEquipment = equipmentList.filter((eq) => {
    const matchesSearch =
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (eq.brandModel && eq.brandModel.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = categoryFilter === 'ALL' || eq.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  // Filtered Work Orders
  const filteredWorkOrders = workOrders.filter((wo) => {
    const matchesStatus = woStatusFilter === 'ALL' || wo.status === woStatusFilter;
    const matchesSearch =
      wo.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.equipment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.equipment.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Helpers
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'COOKING':
        return <Flame className="w-4 h-4 text-orange-400" />;
      case 'REFRIGERATION':
        return <Snowflake className="w-4 h-4 text-cyan-400" />;
      case 'EXTRACTION_VENTILATION':
        return <Fan className="w-4 h-4 text-purple-400" />;
      case 'BEVERAGE_COFFEE':
        return <Coffee className="w-4 h-4 text-amber-400" />;
      default:
        return <Wrench className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPERATIONAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Operativo
          </span>
        );
      case 'MAINTENANCE_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Requiere Servicio
          </span>
        );
      case 'UNDER_REPAIR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            En Reparación / Paro
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300">
            Baja / Inactivo
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shadow-lg shadow-amber-500/10">
            <Wrench className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">
                Mantenimiento de Equipos & Cámaras Frías (Kitchen CMMS)
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Asset Watchdog
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Control de activos, órdenes de trabajo (OT), calendario preventivo, garantías y costos de reparación en cocina.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setNewEquipmentModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Equipo</span>
          </button>
          <button
            onClick={() => openNewWo()}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-600/20 transition"
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Generar OT / Falla</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Activos Totales</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{kpis.totalAssets}</span>
              <span className="text-xs text-emerald-400 font-semibold">{kpis.operationalCount} operativos</span>
            </div>
            <span className="text-[11px] text-slate-500">Maquinaria inventariada</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">En Paro / Falla</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${kpis.underRepairCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
                {kpis.underRepairCount}
              </span>
              <span className="text-xs text-slate-400">equipos</span>
            </div>
            <span className="text-[11px] text-slate-500">Afectando producción</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Preventivo Vencido</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${kpis.overdueCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {kpis.overdueCount}
              </span>
              <span className="text-xs text-slate-400">vencidos</span>
            </div>
            <span className="text-[11px] text-slate-500">{kpis.dueSoonCount} por vencer en 7d</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Horas de Paro</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-purple-400">{kpis.totalDowntimeHours}h</span>
            </div>
            <span className="text-[11px] text-slate-500">Downtime acumulado</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Gasto Mantenimiento</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-cyan-400">${kpis.totalYtdCost.toLocaleString('es-MX')}</span>
            </div>
            <span className="text-[11px] text-slate-500">Refacciones + Técnicos</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Confiabilidad</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">
                {kpis.totalAssets > 0 ? Math.round((kpis.operationalCount / kpis.totalAssets) * 100) : 100}%
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Línea operativa</span>
          </div>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeSubTab === 'inventory'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Inventario de Equipos ({equipmentList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('workOrders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeSubTab === 'workOrders'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Órdenes de Trabajo / CMMS ({workOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeSubTab === 'calendar'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Calendario Preventivo & Checklists</span>
        </button>
      </div>

      {/* VIEW 1: EQUIPMENT INVENTORY */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          {/* Search and Category Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, código o modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: 'ALL', label: 'Todos' },
                { id: 'COOKING', label: 'Cocción' },
                { id: 'REFRIGERATION', label: 'Refrigeración' },
                { id: 'EXTRACTION_VENTILATION', label: 'Extracción' },
                { id: 'BEVERAGE_COFFEE', label: 'Bebidas/Bar' },
                { id: 'DISHWASHING', label: 'Lavado' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    categoryFilter === cat.id
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full py-16 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-400" />
                Cargando inventario de maquinaria de cocina...
              </div>
            ) : filteredEquipment.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
                <Wrench className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                No se encontraron equipos registrados con los filtros aplicados.
              </div>
            ) : (
              filteredEquipment.map((eq) => (
                <div
                  key={eq.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {getCategoryIcon(eq.category)}
                          <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {eq.code}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white mt-1">{eq.name}</h4>
                        <p className="text-xs text-slate-400">{eq.location || 'Cocina Principal'}</p>
                      </div>
                      {getStatusBadge(eq.status)}
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                      {eq.brandModel && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Modelo:</span>
                          <span className="font-medium text-slate-200">{eq.brandModel}</span>
                        </div>
                      )}
                      {eq.serialNumber && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">No. Serie:</span>
                          <span className="font-mono text-slate-300">{eq.serialNumber}</span>
                        </div>
                      )}
                      {eq.vendorName && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Servicio Técnico:</span>
                          <span className="text-slate-200">{eq.vendorName}</span>
                        </div>
                      )}

                      {/* Preventive Status Badge */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-2">
                        <span className="text-slate-500">Próximo Preventivo:</span>
                        {eq.health?.preventiveStatus === 'OVERDUE' ? (
                          <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Vencido ({Math.abs(eq.health.daysUntilNextMaintenance || 0)}d)
                          </span>
                        ) : eq.health?.preventiveStatus === 'DUE_SOON' ? (
                          <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                            Vence en {eq.health.daysUntilNextMaintenance}d
                          </span>
                        ) : eq.nextMaintenanceDate ? (
                          <span className="text-slate-300 font-medium">
                            {new Date(eq.nextMaintenanceDate).toLocaleDateString('es-MX')}
                          </span>
                        ) : (
                          <span className="text-slate-500">No programado</span>
                        )}
                      </div>

                      {/* Warranty Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Garantía:</span>
                        {eq.health?.warrantyStatus === 'ACTIVE' ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Activa ({eq.health.warrantyDaysRemaining}d)
                          </span>
                        ) : eq.health?.warrantyStatus === 'EXPIRED' ? (
                          <span className="text-slate-500 flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Expirada
                          </span>
                        ) : (
                          <span className="text-slate-600">Sin garantía</span>
                        )}
                      </div>

                      {/* Work Orders Count & Cost */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-500">Gasto Acumulado:</span>
                        <span className="font-mono text-cyan-400 font-bold">
                          ${(eq.health?.totalMaintenanceCost || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openNewWo(eq)}
                      className="flex-1 py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold border border-amber-500/30 flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Generar OT
                    </button>
                    <button
                      onClick={() => {
                        setTargetEquipmentForWo(eq);
                        setActiveSubTab('workOrders');
                        setSearchTerm(eq.code);
                      }}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
                      title="Ver Historial de OT"
                    >
                      Historial
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: WORK ORDERS (CMMS) */}
      {activeSubTab === 'workOrders' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por folio, equipo, técnico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {['ALL', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setWoStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    woStatusFilter === st
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'ALL' ? 'Todas' : st === 'SCHEDULED' ? 'Programadas' : st === 'IN_PROGRESS' ? 'En Proceso' : st === 'WAITING_PARTS' ? 'Esp. Refacción' : 'Completadas'}
                </button>
              ))}
            </div>
          </div>

          {/* Work Orders List */}
          <div className="space-y-3">
            {loading ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-400" />
                Cargando órdenes de trabajo...
              </div>
            ) : filteredWorkOrders.length === 0 ? (
              <div className="py-16 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
                No hay órdenes de trabajo registradas con los criterios seleccionados.
              </div>
            ) : (
              filteredWorkOrders.map((wo) => (
                <div
                  key={wo.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-amber-400 mt-1">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-white">{wo.folio}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          wo.priority === 'EMERGENCY' ? 'bg-rose-600/30 text-rose-300 border border-rose-500/50 animate-pulse' :
                          wo.priority === 'HIGH' ? 'bg-orange-600/30 text-orange-300 border border-orange-500/50' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {wo.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          wo.orderType === 'PREVENTIVE' ? 'bg-blue-500/20 text-blue-300' :
                          wo.orderType === 'EMERGENCY_BREAKDOWN' ? 'bg-rose-500/20 text-rose-300' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {wo.orderType}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          wo.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          wo.status === 'IN_PROGRESS' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                          wo.status === 'WAITING_PARTS' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {wo.status}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white mt-1">{wo.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{wo.description}</p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                        <span>Equipo: <strong className="text-slate-200">{wo.equipment.name}</strong> ({wo.equipment.code})</span>
                        {wo.technicianName && <span>Técnico: <strong className="text-slate-200">{wo.technicianName}</strong></span>}
                        {wo.scheduledDate && <span>Programada: <strong className="text-slate-200">{new Date(wo.scheduledDate).toLocaleDateString('es-MX')}</strong></span>}
                        {wo.totalCost !== undefined && (wo.totalCost || 0) > 0 && (
                          <span className="text-cyan-400 font-bold">Costo: ${(wo.totalCost || 0).toFixed(2)}</span>
                        )}
                        {(wo.downtimeHours || 0) > 0 && (
                          <span className="text-purple-400 font-semibold">{wo.downtimeHours}h fuera de servicio</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => openPrintTicket(wo.id)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
                      title="Imprimir Orden de Servicio 80mm"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {wo.status !== 'COMPLETED' && (
                      <button
                        onClick={() => openCompleteModal(wo)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Completar / Liquidar</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: PREVENTIVE CALENDAR & CHECKLISTS */}
      {activeSubTab === 'calendar' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Cronograma de Mantenimientos Preventivos</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Equipos ordenados por urgencia de fecha compromiso para prevenir paros no programados.
              </p>
            </div>
            <button
              onClick={() => openNewWo()}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Programar Servicio
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {equipmentList
              .slice()
              .sort((a, b) => {
                const dateA = a.nextMaintenanceDate ? new Date(a.nextMaintenanceDate).getTime() : Infinity;
                const dateB = b.nextMaintenanceDate ? new Date(b.nextMaintenanceDate).getTime() : Infinity;
                return dateA - dateB;
              })
              .map((eq) => (
                <div key={eq.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-amber-400">{eq.code}</span>
                      <h4 className="font-bold text-white text-sm">{eq.name}</h4>
                    </div>
                    {eq.health?.preventiveStatus === 'OVERDUE' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        VENCIDO
                      </span>
                    ) : eq.health?.preventiveStatus === 'DUE_SOON' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        PRÓXIMO EN 7D
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                        AL DÍA
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Frecuencia recomendada:</span>
                    <span className="text-white font-semibold">Cada {eq.maintenanceFrequencyDays || 90} días</span>
                  </div>

                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-slate-400">Fecha Próximo Servicio:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {eq.nextMaintenanceDate ? new Date(eq.nextMaintenanceDate).toLocaleDateString('es-MX') : 'No establecida'}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openNewWo(eq)}
                      className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold border border-amber-500/30"
                    >
                      Crear OT Preventiva
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* MODAL 1: NUEVO EQUIPO */}
      {newEquipmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Registrar Nuevo Equipo de Cocina</h3>
              </div>
              <button onClick={() => setNewEquipmentModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Código / Tag *</label>
                  <input
                    type="text"
                    required
                    placeholder="EQ-FRY-01"
                    value={equipmentForm.code}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Categoría *</label>
                  <select
                    value={equipmentForm.category}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="COOKING">Cocción (Hornos, Freidoras, Estufas)</option>
                    <option value="REFRIGERATION">Refrigeración (Cámaras, Mesas frías)</option>
                    <option value="EXTRACTION_VENTILATION">Extracción y Campanas</option>
                    <option value="BEVERAGE_COFFEE">Bebidas y Máquinas de Hielo</option>
                    <option value="FOOD_PREPARATION">Preparación y Rebanadoras</option>
                    <option value="DISHWASHING">Lavado de Loza</option>
                    <option value="OTHER">Otro Equipo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre del Activo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Horno Combinado Rational 10 Charolas"
                  value={equipmentForm.name}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Ubicación / Estación</label>
                  <input
                    type="text"
                    placeholder="Línea Caliente 1, Cuarto Frío..."
                    value={equipmentForm.location}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, location: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Criticidad</label>
                  <select
                    value={equipmentForm.criticality}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, criticality: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="CRITICAL">Crítica (Paro total de cocina)</option>
                    <option value="HIGH">Alta</option>
                    <option value="MEDIUM">Media</option>
                    <option value="LOW">Baja</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Marca / Modelo</label>
                  <input
                    type="text"
                    placeholder="Rational iCombi Pro..."
                    value={equipmentForm.brandModel}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, brandModel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">No. Serie</label>
                  <input
                    type="text"
                    placeholder="SN-12345678"
                    value={equipmentForm.serialNumber}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, serialNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Proveedor / Técnico</label>
                  <input
                    type="text"
                    placeholder="Servicio Técnico Gastronómico..."
                    value={equipmentForm.vendorName}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, vendorName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Frecuencia Preventivo (Días)</label>
                  <input
                    type="number"
                    min="1"
                    value={equipmentForm.maintenanceFrequencyDays}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, maintenanceFrequencyDays: parseInt(e.target.value, 10) || 90 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Vencimiento Garantía</label>
                  <input
                    type="date"
                    value={equipmentForm.warrantyExpiration}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, warrantyExpiration: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Costo Adquisición ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={equipmentForm.purchaseCost}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, purchaseCost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewEquipmentModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-sm flex items-center gap-1.5 shadow"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Registrar Equipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NUEVA ORDEN DE TRABAJO */}
      {newWoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Generar Orden de Trabajo (OT)</h3>
              </div>
              <button onClick={() => setNewWoModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkOrder} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Equipo Destino *</label>
                <select
                  required
                  value={woForm.equipmentId}
                  onChange={(e) => setWoForm({ ...woForm, equipmentId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="">Selecciona un equipo</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      [{eq.code}] {eq.name} ({eq.location || 'Cocina'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Servicio *</label>
                  <select
                    value={woForm.orderType}
                    onChange={(e) => setWoForm({ ...woForm, orderType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="PREVENTIVE">Mantenimiento Preventivo</option>
                    <option value="CORRECTIVE">Reparación Correctiva</option>
                    <option value="EMERGENCY_BREAKDOWN">Paro Crítico / Emergencia</option>
                    <option value="CALIBRATION">Calibración / Certificación</option>
                    <option value="INSPECTION">Inspección Diagnóstica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Prioridad *</label>
                  <select
                    value={woForm.priority}
                    onChange={(e) => setWoForm({ ...woForm, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="LOW">Baja (Rutinaria)</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta (Riesgo inminente)</option>
                    <option value="EMERGENCY">Emergencia (Paro de Producción)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Título de la Orden *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Falla en encendido de piloto / Servicio bimestral"
                  value={woForm.title}
                  onChange={(e) => setWoForm({ ...woForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Descripción del Trabajo / Falla *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe detalladamente los síntomas, ruidos o tareas a realizar..."
                  value={woForm.description}
                  onChange={(e) => setWoForm({ ...woForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Técnico / Empresa</label>
                  <input
                    type="text"
                    placeholder="Nombre del técnico o proveedor"
                    value={woForm.technicianName}
                    onChange={(e) => setWoForm({ ...woForm, technicianName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha Programada</label>
                  <input
                    type="date"
                    value={woForm.scheduledDate}
                    onChange={(e) => setWoForm({ ...woForm, scheduledDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewWoModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-sm flex items-center gap-1.5 shadow"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Emitir Orden de Trabajo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: COMPLETAR / LIQUIDAR ORDEN DE TRABAJO */}
      {completeWoModalOpen && targetWoForComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Cerrar y Liquidar OT: {targetWoForComplete.folio}</h3>
                  <p className="text-xs text-slate-400">{targetWoForComplete.equipment.name}</p>
                </div>
              </div>
              <button onClick={() => setCompleteWoModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleCompleteWorkOrder} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Acción Técnica Realizada *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Detalla qué reparaciones o calibraciones se realizaron..."
                  value={completeForm.actionTaken}
                  onChange={(e) => setCompleteForm({ ...completeForm, actionTaken: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Refacciones Reemplazadas</label>
                <input
                  type="text"
                  placeholder="Ej. Termocupla, empaque de puerta, gas refrigerante R404A..."
                  value={completeForm.partsReplaced}
                  onChange={(e) => setCompleteForm({ ...completeForm, partsReplaced: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Mano de Obra ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={completeForm.laborCost}
                    onChange={(e) => setCompleteForm({ ...completeForm, laborCost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Refacciones ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={completeForm.partsCost}
                    onChange={(e) => setCompleteForm({ ...completeForm, partsCost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Horas Paro</label>
                  <input
                    type="number"
                    step="0.1"
                    value={completeForm.downtimeHours}
                    onChange={(e) => setCompleteForm({ ...completeForm, downtimeHours: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* Checklist verification */}
              {completeForm.checklist.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Puntos de Control / Checklist</label>
                  <div className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    {completeForm.checklist.map((item, idx) => (
                      <label key={item.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={(e) => {
                            const updated = [...completeForm.checklist];
                            updated[idx].done = e.target.checked;
                            setCompleteForm({ ...completeForm, checklist: updated });
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
                        />
                        <span>{item.task}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  Total Liquidado: <strong className="text-cyan-400 font-mono">${((completeForm.laborCost || 0) + (completeForm.partsCost || 0)).toFixed(2)}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCompleteWoModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-lg text-sm flex items-center gap-1.5 shadow"
                  >
                    {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Confirmar Cierre de OT
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: IMPRESIÓN DE TICKET DE SERVICIO 80MM */}
      {printModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Comprobante de Orden de Trabajo 80mm</h3>
              </div>
              <button onClick={() => setPrintModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-950">
              {printLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                  Generando comprobante...
                </div>
              ) : (
                <pre className="font-mono text-xs text-amber-400 bg-black/70 p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                  {ticketContent}
                </pre>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/70">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(ticketContent);
                  alert('Comprobante copiado al portapapeles');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Copiar Texto
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-sm flex items-center gap-1.5 shadow"
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
