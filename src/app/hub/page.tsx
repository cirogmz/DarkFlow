'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  Flame, 
  RotateCw, 
  AlertTriangle, 
  Coins, 
  Share2, 
  Store, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Copy, 
  Check, 
  PhoneCall, 
  ExternalLink,
  Power,
  ShieldAlert,
  CreditCard,
  Wallet,
  Building2,
  ChevronRight,
  X
} from 'lucide-react';
import Link from 'next/link';

interface BrandTelemetry {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  isActive: boolean;
  salesToday: number;
  ordersCount: number;
  ticketAverage: number;
  activeOrdersCount: number;
}

interface ActiveOrderRow {
  id: string;
  orderNumber: string;
  brandName: string;
  total: number;
  status: string;
  source: string;
  tableName?: string | null;
  minutesElapsed: number;
}

interface HubData {
  timestamp: string;
  livePulse: {
    totalSalesToday: number;
    ordersCountToday: number;
    ticketAverageToday: number;
    totalSalesYesterday: number;
    growthVsYesterdayPct: number;
    activeOrdersCount: number;
  };
  paymentBreakdown: {
    cashSales: number;
    cardSales: number;
    appsSales: number;
    giftCardSales: number;
    otherSales: number;
  };
  brandsTelemetry: BrandTelemetry[];
  activeOrders: ActiveOrderRow[];
  vaultPulse: {
    openSessionsCount: number;
    openSessions: Array<{
      id: string;
      brandName: string;
      cashierName: string;
      openingBalance: number;
      openedAt: string;
    }>;
    recentCuts: Array<{
      id: string;
      cutType: string;
      cutNumber: string;
      cashierName: string;
      brandName: string;
      totalSales: number;
      cashDifference: number;
      cutAt: string;
    }>;
    discrepanciesCount: number;
  };
  alerts: {
    pendingDetractors: Array<{
      id: string;
      orderNumber: string;
      brandName: string;
      overallRating: number;
      npsScore: number;
      customerName: string;
      customerPhone?: string | null;
      comment?: string | null;
      createdAt: string;
    }>;
    lowStockIngredients: Array<{
      id: string;
      name: string;
      brandName: string;
      stock: number;
      minStock: number;
      unit: string;
    }>;
    delayedOrders: Array<{
      id: string;
      orderNumber: string;
      brandName: string;
      total: number;
      minutesElapsed: number;
    }>;
    cashDiscrepanciesCount: number;
  };
  whatsappDigest: string;
}

