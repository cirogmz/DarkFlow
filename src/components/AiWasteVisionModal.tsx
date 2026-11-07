'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  Scan,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Scale,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { WasteVisionAnalysisResult } from '@/lib/aiVision';

interface AiWasteVisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandId: string;
  onWasteLogged?: () => void;
}

const SAMPLE_PRESETS = [
  {
    label: '🥩 Carne Sobrecocida / Quemada',
    notes: 'Carne de res hamburguesa quemada en plancha por descuido de temperatura',
    categoryHint: 'BURNT_OVERCOOKED',
    mockImage: 'https://images.unsplash.com/photo-1558030006-450675393462?w=500&auto=format&fit=crop&q=60',
  },
  {
    label: '🍟 Sobras de Comensal (Papas y Pan)',
    notes: 'Sobra de mesa comensal dejó la mitad de papas a la francesa y pan',
    categoryHint: 'PLATE_LEFTOVER',
    mockImage: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500&auto=format&fit=crop&q=60',
  },
  {
    label: '🥬 Vegetales Vencidos en Cámara',
    notes: 'Lechuga romana marchita y con caducidad excedida en refrigeración',
    categoryHint: 'SPOILED_EXPIRATION',
    mockImage: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=60',
  },
  {
    label: '🍳 Derrame / Accidente en Suelo',
    notes: 'Caída de charola al piso en área de emplatado por tropiezo',
    categoryHint: 'SPILLAGE_ACCIDENT',
    mockImage: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500&auto=format&fit=crop&q=60',
  },
];

