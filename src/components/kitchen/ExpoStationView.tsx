'use client';

import React, { useState } from 'react';
import { 
  Bell, 
  Check, 
  CheckCircle2, 
  Clock, 
  Flame, 
  Package, 
  ShieldCheck, 
  Utensils, 
  AlertTriangle, 
  Send, 
  Printer, 
  Sparkles,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  Thermometer,
  RotateCcw,
  CheckSquare,
  FileCheck2,
  XCircle,
  Eye,
  Info
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { playWaiterCallChime, playKitchenChime, playAlertChime } from '@/lib/sound';

export interface ExpoOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  notes?: string | null;
  modifiers?: string | null;
  status: 'PENDING' | 'COOKING' | 'DONE';
  serviceStage?: string | null;
  allergenAlert?: string | null;
  expoChecked?: boolean;
  targetTempMin?: number | null;
  actualTemp?: number | null;
  tempStatus?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  servedAt?: string | null;
  kitchenStation?: string | null;
  allergens?: string | null;
  dietaryTags?: string | null;
}

export interface ExpoOrder {
  id: string;
  orderNumber: string;
  source: string;
  status: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  notes?: string | null;
  items: ExpoOrderItem[];
  externalOrderId?: string | null;
  deliveryService?: string | null;
  tableId?: string | null;
  tableNumber?: string | null;
  tableName?: string | null;
  diners?: number | null;
  waiterId?: string | null;
  waiterName?: string | null;
  prepTimeTarget?: number | null;
  cookingStartedAt?: string | null;
  cookingFinishedAt?: string | null;
  currentStage?: string | null;
  expoStatus?: string | null;
  expoNotifiedAt?: string | null;
  expoAssembledAt?: string | null;
  expoPackedAt?: string | null;
  expoNotes?: string | null;
  deliverySecuritySeal?: string | null;
  expoQcPassed?: boolean;
  expoQcCheckedAt?: string | null;
  expoQcCheckedById?: string | null;
  expoQcCheckedByName?: string | null;
  expoQcNotes?: string | null;
  expoTemperature?: number | null;
  expoHaccpStatus?: string | null;
  expoHoldTimeMinutes?: number | null;
  expoRecookRequested?: boolean;
  expoRecookReason?: string | null;
  expoChecklistState?: string | null;
  createdAt: string;
  totalItems: number;
  doneItems: number;
  servedItems: number;
  checkedItems: number;
  isComplete: boolean;
  hasAllergens: boolean;
}

interface ExpoStationViewProps {
  orders: ExpoOrder[];
  currentTimestamp: number;
  onRefresh: () => void;
  soundEnabled: boolean;
  onDirectPrint?: (orderId: string) => void;
  printingOrderId?: string | null;
}

