'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  Check,
  PackageCheck,
  Send,
  Warehouse as WarehouseIcon,
  X,
  Trash2
} from 'lucide-react';

interface RequisitionsTabProps {
  ingredients: Array<{
    id: string;
    name: string;
    stock: number;
    unit: string;
    cost: number;
  }>;
  warehouses: Array<{
    id: string;
    name: string;
    code?: string | null;
  }>;
  onRefreshAll?: () => void;
}

export default function RequisitionsTab({
  ingredients,
  warehouses,
  onRefreshAll,
}: RequisitionsTabProps) {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // New Requisition Form State
  const [newReqType, setNewReqType] = useState<'WAREHOUSE_TRANSFER' | 'PURCHASE_REQUEST'>('WAREHOUSE_TRANSFER');
  const [newReqUrgency, setNewReqUrgency] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [newReqFromWh, setNewReqFromWh] = useState('');
  const [newReqToWh, setNewReqToWh] = useState('');
  const [newReqNotes, setNewReqNotes] = useState('');
  const [newReqItems, setNewReqItems] = useState<Array<{ ingredientId: string; requestedQty: number; notes?: string }>>([]);
  const [itemSelectId, setItemSelectId] = useState('');
  const [itemSelectQty, setItemSelectQty] = useState<number>(1);
  const [itemSelectNotes, setItemSelectNotes] = useState('');
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Approve / Reject Form State
  const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Dispatch Form State
  const [dispatchedQuantities, setDispatchedQuantities] = useState<Record<string, number>>({});
  const [dispatchGuideInput, setDispatchGuideInput] = useState('');

  // Receive Form State
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [receivedNotes, setReceivedNotes] = useState<Record<string, string>>({});

  const fetchRequisitions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (typeFilter !== 'ALL') params.append('type', typeFilter);

      const res = await fetch(`/api/inventory/requisitions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRequisitions(data);
      }
    } catch (err) {
      console.error('Error fetching requisitions:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

  // Agregar insumo al carrito de la requisición
  const handleAddItemToNewReq = () => {
    if (!itemSelectId) return;
    if (itemSelectQty <= 0) {
      alert('La cantidad solicitada debe ser mayor a 0');
      return;
    }

    const existingIndex = newReqItems.findIndex((it) => it.ingredientId === itemSelectId);
    if (existingIndex >= 0) {
      const updated = [...newReqItems];
      updated[existingIndex].requestedQty += itemSelectQty;
      if (itemSelectNotes) updated[existingIndex].notes = itemSelectNotes;
      setNewReqItems(updated);
    } else {
      setNewReqItems([
        ...newReqItems,
        {
          ingredientId: itemSelectId,
          requestedQty: itemSelectQty,
          notes: itemSelectNotes || undefined,
        },
      ]);
    }

    setItemSelectId('');
    setItemSelectQty(1);
    setItemSelectNotes('');
  };

  const handleRemoveItemFromNewReq = (index: number) => {
    setNewReqItems(newReqItems.filter((_, idx) => idx !== index));
  };

  // Crear Requisición
  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newReqItems.length === 0) {
      alert('Debes agregar al menos un insumo a la requisición');
      return;
    }

    try {
      setSubmittingCreate(true);
      const res = await fetch('/api/inventory/requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newReqType,
          urgency: newReqUrgency,
          fromWarehouseId: newReqFromWh || undefined,
          toWarehouseId: newReqToWh || undefined,
          notes: newReqNotes || undefined,
          items: newReqItems,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        alert(`Requisición ${created.folio} creada exitosamente`);
        setShowCreateModal(false);
        setNewReqItems([]);
        setNewReqNotes('');
        await fetchRequisitions();
        if (onRefreshAll) onRefreshAll();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al crear requisición');
      }
    } catch (error) {
      console.error('Error creating requisition:', error);
      alert('Error de conexión');
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Abrir Modal de Aprobación
  const handleOpenApproveModal = (req: any) => {
    setSelectedReq(req);
    const initialApproved: Record<string, number> = {};
    req.items?.forEach((it: any) => {
      initialApproved[it.id] = it.requestedQty;
    });
    setApprovedQuantities(initialApproved);
    setRejectReason('');
    setShowApproveModal(true);
  };

  // Confirmar Aprobación
  const handleConfirmApproval = async () => {
    if (!selectedReq) return;
    try {
      setSubmittingAction(true);
      const approvedItems = Object.entries(approvedQuantities).map(([itemId, approvedQty]) => ({
        itemId,
        approvedQty,
      }));

      const res = await fetch(`/api/inventory/requisitions/${selectedReq.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE',
          approvedItems,
        }),
      });

      if (res.ok) {
        alert('Requisición autorizada exitosamente');
        setShowApproveModal(false);
        await fetchRequisitions();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al aprobar');
      }
    } catch (error) {
      console.error('Error approving:', error);
      alert('Error de conexión');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Rechazar Requisición
  const handleConfirmReject = async () => {
    if (!selectedReq) return;
    if (!rejectReason) {
      alert('Debes indicar un motivo de rechazo');
      return;
    }

    try {
      setSubmittingAction(true);
      const res = await fetch(`/api/inventory/requisitions/${selectedReq.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          rejectionReason: rejectReason,
        }),
      });

      if (res.ok) {
        alert('Requisición rechazada');
        setShowApproveModal(false);
        await fetchRequisitions();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al rechazar');
      }
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Error de conexión');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Abrir Modal de Despacho
  const handleOpenDispatchModal = (req: any) => {
    setSelectedReq(req);
    const initialDispatched: Record<string, number> = {};
    req.items?.forEach((it: any) => {
      initialDispatched[it.id] = it.approvedQty || it.requestedQty;
    });
    setDispatchedQuantities(initialDispatched);
    setDispatchGuideInput('');
    setShowDispatchModal(true);
  };

  // Confirmar Despacho
  const handleConfirmDispatch = async () => {
    if (!selectedReq) return;
    try {
      setSubmittingAction(true);
      const dispatchedItems = Object.entries(dispatchedQuantities).map(([itemId, dispatchedQty]) => ({
        itemId,
        dispatchedQty,
      }));

      const res = await fetch(`/api/inventory/requisitions/${selectedReq.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispatchedItems,
          dispatchGuide: dispatchGuideInput || undefined,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        alert(`Mercancía despachada exitosamente con guía ${updated.dispatchGuide}`);
        setShowDispatchModal(false);
        await fetchRequisitions();
        if (onRefreshAll) onRefreshAll();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al despachar');
      }
    } catch (error) {
      console.error('Error dispatching:', error);
      alert('Error de conexión');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Abrir Modal de Recepción
  const handleOpenReceiveModal = (req: any) => {
    setSelectedReq(req);
    const initialReceived: Record<string, number> = {};
    const initialNotes: Record<string, string> = {};
    req.items?.forEach((it: any) => {
      initialReceived[it.id] = it.dispatchedQty || it.approvedQty;
      initialNotes[it.id] = '';
    });
    setReceivedQuantities(initialReceived);
    setReceivedNotes(initialNotes);
    setShowReceiveModal(true);
  };

  // Confirmar Recepción (Check-in con Discrepancias)
  const handleConfirmReceive = async () => {
    if (!selectedReq) return;
    try {
      setSubmittingAction(true);
      const receivedItems = Object.entries(receivedQuantities).map(([itemId, receivedQty]) => ({
        itemId,
        receivedQty,
        notes: receivedNotes[itemId] || undefined,
      }));

      const res = await fetch(`/api/inventory/requisitions/${selectedReq.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedItems }),
      });

      if (res.ok) {
        const updated = await res.json();
        alert(`Requisición ${updated.folio} recibida. Existencias ingresadas a bodega destino.`);
        setShowReceiveModal(false);
        await fetchRequisitions();
        if (onRefreshAll) onRefreshAll();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al recibir');
      }
    } catch (error) {
      console.error('Error receiving:', error);
      alert('Error de conexión');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Abrir Detalle
  const handleOpenDetailModal = (req: any) => {
    setSelectedReq(req);
    setShowDetailModal(true);
  };

  // Métricas agregadas
  const submittedCount = requisitions.filter((r) => r.status === 'SUBMITTED').length;
  const approvedCount = requisitions.filter((r) => r.status === 'APPROVED').length;
  const dispatchedCount = requisitions.filter((r) => r.status === 'DISPATCHED').length;
  const receivedCount = requisitions.filter((r) => r.status === 'RECEIVED').length;
  const totalDiscrepancyLoss = requisitions.reduce((acc, r) => acc + (r.totalDiscrepancyCost < 0 ? Math.abs(r.totalDiscrepancyCost) : 0), 0);

  // Filtrado por buscador
  const filteredRequisitions = requisitions.filter((r) => {
    const q = searchQuery.toLowerCase();
    const folioMatch = r.folio?.toLowerCase().includes(q);
    const guideMatch = r.dispatchGuide?.toLowerCase().includes(q);
    const fromMatch = r.fromWarehouse?.name?.toLowerCase().includes(q);
    const toMatch = r.toWarehouse?.name?.toLowerCase().includes(q);
    return folioMatch || guideMatch || fromMatch || toMatch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & New Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-400" />
            Requisiciones Internas, Aprobación & Transferencias Inter-Bodegas
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Flujo formal de pedidos de cocina, autorización gerencial, guías de remisión y recepción con registro de mermas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRequisitions}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Refrescar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setNewReqItems([]);
              setNewReqNotes('');
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nueva Requisición Interna
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[11px] text-slate-400 font-medium">Por Autorizar</span>
          <div className="text-2xl font-black text-amber-400 mt-1">{submittedCount}</div>
          <span className="text-[10px] text-slate-500">Solicitudes pendientes</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[11px] text-slate-400 font-medium">Por Despachar</span>
          <div className="text-2xl font-black text-blue-400 mt-1">{approvedCount}</div>
          <span className="text-[10px] text-slate-500">Aprobadas listas en almacén</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[11px] text-slate-400 font-medium">En Tránsito</span>
          <div className="text-2xl font-black text-purple-400 mt-1">{dispatchedCount}</div>
          <span className="text-[10px] text-slate-500">Con guía de despacho</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[11px] text-slate-400 font-medium">Completadas</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">{receivedCount}</div>
          <span className="text-[10px] text-slate-500">Recepción conforme</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl col-span-2 sm:col-span-1">
          <span className="text-[11px] text-slate-400 font-medium">Mermas en Traslado</span>
          <div className="text-2xl font-black text-rose-400 mt-1">${totalDiscrepancyLoss.toFixed(2)}</div>
          <span className="text-[10px] text-slate-500">Faltantes en recepción</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status buttons */}
          {['ALL', 'SUBMITTED', 'APPROVED', 'DISPATCHED', 'RECEIVED', 'REJECTED'].map((st) => {
            const labels: Record<string, string> = {
              ALL: 'Todas',
              SUBMITTED: 'Por Autorizar',
              APPROVED: 'Aprobadas',
              DISPATCHED: 'En Tránsito',
              RECEIVED: 'Recibidas',
              REJECTED: 'Rechazadas',
            };
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {labels[st]}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar folio, bodega o guía..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Requisitions List Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Folio</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Urgencia</th>
                <th className="p-3">Origen ➔ Destino</th>
                <th className="p-3">Solicitante</th>
                <th className="p-3 text-right">Insumos</th>
                <th className="p-3 text-right">Valor Est. ($)</th>
                <th className="p-3 text-center">Guía Despacho</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRequisitions.map((req) => {
                let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
                let label = req.status;

                if (req.status === 'SUBMITTED') {
                  badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                  label = 'POR AUTORIZAR';
                } else if (req.status === 'APPROVED') {
                  badgeClass = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
                  label = 'APROBADA';
                } else if (req.status === 'DISPATCHED') {
                  badgeClass = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
                  label = 'EN TRÁNSITO';
                } else if (req.status === 'RECEIVED') {
                  badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                  label = 'RECIBIDA';
                } else if (req.status === 'REJECTED') {
                  badgeClass = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
                  label = 'RECHAZADA';
                }

                return (
                  <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-indigo-400">
                      {req.folio}
                    </td>
                    <td className="p-3 text-slate-300">
                      {new Date(req.createdAt).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        req.urgency === 'URGENT' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        req.urgency === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {req.urgency === 'URGENT' ? 'URGENTE' : req.urgency === 'HIGH' ? 'ALTA' : 'NORMAL'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-white">
                        {req.fromWarehouse?.name || 'Almacén Central'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        ➔ {req.toWarehouse?.name || 'Cocina Principal'}
                      </div>
                    </td>
                    <td className="p-3 text-slate-300">
                      {req.requestedBy?.name || 'Usuario'}
                    </td>
                    <td className="p-3 text-right font-bold text-white">
                      {req._count?.items || req.items?.length || 0}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-200">
                      ${req.totalEstimatedCost?.toFixed(2)}
                    </td>
                    <td className="p-3 text-center font-mono text-[11px] text-purple-300">
                      {req.dispatchGuide || '-'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                        {label}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center items-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetailModal(req)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors cursor-pointer"
                          title="Ver Detalle"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* Botón Autorizar */}
                        {req.status === 'SUBMITTED' && (
                          <button
                            onClick={() => handleOpenApproveModal(req)}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition-colors cursor-pointer"
                          >
                            Autorizar
                          </button>
                        )}

                        {/* Botón Despachar */}
                        {req.status === 'APPROVED' && (
                          <button
                            onClick={() => handleOpenDispatchModal(req)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            Despachar
                          </button>
                        )}

                        {/* Botón Recibir */}
                        {req.status === 'DISPATCHED' && (
                          <button
                            onClick={() => handleOpenReceiveModal(req)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                            Recibir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRequisitions.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    No se encontraron requisiciones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== MODAL 1: CREAR REQUISICIÓN ===================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                Nueva Solicitud / Requisición Interna
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequisition} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Solicitud</label>
                  <select
                    value={newReqType}
                    onChange={(e: any) => setNewReqType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="WAREHOUSE_TRANSFER">Transferencia Inter-Bodegas</option>
                    <option value="PURCHASE_REQUEST">Requisición para Proveedor (Compras)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Urgencia</label>
                  <select
                    value={newReqUrgency}
                    onChange={(e: any) => setNewReqUrgency(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">Alta (Mismo día)</option>
                    <option value="URGENT">Urgente (Línea parada)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Almacén Origen (Surtidor)</label>
                  <select
                    value={newReqFromWh}
                    onChange={(e) => setNewReqFromWh(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Almacén Central / Comisariato</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Almacén / Área Destino (Receptor)</label>
                  <select
                    value={newReqToWh}
                    onChange={(e) => setNewReqToWh(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Cocina Principal / Línea Caliente</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Notas / Justificación</label>
                  <input
                    type="text"
                    placeholder="Ej. Resurtido para fin de semana"
                    value={newReqNotes}
                    onChange={(e) => setNewReqNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Agregar Insumos */}
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Insumo a Solicitar</label>
                  <select
                    value={itemSelectId}
                    onChange={(e) => setItemSelectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Selecciona un insumo...</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit}) - Stock: {ing.stock} | Costo: ${ing.cost.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-28">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Cantidad</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={itemSelectQty}
                    onChange={(e) => setItemSelectQty(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white text-right focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Observación</label>
                  <input
                    type="text"
                    placeholder="Ej. Específico marca X"
                    value={itemSelectNotes}
                    onChange={(e) => setItemSelectNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddItemToNewReq}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
                >
                  + Agregar
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="pb-2">Insumo</th>
                      <th className="pb-2 text-right">Cantidad Solicitada</th>
                      <th className="pb-2 text-right">Costo Unitario</th>
                      <th className="pb-2 text-right">Subtotal</th>
                      <th className="pb-2">Notas</th>
                      <th className="pb-2 text-center">Quitar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {newReqItems.map((item, index) => {
                      const ing = ingredients.find((i) => i.id === item.ingredientId);
                      const subtotal = (ing?.cost || 0) * item.requestedQty;
                      return (
                        <tr key={index}>
                          <td className="py-2 font-bold text-white">{ing?.name}</td>
                          <td className="py-2 text-right font-bold text-amber-400">
                            {item.requestedQty} {ing?.unit}
                          </td>
                          <td className="py-2 text-right text-slate-400">
                            ${ing?.cost.toFixed(2)}
                          </td>
                          <td className="py-2 text-right font-black text-slate-200">
                            ${subtotal.toFixed(2)}
                          </td>
                          <td className="py-2 text-slate-500">{item.notes || '-'}</td>
                          <td className="py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromNewReq(index)}
                              className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {newReqItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Aún no has agregado insumos a la solicitud
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
                <div className="text-xs text-slate-400">
                  Total de insumos: <strong className="text-white">{newReqItems.length}</strong>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCreate || newReqItems.length === 0}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {submittingCreate ? 'Enviando...' : 'Enviar a Aprobación'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL 2: APROBAR / RECHAZAR ===================== */}
      {showApproveModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-amber-400" />
                Autorización de Requisición {selectedReq.folio}
              </h3>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-xs text-slate-400">
                Revisa las cantidades solicitadas por <strong>{selectedReq.requestedBy?.name || 'cocina'}</strong>. Puedes ajustar la cantidad autorizada si hay limitaciones de stock o presupuesto.
              </p>

              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Insumo</th>
                    <th className="p-2.5 text-right">Solicitado</th>
                    <th className="p-2.5 text-right">Stock Actual</th>
                    <th className="p-2.5 text-right">Cantidad Autorizada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {selectedReq.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="p-2.5 font-bold text-white">{item.ingredient?.name}</td>
                      <td className="p-2.5 text-right font-medium text-slate-300">
                        {item.requestedQty} {item.ingredient?.unit}
                      </td>
                      <td className="p-2.5 text-right text-slate-400">
                        {item.ingredient?.stock} {item.ingredient?.unit}
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          step="any"
                          value={approvedQuantities[item.id] ?? item.requestedQty}
                          onChange={(e) =>
                            setApprovedQuantities((prev) => ({
                              ...prev,
                              [item.id]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-24 bg-slate-950 border border-slate-700 rounded p-1.5 text-right font-bold text-amber-300 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Motivo de rechazo (opcional, solo si rechazas)</label>
                <input
                  type="text"
                  placeholder="Ej. Insumo agotado temporalmente con proveedor"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={submittingAction}
                className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Rechazar Solicitud
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApproval}
                  disabled={submittingAction}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {submittingAction ? 'Procesando...' : 'Aprobar Requisición'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 3: DESPACHAR ===================== */}
      {showDispatchModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-400" />
                Despacho de Mercancía — {selectedReq.folio}
              </h3>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                Al despachar, las cantidades especificadas se <strong>descontarán inmediatamente de las existencias</strong> del almacén origen y se pondrán en estado de tránsito.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Número de Guía de Remisión (Opcional, autogenerado)</label>
                <input
                  type="text"
                  placeholder="Ej. GUIA-0089 (dejar vacío para auto)"
                  value={dispatchGuideInput}
                  onChange={(e) => setDispatchGuideInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Insumo</th>
                    <th className="p-2.5 text-right">Autorizado</th>
                    <th className="p-2.5 text-right">Cantidad a Despachar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {selectedReq.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="p-2.5 font-bold text-white">{item.ingredient?.name}</td>
                      <td className="p-2.5 text-right text-slate-300">
                        {item.approvedQty} {item.ingredient?.unit}
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          step="any"
                          value={dispatchedQuantities[item.id] ?? item.approvedQty}
                          onChange={(e) =>
                            setDispatchedQuantities((prev) => ({
                              ...prev,
                              [item.id]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-24 bg-slate-950 border border-slate-700 rounded p-1.5 text-right font-bold text-blue-300 text-xs focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatch}
                disabled={submittingAction}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg cursor-pointer disabled:opacity-50"
              >
                {submittingAction ? 'Despachando...' : 'Confirmar Salida & Despachar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 4: RECIBIR (CHECK-IN CON DISCREPANCIAS) ===================== */}
      {showReceiveModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-emerald-400" />
                Recepción & Control de Mermas — {selectedReq.folio}
              </h3>
              <button onClick={() => setShowReceiveModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                Guía de despacho: <strong>{selectedReq.dispatchGuide}</strong>. Cuenta físicamente lo recibido. Si llegó menos de lo despachado, el faltante se enviará automáticamente a la <strong>bitácora de mermas</strong> con motivo de traslado.
              </div>

              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Insumo</th>
                    <th className="p-2.5 text-right">Despachado</th>
                    <th className="p-2.5 text-right">Recibido Real</th>
                    <th className="p-2.5 text-right">Discrepancia</th>
                    <th className="p-2.5">Observación / Merma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {selectedReq.items?.map((item: any) => {
                    const recQty = receivedQuantities[item.id] ?? item.dispatchedQty;
                    const diff = recQty - item.dispatchedQty;

                    return (
                      <tr key={item.id}>
                        <td className="p-2.5 font-bold text-white">{item.ingredient?.name}</td>
                        <td className="p-2.5 text-right font-medium text-slate-400">
                          {item.dispatchedQty} {item.ingredient?.unit}
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            step="any"
                            value={recQty}
                            onChange={(e) =>
                              setReceivedQuantities((prev) => ({
                                ...prev,
                                [item.id]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-24 bg-slate-950 border border-slate-700 rounded p-1.5 text-right font-bold text-emerald-300 text-xs focus:border-emerald-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-2.5 text-right font-black">
                          <span className={diff < 0 ? 'text-rose-400' : diff > 0 ? 'text-emerald-400' : 'text-slate-500'}>
                            {diff > 0 ? `+${diff}` : diff} {item.ingredient?.unit}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            placeholder="Causa de faltante..."
                            value={receivedNotes[item.id] || ''}
                            onChange={(e) =>
                              setReceivedNotes((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[11px] text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReceive}
                disabled={submittingAction}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg cursor-pointer disabled:opacity-50"
              >
                {submittingAction ? 'Ingresando...' : 'Confirmar Recepción e Ingresar Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 5: DETALLE / TRAZABILIDAD ===================== */}
      {showDetailModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                Historial y Trazabilidad — {selectedReq.folio}
              </h3>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Timeline stamps */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block">1. Solicitado</span>
                  <div className="font-bold text-white mt-0.5">{selectedReq.requestedBy?.name || '-'}</div>
                  <span className="text-[10px] text-slate-400">{new Date(selectedReq.createdAt).toLocaleString('es-MX')}</span>
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block">2. Aprobado</span>
                  <div className="font-bold text-white mt-0.5">{selectedReq.approvedBy?.name || 'Pendiente'}</div>
                  {selectedReq.approvedAt && (
                    <span className="text-[10px] text-slate-400">{new Date(selectedReq.approvedAt).toLocaleString('es-MX')}</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block">3. Despachado</span>
                  <div className="font-bold text-white mt-0.5">{selectedReq.dispatchedBy?.name || 'Pendiente'}</div>
                  {selectedReq.dispatchedAt && (
                    <span className="text-[10px] text-slate-400">{new Date(selectedReq.dispatchedAt).toLocaleString('es-MX')}</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block">4. Recibido</span>
                  <div className="font-bold text-white mt-0.5">{selectedReq.receivedBy?.name || 'Pendiente'}</div>
                  {selectedReq.receivedAt && (
                    <span className="text-[10px] text-slate-400">{new Date(selectedReq.receivedAt).toLocaleString('es-MX')}</span>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Insumo</th>
                    <th className="p-2.5 text-right">Solicitado</th>
                    <th className="p-2.5 text-right">Autorizado</th>
                    <th className="p-2.5 text-right">Despachado</th>
                    <th className="p-2.5 text-right">Recibido</th>
                    <th className="p-2.5 text-right">Discrepancia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {selectedReq.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="p-2.5 font-bold text-white">{item.ingredient?.name}</td>
                      <td className="p-2.5 text-right text-slate-400">{item.requestedQty} {item.ingredient?.unit}</td>
                      <td className="p-2.5 text-right text-amber-400">{item.approvedQty} {item.ingredient?.unit}</td>
                      <td className="p-2.5 text-right text-blue-400">{item.dispatchedQty} {item.ingredient?.unit}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-400">{item.receivedQty} {item.ingredient?.unit}</td>
                      <td className="p-2.5 text-right font-black">
                        <span className={item.discrepancyQty < 0 ? 'text-rose-400' : 'text-slate-500'}>
                          {item.discrepancyQty} {item.ingredient?.unit}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedReq.notes && (
                <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <strong>Observaciones:</strong> {selectedReq.notes}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg cursor-pointer"
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
