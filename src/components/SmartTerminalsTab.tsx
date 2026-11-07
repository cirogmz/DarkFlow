'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  Wifi,
  Trash2,
  Edit2,
  Zap,
  Radio,
  Server,
  RefreshCw,
  AlertCircle,
  X
} from 'lucide-react';
import { SmartTerminalDTO, TerminalProvider } from '@/lib/smartTerminals';
import SmartTerminalModal from '@/components/SmartTerminalModal';

export default function SmartTerminalsTab() {
  const [terminals, setTerminals] = useState<SmartTerminalDTO[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal create/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<SmartTerminalDTO | null>(null);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<TerminalProvider>('CLIP');
  const [serialNumber, setSerialNumber] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [zone, setZone] = useState('Salón');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Push test modal
  const [testingTerminal, setTestingTerminal] = useState<SmartTerminalDTO | null>(null);

  const fetchTerminals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/smart-terminals');
      const data = await res.json();
      if (res.ok && data.terminals) {
        setTerminals(data.terminals);
      }
    } catch (err) {
      console.error('Error fetching terminals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTerminals();
  }, [fetchTerminals]);

  const handleOpenCreate = () => {
    setEditingTerminal(null);
    setName('');
    setProvider('CLIP');
    setSerialNumber(`CLP-${Math.floor(100000 + Math.random() * 900000)}`);
    setDeviceId(`clip_dev_${Date.now().toString().slice(-6)}`);
    setZone('Salón');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: SmartTerminalDTO) => {
    setEditingTerminal(t);
    setName(t.name);
    setProvider(t.provider);
    setSerialNumber(t.serialNumber);
    setDeviceId(t.deviceId);
    setZone(t.zone);
    setNotes(t.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !serialNumber.trim() || !deviceId.trim()) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/smart-terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTerminal?.id,
          name: name.trim(),
          provider,
          serialNumber: serialNumber.trim(),
          deviceId: deviceId.trim(),
          zone: zone.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      setIsModalOpen(false);
      fetchTerminals();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al guardar terminal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, terminalName: string) => {
    if (!confirm(`¿Eliminar la terminal "${terminalName}"?`)) return;

    try {
      const res = await fetch(`/api/smart-terminals/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTerminals();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch {
      alert('Error de conexión');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CreditCard className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-white">Terminales Smart POS Físicas</h2>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              Clip & MP Point
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            Envía el cobro con un clic desde el POS, Comandero o Mesas directamente a la terminal inalámbrica del mesero, eliminando errores de tecleo manual.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTerminals}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
            title="Refrescar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>Registrar Terminal</span>
          </button>
        </div>
      </div>

      {/* Terminals Grid */}
      {terminals.length === 0 && !loading ? (
        <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-600 flex items-center justify-center mx-auto">
            <Radio className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-white text-base">No hay terminales Smart POS registradas</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Registra tu primera terminal Clip Stand, Clip Pro o Mercado Pago Point Smart para habilitar el cobro automático.
          </p>
          <button
            onClick={handleOpenCreate}
            className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar Terminal Ahora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {terminals.map((t) => {
            const isClip = t.provider === 'CLIP';
            const isBusy = t.status === 'BUSY';

            return (
              <div
                key={t.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl hover:border-slate-700 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                        isClip ? 'bg-orange-500 text-white' : 'bg-sky-500 text-white'
                      }`}
                    >
                      {isClip ? '🟠 CLIP SMART POS' : '🔵 MERCADO PAGO POINT'}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        isBusy
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                          : t.status === 'ONLINE'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {isBusy ? 'COBRANDO...' : t.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-white">{t.name}</h3>
                    <p className="text-xs text-slate-400">
                      Zona: <span className="font-bold text-slate-300">{t.zone}</span>
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl space-y-1 text-[11px] font-mono text-slate-400">
                    <div className="flex justify-between">
                      <span>Serial:</span>
                      <span className="text-white font-bold">{t.serialNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Device ID:</span>
                      <span className="text-slate-300 truncate max-w-[140px]">{t.deviceId}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setTestingTerminal(t)}
                    className="flex-1 py-2 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Probar Cobro Push</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(t)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(t.id, t.name)}
                    className="p-2 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-xl"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">
                {editingTerminal ? 'Editar Terminal Smart POS' : 'Registrar Nueva Terminal'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Nombre de la Terminal:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Clip Barra 1, MP Salón"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Proveedor / Dispositivo:</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as TerminalProvider)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="CLIP">Clip (Stand / Pro / Total)</option>
                    <option value="MERCADOPAGO_POINT">Mercado Pago Point (Smart/Air)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Zona asignada:</label>
                  <input
                    type="text"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    placeholder="Ej. Salón, Barra, Terraza"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Número de Serie (SN):</label>
                  <input
                    type="text"
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="CLP-12345"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Device ID / Terminal ID:</label>
                  <input
                    type="text"
                    required
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="clip_dev_01"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Notas / Referencia interna:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Terminal asignada al turno nocturno"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20"
                >
                  {saving ? 'Guardando...' : editingTerminal ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PUSH TEST INTERACTIVE MODAL */}
      {testingTerminal && (
        <SmartTerminalModal
          isOpen={Boolean(testingTerminal)}
          onClose={() => {
            setTestingTerminal(null);
            fetchTerminals();
          }}
          orderId="test_order_push"
          orderNumber="TEST-99"
          total={150.0}
          tableName="Barra Test"
          onPaymentSuccess={() => {
            fetchTerminals();
          }}
        />
      )}
    </div>
  );
}

