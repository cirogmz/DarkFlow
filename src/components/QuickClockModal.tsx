'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  LogIn, 
  LogOut, 
  Delete,
  Store,
  Sparkles
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { playKitchenChime } from '@/lib/sound';

interface QuickClockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickClockModal({ isOpen, onClose }: QuickClockModalProps) {
  const { activeBrand, addNotification } = useAppStore();
  const [pin, setPin] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    action?: 'CLOCK_IN' | 'CLOCK_OUT';
    message?: string;
    userName?: string;
    userRole?: string;
    duration?: string;
    error?: string;
  } | null>(null);

  // Live seconds ticker
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setResult(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleKeyPress = useCallback((digit: string) => {
    if (result) setResult(null);
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  }, [pin.length, result]);

  const handleDelete = useCallback(() => {
    if (result) setResult(null);
    setPin((prev) => prev.slice(0, -1));
  }, [result]);

  const handleClear = useCallback(() => {
    setPin('');
    setResult(null);
  }, []);

  const handleSubmit = useCallback(async (currentPin?: string) => {
    const pinToSubmit = currentPin || pin;
    if (pinToSubmit.length !== 4) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/attendance/clock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeBrand?.id ? { 'x-brand-id': activeBrand.id } : {}),
        },
        body: JSON.stringify({
          pinCode: pinToSubmit,
          action: 'AUTO',
          brandId: activeBrand?.id,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({
          success: true,
          action: data.action,
          message: data.message,
          userName: data.user?.name,
          userRole: data.user?.role,
          duration: data.durationString,
        });

        // Trigger chime
        try {
          playKitchenChime();
        } catch {}

        addNotification(data.message, 'success');
        setPin('');

        // Auto close after 3 seconds on success
        setTimeout(() => {
          onClose();
        }, 3200);
      } else {
        setResult({
          success: false,
          error: data.error || 'No se pudo procesar la checada',
        });
        setPin('');
      }
    } catch (err: any) {
      console.error('Error clocking in/out:', err);
      setResult({
        success: false,
        error: 'Error de conexión con el servidor',
      });
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [pin, activeBrand?.id, addNotification, onClose]);

  // Physical keyboard listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        if (pin.length < 3) {
          handleKeyPress(e.key);
        } else if (pin.length === 3) {
          const newPin = pin + e.key;
          setPin(newPin);
          handleSubmit(newPin);
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pin.length === 4) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, handleKeyPress, handleDelete, handleSubmit, onClose]);

  // Auto-submit when reaching 4 digits via virtual keypad
  const handleKeypadPress = (val: string) => {
    if (pin.length === 3) {
      const fullPin = pin + val;
      setPin(fullPin);
      handleSubmit(fullPin);
    } else {
      handleKeyPress(val);
    }
  };

  if (!isOpen) return null;

  const formattedDate = currentTime.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl shadow-black/80 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              <Clock className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h3 className="font-black text-white text-sm tracking-wide">RELOJ CHECADOR</h3>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Store className="w-3 h-3 text-slate-500" />
                {activeBrand?.name || 'Sucursal Principal'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Digital Clock Display */}
        <div className="p-5 text-center bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800/80">
          <div className="font-mono text-3xl font-black text-white tracking-widest drop-shadow-md">
            {formattedTime}
          </div>
          <div className="text-[11px] font-semibold text-slate-400 capitalize mt-1">
            {formattedDate}
          </div>
        </div>

        {/* Result Feedback Banner */}
        {result && (
          <div
            className={`p-4 border-b text-xs flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
              result.success
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                : 'bg-red-950/40 border-red-800/50 text-red-300'
            }`}
          >
            {result.success ? (
              result.action === 'CLOCK_IN' ? (
                <LogIn className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <LogOut className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              )
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <p className="font-bold text-white text-sm">
                {result.success
                  ? result.action === 'CLOCK_IN'
                    ? `¡Entrada: ${result.userName}!`
                    : `¡Salida: ${result.userName}!`
                  : 'Atención'}
              </p>
              <p className="text-xs leading-relaxed opacity-90">
                {result.message || result.error}
              </p>
              {result.duration && (
                <p className="font-mono font-bold text-emerald-400 text-[11px] pt-1">
                  ⏱️ Tiempo laborado: {result.duration}
                </p>
              )}
            </div>
          </div>
        )}

        {/* PIN Dots Indicator */}
        <div className="py-4 px-6 flex flex-col items-center justify-center space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Ingresa tu PIN de 4 dígitos
          </span>
          <div className="flex items-center gap-3">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    isFilled
                      ? 'bg-brand-primary scale-110 shadow-lg shadow-brand-primary/50'
                      : 'border-2 border-slate-700 bg-slate-950'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Numeric Keypad */}
        <div className="p-4 pt-1 grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={loading}
              onClick={() => handleKeypadPress(digit)}
              className="h-13 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-mono text-xl font-bold rounded-2xl border border-slate-700/60 shadow-md transition-all active:scale-95 flex items-center justify-center cursor-pointer select-none"
            >
              {digit}
            </button>
          ))}

          {/* Bottom row: Clear, 0, Backspace */}
          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleClear}
            className="h-13 bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs rounded-2xl border border-slate-800 transition-all flex items-center justify-center cursor-pointer select-none"
          >
            Limpiar
          </button>

          <button
            key="0"
            type="button"
            disabled={loading}
            onClick={() => handleKeypadPress('0')}
            className="h-13 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-mono text-xl font-bold rounded-2xl border border-slate-700/60 shadow-md transition-all active:scale-95 flex items-center justify-center cursor-pointer select-none"
          >
            0
          </button>

          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleDelete}
            className="h-13 bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-2xl border border-slate-800 transition-all flex items-center justify-center cursor-pointer select-none"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-center">
          <p className="text-[10px] text-slate-500">
            Checador automático: detecta entrada o salida según tu turno actual
          </p>
        </div>
      </div>
    </div>
  );
}
