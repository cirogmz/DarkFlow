'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  X, 
  Gift, 
  Users, 
  Crown, 
  FlaskConical, 
  AlertCircle, 
  Check, 
  Delete, 
  DollarSign, 
  Utensils, 
  Sparkles 
} from 'lucide-react';

export type CompType = 'STAFF_MEAL' | 'VIP_COURTESY' | 'TASTING_SAMPLE' | 'SERVICE_RECOVERY';

interface CompAuthorizationModalProps {
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  tableNumber?: string | null;
  onSuccess: (data: any) => void;
  onClose: () => void;
}

const COMP_OPTIONS: Array<{
  id: CompType;
  title: string;
  desc: string;
  icon: any;
  color: string;
}> = [
  {
    id: 'STAFF_MEAL',
    title: 'Comida de Personal / Empleados',
    desc: 'Alimentos para staff de turno (se imputa a costo laboral de cocina/sala).',
    icon: Users,
    color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/40 text-blue-400',
  },
  {
    id: 'VIP_COURTESY',
    title: 'Cortesía VIP / Invitación de la Casa',
    desc: 'Atención a socios, influencers o clientes frecuentes (Relaciones Públicas).',
    icon: Crown,
    color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/40 text-amber-400',
  },
  {
    id: 'TASTING_SAMPLE',
    title: 'Degustación / Prueba de Cocina',
    desc: 'Muestras de nuevos platillos o coctelería para el menú.',
    icon: FlaskConical,
    color: 'from-purple-500/20 to-fuchsia-500/10 border-purple-500/40 text-purple-400',
  },
  {
    id: 'SERVICE_RECOVERY',
    title: 'Compensación por Servicio',
    desc: 'Incidencia o retraso con el comensal para garantizar su satisfacción.',
    icon: AlertCircle,
    color: 'from-rose-500/20 to-red-500/10 border-rose-500/40 text-rose-400',
  },
];

export default function CompAuthorizationModal({
  orderId,
  orderNumber,
  orderTotal,
  tableNumber,
  onSuccess,
  onClose,
}: CompAuthorizationModalProps) {
  const [selectedType, setSelectedType] = useState<CompType>('STAFF_MEAL');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [reason, setReason] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKeyClick = (num: string) => {
    if (pinCode.length < 6) {
      setPinCode((prev) => prev + num);
      setErrorMsg('');
    }
  };

  const handleDeleteKey = () => {
    setPinCode((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClearKey = () => {
    setPinCode('');
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode.length < 4) {
      setErrorMsg('Introduce el PIN de 4 dígitos del supervisor');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/orders/comp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          compType: selectedType,
          compBeneficiaryName: beneficiaryName.trim() || undefined,
          compReason: reason.trim() || undefined,
          pinCode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess(data);
      } else {
        setErrorMsg(data.error || 'PIN no autorizado o error al aplicar cortesía');
        setPinCode('');
      }
    } catch {
      setErrorMsg('Error de conexión al validar PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base">Autorización de Cortesía & Staff Meal</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                  {tableNumber ? `Mesa ${tableNumber}` : 'Mostrador'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Comanda #{orderNumber} • Valor venta a bonificar: <strong className="text-emerald-400">${orderTotal.toFixed(2)} MXN</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Comp Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              1. Selecciona el Tipo de Cortesía:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {COMP_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedType === opt.id;

                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedType(opt.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? `bg-gradient-to-br ${opt.color} ring-2 ring-brand-primary`
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {opt.title}
                        </span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-brand-primary" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                      {opt.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Beneficiary & Justification Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Beneficiario / Destinatario
              </label>
              <input
                type="text"
                placeholder="Ej. Chef Rodrigo, Mesa Socios..."
                value={beneficiaryName}
                onChange={(e) => setBeneficiaryName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Motivo / Justificación
              </label>
              <input
                type="text"
                placeholder="Ej. Almuerzo turno tarde, atención VIP..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          {/* Supervisor PIN Keypad Section */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  2. PIN de Autorización Gerencial
                </span>
                <p className="text-[10px] text-slate-400">
                  Introduce el PIN de supervisor para validar el costo en auditoría
                </p>
              </div>

              {/* PIN Dots Display */}
              <div className="flex gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`h-3 w-3 rounded-full transition-all ${
                      pinCode.length > idx
                        ? 'bg-brand-primary scale-110 shadow-sm shadow-brand-primary/50'
                        : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Tactile Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyClick(digit)}
                  className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800/80 text-white font-black text-base shadow transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearKey}
                className="h-11 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 text-slate-400 font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('0')}
                className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800/80 text-white font-black text-base shadow transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDeleteKey}
                className="h-11 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 text-slate-400 font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              >
                <Delete className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || pinCode.length < 4}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-2"
          >
            {loading ? (
              <span>Validando PIN...</span>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Autorizar Cortesía (100% Descuento)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
