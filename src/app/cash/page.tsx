'use client';

import React, { useEffect, useState } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { 
  Coins, 
  Lock, 
  Unlock, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  FileText,
  AlertTriangle,
  CheckCircle2,
  Calendar
} from 'lucide-react';

interface CashSession {
  id: string;
  openedAt: string;
  closedAt?: string | null;
  openingBalance: number;
  closingBalance?: number | null;
  expectedBalance?: number | null;
  actualBalance?: number | null;
  status: string;
  cashSales: number;
  cardSales: number;
  appsSales: number;
  notes?: string | null;
  user: {
    name: string;
  };
}

interface Aggregates {
  cashSales: number;
  cardSales: number;
  appsSales: number;
  totalSales: number;
  expectedBalance: number;
}

export default function CashPage() {
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [pastSessions, setPastSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Opening drawer state
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  
  // Closing drawer state
  const [actualBalance, setActualBalance] = useState<number>(0);
  const [closeNotes, setCloseNotes] = useState('');

  useEffect(() => {
    fetchCashSessions();
  }, []);

  const fetchCashSessions = async () => {
    try {
      const res = await fetch('/api/cash');
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.activeSession);
        setAggregates(data.activeAggregates);
        setPastSessions(data.pastSessions);
        
        // Pre-fill closing amount with expected balance to be user friendly
        if (data.activeAggregates) {
          setActualBalance(data.activeAggregates.expectedBalance);
        }
      }
    } catch (e) {
      console.error('Failed to load cash sessions', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (openingBalance < 0) return;

    try {
      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          openingBalance,
        }),
      });

      if (res.ok) {
        setOpeningBalance(0);
        fetchCashSessions();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Error de red al abrir caja');
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualBalance < 0) return;

    if (!confirm('¿Estás seguro de cerrar el turno de caja actual? No podrás agregar más ventas a este turno.')) {
      return;
    }

    try {
      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          actualBalance,
          notes: closeNotes,
        }),
      });

      if (res.ok) {
        setCloseNotes('');
        fetchCashSessions();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Error de red al cerrar caja');
    }
  };

  const calculateDiscrepancy = () => {
    if (!aggregates) return 0;
    return actualBalance - aggregates.expectedBalance;
  };

  const discrepancy = calculateDiscrepancy();

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
          <Coins className="h-6 w-6 text-brand-primary" />
          <h2 className="text-xl font-bold text-white">Corte de Caja (Control de Efectivo)</h2>
        </div>

        {/* Active turn workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main action card (Open / Close) */}
          <div className="glass-panel border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            {!activeSession ? (
              // Case: No active turn open
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
                  <Unlock className="h-5 w-5 text-amber-500" />
                  <h4 className="font-bold text-white text-sm">Abrir Turno de Caja</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Para registrar ventas en efectivo, tarjetas o apps, es obligatorio iniciar un nuevo turno de caja indicando el saldo base (fondo de caja).
                </p>
                <form onSubmit={handleOpenSession} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Saldo Inicial de Apertura *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
                      <input
                        type="number"
                        required
                        step="0.01"
                        placeholder="100.00"
                        value={openingBalance || ''}
                        onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded py-2.5 pl-7 pr-4 text-slate-200 outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg cursor-pointer"
                  >
                    Iniciar Turno de Caja
                  </button>
                </form>
              </div>
            ) : (
              // Case: Active turn is open. Show closing form.
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
                  <Lock className="h-5 w-5 text-red-400" />
                  <h4 className="font-bold text-white text-sm">Cerrar Turno / Arqueo</h4>
                </div>
                
                <div className="text-xs text-slate-400 space-y-1">
                  <p><strong>Cajero:</strong> {activeSession.user.name}</p>
                  <p><strong>Apertura:</strong> {new Date(activeSession.openedAt).toLocaleTimeString()}</p>
                </div>

                <form onSubmit={handleCloseSession} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Efectivo Real en Caja ($) *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={actualBalance || ''}
                        onChange={(e) => setActualBalance(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded py-2.5 pl-7 pr-4 text-slate-200 outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Notas de Arqueo</label>
                    <textarea
                      placeholder="Sobró cambio de monedas, faltó $5 de propina, etc."
                      value={closeNotes}
                      rows={2}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 outline-none focus:border-brand-primary resize-none"
                    />
                  </div>

                  {discrepancy !== 0 && (
                    <div className={`p-3 border rounded-lg flex items-start gap-2 ${
                      discrepancy > 0 
                        ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400' 
                        : 'bg-red-950/20 border-red-900/50 text-red-400'
                    }`}>
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-[10px] uppercase">
                          {discrepancy > 0 ? 'Sobrante en Caja' : 'Faltante en Caja'}
                        </p>
                        <p className="font-semibold text-xs mt-0.5">Diferencia: ${discrepancy.toFixed(2)}</p>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-slate-950 font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    Confirmar Arqueo y Cerrar Caja
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Aggregated Sales summary card */}
          <div className="glass-panel border border-slate-800 rounded-xl p-5 shadow-lg lg:col-span-2 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white">Resumen de Caja Registradora</h4>
            </div>

            {activeSession && aggregates ? (
              <div className="space-y-4">
                {/* Financial breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Fund opening */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fondo Inicial</p>
                      <h5 className="font-black text-white text-base mt-0.5">${activeSession.openingBalance.toFixed(2)}</h5>
                    </div>
                    <Unlock className="h-5 w-5 text-slate-600" />
                  </div>

                  {/* Cash Sales */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ventas Efectivo</p>
                      <h5 className="font-black text-white text-base mt-0.5">${aggregates.cashSales.toFixed(2)}</h5>
                    </div>
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                  </div>

                  {/* Expected Balance */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Esperado en Caja</p>
                      <h5 className="font-black text-brand-primary text-base mt-0.5">${aggregates.expectedBalance.toFixed(2)}</h5>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-brand-primary" />
                  </div>
                </div>

                {/* Aggregated payment types */}
                <div className="space-y-2.5 pt-2 border-t border-slate-850 text-xs">
                  <h5 className="font-bold text-slate-300">Detalles de Venta (Otras formas de pago):</h5>
                  
                  <div className="flex justify-between items-center p-2.5 bg-slate-950/40 rounded border border-slate-850">
                    <span className="flex items-center gap-2 text-slate-400">
                      <CreditCard className="h-4 w-4 text-blue-400" /> Ventas Tarjetas (Sitio Web)
                    </span>
                    <span className="font-bold text-white">${aggregates.cardSales.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 bg-slate-950/40 rounded border border-slate-850">
                    <span className="flex items-center gap-2 text-slate-400">
                      <Smartphone className="h-4 w-4 text-amber-500" /> Ventas Apps (Uber/Rappi)
                    </span>
                    <span className="font-bold text-white">${aggregates.appsSales.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 bg-slate-900 rounded border border-slate-800 text-sm font-black pt-3 mt-3 border-t">
                    <span className="text-white">Facturación Total del Turno</span>
                    <span className="text-brand-primary">${aggregates.totalSales.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs py-12">
                No hay turno de caja abierto en este momento. Abre un turno a la izquierda.
              </div>
            )}
          </div>
        </div>

        {/* Past Closed Sessions History log */}
        <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-4">
          <div className="p-5 border-b border-slate-800 bg-slate-900/40">
            <h4 className="font-bold text-white text-base">Historial de Turnos Cerrados (Cortes de Caja)</h4>
            <p className="text-xs text-slate-500 mt-1">Registros consolidados de auditoría física de efectivo.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                  <th className="p-4">Turno</th>
                  <th className="p-4">Apertura / Cierre</th>
                  <th className="p-4">Fondo Inicial</th>
                  <th className="p-4">Venta Efectivo</th>
                  <th className="p-4">Cierre Real</th>
                  <th className="p-4">Discrepancia</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pastSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">No hay cortes de caja registrados en esta marca.</td>
                  </tr>
                ) : (
                  pastSessions.map((session) => {
                    const diff = (session.closingBalance || 0) - (session.expectedBalance || 0);
                    return (
                      <tr key={session.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="p-4 font-bold text-white flex flex-col">
                          <span>Cajero: {session.user.name}</span>
                          <span className="text-[10px] text-slate-500 font-normal mt-0.5 font-mono">ID: {session.id.slice(0, 8)}</span>
                        </td>
                        <td className="p-4 text-slate-300">
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-slate-500" /> {new Date(session.openedAt).toLocaleDateString()}</span>
                            <span className="text-[10px] text-slate-500">{new Date(session.openedAt).toLocaleTimeString()} - {session.closedAt ? new Date(session.closedAt).toLocaleTimeString() : 'N/A'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-300">${session.openingBalance.toFixed(2)}</td>
                        <td className="p-4 text-slate-300">${session.cashSales.toFixed(2)}</td>
                        <td className="p-4 font-bold text-white">${session.closingBalance?.toFixed(2)}</td>
                        <td className={`p-4 font-bold ${diff === 0 ? 'text-emerald-400' : diff > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                          {diff === 0 ? '$0.00' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)}`}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => alert(`Detalles del Corte:\n\nFormas de Pago:\n- Efectivo: $${session.cashSales.toFixed(2)}\n- Tarjeta: $${session.cardSales.toFixed(2)}\n- Apps: $${session.appsSales.toFixed(2)}\n\nTotales:\n- Esperado: $${session.expectedBalance?.toFixed(2)}\n- Real Entregado: $${session.closingBalance?.toFixed(2)}\n\nNotas:\n${session.notes || 'Ninguna'}`)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-2 py-1 rounded hover:bg-brand-primary/25 cursor-pointer"
                          >
                            <FileText className="h-3 w-3" /> Ver Reporte
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardContainer>
  );
}