export default function ExpoStationView({
  orders,
  currentTimestamp,
  onRefresh,
  soundEnabled,
  onDirectPrint,
  printingOrderId,
}: ExpoStationViewProps) {
  const { addNotification } = useAppStore();
  const [filterMode, setFilterMode] = useState<'ALL' | 'DINE_IN' | 'DELIVERY' | 'READY_TO_SERVE' | 'QC_PENDING'>('ALL');
  const [callingOrderId, setCallingOrderId] = useState<string | null>(null);
  const [servingOrderId, setServingOrderId] = useState<string | null>(null);

  // Delivery packing modal state
  const [packingModalOrder, setPackingModalOrder] = useState<ExpoOrder | null>(null);
  const [customSeal, setCustomSeal] = useState('');
  const [deliveryChecklist, setDeliveryChecklist] = useState({
    utensils: true,
    napkins: true,
    sauces: true,
    drinksSealed: true,
  });

  // QC & HACCP Modal state
  const [qcModalOrder, setQcModalOrder] = useState<ExpoOrder | null>(null);
  const [qcChecklist, setQcChecklist] = useState({
    presentationOk: true,
    tempOk: true,
    sidesOk: true,
    allergensOk: true,
    cutleryOk: true,
  });
  const [qcDishType, setQcDishType] = useState<'HOT' | 'COLD' | 'NEUTRAL'>('HOT');
  const [qcTemperature, setQcTemperature] = useState<string>('68');
  const [qcNotes, setQcNotes] = useState<string>('');
  const [isSubmittingQc, setIsSubmittingQc] = useState(false);

  // Recook / Remake in Kitchen Modal state
  const [recookModalOrder, setRecookModalOrder] = useState<ExpoOrder | null>(null);
  const [recookItemId, setRecookItemId] = useState<string | null>(null);
  const [recookReason, setRecookReason] = useState<string>('Temperatura por debajo del límite crítico HACCP (<60°C)');
  const [customRecookReason, setCustomRecookReason] = useState<string>('');
  const [isSubmittingRecook, setIsSubmittingRecook] = useState(false);

  // Total order elapsed time (kitchen SLA)
  const getElapsedMinutes = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    return Math.max(0, Math.floor((currentTimestamp - created) / 60000));
  };

  // Pass Hold Time SLA (Time since cooking finished or all items marked done)
  const getPassHoldMinutes = (order: ExpoOrder) => {
    if (!order.isComplete) return null;
    const baseTime = order.cookingFinishedAt 
      ? new Date(order.cookingFinishedAt).getTime()
      : new Date(order.createdAt).getTime();
    return Math.max(0, Math.floor((currentTimestamp - baseTime) / 60000));
  };

  // Toggle item check on the pass
  const handleToggleItemCheck = async (itemId: string) => {
    try {
      const res = await fetch('/api/kitchen/expo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CHECK_ITEM', itemId }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch {
      console.error('Error toggling expo item check');
    }
  };

  // Call assigned waiter
  const handleCallWaiter = async (order: ExpoOrder) => {
    setCallingOrderId(order.id);
    try {
      const res = await fetch('/api/kitchen/expo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CALL_WAITER', orderId: order.id }),
      });
      const data = await res.json();
      if (res.ok) {
        if (soundEnabled) playWaiterCallChime();
        addNotification(data.message || 'Llamado enviado al mesero', 'success');
        onRefresh();
      } else {
        addNotification(data.error || 'Error al llamar mesero', 'error');
      }
    } catch {
      addNotification('Error al contactar con el mesero', 'error');
    } finally {
      setCallingOrderId(null);
    }
  };

  // Serve all items in order
  const handleServeOrder = async (orderId: string) => {
    setServingOrderId(orderId);
    try {
      const res = await fetch('/api/kitchen/expo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SERVE_ALL', orderId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (soundEnabled) playKitchenChime();
        addNotification(data.message || 'Comanda entregada a sala', 'success');
        onRefresh();
      } else {
        addNotification(data.error || 'Error al servir comanda', 'error');
      }
    } catch {
      addNotification('Error al marcar comanda servida', 'error');
    } finally {
      setServingOrderId(null);
    }
  };

  // Pack delivery order
  const handlePackDelivery = async () => {
    if (!packingModalOrder) return;
    try {
      const res = await fetch('/api/kitchen/expo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PACK_DELIVERY',
          orderId: packingModalOrder.id,
          securitySeal: customSeal || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (soundEnabled) playKitchenChime();
        addNotification(data.message || 'Pedido empacado y sellado', 'success');
        setPackingModalOrder(null);
        setCustomSeal('');
        onRefresh();
      } else {
        addNotification(data.error || 'Error al empacar pedido', 'error');
      }
    } catch {
      addNotification('Error al sellar empaque de delivery', 'error');
    }
  };

  // Open QC Verification modal
  const handleOpenQcModal = (order: ExpoOrder) => {
    setQcModalOrder(order);
    if (order.expoChecklistState) {
      try {
        const parsed = JSON.parse(order.expoChecklistState);
        setQcChecklist({
          presentationOk: parsed.presentationOk ?? true,
          tempOk: parsed.tempOk ?? true,
          sidesOk: parsed.sidesOk ?? true,
          allergensOk: parsed.allergensOk ?? true,
          cutleryOk: parsed.cutleryOk ?? true,
        });
      } catch {
        // use default
      }
    } else {
      setQcChecklist({
        presentationOk: true,
        tempOk: true,
        sidesOk: true,
        allergensOk: true,
        cutleryOk: true,
      });
    }
    setQcTemperature(order.expoTemperature !== null && order.expoTemperature !== undefined ? String(order.expoTemperature) : '68');
    setQcNotes(order.expoQcNotes || '');
    setQcDishType('HOT');
  };

  // Submit QC Verification
  const handleVerifyQc = async () => {
    if (!qcModalOrder) return;
    setIsSubmittingQc(true);
    try {
      const tempNum = qcTemperature.trim() !== '' ? parseFloat(qcTemperature) : null;
      const res = await fetch('/api/kitchen/expo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'QC_VERIFY',
          orderId: qcModalOrder.id,
          checklist: qcChecklist,
          temperature: tempNum,
          dishType: qcDishType,
          notes: qcNotes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.qcPassed) {
          if (soundEnabled) playKitchenChime();
          addNotification(data.message || 'Control de Calidad Aprobado', 'success');
        } else {
          if (soundEnabled) playAlertChime();
          addNotification(data.message || 'Control de Calidad con Advertencias', 'warning');
        }
        setQcModalOrder(null);
        onRefresh();
      } else {
        addNotification(data.error || 'Error al validar QC', 'error');
      }
    } catch {
      addNotification('Error al registrar auditoría QC', 'error');
    } finally {
      setIsSubmittingQc(false);
    }
  };

  // Open Recook modal
  const handleOpenRecookModal = (order: ExpoOrder, itemId?: string) => {
    setRecookModalOrder(order);
    setRecookItemId(itemId || null);
    setRecookReason('Temperatura por debajo del límite crítico HACCP (<60°C)');
    setCustomRecookReason('');
  };

  // Submit Recook request to kitchen line
  const handleRequestRecook = async () => {
    if (!recookModalOrder) return;
    const finalReason = customRecookReason.trim() !== '' ? customRecookReason.trim() : recookReason;
    setIsSubmittingRecook(true);
    try {
      const res = await fetch('/api/kitchen/expo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RECOOK_ORDER',
          orderId: recookModalOrder.id,
          itemId: recookItemId || undefined,
          reason: finalReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (soundEnabled) playAlertChime();
        addNotification(data.message || 'Comanda enviada a rehacer en cocina', 'warning');
        setRecookModalOrder(null);
        setRecookReason('');
        setCustomRecookReason('');
        setRecookItemId(null);
        onRefresh();
      } else {
        addNotification(data.error || 'Error al solicitar rehacer platillo', 'error');
      }
    } catch {
      addNotification('Error al enviar orden a cocina', 'error');
    } finally {
      setIsSubmittingRecook(false);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const isDineIn = o.source === 'DINE_IN';
    const isComplete = o.isComplete;

    if (filterMode === 'DINE_IN') return isDineIn;
    if (filterMode === 'DELIVERY') return !isDineIn;
    if (filterMode === 'READY_TO_SERVE') return isComplete;
    if (filterMode === 'QC_PENDING') return isComplete && !o.expoQcPassed;
    return true;
  });

  // Expo stats
  const totalDineIn = orders.filter((o) => o.source === 'DINE_IN').length;
  const totalDelivery = orders.filter((o) => o.source !== 'DINE_IN').length;
  const fullyAssembled = orders.filter((o) => o.isComplete).length;
  const qcPassedCount = orders.filter((o) => o.expoQcPassed).length;
  const qcPendingCount = orders.filter((o) => o.isComplete && !o.expoQcPassed).length;
  const recookCount = orders.filter((o) => o.expoRecookRequested).length;
  const hasAllergensCount = orders.filter((o) => o.hasAllergens).length;

  return (
    <div className="flex flex-col h-full space-y-3 overflow-hidden">
      {/* Top Expo Status Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
        <div className="glass-panel p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Charolas Listas</span>
            <p className="text-xl font-black text-emerald-400">{fullyAssembled}</p>
          </div>
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">QC Aprobado</span>
            <p className="text-xl font-black text-blue-400">{qcPassedCount}</p>
          </div>
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <FileCheck2 className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Pendiente QC</span>
            <p className={`text-xl font-black ${qcPendingCount > 0 ? 'text-amber-400 font-black' : 'text-slate-400'}`}>
              {qcPendingCount}
            </p>
          </div>
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <Thermometer className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Reprocesos / Recook</span>
            <p className={`text-xl font-black ${recookCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`}>
              {recookCount}
            </p>
          </div>
          <div className={`p-2 rounded-lg border ${recookCount > 0 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
            <RotateCcw className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-3 rounded-xl border border-slate-800 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Con Alérgenos</span>
            <p className={`text-xl font-black ${hasAllergensCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`}>
              {hasAllergensCount}
            </p>
          </div>
          <div className={`p-2 rounded-lg border ${hasAllergensCount > 0 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Sub-filter tabs */}
      <div className="flex items-center justify-between gap-2 shrink-0 pb-1">
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs overflow-x-auto max-w-full">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterMode === 'ALL' ? 'bg-brand-primary text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas ({orders.length})
          </button>
          <button
            onClick={() => setFilterMode('DINE_IN')}
            className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterMode === 'DINE_IN' ? 'bg-brand-primary text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Salón ({totalDineIn})
          </button>
          <button
            onClick={() => setFilterMode('DELIVERY')}
            className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterMode === 'DELIVERY' ? 'bg-brand-primary text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Delivery ({totalDelivery})
          </button>
          <button
            onClick={() => setFilterMode('READY_TO_SERVE')}
            className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterMode === 'READY_TO_SERVE' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Listas ({fullyAssembled})
          </button>
          <button
            onClick={() => setFilterMode('QC_PENDING')}
            className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterMode === 'QC_PENDING' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pendiente QC ({qcPendingCount})
          </button>
        </div>

        <button
          onClick={onRefresh}
          className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1 transition-all shrink-0 cursor-pointer"
        >
          <span>Actualizar</span>
        </button>
      </div>

      {/* Orders Grid / Trays */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredOrders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 rounded-2xl border border-slate-800/80">
            <CheckCircle2 className="h-12 w-12 text-slate-600 mb-2" />
            <h4 className="font-bold text-white text-base">Barra de Pase Despejada</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              No hay comandas pendientes de ensamble, llamado o auditoría QC en este filtro.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pb-8">
            {filteredOrders.map((order) => {
              const isDineIn = order.source === 'DINE_IN';
              const totalItems = order.totalItems;
              const doneItems = order.doneItems;
              const isAllDone = order.isComplete;
              const percentDone = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
              const elapsedMins = getElapsedMinutes(order.createdAt);
              const passHoldMins = getPassHoldMinutes(order);
              const isNotified = order.expoStatus === 'NOTIFIED_WAITER';
              const isPacked = Boolean(order.deliverySecuritySeal) || order.expoStatus === 'PACKED';
              const hasAllergens = order.hasAllergens;
              const isQcPassed = Boolean(order.expoQcPassed);
              const isRecookRequested = Boolean(order.expoRecookRequested);

              return (
                <div
                  key={order.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 bg-slate-900 shadow-xl transition-all ${
                    isRecookRequested
                      ? 'border-red-500/70 bg-red-950/20 ring-1 ring-red-500/30'
                      : isQcPassed
                      ? 'border-blue-500/50 bg-slate-900/95 ring-1 ring-blue-500/20'
                      : isAllDone
                      ? 'border-emerald-500/50 bg-slate-900/95 ring-1 ring-emerald-500/20'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-black text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/20">
                            #{order.orderNumber}
                          </span>

                          {isDineIn ? (
                            <span className="text-xs font-black text-white px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/30">
                              Mesa #{order.tableNumber || '?'}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 uppercase">
                              {order.deliveryService || order.source}
                            </span>
                          )}

                          {isNotified && (
                            <span className="text-[10px] font-black text-cyan-300 bg-cyan-950/60 border border-cyan-800 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                              <Bell className="h-3 w-3" /> Mesero Llamado
                            </span>
                          )}

                          {isPacked && (
                            <span className="text-[10px] font-black text-emerald-300 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3" /> Sellado
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 font-semibold mt-1">
                          {order.customerName || (isDineIn ? `Comensales: ${order.diners || 1}` : 'Cliente')}
                          {order.waiterName && (
                            <span className="text-slate-400 font-normal"> • Mesero: <strong className="text-slate-200">{order.waiterName}</strong></span>
                          )}
                        </p>
                      </div>

                      {/* Elapsed Timers: Kitchen Total & Pass SLA */}
                      <div className="text-right shrink-0 space-y-1">
                        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full flex items-center justify-end gap-1 ${
                          elapsedMins >= 20 ? 'bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse' :
                          elapsedMins >= 12 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          <Clock className="h-3 w-3" /> {elapsedMins} min
                        </span>

                        {passHoldMins !== null && (
                          <span
                            className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center justify-end gap-1 ${
                              passHoldMins >= 5
                                ? 'bg-red-500/30 text-red-300 border border-red-500/50 animate-pulse font-black'
                                : passHoldMins >= 3
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                            title={`Tiempo transcurrido en el pase desde que la cocina terminó la comanda.`}
                          >
                            <Flame className="h-3 w-3" /> Pase: {passHoldMins}m
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Recook Alert Banner */}
                    {isRecookRequested && (
                      <div className="bg-red-950/60 border border-red-600/70 rounded-xl p-2.5 flex items-start gap-2 animate-pulse">
                        <RotateCcw className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-black text-red-200">REPROCESO SOLICITADO EN COCINA</p>
                          <p className="text-[11px] text-red-300 mt-0.5">{order.expoRecookReason || 'Rechazado en pase'}</p>
                        </div>
                      </div>
                    )}

                    {/* Allergen Warning Banner */}
                    {hasAllergens && (
                      <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 animate-pulse" />
                        <span className="text-[11px] font-bold text-red-300 leading-tight">
                          ATENCIÓN EXPO: La comanda contiene alertas médicas de alérgenos. Verificar charola aislada.
                        </span>
                      </div>
                    )}

                    {/* Pass Hold Critical Alert (>5 min) */}
                    {passHoldMins !== null && passHoldMins >= 5 && (
                      <div className="bg-amber-950/40 border border-amber-600/60 rounded-xl p-2 flex items-center gap-2">
                        <Flame className="h-4 w-4 text-amber-400 shrink-0 animate-bounce" />
                        <span className="text-[11px] font-bold text-amber-300 leading-tight">
                          ALERTA SLA: Retenido en pase {passHoldMins}m. Riesgo de enfriamiento o condensación. Despachar urgente.
                        </span>
                      </div>
                    )}

                    {/* QC & HACCP Status Bar */}
                    <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Thermometer className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-300">Auditoría QC:</span>
                        {isQcPassed ? (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-blue-400" /> Aprobado
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Pendiente
                          </span>
                        )}
                        {order.expoTemperature !== null && order.expoTemperature !== undefined && (
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            order.expoHaccpStatus === 'PASS'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}>
                            {order.expoTemperature}°C {order.expoHaccpStatus === 'PASS' ? '🟢' : '🔴'}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenQcModal(order)}
                        className="text-[11px] font-bold text-brand-primary hover:text-white px-2 py-0.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/20 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <FileCheck2 className="h-3 w-3" />
                        <span>{isQcPassed ? 'Editar QC' : 'Verificar'}</span>
                      </button>
                    </div>

                    {/* Tray Assembly Progress Meter */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-400 uppercase tracking-wider">
                          Ensamble de Charola: {doneItems}/{totalItems} listos
                        </span>
                        <span className={isAllDone ? 'text-emerald-400 font-black' : 'text-slate-300'}>
                          {percentDone}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isAllDone ? 'bg-emerald-500' : 'bg-brand-primary'
                          }`}
                          style={{ width: `${percentDone}%` }}
                        />
                      </div>
                    </div>

                    {/* Line Items Checklist */}
                    <div className="space-y-1.5 pt-1">
                      {order.items.map((item) => {
                        const isDone = item.status === 'DONE';
                        return (
                          <div
                            key={item.id}
                            className={`p-2 rounded-xl border flex items-start justify-between gap-2 transition-all select-none ${
                              item.expoChecked
                                ? 'bg-emerald-950/30 border-emerald-800/50 text-slate-200'
                                : isDone
                                ? 'bg-slate-950 border-slate-800 text-white hover:border-slate-700'
                                : 'bg-slate-950/50 border-slate-850 text-slate-400 opacity-80'
                            }`}
                          >
                            <div 
                              onClick={() => handleToggleItemCheck(item.id)}
                              className="flex items-start gap-2 flex-1 cursor-pointer"
                            >
                              {/* Checkbox */}
                              <div
                                className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                  item.expoChecked
                                    ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                    : 'border-slate-700 bg-slate-900'
                                }`}
                              >
                                {item.expoChecked && <Check className="h-3 w-3 stroke-[3px]" />}
                              </div>

                              <div className="space-y-0.5">
                                <p className={`text-xs font-bold leading-snug ${item.expoChecked ? 'line-through text-slate-400' : 'text-white'}`}>
                                  {item.quantity}x {item.productName}
                                </p>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                                    {item.kitchenStation || 'COCINA'}
                                  </span>

                                  {item.serviceStage && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800/80 text-slate-400 uppercase">
                                      {item.serviceStage}
                                    </span>
                                  )}

                                  {item.actualTemp !== null && item.actualTemp !== undefined && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-800 text-cyan-300">
                                      {item.actualTemp}°C
                                    </span>
                                  )}
                                </div>

                                {item.notes && (
                                  <p className="text-[10px] text-amber-300 italic">Nota: {item.notes}</p>
                                )}

                                {item.allergenAlert && (
                                  <p className="text-[10px] text-red-300 font-bold bg-red-950/60 border border-red-900/60 px-1.5 py-0.2 rounded inline-block">
                                    ⚠️ {item.allergenAlert}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Item Station Status Pill & Item Recook Trigger */}
                            <div className="shrink-0 flex items-center gap-1">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isDone
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : item.status === 'COOKING'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {isDone ? 'Listo' : item.status === 'COOKING' ? 'En cocción' : 'En cola'}
                              </span>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRecookModal(order, item.id);
                                }}
                                title="Rehacer solo este platillo en cocina"
                                className="p-1 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-500/40 transition-colors"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Delivery Security Seal Details */}
                    {order.deliverySecuritySeal && (
                      <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-300">
                          <ShieldCheck className="h-4 w-4" />
                          <span className="font-bold">Precinto de Seguridad:</span>
                        </div>
                        <span className="font-mono font-black text-white bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-700">
                          {order.deliverySecuritySeal}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
                    {/* Print ticket */}
                    {onDirectPrint && (
                      <button
                        onClick={() => onDirectPrint(order.id)}
                        disabled={printingOrderId === order.id}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Imprimir comanda KOT"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    )}

                    {/* Recook Order button */}
                    <button
                      onClick={() => handleOpenRecookModal(order)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/40 transition-colors cursor-pointer"
                      title="Rehacer comanda completa en cocina"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>

                    {/* Dine In Actions */}
                    {isDineIn ? (
                      <>
                        <button
                          onClick={() => handleCallWaiter(order)}
                          disabled={callingOrderId === order.id}
                          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                            isNotified
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                              : isAllDone
                              ? 'bg-brand-primary text-slate-950 font-black shadow-lg shadow-brand-primary/20'
                              : 'bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                        >
                          <Bell className={`h-4 w-4 ${isNotified ? 'animate-bounce' : ''}`} />
                          <span>{isNotified ? 'Re-llamar Mesero' : 'Llamar a Mesero'}</span>
                        </button>

                        <button
                          onClick={() => handleServeOrder(order.id)}
                          disabled={servingOrderId === order.id}
                          className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                        >
                          <Check className="h-4 w-4 stroke-[3px]" />
                          <span>Servir</span>
                        </button>
                      </>
                    ) : (
                      /* Delivery / Takeaway Actions */
                      <button
                        onClick={() => {
                          setPackingModalOrder(order);
                          setCustomSeal(`SEAL-${Math.floor(1000 + Math.random() * 9000)}`);
                        }}
                        className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                          isPacked
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isAllDone
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>{isPacked ? 'Actualizar Precinto' : 'Sellar y Empacar'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: CONTROL DE CALIDAD EN PASE & AUDITORÍA HACCP */}
      {/* ===================================================================== */}
      {qcModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Control de Calidad & HACCP</h3>
                  <p className="text-xs text-slate-400">
                    Comanda #{qcModalOrder.orderNumber} • {qcModalOrder.tableNumber ? `Mesa #${qcModalOrder.tableNumber}` : qcModalOrder.deliveryService || qcModalOrder.source}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setQcModalOrder(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* SLA Alert Context */}
            {getPassHoldMinutes(qcModalOrder) !== null && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-400 font-medium">Tiempo de Retención en Pase:</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                  (getPassHoldMinutes(qcModalOrder) || 0) >= 5
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {getPassHoldMinutes(qcModalOrder)} minutos
                </span>
              </div>
            )}

            {/* 5-Point Digital QC Checklist */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Checklist de Inspección de Pase (5 Puntos):
              </label>

              {[
                { key: 'presentationOk', label: '✨ Presentación de emplatado impecable (bordes limpios, sin salpicaduras)' },
                { key: 'tempOk', label: '🔥 Temperatura sensorial adecuada (humeante caliente o frío al tacto)' },
                { key: 'sidesOk', label: '🥗 Guarniciones, aderezos y salsas completas según receta' },
                { key: 'allergensOk', label: '🛡️ Verificación estricta de notas médicas y alérgenos' },
                { key: 'cutleryOk', label: '🍴 Cubiertos, servilletas y aditamentos completos' },
              ].map((item) => (
                <label
                  key={item.key}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                    qcChecklist[item.key as keyof typeof qcChecklist]
                      ? 'bg-blue-950/30 border-blue-800/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={qcChecklist[item.key as keyof typeof qcChecklist]}
                    onChange={(e) =>
                      setQcChecklist({ ...qcChecklist, [item.key]: e.target.checked })
                    }
                    className="rounded text-blue-500 h-4 w-4"
                  />
                  <span className="font-medium leading-tight">{item.label}</span>
                </label>
              ))}
            </div>

            {/* HACCP Probe Temperature Section */}
            <div className="space-y-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Thermometer className="h-4 w-4 text-cyan-400" />
                  <span>Auditoría de Sonda Térmica HACCP:</span>
                </label>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => { setQcDishType('HOT'); setQcTemperature('68'); }}
                    className={`px-2 py-0.5 rounded font-bold transition-all ${
                      qcDishType === 'HOT' ? 'bg-orange-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Caliente (&ge;60°C)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQcDishType('COLD'); setQcTemperature('4'); }}
                    className={`px-2 py-0.5 rounded font-bold transition-all ${
                      qcDishType === 'COLD' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Frío (&le;5°C)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQcDishType('NEUTRAL'); setQcTemperature(''); }}
                    className={`px-2 py-0.5 rounded font-bold transition-all ${
                      qcDishType === 'NEUTRAL' ? 'bg-slate-600 text-white font-black' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Exento
                  </button>
                </div>
              </div>

              {qcDishType !== 'NEUTRAL' && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.1"
                        value={qcTemperature}
                        onChange={(e) => setQcTemperature(e.target.value)}
                        placeholder="Ej. 68.5"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:border-brand-primary outline-none"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">°C</span>
                    </div>

                    {/* Quick preset buttons */}
                    <div className="flex gap-1">
                      {qcDishType === 'HOT' ? (
                        <>
                          {['65', '72', '80'].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setQcTemperature(val)}
                              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-300"
                            >
                              {val}°
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          {['2', '4', '5'].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setQcTemperature(val)}
                              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-300"
                            >
                              {val}°
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* HACCP Compliance Gauge Feedback */}
                  {qcTemperature.trim() !== '' && (
                    <div className="text-xs">
                      {qcDishType === 'HOT' && (
                        parseFloat(qcTemperature) >= 60 ? (
                          <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-600/50 text-emerald-300 flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span>Inocuidad HACCP Cumplida (&ge;60°C retención caliente)</span>
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-red-950/50 border border-red-600/60 text-red-300 flex items-center gap-1.5 font-bold animate-pulse">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                            <span>PELIGRO BIOLÓGICO: &lt;60°C (Zona de proliferación bacteriana). Rechazar o recalentar.</span>
                          </div>
                        )
                      )}

                      {qcDishType === 'COLD' && (
                        parseFloat(qcTemperature) <= 5 ? (
                          <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-600/50 text-emerald-300 flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span>Cadena de Frío Segura (&le;5°C)</span>
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-red-950/50 border border-red-600/60 text-red-300 flex items-center gap-1.5 font-bold animate-pulse">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                            <span>PELIGRO: &gt;5°C. Ruptura de la cadena de frío para plato crudo o frío.</span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Notes / Observations */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">
                Observaciones del Auditor de Pase (Opcional):
              </label>
              <input
                type="text"
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                placeholder="Ej. Salsas adicionales en envase hermético..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-primary outline-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setQcModalOrder(null);
                  handleOpenRecookModal(qcModalOrder);
                }}
                className="w-1/3 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Rehacer</span>
              </button>
              <button
                type="button"
                onClick={handleVerifyQc}
                disabled={isSubmittingQc}
                className="w-2/3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isSubmittingQc ? 'Registrando...' : 'Aprobar Control de Calidad'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: REHACER PLATILLO / COMANDA EN COCINA (RECOOK) */}
      {/* ===================================================================== */}
      {recookModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-red-900/60 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Rehacer en Cocina (Recook)</h3>
                  <p className="text-xs text-slate-400">
                    Comanda #{recookModalOrder.orderNumber}
                  </p>
                </div>
              </div>
              <button onClick={() => setRecookModalOrder(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Scope info */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">Alcance del Reproceso:</span>
              <p className="font-bold text-amber-300 mt-0.5">
                {recookItemId
                  ? `Platillo: ${recookModalOrder.items.find((i) => i.id === recookItemId)?.productName || 'Ítem específico'}`
                  : 'Comanda Completa (todos los platillos)'}
              </p>
            </div>

            {/* Quick Reason selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Motivo del Rechazo / Recook:
              </label>

              {[
                'Temperatura por debajo del límite crítico HACCP (<60°C)',
                'Presentación o emplatado defectuoso',
                'Guarnición o especificación de comanda incorrecta',
                'Alérgeno omitido o posible contaminación cruzada',
                'Platillo quemado o cocción deficiente',
              ].map((reason) => (
                <label
                  key={reason}
                  className={`flex items-start gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                    recookReason === reason && customRecookReason === ''
                      ? 'bg-red-950/40 border-red-800/80 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="recookReason"
                    checked={recookReason === reason && customRecookReason === ''}
                    onChange={() => {
                      setRecookReason(reason);
                      setCustomRecookReason('');
                    }}
                    className="text-red-500 mt-0.5"
                  />
                  <span>{reason}</span>
                </label>
              ))}

              <div className="pt-1">
                <input
                  type="text"
                  value={customRecookReason}
                  onChange={(e) => setCustomRecookReason(e.target.value)}
                  placeholder="Otro motivo específico..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-red-500 outline-none"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRecookModalOrder(null)}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRequestRecook}
                disabled={isSubmittingRecook}
                className="w-1/2 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-lg shadow-red-600/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                <span>{isSubmittingRecook ? 'Enviando...' : 'Confirmar Recook'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: CHECKLIST DE EMPAQUE & PRECINTO DE SEGURIDAD DELIVERY */}
      {/* ===================================================================== */}
      {packingModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-base">Control de Empaque Delivery</h3>
                <p className="text-xs text-slate-400">
                  #{packingModalOrder.orderNumber} • {packingModalOrder.deliveryService || packingModalOrder.source}
                </p>
              </div>
              <button onClick={() => setPackingModalOrder(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Verificación de Bolsa:
              </label>

              {[
                { key: 'utensils', label: '🍴 Cubiertos y servilletas completos' },
                { key: 'napkins', label: '🥗 Salsas y aderezos incluidos' },
                { key: 'drinksSealed', label: '🥤 Bebidas selladas a prueba de derrame' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={deliveryChecklist[item.key as keyof typeof deliveryChecklist]}
                    onChange={(e) =>
                      setDeliveryChecklist({ ...deliveryChecklist, [item.key]: e.target.checked })
                    }
                    className="rounded text-brand-primary"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            {/* Security Seal Generator / Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Folio / Precinto de Seguridad:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customSeal}
                  onChange={(e) => setCustomSeal(e.target.value.toUpperCase())}
                  placeholder="Ej. SEAL-4821"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:border-brand-primary outline-none"
                />
                <button
                  type="button"
                  onClick={() => setCustomSeal(`SEAL-${Math.floor(1000 + Math.random() * 9000)}`)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                  title="Generar nuevo folio aleatorio"
                >
                  Azar
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Pega el precinto físico en la bolsa y regístralo aquí para auditoría de entrega al repartidor.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPackingModalOrder(null)}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePackDelivery}
                className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                Confirmar y Sellar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
