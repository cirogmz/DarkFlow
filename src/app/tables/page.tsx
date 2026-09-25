'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  LayoutGrid, 
  Plus, 
  Users, 
  Clock, 
  CheckCircle2, 
  Receipt, 
  ShoppingBag, 
  Utensils,
  Trash2,
  Printer,
  QrCode,
  ExternalLink,
  Copy,
  ArrowRightLeft,
  GitMerge,
  Divide,
  AlertCircle,
  Check,
  Calendar,
  UserCheck,
  BellRing,
  Phone,
  Mail,
  UserPlus,
  Armchair,
  Sparkles,
  XCircle,
  Search,
  Filter
} from 'lucide-react';
import ThermalTicketModal, { ThermalOrderData } from '@/components/ThermalTicketModal';
import { useRouter } from 'next/navigation';

interface TableOrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    name: string;
  };
}

interface TableActiveOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  tip: number;
  diners?: number | null;
  createdAt: string;
  items: TableOrderItem[];
}

interface TableReservationItem {
  id: string;
  customerName: string;
  customerPhone: string;
  diners: number;
  reservationDate: string;
  durationMinutes: number;
  status: string;
}

interface RestaurantTable {
  id: string;
  number: string;
  name: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'RESERVED';
  zone: string;
  brandId: string;
  orders?: TableActiveOrder[];
  reservations?: TableReservationItem[];
}

interface FullReservation {
  id: string;
  brandId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  diners: number;
  reservationDate: string;
  durationMinutes: number;
  status: 'PENDING' | 'CONFIRMED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';
  tableId?: string | null;
  zonePreference?: string | null;
  notes?: string | null;
  table?: {
    id: string;
    number: string;
    name: string;
    capacity: number;
    zone: string;
  } | null;
}

interface WaitlistParty {
  id: string;
  brandId: string;
  customerName: string;
  customerPhone: string;
  diners: number;
  estimatedWaitMinutes: number;
  status: 'WAITING' | 'NOTIFIED' | 'SEATED' | 'CANCELLED';
  zonePreference?: string | null;
  tableId?: string | null;
  notifiedAt?: string | null;
  createdAt: string;
  notes?: string | null;
  table?: {
    id: string;
    number: string;
    name: string;
  } | null;
}