export default function MobileOwnerHubPage() {
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'pulse' | 'brands' | 'alerts' | 'vault'>('pulse');
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [copiedDigest, setCopiedDigest] = useState(false);
  const [togglingBrandId, setTogglingBrandId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchHubData = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const res = await fetch(`/api/hub?brandId=${selectedBrandId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error loading Owner Hub telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBrandId]);

  useEffect(() => {
    fetchHubData();
    // Auto-refresh every 25 seconds for real-time operations
    const interval = setInterval(() => {
      fetchHubData(true);
    }, 25000);
    return () => clearInterval(interval);
  }, [fetchHubData]);

  const handleToggleBrand = async (brandId: string) => {
    setTogglingBrandId(brandId);
    try {
      const res = await fetch('/api/hub/toggle-brand', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      });
      if (res.ok) {
        await fetchHubData(true);
      } else {
        alert('No se pudo cambiar el estado de la marca');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setTogglingBrandId(null);
    }
  };

  const handleCopyDigest = () => {
    if (!data?.whatsappDigest) return;
    navigator.clipboard.writeText(data.whatsappDigest);
    setCopiedDigest(true);
    setTimeout(() => setCopiedDigest(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    if (!data?.whatsappDigest) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(data.whatsappDigest)}`;
    window.open(url, '_blank');
  };

  const totalAlertsCount = (data?.alerts.pendingDetractors.length || 0) +
    (data?.alerts.cashDiscrepanciesCount || 0) +
    (data?.alerts.delayedOrders.length || 0) +
    (data?.alerts.lowStockIngredients.length || 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-amber-400 animate-spin" />
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
          Sincronizando DarkFlow Owner Hub...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 select-none">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-900 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-black text-sm">
              DF
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black text-white tracking-wide">Owner Hub</h1>
                <span className="flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  EN VIVO
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchHubData(false)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition active:scale-95 disabled:opacity-50"
              title="Refrescar en vivo"
            >
              <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <button
              onClick={() => setWhatsappModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition active:scale-95"
              title="Compartir reporte por WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline text-[11px]">Reporte</span>
            </button>
          </div>
        </div>

        {/* Brand Selector Pill Bar */}
        <div className="max-w-md mx-auto mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedBrandId('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all ${
              selectedBrandId === 'ALL'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            ⭐ Todas ({data?.brandsTelemetry.length || 0})
          </button>
          {data?.brandsTelemetry.map((brand) => (
            <button
              key={brand.id}
              onClick={() => setSelectedBrandId(brand.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                selectedBrandId === brand.id
                  ? 'bg-white text-slate-950 shadow-md'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: brand.primaryColor || '#F59E0B' }}
              />
              <span>{brand.name}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* HERO CARD: Live Revenue */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="uppercase font-bold tracking-wider text-[10px]">Ventas de Hoy</span>
            <div className={`flex items-center gap-1 font-bold text-xs ${
              (data?.livePulse.growthVsYesterdayPct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {(data?.livePulse.growthVsYesterdayPct || 0) >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>{(data?.livePulse.growthVsYesterdayPct || 0) > 0 ? `+${data?.livePulse.growthVsYesterdayPct}%` : `${data?.livePulse.growthVsYesterdayPct ?? 0}%`} vs ayer</span>
            </div>
          </div>

          <div className="flex items-baseline gap-1 my-1">
            <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
              ${(data?.livePulse.totalSalesToday || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-amber-400 font-bold">MXN</span>
          </div>

          {/* Sub KPIs Row */}
          <div className="grid grid-cols-3 gap-2 pt-4 mt-3 border-t border-slate-800/80 text-center">
            <div className="bg-slate-950/50 rounded-2xl p-2.5 border border-slate-800/60">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Comandas</span>
              <span className="text-base font-black text-white font-mono mt-0.5 block">
                {data?.livePulse.ordersCountToday || 0}
              </span>
            </div>

            <div className="bg-slate-950/50 rounded-2xl p-2.5 border border-slate-800/60">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Ticket Prom</span>
              <span className="text-base font-black text-amber-400 font-mono mt-0.5 block">
                ${data?.livePulse.ticketAverageToday?.toFixed(0) || 0}
              </span>
            </div>

            <div className="bg-slate-950/50 rounded-2xl p-2.5 border border-slate-800/60">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">En Cocina</span>
              <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
                {data?.livePulse.activeOrdersCount || 0}
              </span>
            </div>
          </div>
        </div>

        {/* TAB 1: PULSE (LIVE REAL-TIME FEED) */}
        {activeTab === 'pulse' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Payment Methods Distribution */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  Ingresos por Canal Hoy
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">100% cobrado</span>
              </div>

              {/* Progress bar of channels */}
              {data && data.livePulse.totalSalesToday > 0 && (
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                  <div
                    style={{ width: `${(data.paymentBreakdown.cardSales / data.livePulse.totalSalesToday) * 100}%` }}
                    className="bg-indigo-500 h-full"
                    title="Tarjeta"
                  />
                  <div
                    style={{ width: `${(data.paymentBreakdown.cashSales / data.livePulse.totalSalesToday) * 100}%` }}
                    className="bg-emerald-500 h-full"
                    title="Efectivo"
                  />
                  <div
                    style={{ width: `${(data.paymentBreakdown.appsSales / data.livePulse.totalSalesToday) * 100}%` }}
                    className="bg-sky-500 h-full"
                    title="Apps Delivery"
                  />
                  <div
                    style={{ width: `${(data.paymentBreakdown.giftCardSales / data.livePulse.totalSalesToday) * 100}%` }}
                    className="bg-amber-500 h-full"
                    title="Monedero / Gift Card"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-400" /> Tarjeta
                  </span>
                  <span className="font-mono font-bold text-white">
                    ${data?.paymentBreakdown.cardSales.toFixed(0)}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" /> Efectivo
                  </span>
                  <span className="font-mono font-bold text-white">
                    ${data?.paymentBreakdown.cashSales.toFixed(0)}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" /> Apps Delivery
                  </span>
                  <span className="font-mono font-bold text-white">
                    ${data?.paymentBreakdown.appsSales.toFixed(0)}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-amber-400" /> Monedero VIP
                  </span>
                  <span className="font-mono font-bold text-white">
                    ${data?.paymentBreakdown.giftCardSales.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Active Kitchen Orders */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Comandas en Marcha ({data?.activeOrders.length || 0})
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Tiempo en espera</span>
              </div>

              {data?.activeOrders.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  ✓ No hay comandas pendientes de entrega en este momento.
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.activeOrders.map((o) => (
                    <div
                      key={o.id}
                      className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">#{o.orderNumber}</span>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                            {o.brandName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {o.tableName ? `Mesa ${o.tableName}` : o.source} • <strong className="font-mono text-slate-200">${o.total.toFixed(2)}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-lg text-xs ${
                          o.minutesElapsed >= 25
                            ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                            : o.minutesElapsed >= 15
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-slate-900 text-emerald-400 border border-slate-800'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {o.minutesElapsed}m
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: BRANDS TELEMETRY & PAUSE CONTROL */}
        {activeTab === 'brands' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Control Remoto de Cocinas</span>
              <span>{data?.brandsTelemetry.length} Marcas</span>
            </div>

            {data?.brandsTelemetry.map((brand) => (
              <div
                key={brand.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-slate-950 text-sm shadow-md"
                      style={{ backgroundColor: brand.primaryColor || '#F59E0B' }}
                    >
                      {brand.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{brand.name}</h4>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        brand.isActive
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {brand.isActive ? 'ACTIVA / EN SERVICIO' : 'PAUSADA'}
                      </span>
                    </div>
                  </div>

                  {/* Remote Toggle Switch */}
                  <button
                    onClick={() => handleToggleBrand(brand.id)}
                    disabled={togglingBrandId === brand.id}
                    className={`p-2.5 rounded-xl border transition active:scale-95 flex items-center gap-1.5 text-xs font-bold ${
                      brand.isActive
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    <span>{brand.isActive ? 'Pausar' : 'Activar'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Ventas Hoy</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      ${brand.salesToday.toLocaleString('es-MX')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Comandas</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {brand.ordersCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Ticket Prom</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      ${brand.ticketAverage.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: OWNER CRITICAL ALERTS */}
        {activeTab === 'alerts' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Incidentes y Alertas Gerenciales</span>
              <span className="font-bold text-amber-400">{totalAlertsCount} activas</span>
            </div>

            {totalAlertsCount === 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white text-sm">Operación 100% en Orden</h4>
                <p className="text-xs text-slate-400">
                  Sin descuadres de caja, quejas de clientes o materias primas agotadas el día de hoy.
                </p>
              </div>
            )}

            {/* Detractor surveys */}
            {data?.alerts.pendingDetractors && data.alerts.pendingDetractors.length > 0 && (
              <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Quejas de Comensales NPS ({data.alerts.pendingDetractors.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {data.alerts.pendingDetractors.map((d) => (
                    <div key={d.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-white">Orden #{d.orderNumber} - {d.brandName}</span>
                        <span className="text-amber-400 font-bold">{d.overallRating}★ | NPS {d.npsScore}/10</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        Comensal: <strong className="text-white">{d.customerName}</strong> {d.customerPhone ? `(${d.customerPhone})` : ''}
                      </p>
                      {d.comment && (
                        <p className="text-rose-300 italic text-[11px] bg-rose-950/20 p-1.5 rounded border border-rose-900/30">
                          &ldquo;{d.comment}&rdquo;
                        </p>
                      )}
                      {d.customerPhone && (
                        <div className="pt-1 flex gap-2">
                          <a
                            href={`tel:${d.customerPhone}`}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                          >
                            <PhoneCall className="w-3 h-3 text-emerald-400" /> Llamar Cliente
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delayed Orders */}
            {data?.alerts.delayedOrders && data.alerts.delayedOrders.length > 0 && (
              <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <Clock className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Comandas con Retraso SLA &gt;25 min ({data.alerts.delayedOrders.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {data.alerts.delayedOrders.map((o) => (
                    <div key={o.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-white font-mono">#{o.orderNumber}</span>
                        <p className="text-slate-400 text-[11px]">{o.brandName} • ${o.total.toFixed(2)}</p>
                      </div>
                      <span className="font-mono font-bold text-rose-400 bg-rose-950/80 border border-rose-800 px-2 py-0.5 rounded-lg text-xs">
                        {o.minutesElapsed} min
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low Stock Ingredients */}
            {data?.alerts.lowStockIngredients && data.alerts.lowStockIngredients.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Insumos Bajo Mínimo ({data.alerts.lowStockIngredients.length})
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {data.alerts.lowStockIngredients.map((i) => (
                    <div key={i.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="font-bold text-white truncate block">{i.name}</span>
                      <p className="text-[10px] text-slate-400">{i.brandName}</p>
                      <div className="mt-1 flex justify-between text-[11px]">
                        <span className="text-slate-500">Stock:</span>
                        <span className="font-mono font-bold text-rose-400">{i.stock} {i.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: VAULT & CASH PULSE */}
        {activeTab === 'vault' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                Cajas y Turnos Abiertos ({data?.vaultPulse.openSessionsCount || 0})
              </h3>

              {data?.vaultPulse.openSessions.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  No hay sesiones de caja abiertas actualmente.
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.vaultPulse.openSessions.map((s) => (
                    <div key={s.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-white">{s.cashierName}</span>
                        <p className="text-slate-400 text-[11px]">{s.brandName}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Fondo Inicial:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          ${s.openingBalance.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Cash Cuts */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                Últimos Cortes Realizados Hoy
              </h3>

              {data?.vaultPulse.recentCuts.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  Sin cortes de caja generados hoy.
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.vaultPulse.recentCuts.map((cut) => {
                    const hasDiff = Math.abs(cut.cashDifference) > 1;
                    return (
                      <div key={cut.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-white">{cut.cutNumber}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-300 font-bold">
                              {cut.cutType}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5">
                            {cut.cashierName} • {cut.brandName}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-bold text-white block">
                            ${cut.totalSales.toFixed(2)}
                          </span>
                          {hasDiff ? (
                            <span className="text-[10px] font-bold text-rose-400">
                              Dif: ${cut.cashDifference.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-bold">
                              ✓ Cuadrado
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FIXED BOTTOM NAVIGATION BAR FOR MOBILE PWA */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-2">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
          <button
            onClick={() => setActiveTab('pulse')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
              activeTab === 'pulse' ? 'text-amber-400 font-bold bg-amber-500/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Pulso</span>
          </button>

          <button
            onClick={() => setActiveTab('brands')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
              activeTab === 'brands' ? 'text-amber-400 font-bold bg-amber-500/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Store className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Marcas</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl relative transition ${
              activeTab === 'alerts' ? 'text-amber-400 font-bold bg-amber-500/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
            {totalAlertsCount > 0 && (
              <span className="absolute top-1 right-5 w-4 h-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center animate-pulse">
                {totalAlertsCount}
              </span>
            )}
            <span className="text-[10px] mt-0.5">Alertas</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
              activeTab === 'vault' ? 'text-amber-400 font-bold bg-amber-500/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Cajas</span>
          </button>
        </div>
      </nav>

      {/* WhatsApp Share Digest Modal */}
      {whatsappModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Reporte para Socios</h3>
                  <p className="text-[11px] text-slate-400">Listo para enviar por WhatsApp</p>
                </div>
              </div>
              <button
                onClick={() => setWhatsappModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-56 overflow-y-auto text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
              {data?.whatsappDigest}
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleOpenWhatsApp}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-500/20"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir en WhatsApp
              </button>

              <button
                onClick={handleCopyDigest}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                {copiedDigest ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedDigest ? '¡Copiado al Portapapeles!' : 'Copiar Texto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
