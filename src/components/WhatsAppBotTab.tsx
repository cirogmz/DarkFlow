'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Bot,
  Send,
  Sparkles,
  FileText,
  FileCode,
  CheckCheck,
  Phone,
  RefreshCw,
  Copy,
  Check,
  Download,
  AlertCircle,
  Clock,
  Settings,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface WhatsAppBotTabProps {
  brandId: string;
}

interface ChatMessage {
  id: string;
  sender: 'CUSTOMER' | 'BOT';
  text: string;
  time: string;
  invoiceId?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  orderNumber?: string;
  trackingUrl?: string;
}

interface InvoiceRequestItem {
  id: string;
  customerPhone: string;
  ticketNumber: string;
  rfc: string;
  taxName: string;
  taxZipCode: string;
  fiscalRegime: string;
  cfdiUse: string;
  status: string;
  createdAt: string;
  invoice?: {
    id: string;
    uuid: string;
    folio: number;
    serie: string;
    total: number;
    status: string;
  } | null;
}

export default function WhatsAppBotTab({ brandId }: WhatsAppBotTabProps) {
  const [subTab, setSubTab] = useState<'SIMULATOR' | 'INVOICES' | 'SETTINGS'>('SIMULATOR');
  const [loading, setLoading] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Settings state
  const [botEnabled, setBotEnabled] = useState(true);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('darkflow_whatsapp_webhook_2026');
  const [welcomeMsg, setWelcomeMsg] = useState(
    '¡Hola! 👋 Bienvenido al Asistente Virtual. Puedo ayudarte a: 📄 Facturar tu ticket en 1 minuto, 🛵 Rastrear tu pedido, o 📋 Consultar nuestro menú digital. ¿En qué puedo apoyarte hoy?'
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Solicitudes recibidas
  const [invoiceRequests, setInvoiceRequests] = useState<InvoiceRequestItem[]>([]);

  // Simulador de Chat
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'BOT',
      text: '¡Hola! 👋 Bienvenido al Asistente Virtual de Facturación y Pedidos. Puedo timbrar tu factura CFDI 4.0 en 10 segundos o decirte el estatus de tu orden. ¿Cómo te ayudo hoy?',
      time: '12:00 PM',
    },
  ]);
  const [simulating, setSimulating] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const fetchSettingsAndRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, convsRes] = await Promise.all([
        fetch(`/api/whatsapp/settings?brandId=${brandId}`),
        fetch(`/api/whatsapp/conversations?brandId=${brandId}`),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.settings) {
          setBotEnabled(data.settings.whatsappBotEnabled ?? true);
          setPhoneNumberId(data.settings.whatsappPhoneNumberId || '');
          setAccessToken(data.settings.whatsappAccessToken || '');
          setVerifyToken(data.settings.whatsappWebhookVerifyToken || 'darkflow_whatsapp_webhook_2026');
          if (data.settings.whatsappWelcomeMsg) {
            setWelcomeMsg(data.settings.whatsappWelcomeMsg);
          }
        }
      }

      if (convsRes.ok) {
        const data = await convsRes.json();
        setInvoiceRequests(data.invoiceRequests || []);
      }
    } catch (e) {
      console.error('Error al cargar datos de WhatsApp:', e);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    fetchSettingsAndRequests();
  }, [fetchSettingsAndRequests]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/whatsapp/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          whatsappBotEnabled: botEnabled,
          whatsappPhoneNumberId: phoneNumberId,
          whatsappAccessToken: accessToken,
          whatsappWebhookVerifyToken: verifyToken,
          whatsappWelcomeMsg: welcomeMsg,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      alert('Error al guardar configuración');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendSimulatorMessage = async (customText?: string) => {
    const textToSend = customText || chatInput;
    if (!textToSend.trim() || simulating) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'CUSTOMER',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setSimulating(true);

    try {
      const res = await fetch('/api/whatsapp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          content: textToSend,
          customerPhone: '5215599887766',
          customerName: 'Comensal en Chat',
        }),
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'BOT',
          text: data.reply.replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          invoiceId: data.reply.invoiceId,
          pdfUrl: data.reply.pdfUrl,
          xmlUrl: data.reply.xmlUrl,
          orderNumber: data.reply.orderNumber,
          trackingUrl: data.reply.trackingUrl,
        };
        setChatMessages((prev) => [...prev, botMsg]);
        fetchSettingsAndRequests();
      } else {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'BOT',
          text: `⚠️ Hubo un error al procesar tu solicitud: ${data.error || 'Intenta de nuevo.'}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'BOT',
        text: '⚠️ Error de conexión al comunicarse con el bot.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSimulating(false);
    }
  };

  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/whatsapp`;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <MessageSquare className="w-6 h-6 animate-pulse" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">WhatsApp Bot de Facturación & Pedidos</h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                    botEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    <Sparkles className="w-3 h-3" /> {botEnabled ? 'Bot Activo' : 'Pausado'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Emisión automática de facturas CFDI 4.0 al recibir foto de ticket o folio, y rastreo de entregas en 1 clic
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSettingsAndRequests}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
              title="Refrescar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setSubTab('SIMULATOR')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            subTab === 'SIMULATOR'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Simulador de Chat en Vivo</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('INVOICES')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            subTab === 'INVOICES'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Facturas Emitidas por Bot ({invoiceRequests.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('SETTINGS')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            subTab === 'SETTINGS'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Credenciales & Webhook</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: SIMULADOR DE CHAT EN VIVO                                 */}
      {/* ===================================================================== */}
      {subTab === 'SIMULATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Columna Izquierda: Celular WhatsApp Interactivo */}
          <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[620px]">
            {/* Header WhatsApp Bar */}
            <div className="bg-emerald-900/40 border-b border-emerald-800/40 px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold">
                  🤖
                </div>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                    DarkFlow Virtual Bot
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </h4>
                  <p className="text-[10px] text-emerald-300/80 font-mono">En línea • Facturación CFDI 4.0</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Phone className="w-4 h-4" />
                <span className="font-mono text-[11px]">+52 1 55 9876 5432</span>
              </div>
            </div>

            {/* Chat Body */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] bg-slate-950/90"
            >
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'CUSTOMER' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-md space-y-2 ${
                      msg.sender === 'CUSTOMER'
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                    {/* Botones de Descarga en Burbuja si se emitió Factura */}
                    {msg.invoiceId && (
                      <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
                        {msg.pdfUrl && (
                          <a
                            href={msg.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-[11px] flex items-center gap-1.5 transition"
                          >
                            <FileText className="w-3.5 h-3.5 text-rose-400" />
                            <span>Descargar PDF</span>
                          </a>
                        )}
                        {msg.xmlUrl && (
                          <a
                            href={msg.xmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-bold text-[11px] flex items-center gap-1.5 transition"
                          >
                            <FileCode className="w-3.5 h-3.5 text-sky-400" />
                            <span>Descargar XML</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Botón de Rastreo si aplica */}
                    {msg.trackingUrl && (
                      <div className="pt-1.5">
                        <a
                          href={msg.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-bold text-[11px] inline-flex items-center gap-1.5 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Ver Mapa en Vivo</span>
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400">
                      <span>{msg.time}</span>
                      {msg.sender === 'CUSTOMER' && <CheckCheck className="w-3.5 h-3.5 text-sky-300" />}
                    </div>
                  </div>
                </div>
              ))}

              {simulating && (
                <div className="flex items-start">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none px-4 py-2 text-xs text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>El Asistente está escribiendo y consultando el SAT...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendSimulatorMessage();
              }}
              className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                placeholder="Escribe un mensaje de prueba (ej. 'Quiero facturar ticket ORD-1001')..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || simulating}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </form>
          </div>

          {/* Columna Derecha: Pruebas Rápidas en 1-Clic */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" /> Pruebas Rápidas de Facturación
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Haz clic en cualquier escenario para simular un mensaje de WhatsApp entrante y ver la respuesta instantánea del bot:
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    handleSendSimulatorMessage(
                      'Hola, quiero facturar mi ticket ORD-1001. RFC: XAXX010101000 Nombre: PUBLICO EN GENERAL CP: 06700 Regimen: 601 Uso: G03 Correo: cliente@gmail.com'
                    )
                  }
                  className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 transition group cursor-pointer"
                >
                  <span className="text-xs font-bold text-emerald-300 block mb-0.5 group-hover:text-emerald-200">
                    ⚡ Facturación Completa en 1 Paso
                  </span>
                  <span className="text-[10px] text-slate-400 line-clamp-2">
                    Envía ticket + RFC + Nombre + CP + Régimen y timbra de inmediato.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendSimulatorMessage('Quiero facturar el ticket ORD-1001')}
                  className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 transition group cursor-pointer"
                >
                  <span className="text-xs font-bold text-sky-300 block mb-0.5 group-hover:text-sky-200">
                    🧾 Consulta de Ticket (Paso 1)
                  </span>
                  <span className="text-[10px] text-slate-400 line-clamp-2">
                    Solo envía el folio; el bot verifica la orden y devuelve la plantilla de datos fiscales.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendSimulatorMessage('¿Cuál es el estatus de mi pedido ORD-1001?')}
                  className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 transition group cursor-pointer"
                >
                  <span className="text-xs font-bold text-amber-300 block mb-0.5 group-hover:text-amber-200">
                    🛵 Rastreo de Pedido en Vivo
                  </span>
                  <span className="text-[10px] text-slate-400 line-clamp-2">
                    Consulta estado en cocina o en camino con enlace directo al mapa GPS.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendSimulatorMessage('Hola, ¿me pueden pasar el menú y las promociones?')}
                  className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 transition group cursor-pointer"
                >
                  <span className="text-xs font-bold text-rose-300 block mb-0.5 group-hover:text-rose-200">
                    📋 Menú Digital & Promociones
                  </span>
                  <span className="text-[10px] text-slate-400 line-clamp-2">
                    Envía el enlace público al Menú QR de la marca y combos disponibles.
                  </span>
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 space-y-2">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Validez Fiscal SAT 4.0
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Todas las facturas emitidas por el bot generan sellos criptográficos SHA-256 oficiales, nodo de Timbre Fiscal Digital y archivos XML/PDF descargables al instante.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: FACTURAS EMITIDAS POR EL BOT                               */}
      {/* ===================================================================== */}
      {subTab === 'INVOICES' && (
        <div className="space-y-4">
          {invoiceRequests.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white">No hay facturas solicitadas por WhatsApp aún</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Prueba el simulador de chat en vivo para emitir tu primera factura desde WhatsApp.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Ticket / Teléfono</th>
                      <th className="p-3.5">RFC & Razón Social</th>
                      <th className="p-3.5">C.P. / Régimen</th>
                      <th className="p-3.5">Folio / UUID</th>
                      <th className="p-3.5">Total</th>
                      <th className="p-3.5 text-right">Descargas SAT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {invoiceRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5">
                          <span className="font-bold text-white block">#{req.ticketNumber}</span>
                          <span className="text-[11px] text-slate-400 font-mono">{req.customerPhone}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono text-emerald-400 font-bold block">{req.rfc}</span>
                          <span className="text-slate-300 truncate max-w-[180px] block" title={req.taxName}>
                            {req.taxName}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="text-slate-300 font-mono block">CP: {req.taxZipCode}</span>
                          <span className="text-[10px] text-slate-500 font-mono">Rég: {req.fiscalRegime}</span>
                        </td>
                        <td className="p-3.5">
                          {req.invoice ? (
                            <>
                              <span className="font-mono text-white font-bold block">
                                {req.invoice.serie}-{req.invoice.folio}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px] block" title={req.invoice.uuid}>
                                {req.invoice.uuid.slice(0, 13)}...
                              </span>
                            </>
                          ) : (
                            <span className="text-amber-400 font-semibold text-[11px]">Pendiente</span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-white">
                          {req.invoice ? `$${req.invoice.total.toFixed(2)}` : '—'}
                        </td>
                        <td className="p-3.5 text-right">
                          {req.invoice ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`/api/invoices/${req.invoice.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                                title="Descargar PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`/api/invoices/${req.invoice.id}/xml`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition"
                                title="Descargar XML"
                              >
                                <FileCode className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: CONFIGURACIÓN & WEBHOOK META CLOUD API                    */}
      {/* ===================================================================== */}
      {subTab === 'SETTINGS' && (
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white">Configuración de WhatsApp Cloud API</h3>
              <p className="text-xs text-slate-400">
                Parámetros de conexión con la API oficial de Meta y webhook entrante
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={botEnabled}
                onChange={(e) => setBotEnabled(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
              <span className="text-xs font-bold text-slate-300">Activar Bot</span>
            </label>
          </div>

          <div className="space-y-4">
            {/* URL del Webhook */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                URL del Webhook (Configura esta URL en el Meta Developer Portal)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                >
                  {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWebhook ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Token de Verificación */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Verify Token de Meta (hub.verify_token)
              </label>
              <input
                type="text"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500"
              />
            </div>

            {/* Phone Number ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Phone Number ID (Meta WhatsApp Business Account)
              </label>
              <input
                type="text"
                placeholder="ej. 109876543210987"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500"
              />
            </div>

            {/* Access Token */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                System User Permanent Access Token
              </label>
              <input
                type="password"
                placeholder="EAA..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500"
              />
            </div>

            {/* Mensaje de Bienvenida */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Plantilla del Mensaje de Bienvenida
              </label>
              <textarea
                rows={3}
                value={welcomeMsg}
                onChange={(e) => setWelcomeMsg(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-emerald-500 leading-relaxed"
              />
              <span className="text-[10px] text-slate-500">
                Usa <code className="text-emerald-400">{'{{brandName}}'}</code> para insertar el nombre de la marca.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {saveSuccess ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Configuración guardada exitosamente
              </span>
            ) : (
              <span className="text-xs text-slate-500">Los cambios aplican de inmediato en producción.</span>
            )}

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{savingSettings ? 'Guardando...' : 'Guardar Configuración'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

