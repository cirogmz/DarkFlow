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
  ChevronRight
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { playWaiterCallChime, playKitchenChime } from '@/lib/sound';

export interface ExpoOrderItem {
  id: string;
  quantity: number;
  price: number;
  notes?: string | null;
  modifiers?: string | null;
  status: 'PENDING' | 'COOKING' | 'DONE';
  serviceStage?: string | null;
  allergenAlert?: string | null;
  expoChecked?: boolean;
  startedAt?: string | null;
  finishedAt?: string | null;
  servedAt?: string | null;
  product: {
    id: string;
    name: string;
    targetPrepTime?: number | null;
    kitchenStation?: string | null;
    allergens?: string | null;
    dietaryTags?: string | null;
  };
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
  table?: {
    id?: string;
    number: string;
    name: string;
  } | null;
  diners?: number | null;
  waiterId?: string | null;
  waiter?: {
    id: string;
    name: string;
  } | null;
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
  createdAt: string;
  updatedAt: string;
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
  const [filterMode, setFilterMode] = useState<'ALL' | 'DINE_IN' | 'DELIVERY' | 'READY_TO_SERVE'>('ALL');
  const [callingOrderId, setCallingOrderId] = useState<string | null>(null);
  const [packingModalOrder, setPackingModalOrder] = useState<ExpoOrder | null>(null);
  const [customSeal, setCustomSeal] = useState('');
  const [deliveryChecklist, setDeliveryChecklist] = useState({
    utensils: true,
    napkins: true,
    sauces: true,
    drinksSealed: true,
  });
  const [servingOrderId, setServingOrderId] = useState<string | null>(null);

  // SLA Calculation
  const getElapsedMinutes = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    return Math.max(0, Math.floor((currentTimestamp - created) / 60000));
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

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const isDineIn = o.source === 'DINE_IN';
    const isComplete = o.items.length > 0 && o.items.every((i) => i.status === 'DONE');

    if (filterMode === 'DINE_IN') return isDineIn;
    if (filterMode === 'DELIVERY') return !isDineIn;
    if (filterMode === 'READY_TO_SERVE') return isComplete;
    return true;
  });

  // Expo stats
  const totalDineIn = orders.filter((o) => o.source === 'DINE_IN').length;
  const totalDelivery = orders.filter((o) => o.source !== 'DINE_IN').length;
  const fullyAssembled = orders.filter((o) => o.items.length > 0 && o.items.every((i) => i.status === 'DONE')).length;
  const hasAllergensCount = orders.filter((o) => o.items.some((i) => Boolean(i.allergenAlert))).length;

  return (
    <div className="flex flex-col h-full space-y-3 overflow-hidden">
      {/* Top Expo Status Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
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
            <span className="text-[10px] text-slate-400 font-bold uppercase">Mesas en Salón</span>
            <p className="text-xl font-black text-purple-400">{totalDineIn}</p>
          </div>
          <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
            <Utensils className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Empaque Delivery</span>
            <p className="text-xl font-black text-amber-400">{totalDelivery}</p>
          </div>
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <Package className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-3 rounded-xl border border-slate-800 flex items-center justify-between">
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
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              filterMode === 'ALL' ? 'bg-brand-primary text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas ({orders.length})
          </button>
          <button
            onClick={() => setFilterMode('DINE_IN')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              filterMode === 'DINE_IN' ? 'bg-brand-primary text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Salón ({totalDineIn})
          </button>
          <button
            onClick={() => setFilterMode('DELIVERY')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              filterMode === 'DELIVERY' ? 'bg-brand-primary text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Delivery ({totalDelivery})
          </button>
          <button
            onClick={() => setFilterMode('READY_TO_SERVE')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              filterMode === 'READY_TO_SERVE' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            100% Listas ({fullyAssembled})
          </button>
        </div>

        <button
          onClick={onRefresh}
          className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1 transition-all"
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
              No hay comandas pendientes de ensamble o llamado en esta estación.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pb-8">
            {filteredOrders.map((order) => {
              const isDineIn = order.source === 'DINE_IN';
              const totalItems = order.items.length;
              const doneItems = order.items.filter((i) => i.status === 'DONE').length;
              const checkedItems = order.items.filter((i) => i.expoChecked).length;
              const isAllDone = totalItems > 0 && doneItems === totalItems;
              const percentDone = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
              const elapsedMins = getElapsedMinutes(order.createdAt);
              const isNotified = order.expoStatus === 'NOTIFIED_WAITER';
              const isPacked = Boolean(order.deliverySecuritySeal) || order.expoStatus === 'PACKED';
              const hasAllergens = order.items.some((i) => Boolean(i.allergenAlert));

              return (
                <div
                  key={order.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 bg-slate-900 shadow-xl transition-all ${
                    isAllDone
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
                              Mesa #{order.table?.number || '?'}
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
                          {order.waiter?.name && (
                            <span className="text-slate-400 font-normal"> • Mesero: <strong className="text-slate-200">{order.waiter.name}</strong></span>
                          )}
                        </p>
                      </div>

                      {/* Elapsed Timer */}
                      <div className="text-right shrink-0">
                        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          elapsedMins >= 20 ? 'bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse' :
                          elapsedMins >= 12 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          <Clock className="h-3 w-3" /> {elapsedMins} min
                        </span>
                      </div>
                    </div>

                    {/* Allergen Warning Banner */}
                    {hasAllergens && (
                      <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 animate-pulse" />
                        <span className="text-[11px] font-bold text-red-300 leading-tight">
                          ATENCIÓN EXPO: La comanda contiene alertas médicas de alérgenos. Verificar charola aislada.
                        </span>
                      </div>
                    )}

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
                            onClick={() => handleToggleItemCheck(item.id)}
                            className={`p-2 rounded-xl border flex items-start justify-between gap-2 transition-all cursor-pointer select-none ${
                              item.expoChecked
                                ? 'bg-emerald-950/30 border-emerald-800/50 text-slate-200'
                                : isDone
                                ? 'bg-slate-950 border-slate-800 text-white hover:border-slate-700'
                                : 'bg-slate-950/50 border-slate-850 text-slate-400 opacity-80'
                            }`}
                          >
                            <div className="flex items-start gap-2">
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
                                  {item.quantity}x {item.product.name}
                                </p>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                                    {item.product.kitchenStation || 'COCINA'}
                                  </span>

                                  {item.serviceStage && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800/80 text-slate-400 uppercase">
                                      {item.serviceStage}
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

                            {/* Item Station Status Pill */}
                            <div className="shrink-0 text-right">
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
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Imprimir comanda KOT"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    )}

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
      {/* MODAL: CHECKLIST DE EMPAQUE & PRECINTO DE SEGURIDAD DELIVERY */}
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
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white"
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
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePackDelivery}
                className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
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
