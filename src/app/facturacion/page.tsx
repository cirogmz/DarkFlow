'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Building2, 
  ArrowLeft,
  ExternalLink,
  Receipt,
  QrCode
} from 'lucide-react';
import { TAX_REGIMES, CFDI_USAGES, validateRfc } from '@/lib/cfdi';

interface OrderInfo {
  id: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  tax: number;
  itemsCount?: number;
  createdAt: string;
  brand?: {
    name: string;
    logoUrl?: string | null;
  };
}

interface StampedInvoice {
  id: string;
  uuid: string;
  serie: string;
  folio: number;
  rfcReceptor: string;
  nombreReceptor: string;
  total: number;
  iva: number;
  subtotal: number;
  fechaTimbrado: string;
  selloSat: string;
  qrSatUrl: string;
}

export default function FacturacionPublicaPage() {
  const [step, setStep] = useState<'lookup' | 'form' | 'success'>('lookup');
  const [orderNumber, setOrderNumber] = useState('');
  const [ticketTotal, setTicketTotal] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [invoice, setInvoice] = useState<StampedInvoice | null>(null);

  // Fiscal form fields
  const [rfc, setRfc] = useState('');
  const [nombre, setNombre] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [regimenFiscal, setRegimenFiscal] = useState('601');
  const [usoCfdi, setUsoCfdi] = useState('G03');
  const [email, setEmail] = useState('');

  // 1. Handle Ticket Lookup
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!orderNumber || !ticketTotal) return;

    setLoading(true);
    try {
      const res = await fetch('/api/public/invoicing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup',
          orderNumber: orderNumber.trim(),
          total: parseFloat(ticketTotal),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'No se pudo localizar el ticket.');
        return;
      }

      setOrder(data.order);

      if (data.alreadyInvoiced && data.invoice) {
        setInvoice(data.invoice);
        setStep('success');
      } else {
        setStep('form');
      }
    } catch {
      setErrorMsg('Error de conexión al consultar el ticket.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Issue CFDI
  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!validateRfc(rfc)) {
      setErrorMsg('El RFC ingresado no tiene una estructura válida según las normas del SAT.');
      return;
    }

    if (!codigoPostal || codigoPostal.length !== 5) {
      setErrorMsg('El Código Postal fiscal debe constar exactamente de 5 dígitos.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/public/invoicing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'issue',
          orderNumber: orderNumber.trim(),
          total: parseFloat(ticketTotal),
          rfcReceptor: rfc.trim().toUpperCase(),
          nombreReceptor: nombre.trim().toUpperCase(),
          codigoPostalReceptor: codigoPostal.trim(),
          regimenFiscalReceptor: regimenFiscal,
          usoCfdi,
          emailReceptor: email.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Error al timbrar la factura fiscal.');
        return;
      }

      setInvoice(data.invoice);
      setStep('success');
    } catch {
      setErrorMsg('Error de conexión al emitir el CFDI.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Download XML
  const handleDownloadXml = () => {
    if (!invoice) return;
    window.open(`/api/invoices/${invoice.id}?format=xml`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-brand-primary selection:text-slate-950">
      {/* Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-primary font-black">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Portal de Auto-Facturación CFDI 4.0</h1>
              <p className="text-xs text-slate-400">Emisión digital oficial de comprobantes fiscales para comensales</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex text-[11px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-full items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" /> Sistema SAT 4.0 Vigente
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {/* STEP 1: TICKET LOOKUP */}
        {step === 'lookup' && (
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center mx-auto mb-2">
                <Receipt className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Consulta y Factura tu Consumo</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Ingresa los datos impresos al final de tu comanda o ticket térmico de compra para generar tu CFDI al instante.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Número de Folio / Comanda *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Ej. ORD-0012 o 1045"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-brand-primary focus:outline-none uppercase font-mono tracking-wider pl-10"
                  />
                  <Search className="h-4 w-4 text-slate-500 absolute left-3.5 top-3.5" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Ubicado en el encabezado de tu ticket.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Importe Total del Ticket ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={ticketTotal}
                  onChange={(e) => setTicketTotal(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-brand-primary focus:outline-none font-bold"
                />
                <p className="text-[11px] text-slate-500 mt-1">Total exacto pagado con centavos.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    Buscando comanda...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 stroke-[3px]" /> Continuar a Datos Fiscales
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: FISCAL DATA FORM */}
        {step === 'form' && order && (
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <button
                type="button"
                onClick={() => setStep('lookup')}
                className="text-slate-400 hover:text-white flex items-center gap-1 text-xs cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Cambiar ticket
              </button>
              <span className="text-xs font-mono text-brand-primary font-bold">Folio: {order.orderNumber}</span>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <div>
                <p className="text-slate-400 font-medium">Consumo en {order.brand?.name || 'Restaurante'}:</p>
                <p className="text-white font-bold text-sm mt-0.5">Subtotal: ${order.subtotal.toFixed(2)} | IVA (16%): ${order.tax.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400">Total a Facturar</p>
                <p className="text-lg font-black text-emerald-400">${order.total.toFixed(2)}</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleIssue} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">RFC del Receptor *</label>
                  <input
                    type="text"
                    required
                    placeholder="XAXX010101000"
                    maxLength={13}
                    value={rfc}
                    onChange={(e) => setRfc(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Código Postal Fiscal *</label>
                  <input
                    type="text"
                    required
                    placeholder="06000"
                    maxLength={5}
                    value={codigoPostal}
                    onChange={(e) => setCodigoPostal(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre o Razón Social (sin régimen societario) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="TAL COMO APARECE EN CONSTANCIA FISCAL"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Régimen Fiscal SAT *</label>
                <select
                  value={regimenFiscal}
                  onChange={(e) => setRegimenFiscal(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-brand-primary focus:outline-none"
                >
                  {TAX_REGIMES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Uso de CFDI *</label>
                <select
                  value={usoCfdi}
                  onChange={(e) => setUsoCfdi(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-brand-primary focus:outline-none"
                >
                  {CFDI_USAGES.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Correo Electrónico (Envío de XML y PDF)</label>
                <input
                  type="email"
                  placeholder="ejemplo@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    Timbrando ante el SAT...
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4" /> Generar y Timbrar Factura CFDI 4.0
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: SUCCESS & DOWNLOADS */}
        {step === 'success' && invoice && (
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white">¡Factura Timbrada con Éxito!</h2>
              <p className="text-xs text-slate-400 mt-1">
                Tu comprobante fiscal digital por internet (CFDI 4.0) ha sido generado y sellado satisfactoriamente.
              </p>
            </div>

            {/* Fiscal Summary Card */}
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Serie y Folio:</span>
                <span className="font-bold text-white font-mono">{invoice.serie}-{invoice.folio}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Folio Fiscal (UUID):</span>
                <span className="font-mono text-brand-primary text-[11px] font-bold break-all">{invoice.uuid}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Receptor RFC:</span>
                <span className="font-bold text-white font-mono">{invoice.rfcReceptor}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Total Facturado:</span>
                <span className="font-black text-emerald-400 text-sm">${invoice.total.toFixed(2)} MXN</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleDownloadXml}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-700"
              >
                <Download className="h-4 w-4 text-brand-primary" /> Descargar XML (.xml)
              </button>
              <button
                onClick={() => window.print()}
                className="py-3 px-4 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg"
              >
                <FileText className="h-4 w-4" /> Imprimir / Guardar PDF
              </button>
            </div>

            <div className="pt-3">
              <a
                href={invoice.qrSatUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors underline"
              >
                <QrCode className="h-3.5 w-3.5" /> Verificar autenticidad en el Portal del SAT
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setStep('lookup');
                  setOrderNumber('');
                  setTicketTotal('');
                  setOrder(null);
                  setInvoice(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                Facturar otro ticket
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-600">
        DarkFlow Manager &copy; {new Date().getFullYear()} — Servicio de Facturación Electrónica CFDI 4.0
      </footer>
    </div>
  );
}
