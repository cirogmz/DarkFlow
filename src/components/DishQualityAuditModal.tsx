'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  Sparkles,
  Award,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Utensils,
  Layers,
  Palette,
  Thermometer,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { DishQualityAuditResult } from '@/lib/aiVision';

interface DishQualityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandId: string;
  orderId?: string;
  orderNumber?: string;
  onAuditCompleted?: () => void;
}

interface ProductOption {
  id: string;
  name: string;
  imageUrl?: string;
}

const SAMPLE_DISH_PRESETS = [
  {
    label: '🍔 Hamburguesa Gourmet (Pase Óptimo)',
    mockImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60',
  },
  {
    label: '🌮 Tacos de Ribeye (Emplatado & Salsa)',
    mockImage: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&auto=format&fit=crop&q=60',
  },
  {
    label: '🥗 Ensalada César con Pollo Grill',
    mockImage: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=500&auto=format&fit=crop&q=60',
  },
  {
    label: '🍕 Pizza Artesanal Margarita',
    mockImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60',
  },
];

export default function DishQualityAuditModal({
  isOpen,
  onClose,
  brandId,
  orderId,
  orderNumber,
  onAuditCompleted,
}: DishQualityAuditModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<DishQualityAuditResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        if (data.products?.length > 0) {
          setSelectedProductId(data.products[0].id);
        }
      }
    } catch {
      // Ignorar fallback silencioso
    }
  };

  if (!isOpen) return null;

  const startCamera = async () => {
    setError(null);
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError('No se pudo acceder a la cámara. Puedes subir una foto o seleccionar un ejemplo.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setImagePreview(dataUrl);
      stopCamera();
      triggerDishAudit(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setImagePreview(dataUrl);
        stopCamera();
        triggerDishAudit(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectPreset = (preset: typeof SAMPLE_DISH_PRESETS[0]) => {
    setImagePreview(preset.mockImage);
    stopCamera();
    triggerDishAudit(preset.mockImage);
  };

  const triggerDishAudit = async (img: string) => {
    setAuditing(true);
    setError(null);
    setAuditResult(null);

    try {
      const res = await fetch('/api/ai-vision/audit-dish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64OrUrl: img,
          brandId,
          productId: selectedProductId || undefined,
          orderId: orderId || undefined,
          station: 'EXPO',
        }),
      });

      const data = await res.json();
      if (res.ok && data.audit) {
        setAuditResult(data.audit);
      } else {
        setError(data.error || 'Error al auditar el platillo');
      }
    } catch {
      setError('Error de conexión al procesar la auditoría de visión');
    } finally {
      setAuditing(false);
    }
  };

  const handleFinish = () => {
    if (onAuditCompleted) onAuditCompleted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400">
              <Award className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Auditoría de Calidad en Pase (Expo QC)</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Visión IA
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inspección de presentación, armonía de color, volumen de guarnición y limpieza de loza
                {orderNumber ? ` • Orden #${orderNumber}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Selector de Platillo del Menú */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-emerald-400" /> Platillo a Inspeccionar
          </label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-emerald-500"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Zona de Captura / Selección de Imagen */}
        {!imagePreview && !cameraActive && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-750 hover:border-emerald-500/50 rounded-2xl p-6 text-center bg-slate-950/50 transition">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white mb-1">
                Fotografía el platillo terminado antes de despacharlo
              </p>
              <p className="text-xs text-slate-400 mb-4">
                La IA evaluará la limpieza de los bordes, el porcionado y la paleta de colores
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Abrir Cámara</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-700 transition cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Subir Foto</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            {/* Presets Rápidos */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                O prueba con una fotografía de prueba:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SAMPLE_DISH_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-left transition flex items-center justify-between cursor-pointer group"
                  >
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white">
                      {p.label}
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Visor en Vivo de Cámara */}
        {cameraActive && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-700">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-2 border-emerald-500/40 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-dashed border-emerald-400/80 rounded-full animate-pulse" />
              </div>
              <div className="absolute top-3 left-3 bg-black/60 px-2.5 py-1 rounded-full text-[10px] text-emerald-300 font-bold flex items-center gap-1.5 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Cámara Expo Activa
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg transition"
              >
                <Camera className="w-4 h-4" />
                Capturar Platillo
              </button>
            </div>
          </div>
        )}

        {/* Imagen Capturada y Resultados de Calidad */}
        {imagePreview && (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center max-h-56">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Platillo inspeccionado" className="w-full max-h-56 object-contain" />

              {auditing && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center space-y-3">
                  <div className="p-3 bg-slate-900/90 border border-emerald-500/40 rounded-2xl shadow-2xl flex items-center gap-2 text-emerald-200 text-xs font-bold animate-bounce">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span>Evaluando balance estético y bordes de emplatado...</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setAuditResult(null);
                }}
                className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-white p-1.5 rounded-xl border border-slate-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Ficha de Calificación de la IA */}
            {auditResult && (
              <div className="space-y-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                {/* Score Principal */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                      Dictamen del Inspector IA
                    </span>
                    <div className="flex items-center gap-2">
                      {auditResult.passed ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" /> APROBADO PARA SALÓN
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-amber-400" /> REQUIERE CORRECCIÓN
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold block">Puntaje Global</span>
                    <p className={`text-2xl font-black font-mono ${
                      auditResult.overallScore >= 90
                        ? 'text-emerald-400'
                        : auditResult.overallScore >= 80
                        ? 'text-sky-400'
                        : 'text-amber-400'
                    }`}>
                      {auditResult.overallScore} <span className="text-xs text-slate-400">/ 100</span>
                    </p>
                  </div>
                </div>

                {/* Calificaciones por Criterio */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1">
                      <Layers className="w-3 h-3 text-sky-400" /> Emplatado
                    </span>
                    <p className="text-sm font-black text-white font-mono mt-0.5">
                      {auditResult.presentationScore}%
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1">
                      <Utensils className="w-3 h-3 text-emerald-400" /> Porcionado
                    </span>
                    <p className="text-sm font-black text-white font-mono mt-0.5">
                      {auditResult.portionScore}%
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1">
                      <Palette className="w-3 h-3 text-amber-400" /> Armonía Color
                    </span>
                    <p className="text-sm font-black text-white font-mono mt-0.5">
                      {auditResult.colorScore}%
                    </p>
                  </div>
                </div>

                {/* Retroalimentación del Chef IA */}
                <div className="p-3 bg-gradient-to-r from-emerald-950/30 to-sky-950/30 border border-emerald-500/30 rounded-xl space-y-1">
                  <span className="text-[10px] font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Observaciones del Chef Supervisor
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {auditResult.aiFeedback}
                  </p>
                </div>

                {/* Defectos Identificados si existen */}
                {auditResult.detectedDefects.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                      Puntos de Mejora Detectados:
                    </span>
                    <ul className="space-y-1">
                      {auditResult.detectedDefects.map((def, i) => (
                        <li key={i} className="text-xs text-amber-200/90 flex items-start gap-1.5 bg-amber-950/30 p-2 rounded-lg border border-amber-800/40">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{def}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer"
          >
            Cerrar
          </button>

          {auditResult && (
            <button
              type="button"
              onClick={handleFinish}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Aceptar & Finalizar Inspección</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
