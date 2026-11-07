'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Scan,
  Sparkles,
  Award,
  DollarSign,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Scale,
  RefreshCw,
  Eye,
  Filter,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import AiWasteVisionModal from './AiWasteVisionModal';
import DishQualityAuditModal from './DishQualityAuditModal';

interface AiVisionDashboardTabProps {
  brandId: string;
}

interface DishAuditItem {
  id: string;
  imageUrl: string;
  overallScore: number;
  presentationScore: number;
  portionScore: number;
  colorScore: number;
  passed: boolean;
  detectedDefects: string;
  aiFeedback: string;
  station: string;
  createdAt: string;
  product?: {
    name: string;
    imageUrl?: string;
  } | null;
  order?: {
    orderNumber: string;
  } | null;
}

interface AiWasteItem {
  id: string;
  quantity: number;
  totalCost: number;
  reason: string;
  notes?: string | null;
  station?: string | null;
  aiCategory?: string | null;
  aiConfidence?: number | null;
  aiEstimatedWeightGrams?: number | null;
  aiSuggestions?: string | null;
  createdAt: string;
  ingredient: {
    name: string;
    unit: string;
  };
}

interface StatsData {
  totalWasteAudits: number;
  totalCostAnalyzed: number;
  totalDishAudits: number;
  passedDishAudits: number;
  dishApprovalRate: number;
  topWasteCategory: string;
  topWasteCategoryLabel: string;
}

