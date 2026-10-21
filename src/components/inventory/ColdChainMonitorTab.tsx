'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Thermometer,
  ThermometerSnowflake,
  ThermometerSun,
  AlertTriangle,
  CheckCircle2,
  BellRing,
  RefreshCw,
  Plus,
  Download,
  Wifi,
  Battery,
  Building,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Clock,
  Sparkles,
  X,
  Activity,
  Sliders,
  DollarSign
} from 'lucide-react';

interface SensorItem {
  id: string;
  name: string;
  deviceCode: string;
  sensorType: string;
  targetTempMin: number;
  targetTempMax: number;
  targetHumidityMin?: number | null;
  targetHumidityMax?: number | null;
  currentTemp?: number | null;
  currentHumidity?: number | null;
  batteryLevel?: number | null;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
  lastReadingAt?: string | null;
  warehouseId?: string | null;
  warehouse?: {
    id: string;
    name: string;
  } | null;
  inventoryValue: number;
  activeAlertsCount: number;
  readings: Array<{
    id: string;
    temperature: number;
    humidity?: number | null;
    status: string;
    battery?: number | null;
    recordedAt: string;
  }>;
  alerts: Array<{
    id: string;
    severity: string;
    temperature: number;
    ruleViolated: string;
    durationMinutes: number;
    inventoryValueAtRisk: number;
    status: string;
    createdAt: string;
  }>;
}

interface ColdChainMonitorTabProps {
  warehouses: Array<{
    id: string;
    name: string;
  }>;
  onRefreshAll?: () => void;
}

