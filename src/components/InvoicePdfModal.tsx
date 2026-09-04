/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  FileText, 
  QrCode 
} from 'lucide-react';

export interface InvoiceOrderData {
  id: string;
  orderNumber: string;
  source: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  notes?: string | null;
  subtotal: number;
  tax: number;
  tip?: number | null;
  total: number;
  diners?: number | null;
  couponCode?: string | null;
  discountAmount?: number | null;
  externalOrderId?: string | null;
  createdAt: string | Date;
  brand?: {
    name: string;
    slug?: string;
    primaryColor?: string;
    logoUrl?: string | null;
  } | null;
  table?: {
    name: string;
    number?: string;
    zone?: string;
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

interface InvoicePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: InvoiceOrderData | null;
  initialMode?: 'INVOICE' | 'RECEIPT';
}

// Helper to convert number to currency words in Spanish
function numberToSpanishWords(amount: number): string {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales: Record<number, string> = {
    11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
    16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
    21: 'VEINTIUNO', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO',
    25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
  };
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  const entero = Math.floor(amount);
  const centavos = Math.round((amount - entero) * 100);
  const centavosStr = centavos.toString().padStart(2, '0');

  if (entero === 0) return `CERO PESOS ${centavosStr}/100 M.N.`;
  if (entero === 100) return `CIEN PESOS ${centavosStr}/100 M.N.`;

  function convertirGrupo(n: number): string {
    let res = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    const du = n % 100;

    if (c > 0) {
      if (c === 1 && du === 0) res += 'CIEN ';
      else res += centenas[c] + ' ';
    }

    if (du >= 11 && du <= 29 && especiales[du]) {
      res += especiales[du] + ' ';
      return res.trim();
    }

    if (d > 0) {
      if (d === 1 && u === 0) res += 'DIEZ ';
      else if (d === 2 && u === 0) res += 'VEINTE ';
      else {
        res += decenas[d] + (u > 0 ? ' Y ' : ' ');
      }
    }

    if (u > 0 && !(du >= 11 && du <= 29)) {
      res += unidades[u] + ' ';
    }

    return res.trim();
  }

  let letras = '';
  if (entero >= 1000) {
    const miles = Math.floor(entero / 1000);
    const resto = entero % 1000;
    if (miles === 1) letras += 'MIL ';
    else letras += convertirGrupo(miles) + ' MIL ';
    if (resto > 0) letras += convertirGrupo(resto) + ' ';
  } else {
    letras = convertirGrupo(entero) + ' ';
  }

  return `${letras.trim()} PESOS ${centavosStr}/100 M.N.`;
}

export default function InvoicePdfModal({
  isOpen,
  onClose,
  order,
  initialMode = 'INVOICE',
}: InvoicePdfModalProps) {
  const [docMode, setDocMode] = useState<'INVOICE' | 'RECEIPT'>(initialMode);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(order.createdAt).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = new Date(order.createdAt).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const subtotal = order.subtotal || 0;
  const discount = order.discountAmount || 0;
  const tax = order.tax || 0;
  const tip = order.tip || 0;
  const total = order.total || (subtotal + tax + tip);
  const wordsAmount = numberToSpanishWords(total);

  // Simulated UUID / Folio Fiscal for demo compliance
  const simulatedUUID = `${order.id.slice(0, 8)}-${order.id.slice(9, 13)}-4a8b-91ef-${order.id.slice(24)}`.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Print specific CSS styles to render professional A4 / Letter document */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print-container,
          #invoice-print-container * {
            visibility: visible;
          }
          #invoice-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20mm !important;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 11pt;
          }
          @page {
            size: letter portrait;
            margin: 0;
          }
        }
      `}</style>

      {/* Main Modal Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden print:max-h-none print:border-none print:shadow-none print:bg-white">
        
        {/* Header Bar (Controls hidden in print) */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">
                Exportar Comprobante / Factura Digital (PDF)
              </h3>
              <p className="text-xs text-slate-400">
                Orden {order.orderNumber} • {order.customerName || 'Venta General'}
              </p>
            </div>
          </div>

          {/* Type switcher and actions */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
              <button
                onClick={() => setDocMode('INVOICE')}
                className={`px-3 py-1 rounded font-bold transition-all ${
                  docMode === 'INVOICE' 
                    ? 'bg-brand-primary text-slate-950 shadow' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Factura Fiscal (CFDI)
              </button>
              <button
                onClick={() => setDocMode('RECEIPT')}
                className={`px-3 py-1 rounded font-bold transition-all ${
                  docMode === 'RECEIPT' 
                    ? 'bg-brand-primary text-slate-950 shadow' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Nota de Venta
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Descargar / Imprimir</span> PDF
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950/40 flex justify-center print:p-0 print:overflow-visible">
          {/* Printable Sheet (Letter/A4 Canvas) */}
          <div
            id="invoice-print-container"
            className="w-full max-w-[800px] bg-white text-slate-900 rounded-xl shadow-2xl p-8 sm:p-12 space-y-6 print:rounded-none print:shadow-none print:p-0"
          >
            {/* Header: Brand and Invoice Meta */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  {order.brand?.logoUrl ? (
                    <img
                      src={order.brand.logoUrl}
                      alt={order.brand.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-300"
                    />
                  ) : (
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-slate-950 text-xl shadow"
                      style={{ backgroundColor: order.brand?.primaryColor || '#E2E8F0' }}
                    >
                      DF
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">
                      {order.brand?.name || 'DARKFLOW GOURMET'}
                    </h1>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      Cocina Central & Restaurante Multi-Marca
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-0.5 pt-2">
                  <p><strong>Razón Social:</strong> OPERADORA DARKFLOW KITCHENS S.A. DE C.V.</p>
                  <p><strong>R.F.C.:</strong> DFK190822ABC • <strong>Régimen:</strong> 601 - General de Ley Personas Morales</p>
                  <p><strong>Dirección:</strong> Av. Gastronómica 500, Roma Norte, Cuauhtémoc, CDMX, C.P. 06700</p>
                  <p><strong>Lugar de Expedición:</strong> 06700, Ciudad de México</p>
                </div>
              </div>

              {/* Right Side: Invoice Tag and Folio */}
              <div className="sm:text-right space-y-1">
                <div className="inline-block px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-wider">
                  {docMode === 'INVOICE' ? 'FACTURA ELECTRÓNICA' : 'COMPROBANTE DE VENTA'}
                </div>
                <p className="text-xl font-mono font-black text-slate-950">
                  {order.orderNumber}
                </p>
                {docMode === 'INVOICE' && (
                  <div className="text-[11px] text-slate-600 font-mono space-y-0.5">
                    <p><strong>FOLIO FISCAL (UUID):</strong></p>
                    <p className="text-[10px] text-slate-800 break-all">{simulatedUUID}</p>
                    <p><strong>No. Serie CSD:</strong> 00001000000508492011</p>
                  </div>
                )}
                <p className="text-xs text-slate-600 pt-1">
                  <strong>Fecha de Emisión:</strong> {formattedDate}, {formattedTime}
                </p>
                <p className="text-xs text-slate-600">
                  <strong>Canal de Venta:</strong> {order.source} {order.table ? `(${order.table.name})` : ''}
                </p>
                {order.externalOrderId && (
                  <p className="text-xs text-emerald-700 font-bold font-mono">
                    ID Externo App: {order.externalOrderId}
                  </p>
                )}
              </div>
            </div>

            {/* Receptor / Customer Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  DATOS DEL RECEPTOR / CLIENTE
                </span>
                <p className="text-sm font-bold text-slate-900">{order.customerName || 'PÚBLICO EN GENERAL'}</p>
                <p className="text-slate-600 mt-0.5"><strong>R.F.C.:</strong> XAXX010101000</p>
                <p className="text-slate-600"><strong>Uso de CFDI:</strong> G03 - Gastos en general / S01 - Sin efectos</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  CONDICIONES COMERCIALES
                </span>
                <p className="text-slate-700"><strong>Método de Pago:</strong> PUE - Pago en una sola exhibición</p>
                <p className="text-slate-700"><strong>Forma de Pago:</strong> 01 - Efectivo / 04 - Tarjeta / 31 - Apps</p>
                <p className="text-slate-700"><strong>Moneda:</strong> MXN - Peso Mexicano</p>
                {order.customerAddress && (
                  <p className="text-slate-600 truncate mt-1"><strong>Dirección:</strong> {order.customerAddress}</p>
                )}
              </div>
            </div>

            {/* Concepts Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-[11px] font-black uppercase text-slate-900">
                    <th className="py-2.5 px-2">CANT</th>
                    <th className="py-2.5 px-2">CLAVE PROD</th>
                    <th className="py-2.5 px-3">DESCRIPCIÓN</th>
                    <th className="py-2.5 px-2 text-right">P. UNITARIO</th>
                    <th className="py-2.5 px-3 text-right">IMPORTE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.items.map((item, idx) => {
                    const price = item.price || 0;
                    const rowTotal = price * item.quantity;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-2 font-bold font-mono">{item.quantity}</td>
                        <td className="py-3 px-2 text-slate-500 font-mono">90101501</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 uppercase block">{item.product.name}</span>
                          {item.notes && (
                            <span className="text-[10px] text-slate-500 italic block mt-0.5">
                              * {item.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-700">
                          ${price.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ${rowTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Amount in Words */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t-2 border-slate-900">
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    CANTIDAD CON LETRA
                  </span>
                  <p className="text-xs font-bold text-slate-800 italic uppercase mt-1">
                    {wordsAmount}
                  </p>
                </div>

                {order.notes && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                    <strong>Observaciones:</strong> {order.notes}
                  </div>
                )}
              </div>

              {/* Totals Table */}
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between py-0.5">
                  <span>Subtotal Bruto:</span>
                  <span className="font-mono font-semibold">${subtotal.toFixed(2)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between py-0.5 text-red-600 font-bold">
                    <span>
                      Descuento {order.couponCode ? `[Cupón: ${order.couponCode}]` : 'Comercial'}:
                    </span>
                    <span className="font-mono">-${discount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between py-0.5 text-slate-600">
                  <span>I.V.A. Trasladado (Tasa 16%):</span>
                  <span className="font-mono">${tax.toFixed(2)}</span>
                </div>

                {tip > 0 && (
                  <div className="flex justify-between py-0.5 text-slate-600">
                    <span>Propina Voluntaria:</span>
                    <span className="font-mono">${tip.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-baseline pt-2 border-t-2 border-slate-900 text-slate-950 font-black text-base">
                  <span>TOTAL A PAGAR:</span>
                  <span className="text-xl font-mono">${total.toFixed(2)} MXN</span>
                </div>
              </div>
            </div>

            {/* Digital Seals, QR Code and Footer (For Invoice Mode) */}
            {docMode === 'INVOICE' && (
              <div className="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                {/* QR Code Graphic (Vector SVG representation) */}
                <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="w-24 h-24 bg-white border border-slate-300 p-1 flex items-center justify-center rounded">
                    <QrCode className="w-20 h-20 text-slate-900" />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 mt-1">Verificación SAT</span>
                </div>

                {/* Digital Stamps */}
                <div className="sm:col-span-3 text-[9px] font-mono text-slate-500 space-y-1.5 leading-tight overflow-hidden">
                  <div>
                    <p className="font-bold text-slate-700">SELLO DIGITAL DEL EMISOR:</p>
                    <p className="truncate text-slate-600">
                      kX9qP2bW4rT7yU8iO1pA3sD5fG6hJ7kL9zX8cV7bN5mQ2wE4rT6yU8iO1pA3sD5fG7hJ8kL0zX==
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">SELLO DIGITAL DEL SAT:</p>
                    <p className="truncate text-slate-600">
                      vB6nM8kL0zX9qP2bW4rT7yU8iO1pA3sD5fG6hJ7kL9zX8cV7bN5mQ2wE4rT6yU8iO1pA3sD5fG==
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">CADENA ORIGINAL DEL COMPLEMENTO DE CERTIFICACIÓN DIGITAL DEL SAT:</p>
                    <p className="truncate text-slate-600">
                      ||1.1|{simulatedUUID}|{new Date().toISOString()}|DFK190822ABC|kX9qP2bW4rT7yU8iO1pA3sD5fG6hJ7kL==|00001000000508492011||
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-500 space-y-0.5">
              <p className="font-bold text-slate-700">Este documento es una representación impresa de un comprobante digital.</p>
              <p>Generado automáticamente por el ecosistema DarkFlow Kitchen Management • Soporte: contacto@darkflow.app</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
