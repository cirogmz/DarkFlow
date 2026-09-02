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
  CreditCard,
  Trash2,
  Printer
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

interface RestaurantTable {
  id: string;
  number: string;
  name: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'RESERVED';
  zone: string;
  brandId: string;
  orders?: TableActiveOrder[];
}

export default function TablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState('all');

  // Modal: New Table
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableCapacity, setTableCapacity] = useState<number>(4);
  const [tableZone, setTableZone] = useState('Salón');
  const [savingTable, setSavingTable] = useState(false);

  // Modal: View Table Bill / Order Detail
  const [selectedTableForBill, setSelectedTableForBill] = useState<RestaurantTable | null>(null);
  const [isThermalOpen, setIsThermalOpen] = useState(false);
  const [thermalOrderData, setThermalOrderData] = useState<ThermalOrderData | null>(null);
  const [thermalInitialMode, setThermalInitialMode] = useState<'CUSTOMER' | 'KITCHEN'>('CUSTOMER');

  const { activeBrand, addNotification } = useAppStore();

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

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 10000); // Polling every 10s for real-time table turnover
    return () => clearInterval(interval);
  }, [fetchTables]);

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

  if (loading) {
    return (
      <DashboardContainer>
        <div className="flex h-[calc(100vh-200px)] items-center justify-center flex-col gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-brand-primary"></div>
          <p className="text-sm text-slate-400">Cargando salón y distribución de mesas...</p>
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Salón & Gestión de Mesas</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Control de comensales, cuentas abiertas y servicio en piso para: <strong className="text-white">{activeBrand?.name}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsNewTableModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow-lg cursor-pointer transition-all duration-200"
          >
            <Plus className="h-4 w-4 stroke-[3px]" /> Nueva Mesa
          </button>
        </div>

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

              return (
                <div
                  key={table.id}
                  className={`glass-panel border rounded-xl p-5 shadow-lg flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden ${
                    isBillRequested
                      ? 'border-blue-500/50 bg-blue-950/10'
                      : isOccupied
                      ? 'border-amber-500/40 bg-amber-950/5'
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
                    ) : (
                      <div className="py-4 text-center text-slate-500 text-xs border border-dashed border-slate-800/80 rounded-lg">
                        Mesa lista para recibir comensales
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-3 border-t border-slate-850 flex items-center justify-between gap-2">
                    {isOccupied ? (
                      <>
                        <button
                          onClick={() => setSelectedTableForBill(table)}
                          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Receipt className="h-3.5 w-3.5" /> Ver Cuenta
                        </button>
                        <button
                          onClick={() => handleReleaseTable(table.id)}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-lg shadow flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Cobrar
                        </button>
                      </>
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

        {/* MODAL: NEW TABLE */}
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

        {/* MODAL: TABLE BILL & ACCOUNT DETAIL */}
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
      </div>
    </DashboardContainer>
  );
}