export default function AiWasteVisionModal({
  isOpen,
  onClose,
  brandId,
  onWasteLogged,
}: AiWasteVisionModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<WasteVisionAnalysisResult | null>(null);
  const [notes, setNotes] = useState('');
  const [station, setStation] = useState('KITCHEN_HOT');
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
      setError('No se pudo acceder a la cámara. Puedes subir una imagen o seleccionar un ejemplo.');
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
      triggerAiAnalysis(dataUrl);
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
        triggerAiAnalysis(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setImagePreview(preset.mockImage);
    setNotes(preset.notes);
    stopCamera();
    triggerAiAnalysis(preset.mockImage, preset.notes);
  };

  const triggerAiAnalysis = async (img: string, customNotes?: string) => {
    setAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const res = await fetch('/api/ai-vision/analyze-waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64OrUrl: img,
          brandId,
          notes: customNotes || notes,
          station,
          confirmAndSave: false,
        }),
      });

      const data = await res.json();
      if (res.ok && data.analysis) {
        setAnalysisResult(data.analysis);
        if (data.analysis.station) {
          setStation(data.analysis.station);
        }
      } else {
        setError(data.error || 'Error al analizar la imagen con IA');
      }
    } catch {
      setError('Error de conexión al procesar la imagen de merma');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!analysisResult || !imagePreview) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/ai-vision/analyze-waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64OrUrl: imagePreview,
          brandId,
          ingredientId: analysisResult.matchedIngredientId,
          station,
          notes: notes || `Merma clasificada por Visión IA (${analysisResult.categoryLabel})`,
          confirmAndSave: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (onWasteLogged) onWasteLogged();
        onClose();
      } else {
        setError(data.error || 'Error al guardar la merma');
      }
    } catch {
      setError('Error de red al guardar la merma');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setAnalysisResult(null);
    setNotes('');
    stopCamera();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 rounded-2xl text-rose-400">
              <Scan className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">AI Waste Vision</h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Red Neuronal
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auditoría fotográfica de mermas, estimación de gramaje y cálculo de pérdida financiera
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

        {/* Zona de Imagen / Cámara */}
        {!imagePreview && !cameraActive && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-750 hover:border-rose-500/50 rounded-2xl p-6 text-center bg-slate-950/50 transition">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white mb-1">
                Toma una foto de la merma o selecciona una imagen
              </p>
              <p className="text-xs text-slate-400 mb-4">
                La IA detectará automáticamente el tipo de alimento, sobre-cocción, sobras y gramaje
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition cursor-pointer"
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

            {/* Presets Rápidos de Prueba */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                O prueba con un caso de simulación preconfigurado:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SAMPLE_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/40 rounded-xl text-left transition flex items-center justify-between cursor-pointer group"
                  >
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white">
                      {p.label}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400 transition" />
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
              <div className="absolute inset-0 border-2 border-rose-500/40 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border border-dashed border-rose-400/70 rounded-2xl animate-pulse" />
              </div>
              <div className="absolute top-3 left-3 bg-black/60 px-2.5 py-1 rounded-full text-[10px] text-rose-300 font-bold flex items-center gap-1.5 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Cámara Activa
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
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg transition"
              >
                <Camera className="w-4 h-4" />
                Capturar Foto
              </button>
            </div>
          </div>
        )}

        {/* Imagen Capturada y Escáner IA */}
        {imagePreview && (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center max-h-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Merma para analizar" className="w-full max-h-64 object-contain" />

              {/* Efecto de Escaneo Láser mientras analiza */}
              {analyzing && (
                <div className="absolute inset-0 bg-rose-950/40 backdrop-blur-xs flex flex-col items-center justify-center space-y-3">
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-rose-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
                  <div className="p-3 bg-slate-900/90 border border-rose-500/40 rounded-2xl shadow-2xl flex items-center gap-2 text-rose-200 text-xs font-bold animate-bounce">
                    <Sparkles className="w-4 h-4 text-rose-400 animate-spin" />
                    <span>Red neuronal analizando materia orgánica...</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-white p-1.5 rounded-xl border border-slate-700 transition"
                title="Cambiar imagen"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Resultados del Análisis de Visión */}
            {analysisResult && (
              <div className="space-y-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                {/* Resumen Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                      Categoría Dictaminada por IA
                    </span>
                    <h4 className="text-sm font-black text-rose-300 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      {analysisResult.categoryLabel}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black font-mono">
                      {Math.round(analysisResult.confidence * 100)}% Confianza
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono uppercase ${
                      analysisResult.aiSeverity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {analysisResult.aiSeverity}
                    </span>
                  </div>
                </div>

                {/* Métricas Estimadas: Peso y Pérdida Financiera */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold block flex items-center gap-1">
                      <Scale className="w-3 h-3 text-sky-400" /> Gramaje Estimado
                    </span>
                    <p className="text-base font-black text-white font-mono mt-0.5">
                      ~{analysisResult.estimatedWeightGrams} <span className="text-xs text-slate-400">g</span>
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold block flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-rose-400" /> Pérdida en Costo
                    </span>
                    <p className="text-base font-black text-rose-400 font-mono mt-0.5">
                      ${analysisResult.estimatedCost.toFixed(2)} <span className="text-xs text-rose-300">MXN</span>
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 font-bold block flex items-center gap-1">
                      <Trash2 className="w-3 h-3 text-amber-400" /> Insumo Coincidente
                    </span>
                    <p className="text-xs font-bold text-slate-200 truncate mt-0.5" title={analysisResult.matchedIngredientName}>
                      {analysisResult.matchedIngredientName}
                    </p>
                  </div>
                </div>

                {/* Ítems Detectados */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Elementos Orgánicos Detectados:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.detectedItems.map((item, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({item.portionPct}%)</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Recomendación Correctiva CAPA de la IA */}
                <div className="p-3 bg-gradient-to-r from-amber-950/30 to-rose-950/30 border border-amber-500/30 rounded-xl space-y-1">
                  <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Acción Preventiva Sugerida (CAPA)
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {analysisResult.correctiveAction}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer / Botones de Acción */}
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

          {analysisResult && (
            <button
              type="button"
              onClick={handleConfirmAndSave}
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Descontando inventario...' : 'Confirmar & Registrar Merma'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
