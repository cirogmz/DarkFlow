'use client';

import React, { useState } from 'react';
import { Printer, X, FileText, ChefHat } from 'lucide-react';

export interface ThermalOrderData {
  id?: string;
  orderNumber: string;
  source: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  notes?: string | null;
  subtotal?: number;
  tax?: number;
  tip?: number;
  total?: number;
  diners?: number | null;
  couponCode?: string | null;
  discountAmount?: number;
  createdAt: string | Date;
  brand?: {
    name: string;
    slug?: string;
    primaryColor?: string;
  } | null;
  table?: {
    name: string;
    number?: string;
    zone?: string;
  } | null;
  customer?: {
    loyaltyPoints?: number;
    totalOrders?: number;
  } | null;
  items: Array<{
    id?: string;
    quantity: number;
    price?: number;
    notes?: string | null;
    product: {
      name: string;
    };
  }>;
}

interface ThermalTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ThermalOrderData | null;
  initialMode?: 'CUSTOMER' | 'KITCHEN';
}

export default function ThermalTicketModal({
  isOpen,
  onClose,
  order,
  initialMode = 'CUSTOMER',
}: ThermalTicketModalProps) {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');
  const [ticketMode, setTicketMode] = useState<'CUSTOMER' | 'KITCHEN'>(initialMode);

  if (!isOpen || !order) return null;

  const dateStr = new Date(order.createdAt).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeStr = new Date(order.createdAt).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const subtotal = order.subtotal ?? (order.total ? order.total * 0.84 : 0);
  const tax = order.tax ?? (order.total ? order.total * 0.16 : 0);
  const tip = order.tip ?? 0;
  const total = order.total ?? subtotal + tax + tip;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Dynamic Print Styles for ESC/POS Thermal Printers */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-print-container,
          #thermal-print-container * {
            visibility: visible;
          }
          #thermal-print-container {
            position: absolute;
            left: 0;
            top: 0;
            margin: 0 !important;
            padding: 4px !important;
            width: ${paperWidth === '58mm' ? '58mm' : '80mm'} !important;
            max-width: ${paperWidth === '58mm' ? '58mm' : '80mm'} !important;
            background: white !important;
            color: black !important;
            font-family: 'Courier New', Courier, monospace !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            margin: 0;
            size: ${paperWidth === '58mm' ? '58mm' : '80mm'} auto;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-brand-primary" />
            <h3 className="font-bold text-white text-base">Impresión Térmica ESC/POS</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Paper & Mode Switchers */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTicketMode('CUSTOMER')}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                ticketMode === 'CUSTOMER'
                  ? 'bg-brand-primary text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> Cuenta / Cliente
            </button>
            <button
              onClick={() => setTicketMode('KITCHEN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                ticketMode === 'KITCHEN'
                  ? 'bg-brand-primary text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <ChefHat className="h-3.5 w-3.5" /> Comanda Cocina
            </button>
          </div>

          {/* Width Switcher */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 font-semibold uppercase mr-1">Ancho:</span>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-2.5 py-1 font-mono font-bold rounded border cursor-pointer ${
                paperWidth === '80mm'
                  ? 'bg-slate-800 border-brand-primary text-brand-primary'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              80mm
            </button>
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-2.5 py-1 font-mono font-bold rounded border cursor-pointer ${
                paperWidth === '58mm'
                  ? 'bg-slate-800 border-brand-primary text-brand-primary'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              58mm
            </button>
          </div>
        </div>

        {/* Thermal Ticket Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/80 rounded-xl flex justify-center border border-slate-800/80">
          <div
            id="thermal-print-container"
            style={{
              width: paperWidth === '58mm' ? '280px' : '360px',
              fontFamily: "'Courier New', Courier, monospace",
            }}
            className="bg-white text-slate-950 p-5 rounded shadow-2xl text-[12px] leading-relaxed transition-all select-none"
          >
            {/* ==================================================== */}
            {/* CUSTOMER RECEIPT / PRE-CUENTA MODE */}
            {/* ==================================================== */}
            {ticketMode === 'CUSTOMER' && (
              <div className="space-y-2">
                {/* Header */}
                <div className="text-center border-b border-dashed border-slate-400 pb-3 space-y-1">
                  <h2 className="text-base font-black uppercase tracking-wider">
                    {order.brand?.name || 'DARKFLOW RESTAURANT'}
                  </h2>
                  <p className="text-[10px] font-semibold text-slate-600">COCINA DIGITAL & SERVICIO EN MESA</p>
                  <p className="text-[10px] text-slate-600">RFC: DFL260901-MX1</p>
                  <p className="text-[10px] text-slate-600">Av. Insurgentes Sur #104, CDMX</p>
                  <p className="text-[10px] font-bold text-slate-700">TEL: 55-8940-1200</p>
                </div>

                {/* Metadata */}
                <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>FOLIO: <strong>{order.orderNumber}</strong></span>
                    <span>{dateStr} {timeStr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ORIGEN: <strong>{order.source}</strong></span>
                    {order.table && (
                      <span className="font-bold">MESA: {order.table.name} ({order.table.zone})</span>
                    )}
                  </div>
                  {order.customerName && (
                    <div>CLIENTE: <strong className="uppercase">{order.customerName}</strong></div>
                  )}
                  {order.customerPhone && <div>TEL: {order.customerPhone}</div>}
                  {order.customerAddress && (
                    <div className="text-[10px] leading-tight">DIR: {order.customerAddress}</div>
                  )}
                </div>

                {/* Items Table */}
                <div className="py-2 border-b border-dashed border-slate-400">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="py-1">CANT</th>
                        <th className="py-1">DESCRIPCIÓN</th>
                        <th className="py-1 text-right">P.U.</th>
                        <th className="py-1 text-right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {order.items.map((item, idx) => {
                        const itemPrice = item.price ?? 0;
                        const rowTotal = itemPrice * item.quantity;
                        return (
                          <tr key={idx} className="align-top">
                            <td className="py-1 font-bold">{item.quantity}</td>
                            <td className="py-1 pr-1">
                              <div className="font-semibold uppercase">{item.product.name}</div>
                              {item.notes && (
                                <div className="text-[9px] italic text-slate-600 pl-1">
                                  * {item.notes}
                                </div>
                              )}
                            </td>
                            <td className="py-1 text-right font-mono">${itemPrice.toFixed(2)}</td>
                            <td className="py-1 text-right font-mono font-bold">${rowTotal.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Financial Totals */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>SUBTOTAL:</span>
                    <span className="font-mono">${subtotal.toFixed(2)}</span>
                  </div>
                  {order.couponCode && (order.discountAmount ?? 0) > 0 && (
                    <div className="flex justify-between text-slate-800 font-bold">
                      <span>CUPÓN [{order.couponCode}]:</span>
                      <span className="font-mono">-${order.discountAmount?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>I.V.A. (16% INCLUIDO):</span>
                    <span className="font-mono">${tax.toFixed(2)}</span>
                  </div>
                  {tip > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>PROPINA:</span>
                      <span className="font-mono">${tip.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200">
                    <span>TOTAL:</span>
                    <span className="font-mono text-base">${total.toFixed(2)} MXN</span>
                  </div>
                </div>

                {/* Loyalty Points Section */}
                {order.customer && typeof order.customer.loyaltyPoints === 'number' && (
                  <div className="py-2 border-b border-dashed border-slate-400 text-center space-y-0.5 text-[10px] bg-slate-50 rounded">
                    <p className="font-bold text-slate-800">★ PROGRAMA DE LEALTAD ★</p>
                    <p>SALDO DE PUNTOS: <strong>{order.customer.loyaltyPoints} PTS</strong></p>
                    <p className="text-[9px] text-slate-600">Equivalente a ${(order.customer.loyaltyPoints * 0.1).toFixed(2)} MXN en recompensas</p>
                  </div>
                )}

                {/* Tip Suggestions */}
                <div className="py-2 border-b border-dashed border-slate-400 text-center space-y-1 text-[10px]">
                  <p className="font-bold text-slate-700">SUGERENCIA DE PROPINA (VOLUNTARIA):</p>
                  <div className="flex justify-around font-mono font-bold">
                    <span>10%: ${(total * 0.10).toFixed(2)}</span>
                    <span>15%: ${(total * 0.15).toFixed(2)}</span>
                    <span>20%: ${(total * 0.20).toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-2 space-y-1 text-[10px] text-slate-600">
                  <p className="font-bold">¡GRACIAS POR SU PREFERENCIA!</p>
                  <p>ESTE COMPROBANTE NO ES UN COMPROBANTE FISCAL</p>
                  <p className="font-mono">*** DARKFLOW POS SYSTEM ***</p>
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* KITCHEN ORDER TICKET (KOT) MODE */}
            {/* ==================================================== */}
            {ticketMode === 'KITCHEN' && (
              <div className="space-y-3">
                {/* Kitchen Header */}
                <div className="text-center border-b-2 border-black pb-2 space-y-1">
                  <h1 className="text-lg font-black tracking-wider uppercase">
                    *** COMANDA DE COCINA ***
                  </h1>
                  <h2 className="text-sm font-bold uppercase bg-slate-200 py-0.5 rounded">
                    {order.brand?.name || 'COCINA CENTRAL'}
                  </h2>
                </div>

                {/* Large Folio & Location */}
                <div className="bg-slate-100 p-2.5 rounded border border-slate-300 flex justify-between items-center font-bold">
                  <div>
                    <span className="text-[10px] text-slate-500 block">ORDEN #:</span>
                    <span className="text-xl font-black">{order.orderNumber}</span>
                  </div>
                  <div className="text-right">
                    {order.table ? (
                      <span className="text-base font-black bg-black text-white px-2 py-1 rounded">
                        MESA {order.table.name}
                      </span>
                    ) : (
                      <span className="text-xs font-bold uppercase bg-black text-white px-2 py-1 rounded">
                        {order.source}
                      </span>
                    )}
                    {order.diners && (
                      <span className="text-[10px] text-slate-600 block mt-0.5">
                        {order.diners} COMENSALES
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-600 flex justify-between border-b border-dashed border-slate-400 pb-1">
                  <span>HORA: <strong>{timeStr}</strong></span>
                  <span>FECHA: <strong>{dateStr}</strong></span>
                </div>

                {/* Items List (Large & Clear for Chefs) */}
                <div className="py-1 border-b-2 border-black space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="border-b border-dashed border-slate-200 pb-2">
                      <div className="flex items-start gap-2">
                        <span className="text-base font-black font-mono bg-black text-white px-1.5 py-0.5 rounded shrink-0">
                          {item.quantity}X
                        </span>
                        <div className="flex-1">
                          <span className="text-sm font-black uppercase leading-tight block">
                            {item.product.name}
                          </span>
                          {item.notes && (
                            <span className="text-xs font-bold bg-amber-100 text-amber-950 px-1.5 py-0.5 rounded mt-1 block border border-amber-300">
                              ⚠️ NOTA: {item.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* General Order Notes */}
                {order.notes && (
                  <div className="p-2 bg-slate-100 border border-slate-300 rounded text-xs font-bold">
                    <span className="block text-[9px] uppercase text-slate-500">Notas de Comanda:</span>
                    <p className="mt-0.5">{order.notes}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="text-center pt-2 text-[10px] font-mono font-bold text-slate-500 border-t border-dashed border-slate-400">
                  --- FIN DE COMANDA ---
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Imprimir {ticketMode === 'CUSTOMER' ? 'Cuenta' : 'Comanda'} ({paperWidth})
          </button>
        </div>
      </div>
    </div>
  );
}