export default function ColdChainMonitorTab({ warehouses, onRefreshAll }: ColdChainMonitorTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'monitors' | 'alerts' | 'log' | 'simulator'>('monitors');
  const [sensors, setSensors] = useState<SensorItem[]>([]);
  const [summary, setSummary] = useState<any>({
    totalSensors: 0,
    normalCount: 0,
    warningCount: 0,
    criticalCount: 0,
    totalValueAtRisk: 0,
  });
  const [loading, setLoading] = useState(true);

  // Modal create sensor
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDeviceCode, setNewDeviceCode] = useState('');
  const [newType, setNewType] = useState('REFRIGERATION');
  const [newMin, setNewMin] = useState<number>(0.0);
  const [newMax, setNewMax] = useState<number>(4.0);
  const [newWarehouseId, setNewWarehouseId] = useState('');
  const [submittingSensor, setSubmittingSensor] = useState(false);

  // Modal resolve alert
  const [selectedAlertForResolve, setSelectedAlertForResolve] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvingAlert, setResolvingAlert] = useState(false);

  // Manual reading simulation
  const [simSensorId, setSimSensorId] = useState('');
  const [simTemp, setSimTemp] = useState<number>(2.5);
  const [simulating, setSimulating] = useState(false);

  const fetchSensors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sensors');
      if (res.ok) {
        const data = await res.json();
        setSensors(data.sensors || []);
        setSummary(data.summary || {});
        if (data.sensors?.length > 0 && !simSensorId) {
          setSimSensorId(data.sensors[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching sensors:', err);
    } finally {
      setLoading(false);
    }
  }, [simSensorId]);

  useEffect(() => {
    fetchSensors();
    // Poll every 30 seconds for live telemetry
    const interval = setInterval(fetchSensors, 30000);
    return () => clearInterval(interval);
  }, [fetchSensors]);

  // Adjust preset temperatures based on equipment type
  const handleTypeChange = (type: string) => {
    setNewType(type);
    if (type === 'FREEZER') {
      setNewMin(-24.0);
      setNewMax(-18.0);
    } else if (type === 'REFRIGERATION') {
      setNewMin(0.0);
      setNewMax(4.0);
    } else if (type === 'LINE_PREP') {
      setNewMin(0.0);
      setNewMax(5.0);
    } else if (type === 'HOT_HOLDING') {
      setNewMin(60.0);
      setNewMax(85.0);
    } else if (type === 'DRY_STORAGE') {
      setNewMin(10.0);
      setNewMax(25.0);
    }
  };

  // Create sensor
  const handleCreateSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newDeviceCode) {
      alert('Ingresa el nombre y el código de dispositivo');
      return;
    }

    try {
      setSubmittingSensor(true);
      const res = await fetch('/api/sensors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          deviceCode: newDeviceCode,
          sensorType: newType,
          targetTempMin: newMin,
          targetTempMax: newMax,
          warehouseId: newWarehouseId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al crear sensor');
      }

      setShowCreateModal(false);
      setNewName('');
      setNewDeviceCode('');
      fetchSensors();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Error');
    } finally {
      setSubmittingSensor(false);
    }
  };

  // Resolve alert
  const handleResolveAlert = async (status: 'ACKNOWLEDGED' | 'RESOLVED') => {
    if (!selectedAlertForResolve) return;

    try {
      setResolvingAlert(true);
      const res = await fetch(`/api/sensors/alerts/${selectedAlertForResolve.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          resolutionNotes: resolutionNotes || (status === 'RESOLVED' ? 'Temperatura normalizada y verificada.' : 'Alarma tomada por supervisor en turno.'),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar alerta');
      }

      setSelectedAlertForResolve(null);
      setResolutionNotes('');
      fetchSensors();
    } catch (err: any) {
      alert(err.message || 'Error');
    } finally {
      setResolvingAlert(false);
    }
  };

  // Run simulation actions
  const runSimulation = async (action: 'SEED_SENSORS' | 'SIMULATE_NORMAL' | 'SIMULATE_SPIKE' | 'CUSTOM', customTemp?: number) => {
    try {
      setSimulating(true);
      if (action === 'CUSTOM') {
        const targetSensor = sensors.find((s) => s.id === simSensorId);
        const res = await fetch('/api/sensors/readings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sensorId: simSensorId,
            temperature: customTemp ?? simTemp,
            humidity: targetSensor?.currentHumidity || 80,
          }),
        });
        if (!res.ok) throw new Error('Error al enviar lectura manual');
      } else {
        const res = await fetch('/api/sensors/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            sensorId: simSensorId || undefined,
          }),
        });
        if (!res.ok) throw new Error('Error en simulación');
      }
      fetchSensors();
    } catch (err: any) {
      alert(err.message || 'Error en simulador');
    } finally {
      setSimulating(false);
    }
  };

  // Helpers
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'FREEZER':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">CONGELACIÓN</span>;
      case 'REFRIGERATION':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">REFRIGERACIÓN</span>;
      case 'LINE_PREP':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">MESA DE LÍNEA</span>;
      case 'HOT_HOLDING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-orange-500/20 text-orange-300 border border-orange-500/30">MANTENEDOR CALIENTE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-slate-300">ALMACÉN SECO</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-500/20 text-red-300 border border-red-500/50 animate-pulse">
            <AlertTriangle className="h-3 w-3" /> CRÍTICO / ALARMA
          </span>
        );
      case 'WARNING':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/50">
            <AlertTriangle className="h-3 w-3" /> DESVIACIÓN
          </span>
        );
      case 'NORMAL':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="h-3 w-3" /> EN NORMA HACCP
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-800 text-slate-400">
            OFFLINE
          </span>
        );
    }
  };

  // Compile active alerts across all sensors
  const allActiveAlerts = sensors.flatMap((s) =>
    s.alerts.map((a) => ({
      ...a,
      sensorName: s.name,
      deviceCode: s.deviceCode,
      sensorType: s.sensorType,
      targetRange: `${s.targetTempMin}°C - ${s.targetTempMax}°C`,
      warehouseName: s.warehouse?.name || 'Almacén General',
    }))
  );

  return (
    <div className="space-y-6">
      {/* HEADER WITH ACTIONS */}
      <div className="glass-panel border border-slate-800 rounded-2xl p-6 bg-slate-900/60 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ThermometerSnowflake className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                Cadena de Frío & Sensores IoT (Cold Chain Watchdog)
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  HACCP NOM-251
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Vigilancia telemétrica continua en cámaras de frío, congeladores y mesas de pase con detección de fugas térmicas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchSensors()}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer"
            title="Refrescar telemetría"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <a
            href="/api/sensors/export"
            download
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 shadow-sm transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span>Exportar Bitácora HACCP</span>
          </a>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs rounded-xl shadow-lg shadow-cyan-900/30 transition transform hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3px]" />
            <span>Nuevo Sensor IoT</span>
          </button>
        </div>
      </div>

      {/* KPI HEALTH RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sensors */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-5 bg-slate-900/40 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Sensores Instalados</p>
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Wifi className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-white mt-2 tracking-tight">
            {summary.totalSensors} <span className="text-xs font-normal text-slate-400">dispositivos</span>
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span>Telemetría en vivo</span>
            <span className="text-emerald-400 font-bold">{summary.normalCount} en norma</span>
          </div>
        </div>

        {/* Card 2: Critical Temperature Alarms */}
        <div className={`glass-panel border rounded-2xl p-5 relative overflow-hidden ${
          summary.criticalCount > 0 ? 'border-red-500/50 bg-red-950/20' : 'border-slate-800/80 bg-slate-900/40'
        }`}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Alertas Térmicas Críticas</p>
            <span className={`p-1.5 rounded-lg ${summary.criticalCount > 0 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
              <BellRing className="h-4 w-4" />
            </span>
          </div>
          <p className={`text-2xl font-black mt-2 tracking-tight ${summary.criticalCount > 0 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {summary.criticalCount}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span>{summary.warningCount} advertencias preventivas</span>
            <span className={summary.criticalCount > 0 ? 'text-red-300 font-bold' : 'text-slate-400'}>
              {summary.criticalCount > 0 ? '¡Riesgo inminente!' : 'Sin alarmas'}
            </span>
          </div>
        </div>

        {/* Card 3: Value at Risk */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-5 bg-slate-900/40 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Inventario en Riesgo ($)</p>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-amber-300 mt-2 tracking-tight">
            ${(summary.totalValueAtRisk || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span>Exposición financiera</span>
            <span className="font-bold text-slate-300">Cámaras con alarma</span>
          </div>
        </div>

        {/* Card 4: Compliance Index */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-5 bg-slate-900/40 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Cumplimiento NOM-251</p>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2 tracking-tight">
            {summary.totalSensors > 0
              ? `${Math.round((summary.normalCount / summary.totalSensors) * 100)}%`
              : '100%'}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span>Rango de inocuidad</span>
            <span className="font-bold text-emerald-300">Auditoría Aprobada</span>
          </div>
        </div>
      </div>

      {/* SUB-TABS NAVIGATION */}
      <div className="glass-panel border border-slate-800 rounded-2xl p-2 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('monitors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSubTab === 'monitors'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Thermometer className="h-4 w-4" />
            <span>Panel de Cámaras en Vivo ({sensors.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('alerts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSubTab === 'alerts'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <BellRing className="h-4 w-4" />
            <span>Alarmas Activas ({allActiveAlerts.length})</span>
            {allActiveAlerts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-500 text-white animate-pulse">
                {allActiveAlerts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('log')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSubTab === 'log'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Bitácora Histórica HACCP</span>
          </button>

          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSubTab === 'simulator'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Simulador IoT & Banco de Pruebas</span>
          </button>
        </div>

        {sensors.length === 0 && (
          <button
            onClick={() => runSimulation('SEED_SENSORS')}
            disabled={simulating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generar 3 Sensores Base</span>
          </button>
        )}
      </div>

      {/* SUB-TAB 1: LIVE MONITORS GRID */}
      {activeSubTab === 'monitors' && (
        <div className="space-y-6">
          {sensors.length === 0 ? (
            <div className="glass-panel border border-slate-800 rounded-3xl p-12 text-center bg-slate-900/40 space-y-4">
              <ThermometerSnowflake className="h-12 w-12 text-cyan-400 mx-auto opacity-50" />
              <h3 className="text-lg font-bold text-white">No hay sensores IoT registrados</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Registra tus sondas de temperatura o haz clic en autogenerar para cargar los sensores base de tu cocina (Cámara de Carnes, Congelador y Mesa de Línea).
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => runSimulation('SEED_SENSORS')}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer"
                >
                  Autogenerar Sensores Base
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Registrar Manualmente
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sensors.map((sensor) => {
                const isCritical = sensor.status === 'CRITICAL';
                const isWarning = sensor.status === 'WARNING';
                const isFreezer = sensor.sensorType === 'FREEZER';

                return (
                  <div
                    key={sensor.id}
                    className={`glass-panel border rounded-3xl p-6 transition-all duration-300 relative overflow-hidden ${
                      isCritical
                        ? 'border-red-500/60 bg-gradient-to-br from-red-950/30 to-slate-900 shadow-xl shadow-red-950/20'
                        : isWarning
                        ? 'border-amber-500/60 bg-gradient-to-br from-amber-950/20 to-slate-900'
                        : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-white text-base tracking-tight">{sensor.name}</h4>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {sensor.warehouse?.name || 'Almacén General'} • <span className="font-mono">{sensor.deviceCode}</span>
                        </p>
                      </div>
                      {getTypeBadge(sensor.sensorType)}
                    </div>

                    {/* Temperature Big Gauge */}
                    <div className="my-6 flex items-center justify-between">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-5xl font-black tracking-tighter font-mono ${
                              isCritical
                                ? 'text-red-400 animate-pulse'
                                : isWarning
                                ? 'text-amber-300'
                                : isFreezer
                                ? 'text-cyan-300'
                                : 'text-emerald-400'
                            }`}
                          >
                            {sensor.currentTemp !== null && sensor.currentTemp !== undefined
                              ? `${sensor.currentTemp > 0 ? '+' : ''}${sensor.currentTemp.toFixed(1)}`
                              : '--'}
                          </span>
                          <span className="text-2xl font-bold text-slate-400">°C</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Humedad: <strong className="text-slate-200">{sensor.currentHumidity ? `${sensor.currentHumidity.toFixed(0)}%` : 'N/A'}</strong>
                        </p>
                      </div>

                      <div className="text-right space-y-1.5">
                        {getStatusBadge(sensor.status)}
                        <p className="text-[10px] text-slate-400 font-mono">
                          Rango: {sensor.targetTempMin}°C a {sensor.targetTempMax}°C
                        </p>
                      </div>
                    </div>

                    {/* Sparkline mini-graph of last 12 readings */}
                    <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Historial Reciente (Últimas 12h)</span>
                        <span className="font-mono text-slate-300">
                          {sensor.readings.length > 0
                            ? `Min: ${Math.min(...sensor.readings.map((r) => r.temperature)).toFixed(1)}°C | Max: ${Math.max(...sensor.readings.map((r) => r.temperature)).toFixed(1)}°C`
                            : 'Sin datos'}
                        </span>
                      </div>

                      <div className="h-10 flex items-end gap-1 pt-1">
                        {sensor.readings.slice(0, 12).reverse().map((r, i) => {
                          const isHigh = r.temperature > sensor.targetTempMax;
                          const heightPct = Math.min(Math.max(((r.temperature - sensor.targetTempMin) / (sensor.targetTempMax - sensor.targetTempMin + 0.1)) * 80, 15), 100);
                          return (
                            <div
                              key={r.id || i}
                              className={`flex-1 rounded-t transition-all ${
                                isHigh
                                  ? 'bg-red-500'
                                  : r.status === 'WARNING'
                                  ? 'bg-amber-400'
                                  : 'bg-cyan-500/70'
                              }`}
                              style={{ height: `${heightPct}%` }}
                              title={`${r.temperature}°C (${new Date(r.recordedAt).toLocaleTimeString('es-MX')})`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer Meta */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Battery className={`h-3.5 w-3.5 ${sensor.batteryLevel && sensor.batteryLevel < 20 ? 'text-red-400' : 'text-emerald-400'}`} />
                        <span>{sensor.batteryLevel || 100}%</span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px]">
                        <span>Mercancía:</span>
                        <strong className="text-white font-mono">${sensor.inventoryValue.toFixed(0)}</strong>
                      </div>

                      <div className="text-[10px] text-slate-500">
                        {sensor.lastReadingAt ? new Date(sensor.lastReadingAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: ACTIVE ALERTS */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-4">
          <div className="glass-panel border border-slate-800 rounded-2xl p-6 bg-slate-900/40 shadow-xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                  Registro de Desviaciones Térmicas & Protocolo HACCP
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Atención prioritaria a cámaras fuera de temperatura límite para evitar pérdidas de producto e intoxicación alimentaria.
                </p>
              </div>
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {allActiveAlerts.length} incidentes abiertos
              </span>
            </div>

            {allActiveAlerts.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto opacity-50 mb-2" />
                <p className="font-bold text-slate-300 text-sm">Sin alertas de temperatura activas</p>
                <p className="text-xs text-slate-500 mt-1">Todas las cámaras y congeladores operan dentro de los límites de la NOM-251.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allActiveAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-2xl border border-red-500/40 bg-red-950/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-500/20 text-red-300 border border-red-500/40">
                          {alert.severity}
                        </span>
                        <h4 className="font-bold text-white text-sm">{alert.sensorName}</h4>
                        <span className="text-xs text-slate-400">({alert.warehouseName})</span>
                      </div>
                      <p className="text-xs text-red-300 font-bold">{alert.ruleViolated}</p>
                      <p className="text-[11px] text-slate-400">
                        Temperatura registrada: <strong className="text-white font-mono">{alert.temperature}°C</strong> • Rango Objetivo: {alert.targetRange} • Inventario en riesgo: <strong className="text-amber-300 font-mono">${alert.inventoryValueAtRisk.toFixed(2)}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => setSelectedAlertForResolve(alert)}
                        className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer"
                      >
                        Atender / Resolver Alarma
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: HISTORICAL LOG */}
      {activeSubTab === 'log' && (
        <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4">
          <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h4 className="text-sm font-black text-white">Bitácora Oficial de Telemetría Térmica HACCP</h4>
              <p className="text-xs text-slate-400 mt-0.5">Historial continuo para auditorías sanitarias COFEPRIS / FDA</p>
            </div>
            <a
              href="/api/sensors/export"
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>Descargar CSV</span>
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                  <th className="p-3.5">Fecha y Hora</th>
                  <th className="p-3.5">Sensor</th>
                  <th className="p-3.5">Cámara / Bodega</th>
                  <th className="p-3.5">Temp (°C)</th>
                  <th className="p-3.5">Rango Objetivo</th>
                  <th className="p-3.5">Humedad</th>
                  <th className="p-3.5">Estatus HACCP</th>
                  <th className="p-3.5">Batería</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {sensors.flatMap((s) => s.readings.map((r) => ({ ...r, sensorName: s.name, sensorType: s.sensorType, targetMin: s.targetTempMin, targetMax: s.targetTempMax, warehouseName: s.warehouse?.name }))).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-500">
                      No hay registros telemétricos disponibles.
                    </td>
                  </tr>
                ) : (
                  sensors
                    .flatMap((s) =>
                      s.readings.map((r) => ({
                        ...r,
                        sensorName: s.name,
                        sensorType: s.sensorType,
                        targetMin: s.targetTempMin,
                        targetMax: s.targetTempMax,
                        warehouseName: s.warehouse?.name || 'Almacén General',
                      }))
                    )
                    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
                    .slice(0, 50)
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 text-slate-400 font-mono">
                          {new Date(item.recordedAt).toLocaleString('es-MX')}
                        </td>
                        <td className="p-3.5 font-bold text-white">{item.sensorName}</td>
                        <td className="p-3.5 text-slate-300">{item.warehouseName}</td>
                        <td className="p-3.5 font-mono font-black text-sm text-white">
                          {item.temperature.toFixed(1)}°C
                        </td>
                        <td className="p-3.5 text-slate-400 font-mono">
                          {item.targetMin}°C a {item.targetMax}°C
                        </td>
                        <td className="p-3.5 text-slate-300">
                          {item.humidity ? `${item.humidity.toFixed(0)}%` : '—'}
                        </td>
                        <td className="p-3.5">{getStatusBadge(item.status)}</td>
                        <td className="p-3.5 text-slate-400">{item.battery || 100}%</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: IoT SIMULATOR & TEST BENCH */}
      {activeSubTab === 'simulator' && (
        <div className="glass-panel border border-slate-800 rounded-2xl p-6 bg-slate-900/40 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Sliders className="h-5 w-5 text-cyan-400" />
              Banco de Pruebas Telemétricas & Simulador IoT
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Permite simular eventos reales de cocina: falla de compresor, puerta de cámara abierta o corte de energía para verificar la respuesta del sistema.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action 1: Normal */}
            <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="h-4 w-4" />
                <span>Simular Cadena de Frío Óptima</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Inyecta lecturas en norma para todos los sensores activos (2.5°C en refrigeración, -19.5°C en congelador).
              </p>
              <button
                onClick={() => runSimulation('SIMULATE_NORMAL')}
                disabled={simulating}
                className="w-full py-2 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Inyectar Temperatura Normal
              </button>
            </div>

            {/* Action 2: Critical Spike */}
            <div className="p-4 bg-slate-950/60 rounded-2xl border border-red-900/40 space-y-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                <Flame className="h-4 w-4" />
                <span>Simular Falla Térmica / Descongelamiento</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Provoca un pico térmico peligroso (+8.8°C en refrigerador o -9.5°C en congelador), detonando alarma inmediata y cálculo de inventario en riesgo.
              </p>
              <button
                onClick={() => runSimulation('SIMULATE_SPIKE')}
                disabled={simulating}
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
              >
                Detonar Falla Crítica
              </button>
            </div>

            {/* Action 3: Custom Injection */}
            <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                <Thermometer className="h-4 w-4" />
                <span>Inyección Manual Específica</span>
              </div>
              <div className="space-y-2">
                <select
                  value={simSensorId}
                  onChange={(e) => setSimSensorId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                >
                  {sensors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    value={simTemp}
                    onChange={(e) => setSimTemp(parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                  />
                  <span className="text-xs text-slate-400">°C</span>
                  <button
                    onClick={() => runSimulation('CUSTOM', simTemp)}
                    disabled={simulating}
                    className="flex-1 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition"
                  >
                    Enviar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTRAR NUEVO SENSOR IOT */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-3xl w-full max-w-lg bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <ThermometerSnowflake className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-black text-white">Nuevo Sensor de Temperatura IoT</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSensor} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nombre Descriptivo de la Cámara *</label>
                <input
                  type="text"
                  placeholder="Ej: Cámara Fría Carnes & Aves"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Código / MAC del Dispositivo *</label>
                  <input
                    type="text"
                    placeholder="Ej: SENS-CF-04"
                    value={newDeviceCode}
                    onChange={(e) => setNewDeviceCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono uppercase focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Tipo de Equipo *</label>
                  <select
                    value={newType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="REFRIGERATION">Refrigeración (0°C a 4°C)</option>
                    <option value="FREEZER">Congelación (-24°C a -18°C)</option>
                    <option value="LINE_PREP">Mesa Fría de Línea (0°C a 5°C)</option>
                    <option value="HOT_HOLDING">Mantenedor Caliente (60°C a 85°C)</option>
                    <option value="DRY_STORAGE">Almacén Seco (10°C a 25°C)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Límite Mínimo (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newMin}
                    onChange={(e) => setNewMin(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Límite Máximo (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newMax}
                    onChange={(e) => setNewMax(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              {warehouses.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Bodega / Almacén Vinculado</label>
                  <select
                    value={newWarehouseId}
                    onChange={(e) => setNewWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Seleccionar bodega para cálculo de valor en riesgo...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingSensor}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl shadow-lg"
                >
                  Guardar Sensor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESOLVER ALERTA TÉRMICA */}
      {selectedAlertForResolve && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-3xl w-full max-w-md bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-400" />
                <h3 className="text-base font-black text-white">Atender Alarma de Temperatura</h3>
              </div>
              <button onClick={() => setSelectedAlertForResolve(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs space-y-1">
              <p className="font-bold text-white">{selectedAlertForResolve.sensorName}</p>
              <p className="text-red-400 font-bold">{selectedAlertForResolve.ruleViolated}</p>
              <p className="text-slate-400">
                Valor en riesgo: <strong className="text-amber-300">${selectedAlertForResolve.inventoryValueAtRisk?.toFixed(2)}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">Acción Correctiva Ejecutada *</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Ej: Se cerró puerta de cámara, técnico revisó termostato y temperatura retornó a 2.4°C..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedAlertForResolve(null)}
                className="px-3.5 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resolvingAlert}
                onClick={() => handleResolveAlert('ACKNOWLEDGED')}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl"
              >
                Reconocer Alerta
              </button>
              <button
                type="button"
                disabled={resolvingAlert}
                onClick={() => handleResolveAlert('RESOLVED')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg"
              >
                Resolver y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