export default function AiVisionDashboardTab({ brandId }: AiVisionDashboardTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'WASTE' | 'DISHES'>('WASTE');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [audits, setAudits] = useState<DishAuditItem[]>([]);
  const [wasteLogs, setWasteLogs] = useState<AiWasteItem[]>([]);

  // Modals
  const [wasteModalOpen, setWasteModalOpen] = useState(false);
  const [dishModalOpen, setDishModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai-vision/audits?brandId=${brandId}&limit=40`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setAudits(data.audits || []);
        setWasteLogs(data.recentWasteWithAi || []);
      }
    } catch (e) {
      console.error('Error al cargar datos de AI Vision:', e);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Scan Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/20 to-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Scan className="w-5 h-5 animate-pulse" />
              </span>
              <h2 className="text-xl font-black text-white">AI Waste & Dish Quality Vision</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Red Neuronal Activa
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Auditoría fotográfica de mermas orgánicas y control de calidad estético en pase de cocina mediante visión artificial y estimación de costos en tiempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setWasteModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Escanear Merma con IA</span>
            </button>

            <button
              type="button"
              onClick={() => setDishModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>Auditar Platillo en Pase</span>
            </button>

            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
              title="Refrescar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scan className="w-4 h-4 text-rose-400" /> Mermas Auditadas con IA
            </span>
            <p className="text-2xl font-black text-white font-mono">
              {stats.totalWasteAudits}
            </p>
            <span className="text-[10px] text-slate-500 font-medium block">
              Registros con imagen y categorización
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-400" /> Pérdida Calculada por IA
            </span>
            <p className="text-2xl font-black text-amber-400 font-mono">
              ${stats.totalCostAnalyzed.toFixed(2)} <span className="text-xs text-slate-400">MXN</span>
            </p>
            <span className="text-[10px] text-slate-500 font-medium block">
              Impacto directo en Food Cost
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-400" /> Aprobación en Pase (Expo)
            </span>
            <p className="text-2xl font-black text-emerald-400 font-mono">
              {stats.dishApprovalRate}%
            </p>
            <span className="text-[10px] text-slate-500 font-medium block">
              {stats.passedDishAudits} de {stats.totalDishAudits} platillos conformes
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-sky-400" /> Causa Principal
            </span>
            <p className="text-xs font-black text-slate-200 line-clamp-1 mt-1">
              {stats.topWasteCategoryLabel}
            </p>
            <span className="text-[10px] text-slate-500 font-medium block">
              Mayor recurrencia en línea
            </span>
          </div>
        </div>
      )}

      {/* Sub-Tabs: Mermas vs Platillos */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('WASTE')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'WASTE'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Mermas Clasificadas ({wasteLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('DISHES')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'DISHES'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Inspección de Platillos en Pase ({audits.length})</span>
        </button>
      </div>

      {/* Listado: Mermas con IA */}
      {activeSubTab === 'WASTE' && (
        <div className="space-y-3">
          {wasteLogs.length === 0 ? (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                <Scan className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white">No hay mermas analizadas con visión artificial aún</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Usa el botón &quot;Escanear Merma con IA&quot; para fotografiar alimentos y obtener un diagnóstico instantáneo.
              </p>
              <button
                type="button"
                onClick={() => setWasteModalOpen(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
              >
                Escanear Primera Merma
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {wasteLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-rose-400 font-black uppercase tracking-wider block">
                        {log.aiCategory || 'MERMA GENERAL'}
                      </span>
                      <h4 className="text-sm font-black text-white">{log.ingredient.name}</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-black font-mono">
                      ${log.totalCost.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">Cantidad / Peso</span>
                      <p className="font-mono text-slate-300 font-bold">
                        {log.quantity} {log.ingredient.unit}
                        {log.aiEstimatedWeightGrams ? ` (~${log.aiEstimatedWeightGrams}g)` : ''}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">Estación</span>
                      <p className="font-semibold text-slate-300">{log.station || 'COCINA'}</p>
                    </div>
                  </div>

                  {log.aiSuggestions && (
                    <div className="text-[11px] text-slate-400 bg-amber-950/20 border border-amber-800/30 p-2 rounded-lg line-clamp-2">
                      <span className="font-bold text-amber-300 block mb-0.5">Acción Correctiva:</span>
                      {log.aiSuggestions}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                    <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                    {log.aiConfidence && (
                      <span className="font-mono text-emerald-400">
                        {Math.round(log.aiConfidence * 100)}% Confianza
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Listado: Platillos Auditados en Pase */}
      {activeSubTab === 'DISHES' && (
        <div className="space-y-3">
          {audits.length === 0 ? (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                <Award className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white">No hay platillos inspeccionados en pase aún</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Audita la presentación de tus platillos antes de salir a salón con la cámara del pase.
              </p>
              <button
                type="button"
                onClick={() => setDishModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
              >
                Auditar Primer Platillo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {audits.map((audit) => (
                <div
                  key={audit.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {audit.passed ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" /> APROBADO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-amber-400" /> OBSERVADO
                          </span>
                        )}
                        {audit.order && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            #{audit.order.orderNumber}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-black text-white">
                        {audit.product ? audit.product.name : 'Platillo en Pase'}
                      </h4>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 font-bold block">Puntaje</span>
                      <p className={`text-lg font-black font-mono ${
                        audit.overallScore >= 90
                          ? 'text-emerald-400'
                          : audit.overallScore >= 80
                          ? 'text-sky-400'
                          : 'text-amber-400'
                      }`}>
                        {audit.overallScore}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center text-xs bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Emplatado</span>
                      <p className="font-mono text-slate-300 font-bold text-xs">{audit.presentationScore}%</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Porción</span>
                      <p className="font-mono text-slate-300 font-bold text-xs">{audit.portionScore}%</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Color</span>
                      <p className="font-mono text-slate-300 font-bold text-xs">{audit.colorScore}%</p>
                    </div>
                  </div>

                  {audit.aiFeedback && (
                    <p className="text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800 leading-relaxed line-clamp-3">
                      {audit.aiFeedback}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                    <span>Estación: {audit.station}</span>
                    <span>{new Date(audit.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      <AiWasteVisionModal
        isOpen={wasteModalOpen}
        onClose={() => setWasteModalOpen(false)}
        brandId={brandId}
        onWasteLogged={fetchData}
      />

      <DishQualityAuditModal
        isOpen={dishModalOpen}
        onClose={() => setDishModalOpen(false)}
        brandId={brandId}
        onAuditCompleted={fetchData}
      />
    </div>
  );
}
