'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  Printer,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ChefHat,
  User,
  Coffee,
  ShieldCheck,
  FileText,
  Flame,
  Award,
  Sparkles
} from 'lucide-react';
import { RETURN_REASONS, ATTRIBUTIONS, RESOLUTIONS, ReturnMetrics } from '@/lib/dishReturns';

interface DishReturnItem {
  id: string;
  orderId: string;
  productName: string;
  tableNumber?: string | null;
  waiterName?: string | null;
  returnReason: string;
  attribution: string;
  resolution: string;
  quantity: number;
  price: number;
  estimatedFoodCost: number;
  guestCompType?: string | null;
  guestCompAmount?: number | null;
  supervisorName?: string | null;
  notes?: string | null;
  createdAt: string;
  order: {
    orderNumber: string;
    table?: { number: string; name: string } | null;
  };
}

export default function DishReturnAuditTab() {
  const [returns, setReturns] = useState<DishReturnItem[]>([]);
  const [metrics, setMetrics] = useState<ReturnMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [attributionFilter, setAttributionFilter] = useState('ALL');
  const [reasonFilter, setReasonFilter] = useState('ALL');

  // Modals
  const [newReturnModalOpen, setNewReturnModalOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({
    orderId: '',
    productName: '',
    tableNumber: '',
    waiterName: '',
    returnReason: 'UNDERCOOKED_OVERCOOKED',
    attribution: 'KITCHEN',
    resolution: 'RECOOK',
    quantity: 1,
    price: 0,
    estimatedFoodCost: 0,
    guestCompType: 'NONE',
    guestCompAmount: 0,
    supervisorPin: '',
    notes: '',
  });

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [ticketContent, setTicketContent] = useState('');
  const [printLoading, setPrintLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Returns
  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dish-returns');
      if (res.ok) {
        const data = await res.json();
        setReturns(data.returns || []);
        setMetrics(data.metrics || null);
      }
    } catch (err) {
      console.error('Error fetching dish returns:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  // Submit New Return
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnForm.orderId.trim() || !returnForm.productName.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/dish-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnForm),
      });

      if (res.ok) {
        setNewReturnModalOpen(false);
        setReturnForm({
          orderId: '',
          productName: '',
          tableNumber: '',
          waiterName: '',
          returnReason: 'UNDERCOOKED_OVERCOOKED',
          attribution: 'KITCHEN',
          resolution: 'RECOOK',
          quantity: 1,
          price: 0,
          estimatedFoodCost: 0,
          guestCompType: 'NONE',
          guestCompAmount: 0,
          supervisorPin: '',
          notes: '',
        });
        fetchReturns();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al registrar devolución');
      }
    } catch (err) {
      console.error('Error submitting return:', err);
      alert('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Ticket Print Modal
  const openPrintTicket = async (id: string) => {
    try {
      setPrintLoading(true);
      setPrintModalOpen(true);
      setTicketContent('Cargando vale de devolución...');
      const res = await fetch(`/api/dish-returns/${id}/print`);
      if (res.ok) {
        const data = await res.json();
        setTicketContent(data.ticket || '');
      } else {
        setTicketContent('No se pudo generar el vale.');
      }
    } catch (err) {
      console.error('Error fetching ticket:', err);
      setTicketContent('Error al comunicarse con el servidor.');
    } finally {
      setPrintLoading(false);
    }
  };

  // Filtered List
  const filteredReturns = returns.filter((r) => {
    const matchesSearch =
      r.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.tableNumber && r.tableNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.waiterName && r.waiterName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAttribution = attributionFilter === 'ALL' || r.attribution === attributionFilter;
    const matchesReason = reasonFilter === 'ALL' || r.returnReason === reasonFilter;

    return matchesSearch && matchesAttribution && matchesReason;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 shadow-lg shadow-rose-500/10">
            <RotateCcw className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">
                Devoluciones de Platillos & Merma de Mesa (Service Recovery)
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Auditoría en Salón
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Trazabilidad de platillos devueltos, análisis causa-raíz (Cocina vs Servicio), reproceso urgente en KDS y compensaciones.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => fetchReturns()}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setNewReturnModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Devolución</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Platillos Devueltos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{metrics.totalReturns}</span>
              <span className="text-xs text-slate-400">unidades</span>
            </div>
            <span className="text-[11px] text-slate-500">En el período</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Venta Devuelta / Anulada</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-rose-400">${metrics.totalReturnedSalesValue.toFixed(2)}</span>
            </div>
            <span className="text-[11px] text-slate-500">Impacto en ticket</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Merma en Insumos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-400">${metrics.totalEstimatedWasteCost.toFixed(2)}</span>
            </div>
            <span className="text-[11px] text-slate-500">Food Cost absorbido</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Falla de Cocina</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-purple-400">
                {metrics.totalReturns > 0 ? Math.round((metrics.kitchenAttributedCount / metrics.totalReturns) * 100) : 0}%
              </span>
              <span className="text-xs text-slate-400">({metrics.kitchenAttributedCount})</span>
            </div>
            <span className="text-[11px] text-slate-500">Cocción / Frío / Alérgeno</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Falla de Servicio</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-cyan-400">
                {metrics.totalReturns > 0 ? Math.round((metrics.waiterAttributedCount / metrics.totalReturns) * 100) : 0}%
              </span>
              <span className="text-xs text-slate-400">({metrics.waiterAttributedCount})</span>
            </div>
            <span className="text-[11px] text-slate-500">Error comanda o mesa</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
            <span className="text-xs text-slate-400 font-medium">Rehacer en Cocina</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">
                {metrics.totalReturns > 0 ? Math.round((metrics.recookCount / metrics.totalReturns) * 100) : 0}%
              </span>
              <span className="text-xs text-slate-400">({metrics.recookCount})</span>
            </div>
            <span className="text-[11px] text-slate-500">Recook KDS activado</span>
          </div>
        </div>
      )}

      {/* Root Cause Analytics (Pareto) */}
      {metrics && metrics.topReasons.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Principales Causas Raíz de Devolución
            </h4>
            <div className="space-y-2">
              {metrics.topReasons.slice(0, 5).map((r) => (
                <div key={r.reason}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">{r.label}</span>
                    <span className="font-bold text-white">
                      {r.count} ({r.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all"
                      style={{ width: `${r.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              Platillos con Mayor Incidencia de Devolución
            </h4>
            <div className="space-y-2">
              {metrics.topReturnedDishes.slice(0, 5).map((d) => (
                <div key={d.productName} className="flex items-center justify-between p-2 bg-slate-950/60 rounded-lg text-xs">
                  <span className="font-semibold text-slate-200">{d.productName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{d.count} devolución(es)</span>
                    <span className="text-rose-400 font-mono font-bold">${d.value.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por platillo, comanda, mesa o mesero..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Atribución:
          </span>
          {[
            { id: 'ALL', label: 'Todas' },
            { id: 'KITCHEN', label: 'Cocina' },
            { id: 'SERVICE_WAITER', label: 'Mesero' },
            { id: 'CUSTOMER_PREFERENCE', label: 'Comensal' },
          ].map((att) => (
            <button
              key={att.id}
              onClick={() => setAttributionFilter(att.id)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                attributionFilter === att.id
                  ? 'bg-rose-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {att.label}
            </button>
          ))}
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Platillo & Comanda</th>
                <th className="px-4 py-3.5">Causa / Motivo</th>
                <th className="px-4 py-3.5 text-center">Atribución</th>
                <th className="px-4 py-3.5 text-center">Resolución</th>
                <th className="px-4 py-3.5 text-center">Impacto ($)</th>
                <th className="px-4 py-3.5">Personal</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-400" />
                    Cargando bitácora de devoluciones...
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No se registran devoluciones con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-base">{r.productName}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-[11px] text-slate-300">
                          #{r.order.orderNumber}
                        </span>
                        {r.tableNumber && <span>Mesa {r.tableNumber}</span>}
                        <span>({r.quantity} un.)</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-xs">
                      <div className="font-semibold text-slate-200">
                        {RETURN_REASONS[r.returnReason]?.label || r.returnReason}
                      </div>
                      {r.notes && <div className="text-slate-400 text-[11px] mt-0.5">{r.notes}</div>}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${ATTRIBUTIONS[r.attribution]?.color || ''}`}>
                        {ATTRIBUTIONS[r.attribution]?.label || r.attribution}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-center text-xs">
                      <span className="font-medium text-slate-300">
                        {RESOLUTIONS[r.resolution] || r.resolution}
                      </span>
                      {r.guestCompType && r.guestCompType !== 'NONE' && (
                        <div className="text-[11px] text-amber-400 font-semibold mt-0.5">
                          Comp: {r.guestCompType} (${r.guestCompAmount || 0})
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center text-xs font-mono">
                      <div className="font-bold text-rose-400">${(r.price * r.quantity).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">Costo: ${(r.estimatedFoodCost * r.quantity).toFixed(2)}</div>
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-400">
                      {r.waiterName && <div>Mesero: <strong className="text-slate-200">{r.waiterName}</strong></div>}
                      {r.supervisorName && <div>Autorizó: <strong className="text-slate-200">{r.supervisorName}</strong></div>}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => openPrintTicket(r.id)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
                        title="Imprimir Vale de Devolución 80mm"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: REGISTRAR DEVOLUCIÓN */}
      {newReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Registrar Devolución de Platillo</h3>
              </div>
              <button onClick={() => setNewReturnModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">ID o Folio de Comanda *</label>
                  <input
                    type="text"
                    required
                    placeholder="ID o # de Comanda"
                    value={returnForm.orderId}
                    onChange={(e) => setReturnForm({ ...returnForm, orderId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Mesa</label>
                  <input
                    type="text"
                    placeholder="Ej. Mesa 4 / Terraza"
                    value={returnForm.tableNumber}
                    onChange={(e) => setReturnForm({ ...returnForm, tableNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Platillo Devuelto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Rib Eye 400g / Hamburguesa Trufa"
                  value={returnForm.productName}
                  onChange={(e) => setReturnForm({ ...returnForm, productName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Motivo de Devolución *</label>
                  <select
                    value={returnForm.returnReason}
                    onChange={(e) => {
                      const reason = e.target.value;
                      const defaultAtt = RETURN_REASONS[reason]?.defaultAttribution || 'KITCHEN';
                      setReturnForm({
                        ...returnForm,
                        returnReason: reason,
                        attribution: defaultAtt,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {Object.entries(RETURN_REASONS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Atribución *</label>
                  <select
                    value={returnForm.attribution}
                    onChange={(e) => setReturnForm({ ...returnForm, attribution: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="KITCHEN">Cocina / Preparación</option>
                    <option value="SERVICE_WAITER">Servicio / Mesero</option>
                    <option value="CUSTOMER_PREFERENCE">Preferencia del Comensal</option>
                    <option value="UNKNOWN">No determinado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Resolución Inmediata *</label>
                  <select
                    value={returnForm.resolution}
                    onChange={(e) => setReturnForm({ ...returnForm, resolution: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="RECOOK">Rehacer Urgente en Cocina (Recook KDS)</option>
                    <option value="REMOVE_FROM_BILL">Retirar de la Cuenta (Cancelar cobro)</option>
                    <option value="DISCOUNT_APPLIED">Descuento de Cortesía en Cuenta</option>
                    <option value="COMPLIMENTARY_RECOVERY">Cortesía de Recuperación</option>
                    <option value="REPLACE_WITH_DIFFERENT_ITEM">Sustituir por Otro Platillo</option>
                    <option value="NO_ACTION">Sin Acción</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Compensación al Comensal</label>
                  <select
                    value={returnForm.guestCompType}
                    onChange={(e) => setReturnForm({ ...returnForm, guestCompType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="NONE">Ninguna</option>
                    <option value="WALLET_CASHBACK">Abono Monedero Digital ($)</option>
                    <option value="COUPON_DISCOUNT">Cupón Disculpa para Próxima Visita</option>
                    <option value="FREE_DESSERT_DRINK">Postre o Bebida de Cortesía</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={returnForm.quantity}
                    onChange={(e) => setReturnForm({ ...returnForm, quantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Precio Venta ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={returnForm.price}
                    onChange={(e) => setReturnForm({ ...returnForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">PIN Supervisor</label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="****"
                    value={returnForm.supervisorPin}
                    onChange={(e) => setReturnForm({ ...returnForm, supervisorPin: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Notas / Detalles del Incidente</label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre qué salió mal o comentarios del cliente..."
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewReturnModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-sm flex items-center gap-1.5 shadow"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Registrar Devolución
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TICKET TÉRMICO 80MM */}
      {printModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Vale de Devolución de Platillo 80mm</h3>
              </div>
              <button onClick={() => setPrintModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-950">
              {printLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-400" />
                  Generando vale...
                </div>
              ) : (
                <pre className="font-mono text-xs text-rose-300 bg-black/70 p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                  {ticketContent}
                </pre>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/70">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(ticketContent);
                  alert('Vale copiado al portapapeles');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Copiar Texto
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-lg text-sm flex items-center gap-1.5 shadow"
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