export default function TablesPage() {
  const router = useRouter();
  const { activeBrand, addNotification } = useAppStore();

  // Tab View: Floor Plan vs Hostess Station
  const [activeTab, setActiveTab] = useState<'FLOOR_PLAN' | 'HOSTESS'>('FLOOR_PLAN');

  // Tables State
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState('all');

  // Hostess & Waitlist States
  const [reservations, setReservations] = useState<FullReservation[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistParty[]>([]);
  const [resDateFilter, setResDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [resStatusFilter, setResStatusFilter] = useState('ALL');
  const [resSearch, setResSearch] = useState('');
  const [loadingHostess, setLoadingHostess] = useState(false);

  // Modals for Tables
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableCapacity, setTableCapacity] = useState<number>(4);
  const [tableZone, setTableZone] = useState('Salón');
  const [savingTable, setSavingTable] = useState(false);

  // Modal: View Table Bill / Order Detail
  const [selectedTableForBill, setSelectedTableForBill] = useState<RestaurantTable | null>(null);
  const [isThermalOpen, setIsThermalOpen] = useState(false);
  const [thermalInitialMode, setThermalInitialMode] = useState<'CUSTOMER' | 'KITCHEN'>('CUSTOMER');
  const [thermalOrderData, setThermalOrderData] = useState<ThermalOrderData | null>(null);

  // Modal: Table QR Code for Diner Self-Ordering
  const [selectedTableForQr, setSelectedTableForQr] = useState<RestaurantTable | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modal: Transfer Table Order
  const [selectedTableForTransfer, setSelectedTableForTransfer] = useState<RestaurantTable | null>(null);
  const [targetTransferTableId, setTargetTransferTableId] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Modal: Merge Table Orders
  const [selectedTableForMerge, setSelectedTableForMerge] = useState<RestaurantTable | null>(null);
  const [targetMergeTableId, setTargetMergeTableId] = useState('');
  const [merging, setMerging] = useState(false);

  // Hostess Modals: New Reservation
  const [isNewResModalOpen, setIsNewResModalOpen] = useState(false);
  const [resForm, setResForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    diners: 2,
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    durationMinutes: 90,
    tableId: '',
    zonePreference: 'Salón',
    notes: ''
  });
  const [savingRes, setSavingRes] = useState(false);

  // Hostess Modals: New Waitlist Entry
  const [isNewWaitlistModalOpen, setIsNewWaitlistModalOpen] = useState(false);
  const [waitlistForm, setWaitlistForm] = useState({
    customerName: '',
    customerPhone: '',
    diners: 2,
    estimatedWaitMinutes: 15,
    zonePreference: 'Cualquiera',
    notes: ''
  });
  const [savingWaitlist, setSavingWaitlist] = useState(false);

  // Hostess Modal: Seating Dialog (for Waitlist party or Reservation)
  const [seatingTarget, setSeatingTarget] = useState<{
    type: 'WAITLIST' | 'RESERVATION';
    id: string;
    customerName: string;
    diners: number;
    currentTableId?: string | null;
  } | null>(null);
  const [selectedSeatTableId, setSelectedSeatTableId] = useState('');
  const [savingSeating, setSavingSeating] = useState(false);

  // Fetch Tables
  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/tables');
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
      }
    } catch (err) {
      console.error('Failed to load tables', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Hostess Data (Reservations & Waitlist)
  const fetchHostessData = useCallback(async () => {
    setLoadingHostess(true);
    try {
      const [resRes, waitRes] = await Promise.all([
        fetch(`/api/reservations?date=${resDateFilter}&status=${resStatusFilter}`),
        fetch('/api/waitlist?status=ACTIVE')
      ]);

      if (resRes.ok) {
        const data = await resRes.json();
        setReservations(data.reservations || []);
      }

      if (waitRes.ok) {
        const data = await waitRes.json();
        setWaitlist(data.entries || []);
      }
    } catch (err) {
      console.error('Error fetching hostess data:', err);
    } finally {
      setLoadingHostess(false);
    }
  }, [resDateFilter, resStatusFilter]);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 10000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  useEffect(() => {
    fetchHostessData();
    const interval = setInterval(fetchHostessData, 15000);
    return () => clearInterval(interval);
  }, [fetchHostessData]);

  // Handler: Create Table
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber) return;

    setSavingTable(true);
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: tableNumber,
          name: tableName || `Mesa ${tableNumber}`,
          capacity: tableCapacity,
          zone: tableZone,
        }),
      });

      if (res.ok) {
        addNotification(`Mesa "${tableNumber}" agregada al salón`, 'success');
        setIsNewTableModalOpen(false);
        setTableNumber('');
        setTableName('');
        setTableCapacity(4);
        fetchTables();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error de red al crear mesa');
    } finally {
      setSavingTable(false);
    }
  };

  // Handler: Release Table
  const handleReleaseTable = async (tableId: string) => {
    if (!confirm('¿Deseas cerrar la cuenta y liberar esta mesa a Disponible?')) return;

    try {
      const res = await fetch('/api/tables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tableId,
          action: 'release',
        }),
      });

      if (res.ok) {
        addNotification(`Mesa liberada con éxito`, 'success');
        setSelectedTableForBill(null);
        fetchTables();
      } else {
        alert('Error al liberar mesa');
      }
    } catch {
      alert('Error de red al liberar mesa');
    }
  };

  const handleRequestBill = async (tableId: string) => {
    try {
      const res = await fetch('/api/tables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tableId,
          status: 'BILL_REQUESTED',
        }),
      });

      if (res.ok) {
        addNotification('Cuenta solicitada para la mesa', 'info');
        fetchTables();
      }
    } catch {
      alert('Error al solicitar cuenta');
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta mesa?')) return;

    try {
      const res = await fetch(`/api/tables?id=${tableId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        addNotification('Mesa eliminada', 'info');
        fetchTables();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error al eliminar mesa');
    }
  };

  const handleOpenPOSForTable = (tableId: string) => {
    router.push(`/pos?tableId=${tableId}&source=DINE_IN`);
  };

  const handleTransferTable = async () => {
    if (!selectedTableForTransfer || !targetTransferTableId) return;
    setTransferring(true);
    try {
      const res = await fetch('/api/tables/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId: selectedTableForTransfer.id,
          targetTableId: targetTransferTableId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addNotification(data.message || 'Comanda transferida', 'success');
        setSelectedTableForTransfer(null);
        setTargetTransferTableId('');
        fetchTables();
      } else {
        addNotification(data.error || 'Error al transferir', 'error');
      }
    } catch {
      addNotification('Error de red al transferir comanda', 'error');
    } finally {
      setTransferring(false);
    }
  };

  const handleMergeTables = async () => {
    if (!selectedTableForMerge || !targetMergeTableId) return;
    setMerging(true);
    try {
      const res = await fetch('/api/tables/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId: selectedTableForMerge.id,
          targetTableId: targetMergeTableId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addNotification(data.message || 'Mesas fusionadas con éxito', 'success');
        setSelectedTableForMerge(null);
        setTargetMergeTableId('');
        fetchTables();
      } else {
        addNotification(data.error || 'Error al fusionar mesas', 'error');
      }
    } catch {
      addNotification('Error de red al fusionar mesas', 'error');
    } finally {
      setMerging(false);
    }
  };

  // --- HOSTESS ACTIONS ---

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resForm.customerName || !resForm.customerPhone || !resForm.date || !resForm.time) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    setSavingRes(true);
    try {
      const resDateIso = new Date(`${resForm.date}T${resForm.time}:00`).toISOString();
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: resForm.customerName,
          customerPhone: resForm.customerPhone,
          customerEmail: resForm.customerEmail || undefined,
          diners: Number(resForm.diners),
          reservationDate: resDateIso,
          durationMinutes: Number(resForm.durationMinutes),
          tableId: resForm.tableId || undefined,
          zonePreference: resForm.zonePreference || undefined,
          notes: resForm.notes || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(`Reservación creada para ${resForm.customerName}`, 'success');
        setIsNewResModalOpen(false);
        setResForm({
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          diners: 2,
          date: new Date().toISOString().split('T')[0],
          time: '14:00',
          durationMinutes: 90,
          tableId: '',
          zonePreference: 'Salón',
          notes: ''
        });
        fetchHostessData();
        fetchTables();
      } else {
        addNotification(data.error || 'Error al crear reservación', 'error');
      }
    } catch {
      addNotification('Error de red al crear reservación', 'error');
    } finally {
      setSavingRes(false);
    }
  };

  const handleCreateWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistForm.customerName || !waitlistForm.customerPhone) {
      alert('Nombre y Teléfono son requeridos');
      return;
    }

    setSavingWaitlist(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: waitlistForm.customerName,
          customerPhone: waitlistForm.customerPhone,
          diners: Number(waitlistForm.diners),
          estimatedWaitMinutes: Number(waitlistForm.estimatedWaitMinutes),
          zonePreference: waitlistForm.zonePreference !== 'Cualquiera' ? waitlistForm.zonePreference : undefined,
          notes: waitlistForm.notes || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(`Anotado ${waitlistForm.customerName} a la Lista de Espera`, 'success');
        setIsNewWaitlistModalOpen(false);
        setWaitlistForm({
          customerName: '',
          customerPhone: '',
          diners: 2,
          estimatedWaitMinutes: 15,
          zonePreference: 'Cualquiera',
          notes: ''
        });
        fetchHostessData();
      } else {
        addNotification(data.error || 'Error al registrar en lista de espera', 'error');
      }
    } catch {
      addNotification('Error de red al registrar en lista de espera', 'error');
    } finally {
      setSavingWaitlist(false);
    }
  };

  const handleNotifyWaitlist = async (id: string, customerName: string) => {
    try {
      const res = await fetch(`/api/waitlist/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'NOTIFY' }),
      });
      if (res.ok) {
        addNotification(`🔔 Notificación enviada a ${customerName}. Mesa lista.`, 'info');
        fetchHostessData();
      }
    } catch {
      addNotification('Error al notificar comensal', 'error');
    }
  };

  const handleCancelWaitlist = async (id: string) => {
    if (!confirm('¿Deseas retirar a este comensal de la lista de espera?')) return;
    try {
      const res = await fetch(`/api/waitlist/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addNotification('Comensal retirado de la lista', 'info');
        fetchHostessData();
      }
    } catch {
      addNotification('Error al retirar comensal', 'error');
    }
  };

  const handleUpdateReservationStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        addNotification(`Reservación actualizada a ${status}`, 'success');
        fetchHostessData();
        fetchTables();
      }
    } catch {
      addNotification('Error al actualizar reservación', 'error');
    }
  };

  const handleConfirmSeating = async () => {
    if (!seatingTarget || !selectedSeatTableId) {
      alert('Selecciona una mesa para sentar al comensal');
      return;
    }

    setSavingSeating(true);
    try {
      if (seatingTarget.type === 'WAITLIST') {
        const res = await fetch(`/api/waitlist/${seatingTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SEAT',
            tableId: selectedSeatTableId,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          addNotification(`Comensal sentado en mesa con éxito`, 'success');
          setSeatingTarget(null);
          setSelectedSeatTableId('');
          fetchHostessData();
          fetchTables();
        } else {
          addNotification(data.error || 'Error al sentar comensal', 'error');
        }
      } else {
        const res = await fetch(`/api/reservations/${seatingTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'SEATED',
            tableId: selectedSeatTableId,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          addNotification(`Reservación sentada en mesa con éxito`, 'success');
          setSeatingTarget(null);
          setSelectedSeatTableId('');
          fetchHostessData();
          fetchTables();
        } else {
          addNotification(data.error || 'Error al sentar reservación', 'error');
        }
      }
    } catch {
      addNotification('Error de red al sentar comensales', 'error');
    } finally {
      setSavingSeating(false);
    }
  };

  // Zones list
  const zones = Array.from(new Set(tables.map(t => t.zone || 'Salón')));
  const filteredTables = tables.filter(t => selectedZone === 'all' || t.zone === selectedZone);

  // Metrics
  const totalTables = tables.length;
  const occupiedTables = tables.filter(t => t.status === 'OCCUPIED' || t.status === 'BILL_REQUESTED').length;
  const availableTables = tables.filter(t => t.status === 'AVAILABLE').length;
  const totalDiners = tables.reduce((sum, t) => {
    const active = t.orders && t.orders.length > 0 ? t.orders[0] : null;
    return sum + (active?.diners || (t.status === 'OCCUPIED' ? t.capacity : 0));
  }, 0);

  // Helper: seating duration
  const getMinutesSeated = (createdAtStr?: string) => {
    if (!createdAtStr) return 0;
    const diffMs = Date.now() - new Date(createdAtStr).getTime();
    return Math.max(1, Math.floor(diffMs / (60 * 1000)));
  };

  // Helper: Waitlist elapsed minutes
  const getElapsedWaitMinutes = (createdAtStr: string) => {
    const diffMs = Date.now() - new Date(createdAtStr).getTime();
    return Math.max(0, Math.floor(diffMs / (60 * 1000)));
  };

  // Filtered reservations
  const filteredReservations = reservations.filter(r => {
    if (!resSearch) return true;
    const q = resSearch.toLowerCase();
    return (
      r.customerName.toLowerCase().includes(q) ||
      r.customerPhone.includes(q) ||
      (r.customerEmail && r.customerEmail.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <DashboardContainer>
        <div className="flex h-[calc(100vh-200px)] items-center justify-center flex-col gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-brand-primary"></div>
          <p className="text-sm text-slate-400">Cargando salón, mesas y estación de hostess...</p>
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Header & Tab Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Salón, Mesas & Hostess</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Fase 22 Soft Restaurant
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Recepción de comensales, reservaciones y servicio en piso para: <strong className="text-white">{activeBrand?.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Main Mode Tabs */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('FLOOR_PLAN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'FLOOR_PLAN'
                    ? 'bg-brand-primary text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Salón & Mapa</span>
              </button>
              <button
                onClick={() => setActiveTab('HOSTESS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative ${
                  activeTab === 'HOSTESS'
                    ? 'bg-brand-primary text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Armchair className="h-3.5 w-3.5" />
                <span>Hostess & Puerta</span>
                {waitlist.length > 0 && (
                  <span className="h-4 w-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                    {waitlist.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'FLOOR_PLAN' ? (
              <button
                onClick={() => setIsNewTableModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-xl shadow-lg cursor-pointer transition-all shrink-0"
              >
                <Plus className="h-4 w-4 stroke-[3px]" /> Nueva Mesa
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsNewWaitlistModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer transition-all"
                >
                  <UserPlus className="h-4 w-4" /> Anotar en Espera
                </button>
                <button
                  onClick={() => setIsNewResModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all"
                >
                  <Calendar className="h-4 w-4" /> Reservación
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: SALÓN & MAPA DE MESAS                             */}
        {/* ======================================================== */}
        {activeTab === 'FLOOR_PLAN' && (
          <div className="space-y-6">
            {/* Live Salón KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Mesas Totales</span>
                  <p className="text-2xl font-black text-white mt-1">{totalTables}</p>
                </div>
                <div className="p-2 bg-slate-800 rounded-lg text-slate-300">
                  <LayoutGrid className="h-5 w-5" />
                </div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase">Disponibles</span>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{availableTables}</p>
                </div>
                <div className="p-2 bg-emerald-950/40 border border-emerald-900/40 rounded-lg text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-400 font-semibold uppercase">Ocupadas</span>
                  <p className="text-2xl font-black text-amber-400 mt-1">{occupiedTables}</p>
                </div>
                <div className="p-2 bg-amber-950/40 border border-amber-900/40 rounded-lg text-amber-400">
                  <Utensils className="h-5 w-5" />
                </div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-blue-400 font-semibold uppercase">Comensales en Sala</span>
                  <p className="text-2xl font-black text-blue-400 mt-1">{totalDiners}</p>
                </div>
                <div className="p-2 bg-blue-950/40 border border-blue-900/40 rounded-lg text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Zone Selector */}
            <div className="flex overflow-x-auto gap-2 py-1 border-b border-slate-850">
              <button
                onClick={() => setSelectedZone('all')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  selectedZone === 'all'
                    ? 'bg-brand-primary border-brand-primary text-slate-950'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Todas las Zonas ({tables.length})
              </button>
              {zones.map((zone) => {
                const count = tables.filter(t => t.zone === zone).length;
                return (
                  <button
                    key={zone}
                    onClick={() => setSelectedZone(zone)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      selectedZone === zone
                        ? 'bg-brand-primary border-brand-primary text-slate-950'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {zone} ({count})
                  </button>
                );
              })}
            </div>

            {/* Tables Floor Plan Grid */}
            {filteredTables.length === 0 ? (
              <div className="p-12 text-center glass-panel border border-slate-800 rounded-xl space-y-3">
                <LayoutGrid className="h-10 w-10 mx-auto text-slate-600" />
                <h4 className="font-bold text-white text-base">No hay mesas en esta zona</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Comienza organizando tu restaurante físico dando de alta las mesas del salón.
                </p>
                <button
                  onClick={() => setIsNewTableModalOpen(true)}
                  className="px-4 py-2 bg-brand-primary text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[3px]" /> Dar de Alta Primera Mesa
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredTables.map((table) => {
                  const activeOrder = table.orders && table.orders.length > 0 ? table.orders[0] : null;
                  const isOccupied = table.status === 'OCCUPIED' || table.status === 'BILL_REQUESTED' || Boolean(activeOrder);
                  const isBillRequested = table.status === 'BILL_REQUESTED';
                  const minutes = activeOrder ? getMinutesSeated(activeOrder.createdAt) : 0;
                  const upcomingRes = table.reservations && table.reservations.length > 0 ? table.reservations[0] : null;

                  return (
                    <div
                      key={table.id}
                      className={`glass-panel border rounded-xl p-5 shadow-lg flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden ${
                        isBillRequested
                          ? 'border-blue-500/50 bg-blue-950/10'
                          : isOccupied
                          ? 'border-amber-500/40 bg-amber-950/5'
                          : upcomingRes
                          ? 'border-purple-500/40 bg-purple-950/5'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Bar on Table Card */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm border ${
                                isBillRequested
                                  ? 'bg-blue-500 text-slate-950 border-blue-400'
                                  : isOccupied
                                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                                  : 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                              }`}
                            >
                              {table.number}
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-sm leading-tight">{table.name}</h4>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <span className="font-semibold text-slate-300">{table.zone}</span> • {table.capacity} pers.
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTableForQr(table);
                                setCopiedLink(false);
                              }}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-800 transition-colors cursor-pointer"
                              title="Ver / Imprimir Código QR de Mesa para Auto-Pedido"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>

                            {/* Status Badge */}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                isBillRequested
                                  ? 'bg-blue-950/80 border-blue-800 text-blue-300 animate-pulse'
                                  : isOccupied
                                  ? 'bg-amber-950/80 border-amber-800 text-amber-300'
                                  : 'bg-emerald-950/60 border-emerald-900 text-emerald-400'
                              }`}
                            >
                              {isBillRequested ? 'Cuenta Pedida' : isOccupied ? 'Ocupada' : 'Disponible'}
                            </span>
                          </div>
                        </div>

                        {/* Reservation Alert Badge (if scheduled for today) */}
                        {upcomingRes && (
                          <div className="bg-purple-950/40 border border-purple-800/60 rounded-lg p-2 flex items-center justify-between text-[11px] text-purple-300">
                            <span className="flex items-center gap-1.5 font-bold">
                              <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span>Reserva: {new Date(upcomingRes.reservationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </span>
                            <span className="text-[10px] text-purple-400/80 font-medium truncate max-w-[120px]">
                              {upcomingRes.customerName} ({upcomingRes.diners}p)
                            </span>
                          </div>
                        )}

                        {/* Occupied State Info */}
                        {isOccupied && activeOrder ? (
                          <div className="bg-slate-950/80 border border-slate-850 rounded-lg p-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-slate-400 text-[11px]">
                              <span className="flex items-center gap-1">
                                <Receipt className="h-3.5 w-3.5 text-brand-primary" />
                                <strong>{activeOrder.orderNumber}</strong>
                              </span>
                              <span className="flex items-center gap-1 text-slate-300 font-mono">
                                <Clock className="h-3 w-3 text-slate-400" />
                                {minutes} min
                              </span>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-900 pt-1.5">
                              <span className="text-slate-400 text-[11px]">
                                {activeOrder.diners || table.capacity} comensales ({activeOrder.items.length} platos)
                              </span>
                              <span className="font-black text-brand-primary text-sm">
                                ${activeOrder.total.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ) : !upcomingRes ? (
                          <div className="py-4 text-center text-slate-500 text-xs border border-dashed border-slate-800/80 rounded-lg">
                            Mesa lista para recibir comensales
                          </div>
                        ) : null}
                      </div>

                      {/* Actions Footer */}
                      <div className="pt-4 mt-3 border-t border-slate-850 flex items-center justify-between gap-2">
                        {isOccupied ? (
                          <div className="w-full space-y-1.5">
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                onClick={() => setSelectedTableForBill(table)}
                                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] rounded-lg border border-slate-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                title="Ver desglose de cuenta"
                              >
                                <Receipt className="h-3 w-3 text-brand-primary" /> Cuenta
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedTableForTransfer(table);
                                  setTargetTransferTableId('');
                                }}
                                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] rounded-lg border border-slate-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                title="Transferir comanda a otra mesa disponible"
                              >
                                <ArrowRightLeft className="h-3 w-3 text-sky-400" /> Mover
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedTableForMerge(table);
                                  setTargetMergeTableId('');
                                }}
                                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] rounded-lg border border-slate-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                title="Unir comanda con otra mesa ocupada"
                              >
                                <GitMerge className="h-3 w-3 text-purple-400" /> Unir
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                onClick={() => router.push(`/pos?tableId=${table.id}&orderId=${activeOrder?.id || ''}&source=DINE_IN`)}
                                className="py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-black text-xs rounded-lg shadow flex items-center justify-center gap-1 cursor-pointer transition-all"
                              >
                                <Divide className="h-3.5 w-3.5 stroke-[2.5px]" /> Cobrar / Dividir
                              </button>
                              <button
                                onClick={() => handleReleaseTable(table.id)}
                                className="py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                title="Liberar mesa directamente"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Liberar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenPOSForTable(table.id)}
                              className="flex-1 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <ShoppingBag className="h-3.5 w-3.5 stroke-[2.5px]" /> Tomar Comanda
                            </button>
                            <button
                              onClick={() => handleDeleteTable(table.id)}
                              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar Mesa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: ESTACIÓN DE HOSTESS & RECEPCIÓN                    */}
        {/* ======================================================== */}
        {activeTab === 'HOSTESS' && (
          <div className="space-y-6">
            {/* Hostess Quick KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase">Mesas Libres</span>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{availableTables}</p>
                </div>
                <div className="p-2 bg-emerald-950/40 border border-emerald-900/40 rounded-lg text-emerald-400">
                  <Armchair className="h-5 w-5" />
                </div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-400 font-semibold uppercase">En Lista de Espera</span>
                  <p className="text-2xl font-black text-amber-400 mt-1">{waitlist.length}</p>
                </div>
                <div className="p-2 bg-amber-950/40 border border-amber-900/40 rounded-lg text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-purple-400 font-semibold uppercase">Reservaciones Hoy</span>
                  <p className="text-2xl font-black text-purple-400 mt-1">{reservations.length}</p>
                </div>
                <div className="p-2 bg-purple-950/40 border border-purple-900/40 rounded-lg text-purple-400">
                  <Calendar className="h-5 w-5" />
                </div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-sky-400 font-semibold uppercase">Tiempo Promedio Espera</span>
                  <p className="text-2xl font-black text-sky-400 mt-1">
                    {waitlist.length > 0
                      ? Math.round(waitlist.reduce((sum, w) => sum + (w.estimatedWaitMinutes || 15), 0) / waitlist.length)
                      : 0}{' '}
                    <span className="text-xs font-normal text-slate-400">min</span>
                  </p>
                </div>
                <div className="p-2 bg-sky-950/40 border border-sky-900/40 rounded-lg text-sky-400">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Split View: Left = Waitlist, Right = Reservations Agenda */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT: LIVE WAITLIST (Col 5) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="glass-panel border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-sm">Lista de Espera en Puerta</h3>
                        <p className="text-[11px] text-slate-400">{waitlist.length} comensales esperando mesa</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsNewWaitlistModalOpen(true)}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3px]" /> Anotar
                    </button>
                  </div>

                  {waitlist.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <UserCheck className="w-10 h-10 mx-auto text-slate-700" />
                      <p className="text-xs text-slate-400 font-bold">No hay comensales en espera</p>
                      <p className="text-[11px] text-slate-500">
                        Todos los comensales que lleguen sin reservación pueden anotarse aquí para calcular turnos.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {waitlist.map((party, index) => {
                        const elapsed = getElapsedWaitMinutes(party.createdAt);
                        const isOverdue = elapsed > party.estimatedWaitMinutes;
                        const isNotified = party.status === 'NOTIFIED';

                        return (
                          <div
                            key={party.id}
                            className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                              isNotified
                                ? 'bg-sky-950/20 border-sky-500/50 ring-1 ring-sky-500/30'
                                : isOverdue
                                ? 'bg-rose-950/20 border-rose-800/50'
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <span className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-black flex items-center justify-center shrink-0">
                                  #{index + 1}
                                </span>
                                <div>
                                  <h4 className="font-extrabold text-white text-xs leading-tight">
                                    {party.customerName}
                                  </h4>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                    <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                                      <Users className="w-3 h-3" /> {party.diners} personas
                                    </span>
                                    {party.zonePreference && (
                                      <span>• Zona: <strong className="text-slate-300">{party.zonePreference}</strong></span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                    isNotified
                                      ? 'bg-sky-500/20 border-sky-500 text-sky-300 animate-pulse'
                                      : isOverdue
                                      ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                      : 'bg-amber-500/20 border-amber-500 text-amber-300'
                                  }`}
                                >
                                  {isNotified ? 'Avisado' : `${elapsed} / ${party.estimatedWaitMinutes}m`}
                                </span>
                              </div>
                            </div>

                            {/* Contact info & Notes */}
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-850">
                              <span className="flex items-center gap-1 font-mono text-slate-300">
                                <Phone className="w-3 h-3 text-slate-500" />
                                {party.customerPhone}
                              </span>
                              {party.notes && (
                                <span className="text-[10px] italic text-slate-400 truncate max-w-[160px]">
                                  &ldquo;{party.notes}&rdquo;
                                </span>
                              )}
                            </div>

                            {/* Actions for waitlist entry */}
                            <div className="grid grid-cols-3 gap-1.5 pt-1">
                              <button
                                onClick={() => handleNotifyWaitlist(party.id, party.customerName)}
                                className="py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                title="Notificar al cliente que su mesa está lista"
                              >
                                <BellRing className="w-3 h-3" /> Avisar
                              </button>
                              <button
                                onClick={() => {
                                  setSeatingTarget({
                                    type: 'WAITLIST',
                                    id: party.id,
                                    customerName: party.customerName,
                                    diners: party.diners,
                                  });
                                  setSelectedSeatTableId('');
                                }}
                                className="py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] rounded-lg shadow flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <Armchair className="w-3 h-3 stroke-[2.5px]" /> Sentar
                              </button>
                              <button
                                onClick={() => handleCancelWaitlist(party.id)}
                                className="py-1.5 bg-slate-900 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                title="Retirar de lista"
                              >
                                <XCircle className="w-3 h-3" /> Cancelar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: RESERVATIONS AGENDA (Col 7) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="glass-panel border border-slate-800 rounded-2xl p-5 space-y-4">
                  {/* Agenda Header & Filters */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-sm">Agenda de Reservaciones</h3>
                        <p className="text-[11px] text-slate-400">Libro de citas y asignación previa</p>
                      </div>
                    </div>

                    {/* Date and Quick buttons */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="date"
                        value={resDateFilter}
                        onChange={(e) => setResDateFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={() => setResDateFilter(new Date().toISOString().split('T')[0])}
                        className="px-2 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                      >
                        Hoy
                      </button>
                    </div>
                  </div>

                  {/* Search and Status filter row */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar por cliente, teléfono o email..."
                        value={resSearch}
                        onChange={(e) => setResSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-purple-500"
                      />
                    </div>
                    <select
                      value={resStatusFilter}
                      onChange={(e) => setResStatusFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-purple-500"
                    >
                      <option value="ALL">Todos los Estados</option>
                      <option value="CONFIRMED">Confirmadas</option>
                      <option value="PENDING">Pendientes</option>
                      <option value="SEATED">Sentadas en Mesa</option>
                      <option value="CANCELLED">Canceladas</option>
                    </select>
                  </div>

                  {/* Reservations List */}
                  {filteredReservations.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <Calendar className="w-10 h-10 mx-auto text-slate-700" />
                      <p className="text-xs text-slate-400 font-bold">No hay reservaciones para esta fecha</p>
                      <p className="text-[11px] text-slate-500">
                        Programa visitas y asigna mesas con anticipación para optimizar la ocupación del salón.
                      </p>
                      <button
                        onClick={() => setIsNewResModalOpen(true)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors mt-2"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3px]" /> Programar Reservación
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      {filteredReservations.map((res) => {
                        const dateObj = new Date(res.reservationDate);
                        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const isSeated = res.status === 'SEATED';
                        const isConfirmed = res.status === 'CONFIRMED';
                        const isCancelled = res.status === 'CANCELLED';

                        return (
                          <div
                            key={res.id}
                            className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                              isSeated
                                ? 'bg-emerald-950/15 border-emerald-900/40 opacity-80'
                                : isCancelled
                                ? 'bg-slate-950 border-slate-900 opacity-50'
                                : isConfirmed
                                ? 'bg-purple-950/20 border-purple-800/50'
                                : 'bg-slate-950 border-slate-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 font-black text-xs text-center shrink-0">
                                  <Clock className="w-3.5 h-3.5 mx-auto mb-0.5 text-purple-400" />
                                  <span>{timeStr}</span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-extrabold text-white text-sm">{res.customerName}</h4>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                                      <Users className="w-2.5 h-2.5 text-purple-400" /> {res.diners} personas
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                                    <span className="flex items-center gap-1 font-mono text-slate-300">
                                      <Phone className="w-3 h-3 text-slate-500" /> {res.customerPhone}
                                    </span>
                                    {res.customerEmail && (
                                      <span className="flex items-center gap-1">
                                        <Mail className="w-3 h-3 text-slate-500" /> {res.customerEmail}
                                      </span>
                                    )}
                                    {res.table ? (
                                      <span className="font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-900/80 px-2 py-0.2 rounded text-[10px]">
                                        Mesa #{res.table.number} ({res.table.zone})
                                      </span>
                                    ) : (
                                      <span className="text-amber-400 text-[10px]">
                                        Mesa sin asignar {res.zonePreference ? `(${res.zonePreference})` : ''}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider shrink-0 ${
                                  isSeated
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                    : isCancelled
                                    ? 'bg-slate-800 border-slate-700 text-slate-500'
                                    : isConfirmed
                                    ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                    : 'bg-amber-500/20 border-amber-500 text-amber-300'
                                }`}
                              >
                                {res.status}
                              </span>
                            </div>

                            {res.notes && (
                              <div className="bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 italic">
                                Nota: &ldquo;{res.notes}&rdquo;
                              </div>
                            )}

                            {/* Actions for Reservation */}
                            {!isCancelled && (
                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-850">
                                {!isSeated && (
                                  <>
                                    {res.status === 'PENDING' && (
                                      <button
                                        onClick={() => handleUpdateReservationStatus(res.id, 'CONFIRMED')}
                                        className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-bold text-[11px] rounded-lg cursor-pointer transition-colors"
                                      >
                                        Confirmar
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setSeatingTarget({
                                          type: 'RESERVATION',
                                          id: res.id,
                                          customerName: res.customerName,
                                          diners: res.diners,
                                          currentTableId: res.tableId,
                                        });
                                        setSelectedSeatTableId(res.tableId || '');
                                      }}
                                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] rounded-lg shadow flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Armchair className="w-3.5 h-3.5 stroke-[2.5px]" />
                                      <span>Sentar Comensal</span>
                                    </button>
                                  </>
                                )}
                                {!isSeated && (
                                  <button
                                    onClick={() => handleUpdateReservationStatus(res.id, 'CANCELLED')}
                                    className="px-2.5 py-1 text-slate-500 hover:text-rose-400 text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: NEW TABLE                                         */}
        {/* ======================================================== */}
        {isNewTableModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
              <button
                onClick={() => setIsNewTableModalOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                ✕
              </button>

              <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-brand-primary" />
                <h3 className="text-lg font-bold text-white">Dar de Alta Nueva Mesa</h3>
              </div>

              <form onSubmit={handleCreateTable} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Número / Código de Mesa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 1, 14, T-1, Barra-2"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Nombre Descriptivo</label>
                  <input
                    type="text"
                    placeholder="Ej. Mesa 1 - Salón Central"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Capacidad (Personas)</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={tableCapacity}
                      onChange={(e) => setTableCapacity(parseInt(e.target.value, 10) || 2)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Zona / Área</label>
                    <select
                      value={tableZone}
                      onChange={(e) => setTableZone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    >
                      <option value="Salón">Salón Principal</option>
                      <option value="Terraza">Terraza</option>
                      <option value="Barra">Barra / Bar</option>
                      <option value="VIP">Área VIP</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsNewTableModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingTable}
                    className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {savingTable ? 'Guardando...' : 'Crear Mesa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: HOSTESS - NUEVA RESERVACIÓN                       */}
        {/* ======================================================== */}
        {isNewResModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
              <button
                onClick={() => setIsNewResModalOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                ✕
              </button>

              <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Programar Nueva Reservación</h3>
                  <p className="text-xs text-slate-400">Asigna fecha, comensales y mesa para el cliente</p>
                </div>
              </div>

              <form onSubmit={handleCreateReservation} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Nombre del Comensal *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Hernández"
                    value={resForm.customerName}
                    onChange={(e) => setResForm({ ...resForm, customerName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Teléfono Móvil *</label>
                    <input
                      type="tel"
                      required
                      placeholder="Ej. 5512345678"
                      value={resForm.customerPhone}
                      onChange={(e) => setResForm({ ...resForm, customerPhone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Email (Opcional)</label>
                    <input
                      type="email"
                      placeholder="cliente@email.com"
                      value={resForm.customerEmail}
                      onChange={(e) => setResForm({ ...resForm, customerEmail: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Fecha *</label>
                    <input
                      type="date"
                      required
                      value={resForm.date}
                      onChange={(e) => setResForm({ ...resForm, date: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Hora *</label>
                    <input
                      type="time"
                      required
                      value={resForm.time}
                      onChange={(e) => setResForm({ ...resForm, time: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Personas</label>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      required
                      value={resForm.diners}
                      onChange={(e) => setResForm({ ...resForm, diners: Number(e.target.value) || 2 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Zona Preferida</label>
                    <select
                      value={resForm.zonePreference}
                      onChange={(e) => setResForm({ ...resForm, zonePreference: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-200 outline-none focus:border-purple-500"
                    >
                      <option value="Salón">Salón Principal</option>
                      <option value="Terraza">Terraza</option>
                      <option value="Barra">Barra / Bar</option>
                      <option value="VIP">Área VIP</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Mesa Específica (Opcional)</label>
                    <select
                      value={resForm.tableId}
                      onChange={(e) => setResForm({ ...resForm, tableId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-200 outline-none focus:border-purple-500"
                    >
                      <option value="">-- Sin mesa fija previa --</option>
                      {tables.map(t => (
                        <option key={t.id} value={t.id}>
                          Mesa {t.number} ({t.zone} - {t.capacity}p)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Notas / Requerimientos</label>
                  <input
                    type="text"
                    placeholder="Ej. Celebración de aniversario, silla de bebé..."
                    value={resForm.notes}
                    onChange={(e) => setResForm({ ...resForm, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsNewResModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingRes}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl shadow cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {savingRes ? 'Guardando...' : 'Confirmar Reservación'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: HOSTESS - ANOTAR EN LISTA DE ESPERA               */}
        {/* ======================================================== */}
        {isNewWaitlistModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
              <button
                onClick={() => setIsNewWaitlistModalOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                ✕
              </button>

              <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Anotar en Lista de Espera</h3>
                  <p className="text-xs text-slate-400">Recepción y cálculo de turno en puerta</p>
                </div>
              </div>

              <form onSubmit={handleCreateWaitlist} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Nombre de la Familia / Grupo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Familia Gómez"
                    value={waitlistForm.customerName}
                    onChange={(e) => setWaitlistForm({ ...waitlistForm, customerName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Teléfono para Avisar por SMS / Llamada *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ej. 5543219876"
                    value={waitlistForm.customerPhone}
                    onChange={(e) => setWaitlistForm({ ...waitlistForm, customerPhone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Personas</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      required
                      value={waitlistForm.diners}
                      onChange={(e) => setWaitlistForm({ ...waitlistForm, diners: Number(e.target.value) || 2 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Espera Estimada (min)</label>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      required
                      value={waitlistForm.estimatedWaitMinutes}
                      onChange={(e) => setWaitlistForm({ ...waitlistForm, estimatedWaitMinutes: Number(e.target.value) || 15 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Zona Preferida</label>
                  <select
                    value={waitlistForm.zonePreference}
                    onChange={(e) => setWaitlistForm({ ...waitlistForm, zonePreference: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-200 outline-none focus:border-amber-500"
                  >
                    <option value="Cualquiera">Cualquiera (Primera mesa disponible)</option>
                    <option value="Salón">Salón</option>
                    <option value="Terraza">Terraza</option>
                    <option value="Barra">Barra</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Notas Adicionales</label>
                  <input
                    type="text"
                    placeholder="Ej. Prefiere mesa periquera o alejada del pasillo"
                    value={waitlistForm.notes}
                    onChange={(e) => setWaitlistForm({ ...waitlistForm, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsNewWaitlistModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingWaitlist}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl shadow cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {savingWaitlist ? 'Anotando...' : 'Anotar en Puerta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: HOSTESS - SENTAR COMENSAL EN MESA                 */}
        {/* ======================================================== */}
        {seatingTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
              <button
                onClick={() => setSeatingTarget(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                ✕
              </button>

              <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Armchair className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Sentar en Mesa del Salón</h3>
                  <p className="text-xs text-slate-400">
                    {seatingTarget.customerName} ({seatingTarget.diners} comensales)
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 block">
                  Selecciona la mesa a ocupar:
                </label>

                {tables.filter(t => t.status === 'AVAILABLE' || t.id === seatingTarget.currentTableId).length === 0 ? (
                  <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl text-xs text-amber-300 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      Sin mesas disponibles en este momento
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Libera o cobra alguna de las mesas ocupadas desde la pestaña Salón.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                    {tables
                      .filter(t => t.status === 'AVAILABLE' || t.id === seatingTarget.currentTableId)
                      .map((t) => {
                        const isRecommended = t.capacity >= seatingTarget.diners && t.capacity <= seatingTarget.diners + 2;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedSeatTableId(t.id)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                              selectedSeatTableId === t.id
                                ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold ring-1 ring-emerald-400'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                            }`}
                          >
                            {isRecommended && (
                              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-400" title="Capacidad óptima" />
                            )}
                            <span className="text-xs font-black">Mesa #{t.number}</span>
                            <span className="text-[10px] text-slate-500">{t.zone} • {t.capacity} pers.</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSeatingTarget(null)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSeating}
                  disabled={savingSeating || !selectedSeatTableId}
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  {savingSeating ? <span className="animate-pulse">Asignando...</span> : <>
                    <Check className="w-3.5 h-3.5 stroke-[3px]" />
                    <span>Sentar y Ocupar</span>
                  </>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: TABLE BILL & ACCOUNT DETAIL                       */}
        {/* ======================================================== */}
        {selectedTableForBill && selectedTableForBill.orders && selectedTableForBill.orders[0] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
              <button
                onClick={() => setSelectedTableForBill(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                ✕
              </button>

              <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-brand-primary" />
                  <h3 className="text-base font-bold text-white">Cuenta: {selectedTableForBill.name}</h3>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {selectedTableForBill.orders[0].orderNumber}
                </span>
              </div>

              {/* Bill Details */}
              <div className="bg-white text-slate-950 p-4 rounded-lg font-mono text-xs space-y-2 border border-slate-700 shadow-inner">
                <div className="text-center border-b border-dashed border-slate-300 pb-2">
                  <p className="font-bold text-sm">DARKFLOW RESTAURANTE</p>
                  <p className="text-[10px] text-slate-600">Mesa {selectedTableForBill.number} - {selectedTableForBill.zone}</p>
                  <p className="text-[9px] text-slate-500">{new Date(selectedTableForBill.orders[0].createdAt).toLocaleString('es-MX')}</p>
                </div>

                <div className="divide-y divide-dashed divide-slate-200 py-1 max-h-48 overflow-y-auto">
                  {selectedTableForBill.orders[0].items.map((item) => (
                    <div key={item.id} className="py-1 flex justify-between">
                      <span>{item.quantity}x {item.product.name}</span>
                      <span className="font-bold">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-right text-[11px]">
                  <p>Subtotal: ${selectedTableForBill.orders[0].subtotal.toFixed(2)}</p>
                  <p>IVA (16%): ${selectedTableForBill.orders[0].tax.toFixed(2)}</p>
                  <p className="font-bold text-sm pt-1 border-t border-slate-200">
                    Total: ${selectedTableForBill.orders[0].total.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => {
                    const ord = selectedTableForBill.orders![0];
                    setThermalOrderData({
                      orderNumber: ord.orderNumber,
                      source: 'DINE_IN',
                      createdAt: ord.createdAt,
                      subtotal: ord.subtotal,
                      tax: ord.tax,
                      tip: 0,
                      total: ord.total,
                      diners: ord.diners,
                      table: { name: selectedTableForBill.name, number: selectedTableForBill.number, zone: selectedTableForBill.zone },
                      items: ord.items,
                    });
                    setThermalInitialMode('CUSTOMER');
                    setIsThermalOpen(true);
                  }}
                  className="py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Pre-cuenta (58/80)
                </button>
                <button
                  onClick={() => {
                    const ord = selectedTableForBill.orders![0];
                    setThermalOrderData({
                      orderNumber: ord.orderNumber,
                      source: 'DINE_IN',
                      createdAt: ord.createdAt,
                      subtotal: ord.subtotal,
                      tax: ord.tax,
                      tip: 0,
                      total: ord.total,
                      diners: ord.diners,
                      table: { name: selectedTableForBill.name, number: selectedTableForBill.number, zone: selectedTableForBill.zone },
                      items: ord.items,
                    });
                    setThermalInitialMode('KITCHEN');
                    setIsThermalOpen(true);
                  }}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Comanda Cocina
                </button>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-800">
                <button
                  onClick={() => handleReleaseTable(selectedTableForBill.id)}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" /> Cobrar y Liberar Mesa
                </button>
                <button
                  onClick={() => handleRequestBill(selectedTableForBill.id)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Receipt className="h-4 w-4" /> Marcar &quot;Cuenta Pedida&quot;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ESC/POS Thermal Printing Dialog */}
        {thermalOrderData && (
          <ThermalTicketModal
            isOpen={isThermalOpen}
            onClose={() => setIsThermalOpen(false)}
            order={thermalOrderData}
            initialMode={thermalInitialMode}
          />
        )}

        {/* MODAL: Table QR Code Stand for Diner Self-Ordering */}
        {selectedTableForQr && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
              <button
                onClick={() => setSelectedTableForQr(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white p-1"
              >
                ✕
              </button>

              <div className="text-center space-y-1 border-b border-slate-800 pb-3">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                  Código QR de Mesa para Comensales
                </span>
                <h3 className="text-lg font-black text-white flex items-center justify-center gap-2">
                  <Utensils className="w-4 h-4 text-amber-400" />
                  Mesa {selectedTableForQr.number}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedTableForQr.name} • {selectedTableForQr.zone}
                </p>
              </div>

              {/* Printable Table QR Stand Preview */}
              <div className="p-5 bg-white rounded-xl text-slate-950 flex flex-col items-center justify-center text-center space-y-3 shadow-inner border border-slate-300" id="qr-stand-print">
                <div className="space-y-0.5">
                  <p className="font-black text-xs uppercase tracking-wider text-slate-800">
                    {activeBrand?.name || 'DARKFLOW RESTAURANT'}
                  </p>
                  <p className="text-[10px] text-slate-500">Escanea para ordenar y pedir la cuenta</p>
                </div>

                <div className="w-36 h-36 bg-slate-950 p-2 rounded-xl flex items-center justify-center shadow-md">
                  <QrCode className="w-28 h-28 text-white" />
                </div>

                <div className="bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1 rounded-full font-black text-xs">
                  MESA #{selectedTableForQr.number}
                </div>

                <p className="text-[9px] text-slate-400 font-mono break-all max-w-[220px]">
                  {typeof window !== 'undefined' ? `${window.location.origin}/m/${activeBrand?.slug}?table=${selectedTableForQr.number}` : ''}
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const url = `${window.location.origin}/m/${activeBrand?.slug}?table=${selectedTableForQr.number}`;
                        navigator.clipboard.writeText(url);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }
                    }}
                    className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? '¡Copiado!' : 'Copiar Link'}</span>
                  </button>

                  <a
                    href={`/m/${activeBrand?.slug}?table=${selectedTableForQr.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow cursor-pointer transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Probar Menú</span>
                  </a>
                </div>

                <button
                  onClick={() => setSelectedTableForQr(null)}
                  className="w-full py-2 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white font-bold text-xs rounded-xl border border-slate-800 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: TRANSFER TABLE */}
        {selectedTableForTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
              <button
                onClick={() => setSelectedTableForTransfer(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white p-1"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Mover Comanda</h3>
                  <p className="text-xs text-slate-400">Origen: Mesa #{selectedTableForTransfer.number} ({selectedTableForTransfer.name})</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Selecciona la mesa disponible a donde deseas reubicar a los comensales. La comanda activa se transferirá automáticamente.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Mesa Destino (Disponible):</label>
                {tables.filter(t => t.status === 'AVAILABLE' && t.id !== selectedTableForTransfer.id).length === 0 ? (
                  <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>No hay mesas disponibles en el salón en este momento.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {tables
                      .filter(t => t.status === 'AVAILABLE' && t.id !== selectedTableForTransfer.id)
                      .map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTargetTransferTableId(t.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            targetTransferTableId === t.id
                              ? 'bg-sky-500/20 border-sky-500 text-white font-bold ring-1 ring-sky-400'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <span className="text-xs font-black">Mesa {t.number}</span>
                          <span className="text-[10px] text-slate-500">{t.zone} • {t.capacity}p</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedTableForTransfer(null)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleTransferTable}
                  disabled={transferring || !targetTransferTableId}
                  className="flex-1 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  {transferring ? <span className="animate-pulse">Moviendo...</span> : <>
                    <Check className="w-3.5 h-3.5 stroke-[3px]" />
                    <span>Confirmar</span>
                  </>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: MERGE TABLES */}
        {selectedTableForMerge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
              <button
                onClick={() => setSelectedTableForMerge(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white p-1"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Unir Cuentas de Mesas</h3>
                  <p className="text-xs text-slate-400">Origen: Mesa #{selectedTableForMerge.number}</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Los platillos de la Mesa #{selectedTableForMerge.number} se sumarán a la mesa destino seleccionada. La Mesa #{selectedTableForMerge.number} quedará liberada.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Unir con Mesa Ocupada:</label>
                {tables.filter(t => t.id !== selectedTableForMerge.id && (t.status === 'OCCUPIED' || t.status === 'BILL_REQUESTED' || (t.orders && t.orders.length > 0))).length === 0 ? (
                  <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>No hay otras mesas ocupadas para fusionar.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {tables
                      .filter(t => t.id !== selectedTableForMerge.id && (t.status === 'OCCUPIED' || t.status === 'BILL_REQUESTED' || (t.orders && t.orders.length > 0)))
                      .map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTargetMergeTableId(t.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            targetMergeTableId === t.id
                              ? 'bg-purple-500/20 border-purple-500 text-white font-bold ring-1 ring-purple-400'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <span className="text-xs font-black">Mesa {t.number}</span>
                          <span className="text-[10px] text-brand-primary font-mono">${(t.orders?.[0]?.total || 0).toFixed(2)}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedTableForMerge(null)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleMergeTables}
                  disabled={merging || !targetMergeTableId}
                  className="flex-1 py-2 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  {merging ? <span className="animate-pulse">Fusionando...</span> : <>
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>Fusionar</span>
                  </>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardContainer>
  );
}
