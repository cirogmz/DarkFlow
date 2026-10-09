'use client';

import React, { useRef } from 'react';
import { Printer, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface SettlementOrder {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  paymentMethod?: string | null;
  total: number;
  tip?: number | null;
  deliveryFee?: number | null;
  deliveredAt?: string | null;
}

interface SettlementData {
  id: string;
  settlementNumber: string;
  brand?: {
    name: string;
  } | null;
  driver: {
    name: string;
    email?: string;
    deliveryProfile?: {
      vehicleType?: string;
      plateNumber?: string | null;
      phoneNumber?: string | null;
    } | null;
  };
  cashier?: {
    name: string;
  } | null;
  totalOrders: number;
  totalCashExpected: number;
  totalCashTurnedIn: number;
  cashDifference: number;
  totalTips: number;
  totalCommissions: number;
  cashFloatReturned: number;
  netCashToCashier: number;
  status: string;
  notes?: string | null;
  settledAt: string;
  orders?: SettlementOrder[];
}

interface DriverSettlementReceiptModalProps {
  settlement: SettlementData | null;
  onClose: () => void;
}

export default function DriverSettlementReceiptModal({ settlement, onClose }: DriverSettlementReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!settlement) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(settlement.settledAt).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const diff = settlement.cashDifference;
  const isBalanced = Math.abs(diff) < 0.01;
  const isShort = diff < -0.01;
  const isOver = diff > 0.01;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      {/* Print CSS styles to isolate ticket */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-settlement-receipt, #thermal-settlement-receipt * {
            visibility: visible;
          }
          #thermal-settlement-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            margin: 0;
            padding: 10px;
            color: #000;
            background: #fff;
            font-family: monospace;
            font-size: 11px;
            box-shadow: none;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Printer className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Comprobante de Liquidación COD</h3>
              <p className="text-xs text-slate-400">Folio: {settlement.settlementNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary text-slate-950 text-xs font-bold hover:bg-brand-primary/90 transition-colors shadow-lg shadow-brand-primary/20"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir Ticket
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable thermal container */}
        <div className="p-6 max-h-[75vh] overflow-y-auto flex justify-center bg-slate-950/70">
          <div
            id="thermal-settlement-receipt"
            ref={receiptRef}
            className="w-full max-w-[340px] bg-white text-black p-5 rounded-lg shadow-inner font-mono text-[11px] leading-relaxed border border-slate-300"
          >
            {/* Store Header */}
            <div className="text-center pb-3 border-b border-dashed border-neutral-400">
              <div className="text-base font-extrabold tracking-wider uppercase">
                {settlement.brand?.name || 'DARKFLOW RESTAURANT'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5">
                SISTEMA DE DESPACHO & FLOTILLA
              </div>
              <div className="text-xs font-bold mt-2 bg-neutral-200 py-1 rounded">
                LIQUIDACIÓN DE REPARTIDOR
              </div>
              <div className="text-[10px] text-neutral-700 mt-1">
                FOLIO: <span className="font-bold">{settlement.settlementNumber}</span>
              </div>
              <div className="text-[10px] text-neutral-500">
                FECHA: {formattedDate}
              </div>
            </div>

            {/* Driver & Cashier Details */}
            <div className="py-2.5 border-b border-dashed border-neutral-400 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-neutral-600">REPARTIDOR:</span>
                <span className="font-bold">{settlement.driver.name}</span>
              </div>
              {settlement.driver.deliveryProfile?.vehicleType && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">VEHÍCULO:</span>
                  <span>{settlement.driver.deliveryProfile.vehicleType} {settlement.driver.deliveryProfile.plateNumber ? `(${settlement.driver.deliveryProfile.plateNumber})` : ''}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-600">CAJERO(A):</span>
                <span>{settlement.cashier?.name || 'ADMINISTRACIÓN'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">PEDIDOS LIQUIDADOS:</span>
                <span className="font-bold">{settlement.totalOrders}</span>
              </div>
            </div>

            {/* Orders Breakdown */}
            {settlement.orders && settlement.orders.length > 0 && (
              <div className="py-2.5 border-b border-dashed border-neutral-400">
                <div className="font-bold text-[10px] text-neutral-700 mb-1.5 uppercase tracking-wide">
                  Desglose de Comandas:
                </div>
                <table className="w-full text-[9.5px]">
                  <thead>
                    <tr className="border-b border-neutral-300 text-neutral-600 text-left">
                      <th className="pb-1 font-semibold">Folio</th>
                      <th className="pb-1 font-semibold">Pago</th>
                      <th className="pb-1 text-right font-semibold">Propina</th>
                      <th className="pb-1 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {settlement.orders.map((ord) => (
                      <tr key={ord.id}>
                        <td className="py-1 font-medium">#{ord.orderNumber}</td>
                        <td className="py-1 text-neutral-600 truncate max-w-[65px]">
                          {ord.paymentMethod?.toLowerCase().includes('cash') || ord.paymentMethod?.toLowerCase().includes('efectivo')
                            ? 'EFEC'
                            : 'OTRO'}
                        </td>
                        <td className="py-1 text-right text-neutral-600">
                          ${(ord.tip || 0).toFixed(2)}
                        </td>
                        <td className="py-1 text-right font-bold">
                          ${ord.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Financial Summary */}
            <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Efectivo Cobrado (COD):</span>
                <span className="font-semibold">${settlement.totalCashExpected.toFixed(2)}</span>
              </div>
              {settlement.cashFloatReturned > 0 && (
                <div className="flex justify-between">
                  <span>(+) Fondo Cambio Devuelto:</span>
                  <span>${settlement.cashFloatReturned.toFixed(2)}</span>
                </div>
              )}
              {settlement.totalTips > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>Propinas Registradas:</span>
                  <span>${settlement.totalTips.toFixed(2)}</span>
                </div>
              )}
              {settlement.totalCommissions > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>Comisión / Viático Flete:</span>
                  <span>${settlement.totalCommissions.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[11px] pt-1 border-t border-neutral-200">
                <span>Total Esperado en Caja:</span>
                <span>${settlement.netCashToCashier.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-[11px] text-blue-900">
                <span>Efectivo Entregado por Chofer:</span>
                <span>${settlement.totalCashTurnedIn.toFixed(2)}</span>
              </div>
            </div>

            {/* Difference / Balance */}
            <div className="py-2 border-b border-dashed border-neutral-400 text-center">
              {isBalanced && (
                <div className="text-emerald-700 font-bold text-[11px] flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  CUADRE EXACTO ($0.00)
                </div>
              )}
              {isShort && (
                <div className="text-red-700 font-bold text-[11px] flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  FALTANTE DE EFECTIVO: -${Math.abs(diff).toFixed(2)}
                </div>
              )}
              {isOver && (
                <div className="text-amber-700 font-bold text-[11px] flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  SOBRANTE DE EFECTIVO: +${diff.toFixed(2)}
                </div>
              )}
            </div>

            {/* Notes */}
            {settlement.notes && (
              <div className="py-2 border-b border-dashed border-neutral-400 text-[9.5px]">
                <span className="font-bold">NOTAS: </span>
                <span className="text-neutral-700 italic">{settlement.notes}</span>
              </div>
            )}

            {/* Signatures */}
            <div className="pt-6 pb-2 grid grid-cols-2 gap-4 text-center text-[9px] text-neutral-600">
              <div>
                <div className="border-t border-neutral-400 pt-1 font-semibold text-black">
                  FIRMA REPARTIDOR
                </div>
                <div className="text-[8px] text-neutral-500 truncate">{settlement.driver.name}</div>
              </div>
              <div>
                <div className="border-t border-neutral-400 pt-1 font-semibold text-black">
                  FIRMA CAJERO / RECIBIÓ
                </div>
                <div className="text-[8px] text-neutral-500 truncate">{settlement.cashier?.name || 'CAJA'}</div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 text-[8px] text-neutral-400">
              Generado por DarkFlow Manager • Soft Restaurant Parity
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
