'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  Truck, 
  User, 
  MapPin, 
  Smartphone, 
  Navigation, 
  Clock, 
  Play, 
  Check, 
  Volume2, 
  VolumeX,
  DollarSign,
  Receipt,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  MessageCircle,
  CreditCard,
  Banknote,
  Sliders,
  History,
  ShieldCheck,
  Printer
} from 'lucide-react';
import { playDispatchChime } from '@/lib/sound';
import DriverSettlementReceiptModal from '@/components/DriverSettlementReceiptModal';

interface DeliveryProfile {
  id?: string;
  vehicleType: string;
  plateNumber?: string | null;
  phoneNumber?: string | null;
  activeCashFloat?: number;
  commissionPerOrder?: number;
  status: string;
}

interface Driver {
  id: string;
  name: string;
  email?: string;
  role: string;
  deliveryProfile?: DeliveryProfile | null;
  stats?: {
    activeDeliveriesCount: number;
    pendingSettlementOrdersCount: number;
    pendingSettlementCash: number;
    pendingSettlementTips: number;
  };
}

interface OrderItem {
  id: string;
  quantity: number;
  product: {
    name: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  total: number;
  tip?: number | null;
  deliveryFee?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string;
  driverId?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  driver?: {
    id?: string;
    name: string;
    deliveryProfile?: DeliveryProfile | null;
  } | null;
  items: OrderItem[];
}

interface PendingSettlementData {
  driver: {
    id: string;
    name: string;
    email?: string;
    deliveryProfile?: DeliveryProfile | null;
  };
  openCashSession: { id: string; openedAt: string } | null;
  summary: {
    totalOrders: number;
    cashOrdersCount: number;
    cardOrdersCount: number;
    totalCashExpected: number;
    totalCardExpected: number;
    totalTips: number;
    totalDeliveryFees: number;
    totalCommissions: number;
    activeCashFloat: number;
    suggestedCashToCashier: number;
  };
  orders: (Order & { isCash: boolean })[];
}

interface SettlementRecord {
  id: string;
  settlementNumber: string;
  driverId: string;
  driver: {
    name: string;
    deliveryProfile?: DeliveryProfile | null;
  };
  cashier?: {
    name: string;
  } | null;
  totalOrders: number;
  totalCashExpected: number;
  totalCashTurnedIn: number;
  cashDifference: number;
  totalTips: number;
  totalCommissions: number;
  cashFloatReturned: number;
  netCashToCashier: number;
  status: string;
  notes?: string | null;
  settledAt: string;
  orders: {
    id: string;
    orderNumber: string;
    total: number;
    paymentMethod?: string | null;
    tip?: number | null;
  }[];
}

export default function DriversPage() {
  const [activeTab, setActiveTab] = useState<'DISPATCH' | 'SETTLEMENT' | 'FLEET'>('DISPATCH');
  
  // Base state
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionMode, setConnectionMode] = useState<'SSE' | 'POLL' | 'CONNECTING'>('CONNECTING');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Dispatch selection
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Settlement state
  const [settlementDriverId, setSettlementDriverId] = useState('');
  const [pendingSettlement, setPendingSettlement] = useState<PendingSettlementData | null>(null);
  const [selectedOrderIdsToSettle, setSelectedOrderIdsToSettle] = useState<string[]>([]);
  const [cashTurnedInInput, setCashTurnedInInput] = useState('');
  const [cashFloatReturnedInput, setCashFloatReturnedInput] = useState('0');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [deductTips, setDeductTips] = useState(false);
  const [deductCommissions, setDeductCommissions] = useState(false);
  const [settlementsHistory, setSettlementsHistory] = useState<SettlementRecord[]>([]);
  const [loadingSettlement, setLoadingSettlement] = useState(false);
  const [submittingSettlement, setSubmittingSettlement] = useState(false);

  // Active receipt modal
  const [viewingSettlement, setViewingSettlement] = useState<any | null>(null);

  // New Driver Modal State
  const [showNewDriverModal, setShowNewDriverModal] = useState(false);
  const [newDriverData, setNewDriverData] = useState({
    name: '',
    email: '',
    password: '',
    phoneNumber: '',
    vehicleType: 'MOTO',
    plateNumber: '',
    commissionPerOrder: '25',
    activeCashFloat: '200',
  });
  const [savingDriver, setSavingDriver] = useState(false);

  const { addNotification } = useAppStore();

  const fetchDriverData = useCallback(async () => {
    try {
      // 1. Fetch drivers list
      const driversRes = await fetch('/api/drivers');
      if (driversRes.ok) {
        const driversData = await driversRes.json();
        setDrivers(driversData.drivers || []);
      }

      // 2. Fetch orders in READY status and ON_THE_WAY status
      const ordersRes = await fetch('/api/orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        const allOrders = ordersData.orders || [];
        const ready = allOrders.filter((o: Order) => o.status === 'READY');
        const otw = allOrders.filter((o: Order) => o.status === 'ON_THE_WAY');
        setReadyOrders(ready);
        setActiveDeliveries(otw);
        
        // Auto pre-select first order if none selected
        if (ready.length > 0 && !selectedOrderId) {
          setSelectedOrderId(ready[0].id);
        }
      }

      // 3. Fetch settlements history if on settlement tab
      const settRes = await fetch('/api/drivers/settlements?limit=20');
      if (settRes.ok) {
        const settData = await settRes.json();
        setSettlementsHistory(settData.settlements || []);
      }
    } catch (e) {
      console.error('Failed to load driver dispatch board', e);
    } finally {
      setLoading(false);
    }
  }, [selectedOrderId]);

  // Real-time SSE Connection
  useEffect(() => {
    fetchDriverData();

    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource('/api/orders/stream');

      eventSource.addEventListener('connected', () => {
        setConnectionMode('SSE');
      });

      eventSource.addEventListener('order_updated', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.status === 'READY') {
            if (soundEnabledRef.current) {
              playDispatchChime();
            }
            addNotification(`🔔 ¡Pedido #${payload.orderNumber} listo para despacho!`, 'info');
          }
          fetchDriverData();
        } catch (err) {
          console.error('Error parsing order_updated', err);
        }
      });

      eventSource.addEventListener('order_created', () => {
        fetchDriverData();
      });

      eventSource.onerror = () => {
        setConnectionMode('POLL');
      };
    } catch {
      setConnectionMode('POLL');
    }

    fallbackInterval = setInterval(fetchDriverData, 10000);

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [fetchDriverData, addNotification]);

  // Load pending settlement data when a driver is selected in Settlement tab
  useEffect(() => {
    if (!settlementDriverId) {
      setPendingSettlement(null);
      setSelectedOrderIdsToSettle([]);
      return;
    }

    const loadPending = async () => {
      setLoadingSettlement(true);
      try {
        const res = await fetch(`/api/drivers/pending-settlement?driverId=${settlementDriverId}`);
        if (res.ok) {
          const data: PendingSettlementData = await res.json();
          setPendingSettlement(data);
          const allIds = data.orders.map((o) => o.id);
          setSelectedOrderIdsToSettle(allIds);
          // Auto set default cash turned in = expected
          setCashTurnedInInput(data.summary.suggestedCashToCashier.toFixed(2));
          setCashFloatReturnedInput('0');
        } else {
          setPendingSettlement(null);
        }
      } catch (err) {
        console.error('Error loading pending settlement', err);
      } finally {
        setLoadingSettlement(false);
      }
    };

    loadPending();
  }, [settlementDriverId]);

  // Handler for dispatching order
  const handleAssignOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || !selectedDriverId) return;

    try {
      const res = await fetch(`/api/orders/${selectedOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ON_THE_WAY',
          driverId: selectedDriverId,
        }),
      });

      if (res.ok) {
        await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId: selectedDriverId,
            status: 'DELIVERING',
          }),
        });

        addNotification(`Pedido asignado con éxito a repartidor`, 'success');
        setSelectedOrderId('');
        setSelectedDriverId('');
        fetchDriverData();
      } else {
        alert('Error al asignar el pedido');
      }
    } catch {
      alert('Error de red al despachar pedido');
    }
  };

  // Quick dispatch directly from card
  const handleQuickDispatch = async (orderId: string, driverId: string) => {
    if (!orderId || !driverId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ON_THE_WAY',
          driverId: driverId,
        }),
      });

      if (res.ok) {
        await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId: driverId,
            status: 'DELIVERING',
          }),
        });

        addNotification(`Pedido despachado correctamente`, 'success');
        fetchDriverData();
      }
    } catch {
      alert('Error de red al despachar');
    }
  };

  // Handler for marking delivered
  const handleMarkAsDelivered = async (orderId: string, driverId?: string | null) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED' }),
      });

      if (res.ok) {
        if (driverId) {
          await fetch('/api/drivers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverId,
              status: 'AVAILABLE',
            }),
          });
        }

        addNotification(`Pedido marcado como ENTREGADO. Inventario descontado. Listo para liquidación COD.`, 'success');
        fetchDriverData();
      } else {
        alert('Error al completar pedido');
      }
    } catch {
      alert('Error de red');
    }
  };

  // Handler for creating settlement
  const handleProcessSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementDriverId || selectedOrderIdsToSettle.length === 0) {
      alert('Selecciona al menos un pedido para liquidar');
      return;
    }

    setSubmittingSettlement(true);
    try {
      const res = await fetch('/api/drivers/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: settlementDriverId,
          totalCashTurnedIn: parseFloat(cashTurnedInInput || '0'),
          cashFloatReturned: parseFloat(cashFloatReturnedInput || '0'),
          notes: settlementNotes,
          orderIds: selectedOrderIdsToSettle,
          deductTips,
          deductCommissions,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addNotification(`Liquidación #${data.settlement.settlementNumber} completada con éxito`, 'success');
        setViewingSettlement(data.settlement);
        setSettlementDriverId('');
        setPendingSettlement(null);
        setSelectedOrderIdsToSettle([]);
        setSettlementNotes('');
        fetchDriverData();
      } else {
        alert(data.error || 'Error al procesar la liquidación');
      }
    } catch {
      alert('Error de red al procesar liquidación');
    } finally {
      setSubmittingSettlement(false);
    }
  };

  // Handler for registering new driver
  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDriver(true);
    try {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createNew: true,
          name: newDriverData.name,
          email: newDriverData.email,
          password: newDriverData.password || 'darkflow123',
          phoneNumber: newDriverData.phoneNumber,
          vehicleType: newDriverData.vehicleType,
          plateNumber: newDriverData.plateNumber,
          commissionPerOrder: parseFloat(newDriverData.commissionPerOrder || '0'),
          activeCashFloat: parseFloat(newDriverData.activeCashFloat || '0'),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addNotification(`Repartidor ${newDriverData.name} registrado con éxito`, 'success');
        setShowNewDriverModal(false);
        setNewDriverData({
          name: '',
          email: '',
          password: '',
          phoneNumber: '',
          vehicleType: 'MOTO',
          plateNumber: '',
          commissionPerOrder: '25',
          activeCashFloat: '200',
        });
        fetchDriverData();
      } else {
        alert(data.error || 'Error al registrar chofer');
      }
    } catch {
      alert('Error de red al registrar chofer');
    } finally {
      setSavingDriver(false);
    }
  };

  // SLA elapsed time calculation
  const getElapsedTimeBadge = (dateString?: string | null) => {
    if (!dateString) return null;
    const elapsedMinutes = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60));
    
    let colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (elapsedMinutes >= 40) {
      colorClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse';
    } else if (elapsedMinutes >= 20) {
      colorClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }

    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
        <Clock className="h-3 w-3" />
        {elapsedMinutes} min en ruta
      </span>
    );
  };

  // Settlement KPI Calculations
  const totalPendingCashAcrossDrivers = drivers.reduce(
    (sum, d) => sum + (d.stats?.pendingSettlementCash || 0),
    0
  );
  const totalPendingOrdersAcrossDrivers = drivers.reduce(
    (sum, d) => sum + (d.stats?.pendingSettlementOrdersCount || 0),
    0
  );
  const totalTipsAcrossDrivers = drivers.reduce(
    (sum, d) => sum + (d.stats?.pendingSettlementTips || 0),
    0
  );

  // Settlement Live Balance Calculation
  const calculateCurrentBalance = () => {
    if (!pendingSettlement) {
      return {
        expected: 0,
        turnedIn: 0,
        diff: 0,
        cashSum: 0,
        tipsSum: 0,
        commSum: 0,
        ordersCount: 0,
      };
    }
    
    const selectedOrders = pendingSettlement.orders.filter((o) =>
      selectedOrderIdsToSettle.includes(o.id)
    );
    const cashSum = selectedOrders
      .filter((o) => o.isCash)
      .reduce((s, o) => s + o.total, 0);
    const floatRet = parseFloat(cashFloatReturnedInput || '0');
    const tipsSum = selectedOrders.reduce((s, o) => s + (o.tip || 0), 0);
    const commRate = pendingSettlement.driver.deliveryProfile?.commissionPerOrder || 0;
    const commSum = commRate * selectedOrders.length;

    let netExpected = cashSum + floatRet;
    if (deductTips) netExpected -= tipsSum;
    if (deductCommissions) netExpected -= commSum;

    const turnedIn = parseFloat(cashTurnedInInput || '0');
    const diff = turnedIn - netExpected;

    return {
      expected: netExpected,
      turnedIn,
      diff,
      cashSum,
      tipsSum,
      commSum,
      ordersCount: selectedOrders.length,
    };
  };

  const balanceState = calculateCurrentBalance();

  if (loading) {
    return (
      <DashboardContainer>
        <div className="flex h-[calc(100vh-200px)] items-center justify-center flex-col gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-brand-primary"></div>
          <p className="text-sm text-slate-400">Cargando logística & flotilla de repartidores...</p>
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Flotilla & Despacho de Repartidores</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border ${
                  connectionMode === 'SSE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${connectionMode === 'SSE' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'}`} />
                  {connectionMode === 'SSE' ? 'EN VIVO (SSE)' : 'EN VIVO (POLL)'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Rutas en tiempo real, liquidación de contra-entrega (COD) y arqueo de choferes</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  if (next) playDispatchChime();
                  addNotification(next ? 'Alerta sonora de despacho activa' : 'Alerta silenciada', 'info');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  soundEnabled 
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title={soundEnabled ? 'Silenciar alertas' : 'Activar alertas'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span className="hidden sm:inline">{soundEnabled ? 'Sonido Activo' : 'Mute'}</span>
              </button>

              <button
                onClick={() => playDispatchChime()}
                className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Probar sonido de despacho"
              >
                Probar
              </button>
            </div>

            <button
              onClick={() => fetchDriverData()}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Refrescar datos"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-850 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('DISPATCH')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'DISPATCH'
                  ? 'bg-brand-primary text-slate-950 shadow-lg shadow-brand-primary/20'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-900 border border-slate-800'
              }`}
            >
              <Navigation className="h-4 w-4" />
              Despacho & Rutas en Vivo
              {(readyOrders.length > 0 || activeDeliveries.length > 0) && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'DISPATCH' ? 'bg-slate-950 text-brand-primary' : 'bg-brand-primary text-slate-950'
                }`}>
                  {readyOrders.length + activeDeliveries.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('SETTLEMENT')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'SETTLEMENT'
                  ? 'bg-brand-primary text-slate-950 shadow-lg shadow-brand-primary/20'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-900 border border-slate-800'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              Liquidación de Efectivo (COD)
              {totalPendingOrdersAcrossDrivers > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 animate-pulse">
                  {totalPendingOrdersAcrossDrivers}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('FLEET')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'FLEET'
                  ? 'bg-brand-primary text-slate-950 shadow-lg shadow-brand-primary/20'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-900 border border-slate-800'
              }`}
            >
              <Truck className="h-4 w-4" />
              Control de Flotilla
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                {drivers.length}
              </span>
            </button>
          </div>

          {activeTab === 'FLEET' && (
            <button
              onClick={() => setShowNewDriverModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Plus className="h-4 w-4" /> Registrar Nuevo Chofer
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: DESPACHO & RUTAS EN VIVO */}
        {/* ========================================================================= */}
        {activeTab === 'DISPATCH' && (
          <div className="space-y-6">
            {/* Quick Dispatch Control Bar */}
            <div className="glass-panel border border-slate-800 rounded-2xl p-5 shadow-xl bg-slate-950/60">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-850 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-brand-primary" />
                  <div>
                    <h3 className="font-bold text-white text-sm">Asignación Rápida de Despacho</h3>
                    <p className="text-[11px] text-slate-400">Selecciona el pedido listo y el chofer para enviar a ruta con un clic</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                    <span className="text-slate-400">Listos para Despacho:</span>
                    <span className="font-bold text-white font-mono">{readyOrders.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                    <span className="text-slate-400">En Ruta:</span>
                    <span className="font-bold text-amber-400 font-mono">{activeDeliveries.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                    <span className="text-slate-400">Choferes Disponibles:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {drivers.filter(d => d.deliveryProfile?.status === 'AVAILABLE').length}
                    </span>
                  </div>
                </div>
              </div>

              {readyOrders.length === 0 ? (
                <div className="p-4 text-center border border-slate-800/80 border-dashed rounded-xl text-slate-500 text-xs">
                  No hay pedidos pendientes en estado &quot;Listo&quot;. La cocina está al día.
                </div>
              ) : (
                <form onSubmit={handleAssignOrder} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      1. Seleccionar Pedido Listo
                    </label>
                    <select
                      required
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-brand-primary outline-none"
                    >
                      <option value="">-- Elige comanda lista --</option>
                      {readyOrders.map(order => (
                        <option key={order.id} value={order.id}>
                          #{order.orderNumber} • {order.customerName} (${order.total.toFixed(2)}) • {order.customerAddress || 'Sin dir'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      2. Asignar Repartidor
                    </label>
                    <select
                      required
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-brand-primary outline-none"
                    >
                      <option value="">-- Elige chofer --</option>
                      {drivers.map(d => {
                        const isAvail = d.deliveryProfile?.status === 'AVAILABLE';
                        return (
                          <option key={d.id} value={d.id}>
                            {d.name} {isAvail ? '🟢 (Disponible)' : `🟡 (${d.deliveryProfile?.status || 'Ocupado'})`} - {d.deliveryProfile?.vehicleType || 'MOTO'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <button
                      type="submit"
                      disabled={!selectedOrderId || !selectedDriverId}
                      className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-slate-950 font-bold rounded-xl shadow-lg shadow-brand-primary/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs transition-all"
                    >
                      <Play className="h-4 w-4 fill-slate-950" /> Despachar a Ruta
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Live Dispatch Two-Column Kanban Board */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: READY (Listo para despachar) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500"></div>
                    <h3 className="font-bold text-white text-sm">Listos en Mostrador / Empaque</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                    {readyOrders.length} pedidos
                  </span>
                </div>

                {readyOrders.length === 0 ? (
                  <div className="p-8 text-center border border-slate-850 border-dashed rounded-2xl text-slate-600 text-xs">
                    No hay pedidos en espera de repartidor.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {readyOrders.map((order) => {
                      const isCash = !order.paymentMethod || order.paymentMethod.toUpperCase().includes('CASH') || order.paymentMethod.toUpperCase().includes('EFECTIVO');
                      const mapsUrl = order.customerAddress ? `https://maps.google.com/?q=${encodeURIComponent(order.customerAddress)}` : null;
                      const cleanPhone = order.customerPhone?.replace(/\D/g, '') || '';
                      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.length === 10 ? '52' + cleanPhone : cleanPhone}` : null;

                      return (
                        <div
                          key={order.id}
                          className="glass-panel border border-slate-800 hover:border-slate-700 rounded-xl p-4 shadow-lg space-y-3 transition-all bg-slate-950/70"
                        >
                          {/* Order Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-extrabold text-sm text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                  #{order.orderNumber}
                                </span>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Listo en Cocina
                                </span>
                              </div>
                              <h4 className="font-bold text-white text-xs mt-1">{order.customerName}</h4>
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-extrabold text-emerald-400 font-mono">
                                ${order.total.toFixed(2)}
                              </div>
                              {/* Payment badge */}
                              {isCash ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <Banknote className="h-3 w-3" /> COBRAR EFECTIVO (COD)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  <CreditCard className="h-3 w-3" /> PAGADO EN LÍNEA
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Customer Address & Phone */}
                          <div className="space-y-1.5 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                            {order.customerAddress ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-slate-300 truncate">
                                  <MapPin className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                                  <span className="truncate">{order.customerAddress}</span>
                                </span>
                                {mapsUrl && (
                                  <a
                                    href={mapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-blue-400 hover:text-blue-300 font-bold shrink-0 flex items-center gap-1 underline"
                                  >
                                    Ver Mapa <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-500 italic">Sin dirección registrada (Mostrador)</p>
                            )}

                            {order.customerPhone && (
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-850">
                                <span className="flex items-center gap-1.5 text-slate-400">
                                  <Smartphone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                  <span>{order.customerPhone}</span>
                                </span>
                                {waUrl && (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded font-bold shrink-0 flex items-center gap-1 transition-colors"
                                  >
                                    <MessageCircle className="h-3 w-3" /> WhatsApp
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Items summary */}
                          <div className="text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-500">Items: </span>
                            {order.items.map(i => `${i.quantity}x ${i.product.name}`).join(', ')}
                          </div>

                          {/* Quick assign button bar */}
                          <div className="pt-2 border-t border-slate-850 flex items-center gap-2">
                            <select
                              id={`quick-driver-${order.id}`}
                              defaultValue=""
                              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:border-brand-primary outline-none flex-1"
                            >
                              <option value="">Seleccionar chofer...</option>
                              {drivers.map(d => (
                                <option key={d.id} value={d.id}>
                                  {d.name} ({d.deliveryProfile?.vehicleType})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const selectEl = document.getElementById(`quick-driver-${order.id}`) as HTMLSelectElement;
                                if (selectEl && selectEl.value) {
                                  handleQuickDispatch(order.id, selectEl.value);
                                } else {
                                  alert('Selecciona un repartidor primero');
                                }
                              }}
                              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow cursor-pointer transition-colors"
                            >
                              <Play className="h-3 w-3 fill-white" /> Enviar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: ON THE WAY (En ruta con repartidor) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping"></div>
                    <h3 className="font-bold text-white text-sm">En Ruta de Entrega (Tránsito)</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    {activeDeliveries.length} en tránsito
                  </span>
                </div>

                {activeDeliveries.length === 0 ? (
                  <div className="p-8 text-center border border-slate-850 border-dashed rounded-2xl text-slate-600 text-xs">
                    No hay pedidos en tránsito actualmente.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeDeliveries.map((order) => {
                      const isCash = !order.paymentMethod || order.paymentMethod.toUpperCase().includes('CASH') || order.paymentMethod.toUpperCase().includes('EFECTIVO');
                      const mapsUrl = order.customerAddress ? `https://maps.google.com/?q=${encodeURIComponent(order.customerAddress)}` : null;
                      const cleanPhone = order.customerPhone?.replace(/\D/g, '') || '';
                      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.length === 10 ? '52' + cleanPhone : cleanPhone}` : null;

                      return (
                        <div
                          key={order.id}
                          className="glass-panel border border-slate-800 hover:border-slate-700 rounded-xl p-4 shadow-lg space-y-3 transition-all bg-slate-950/70"
                        >
                          {/* Header & SLA */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-extrabold text-sm text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                  #{order.orderNumber}
                                </span>
                                {getElapsedTimeBadge(order.dispatchedAt)}
                              </div>
                              <h4 className="font-bold text-white text-xs mt-1">{order.customerName}</h4>
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-extrabold text-emerald-400 font-mono">
                                ${order.total.toFixed(2)}
                              </div>
                              {isCash ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <Banknote className="h-3 w-3" /> COBRAR EFECTIVO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  <CreditCard className="h-3 w-3" /> PAGADO ONLINE
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Driver assigned banner */}
                          <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <User className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <span className="text-[10px] text-blue-300 uppercase font-semibold">Repartidor Asignado</span>
                                <p className="font-bold text-white">{order.driver?.name || 'Chofer'}</p>
                              </div>
                            </div>
                            <span className="text-[10px] bg-slate-900 px-2 py-1 rounded text-slate-300 font-mono">
                              {order.driver?.deliveryProfile?.vehicleType || 'MOTO'} {order.driver?.deliveryProfile?.plateNumber ? `• ${order.driver.deliveryProfile.plateNumber}` : ''}
                            </span>
                          </div>

                          {/* Address & WhatsApp */}
                          <div className="space-y-1 text-xs text-slate-300 bg-slate-900/40 p-2.5 rounded-lg">
                            {order.customerAddress && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1 text-slate-300 truncate">
                                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{order.customerAddress}</span>
                                </span>
                                {mapsUrl && (
                                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline shrink-0">
                                    Mapa
                                  </a>
                                )}
                              </div>
                            )}

                            {order.customerPhone && (
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-850">
                                <span className="flex items-center gap-1 text-slate-400">
                                  <Smartphone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                  <span>{order.customerPhone}</span>
                                </span>
                                {waUrl && (
                                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 font-bold hover:underline shrink-0 flex items-center gap-1">
                                    <MessageCircle className="h-3 w-3" /> WhatsApp
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action button: Confirm delivered */}
                          <div className="pt-2 border-t border-slate-850 flex items-center justify-end">
                            <button
                              onClick={() => handleMarkAsDelivered(order.id, order.driverId)}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer transition-colors"
                            >
                              <Check className="h-4 w-4 stroke-[3px]" /> Confirmar Entrega
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: LIQUIDACIÓN DE EFECTIVO (COD SETTLEMENT) */}
        {/* ========================================================================= */}
        {activeTab === 'SETTLEMENT' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel border border-slate-800 rounded-2xl p-4 bg-slate-950/60 shadow-lg">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Efectivo en Calle (Por Liquidar)</span>
                  <DollarSign className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold text-amber-400 font-mono mt-2">
                  ${totalPendingCashAcrossDrivers.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Efectivo contra-entrega pendiente</div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-2xl p-4 bg-slate-950/60 shadow-lg">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Pedidos Entregados Pendientes</span>
                  <Receipt className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-2xl font-extrabold text-blue-400 font-mono mt-2">
                  {totalPendingOrdersAcrossDrivers}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Comandas listas para corte</div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-2xl p-4 bg-slate-950/60 shadow-lg">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Propinas por Liquidar</span>
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-2">
                  ${totalTipsAcrossDrivers.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Registradas para repartidores</div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-2xl p-4 bg-slate-950/60 shadow-lg">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Cortes / Liquidaciones Hoy</span>
                  <ShieldCheck className="h-4 w-4 text-purple-400" />
                </div>
                <div className="text-2xl font-extrabold text-purple-400 font-mono mt-2">
                  {settlementsHistory.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Registradas en el sistema</div>
              </div>
            </div>

            {/* Main Settlement Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Settlement Form & Balance (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="glass-panel border border-slate-800 rounded-2xl p-5 shadow-xl bg-slate-950/70 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-emerald-400" />
                      <div>
                        <h3 className="font-bold text-white text-sm">Corte & Arqueo de Repartidor</h3>
                        <p className="text-[11px] text-slate-400">Recepción de efectivo en caja y liquidación de comandas</p>
                      </div>
                    </div>
                  </div>

                  {/* Driver Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Seleccionar Repartidor a Liquidar:
                    </label>
                    <select
                      value={settlementDriverId}
                      onChange={(e) => setSettlementDriverId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-brand-primary outline-none"
                    >
                      <option value="">-- Elige un repartidor con pedidos pendientes --</option>
                      {drivers.map(d => {
                        const count = d.stats?.pendingSettlementOrdersCount || 0;
                        const cash = d.stats?.pendingSettlementCash || 0;
                        return (
                          <option key={d.id} value={d.id}>
                            {d.name} • {count} pedidos pendientes (${cash.toFixed(2)} en efectivo COD)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {loadingSettlement && (
                    <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                      Calculando balance y comandas del chofer...
                    </div>
                  )}

                  {!loadingSettlement && !pendingSettlement && settlementDriverId && (
                    <div className="p-6 text-center border border-slate-800 rounded-xl text-slate-500 text-xs">
                      Este repartidor no tiene pedidos entregados pendientes de liquidar.
                    </div>
                  )}

                  {!loadingSettlement && pendingSettlement && (
                    <div className="space-y-5 pt-2">
                      {/* Driver Overview Banner */}
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-850 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-bold text-white text-sm">{pendingSettlement.driver.name}</p>
                          <p className="text-slate-400 text-[11px]">
                            {pendingSettlement.driver.deliveryProfile?.vehicleType} • Placas: {pendingSettlement.driver.deliveryProfile?.plateNumber || 'S/N'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase">Fondo de Cambio Asignado:</span>
                          <p className="font-mono font-bold text-white">
                            ${(pendingSettlement.summary.activeCashFloat || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Orders checklist */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300">
                            Comandas a Liquidar ({selectedOrderIdsToSettle.length} de {pendingSettlement.orders.length} seleccionadas):
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedOrderIdsToSettle.length === pendingSettlement.orders.length) {
                                setSelectedOrderIdsToSettle([]);
                              } else {
                                setSelectedOrderIdsToSettle(pendingSettlement.orders.map(o => o.id));
                              }
                            }}
                            className="text-[11px] text-blue-400 hover:underline"
                          >
                            {selectedOrderIdsToSettle.length === pendingSettlement.orders.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                          </button>
                        </div>

                        <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                          {pendingSettlement.orders.map((ord) => {
                            const isSelected = selectedOrderIdsToSettle.includes(ord.id);
                            return (
                              <label
                                key={ord.id}
                                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-slate-900/80 border-slate-700 text-white'
                                    : 'bg-slate-950/40 border-slate-850 text-slate-500'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedOrderIdsToSettle([...selectedOrderIdsToSettle, ord.id]);
                                      } else {
                                        setSelectedOrderIdsToSettle(selectedOrderIdsToSettle.filter(id => id !== ord.id));
                                      }
                                    }}
                                    className="rounded border-slate-700 bg-slate-800 text-brand-primary"
                                  />
                                  <div>
                                    <span className="font-mono font-bold">#{ord.orderNumber}</span>
                                    <span className="text-[11px] text-slate-400 ml-2">{ord.customerName}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    ord.isCash ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                                  }`}>
                                    {ord.isCash ? 'EFECTIVO' : 'ONLINE'}
                                  </span>
                                  <span className="font-mono font-bold text-emerald-400">
                                    ${ord.total.toFixed(2)}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Calculation parameters */}
                      <form onSubmit={handleProcessSettlement} className="space-y-4 pt-3 border-t border-slate-850">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300">
                              Efectivo Entregado a Caja ($):
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={cashTurnedInInput}
                              onChange={(e) => setCashTurnedInInput(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:border-brand-primary outline-none"
                              placeholder="0.00"
                            />
                            <p className="text-[10px] text-slate-500">Monto físico entregado por el chofer</p>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300">
                              Fondo de Cambio Devuelto ($):
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={cashFloatReturnedInput}
                              onChange={(e) => setCashFloatReturnedInput(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-primary outline-none"
                              placeholder="0.00"
                            />
                            <p className="text-[10px] text-slate-500">Dejar en 0 si conserva el fondo para el siguiente turno</p>
                          </div>
                        </div>

                        {/* Deductions check */}
                        <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-850 space-y-2 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={deductTips}
                              onChange={(e) => setDeductTips(e.target.checked)}
                              className="rounded border-slate-700 bg-slate-800 text-brand-primary"
                            />
                            <span className="text-slate-300">
                              Pagar propinas del repartidor directamente del efectivo recaudado (${balanceState.tipsSum.toFixed(2)})
                            </span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={deductCommissions}
                              onChange={(e) => setDeductCommissions(e.target.checked)}
                              className="rounded border-slate-700 bg-slate-800 text-brand-primary"
                            />
                            <span className="text-slate-300">
                              Pagar comisiones por flete directamente del efectivo (${balanceState.commSum.toFixed(2)})
                            </span>
                          </label>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-300">Notas u Observaciones:</label>
                          <input
                            type="text"
                            value={settlementNotes}
                            onChange={(e) => setSettlementNotes(e.target.value)}
                            placeholder="Ej. Entregó cambio exacto, turno vespertino..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-primary outline-none"
                          />
                        </div>

                        {/* Open Cash Session Notification */}
                        {pendingSettlement.openCashSession ? (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                            <CheckCircle className="h-4 w-4 shrink-0" />
                            <span>
                              Sesión de caja activa detectada. El efectivo entregado se ingresará automáticamente como movimiento de caja.
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>
                              No hay sesión de caja abierta en este turno. La liquidación se guardará pero no afectará el corte de caja X/Z.
                            </span>
                          </div>
                        )}

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={submittingSettlement || selectedOrderIdsToSettle.length === 0}
                          className="w-full py-3 bg-brand-primary hover:bg-brand-primary/90 text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 disabled:opacity-40 transition-all cursor-pointer"
                        >
                          {submittingSettlement ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" /> Procesando liquidación...
                            </>
                          ) : (
                            <>
                              <Printer className="h-4 w-4" /> Confirmar Liquidación & Imprimir Comprobante
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Financial Breakdown & Difference (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="glass-panel border border-slate-800 rounded-2xl p-5 shadow-xl bg-slate-950/70 space-y-4">
                  <div className="border-b border-slate-850 pb-3">
                    <h4 className="font-bold text-white text-sm">Resumen Contable del Arqueo</h4>
                    <p className="text-[11px] text-slate-400">Cuadre de caja en tiempo real</p>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-850 text-slate-400">
                      <span>Comandas Seleccionadas:</span>
                      <span className="font-bold text-white">{balanceState.ordersCount || 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-850 text-slate-400">
                      <span>Efectivo Cobrado en Contra-Entrega:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ${(balanceState.cashSum || 0).toFixed(2)}
                      </span>
                    </div>
                    {parseFloat(cashFloatReturnedInput || '0') > 0 && (
                      <div className="flex justify-between py-1 border-b border-slate-850 text-slate-400">
                        <span>(+) Fondo de Cambio Devuelto:</span>
                        <span className="font-mono text-white">
                          ${parseFloat(cashFloatReturnedInput).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {deductTips && (
                      <div className="flex justify-between py-1 border-b border-slate-850 text-slate-400">
                        <span>(-) Propinas Pagadas al Chofer:</span>
                        <span className="font-mono text-rose-400">
                          -${(balanceState.tipsSum || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {deductCommissions && (
                      <div className="flex justify-between py-1 border-b border-slate-850 text-slate-400">
                        <span>(-) Fletes / Comisiones Pagadas:</span>
                        <span className="font-mono text-rose-400">
                          -${(balanceState.commSum || 0).toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between py-2 border-t border-slate-800 text-sm font-bold text-white">
                      <span>Efectivo Neto Esperado en Caja:</span>
                      <span className="font-mono text-brand-primary">
                        ${(balanceState.expected || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between py-1 text-sm font-bold text-white">
                      <span>Efectivo Físico Entregado:</span>
                      <span className="font-mono text-white">
                        ${(balanceState.turnedIn || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Difference box */}
                  <div className={`p-4 rounded-xl border text-center space-y-1 ${
                    Math.abs(balanceState.diff) < 0.01
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : balanceState.diff < -0.01
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}>
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Diferencia de Arqueo
                    </span>
                    <div className="text-xl font-mono font-extrabold">
                      {Math.abs(balanceState.diff) < 0.01 ? (
                        '$0.00 (CUADRE EXACTO)'
                      ) : balanceState.diff < 0 ? (
                        `-$${Math.abs(balanceState.diff).toFixed(2)} (FALTANTE)`
                      ) : (
                        `+$${balanceState.diff.toFixed(2)} (SOBRANTE)`
                      )}
                    </div>
                  </div>
                </div>

                {/* History of settlements */}
                <div className="glass-panel border border-slate-800 rounded-2xl p-4 shadow-xl bg-slate-950/70 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-slate-400" /> Historial Reciente de Liquidaciones
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">{settlementsHistory.length} registros</span>
                  </div>

                  {settlementsHistory.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-slate-500">
                      No hay liquidaciones registradas en este turno.
                    </div>
                  ) : (
                    <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
                      {settlementsHistory.map((s) => (
                        <div
                          key={s.id}
                          className="p-2.5 rounded-xl bg-slate-900 border border-slate-850 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-white text-[11px]">{s.settlementNumber}</span>
                              <span className="text-[10px] text-slate-400">• {s.driver?.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(s.settledAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} • {s.totalOrders} pedidos
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <span className="font-mono font-bold text-emerald-400 text-xs">
                                ${s.totalCashTurnedIn.toFixed(2)}
                              </span>
                              <div className={`text-[9px] font-bold ${
                                Math.abs(s.cashDifference) < 0.01 ? 'text-emerald-500' : s.cashDifference < 0 ? 'text-rose-400' : 'text-amber-400'
                              }`}>
                                Diff: {s.cashDifference >= 0 ? '+' : ''}${s.cashDifference.toFixed(2)}
                              </div>
                            </div>
                            <button
                              onClick={() => setViewingSettlement(s)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Ver Comprobante Térmico"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CONTROL DE FLOTILLA (FLEET MANAGEMENT) */}
        {/* ========================================================================= */}
        {activeTab === 'FLEET' && (
          <div className="space-y-6">
            <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden shadow-xl bg-slate-950/60">
              <div className="p-5 border-b border-slate-850 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-white text-base">Directorio & Configuración de Flotilla</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gestión de choferes, vehículos, fondo de cambio y comisiones por flete
                  </p>
                </div>
                <button
                  onClick={() => setShowNewDriverModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Agregar Repartidor
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {drivers.map((driver) => {
                  const status = driver.deliveryProfile?.status || 'OFFLINE';
                  const vehicle = driver.deliveryProfile?.vehicleType || 'MOTO';
                  const plates = driver.deliveryProfile?.plateNumber;
                  const phone = driver.deliveryProfile?.phoneNumber;
                  const cashFloat = driver.deliveryProfile?.activeCashFloat || 0;
                  const commission = driver.deliveryProfile?.commissionPerOrder || 0;

                  return (
                    <div
                      key={driver.id}
                      className="glass-panel border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4 bg-slate-900/60"
                    >
                      {/* Driver info header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm">{driver.name}</h4>
                            <p className="text-[11px] text-slate-400">{driver.email}</p>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          status === 'AVAILABLE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : status === 'DELIVERING'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            status === 'AVAILABLE' ? 'bg-emerald-400' : status === 'DELIVERING' ? 'bg-amber-400' : 'bg-slate-500'
                          }`} />
                          {status === 'AVAILABLE' ? 'Disponible' : status === 'DELIVERING' ? 'En Reparto' : 'Offline'}
                        </span>
                      </div>

                      {/* Fleet details */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-850">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Vehículo</span>
                          <p className="font-bold text-slate-200 mt-0.5">{vehicle} {plates ? `(${plates})` : ''}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Teléfono</span>
                          <p className="font-bold text-slate-200 mt-0.5">{phone || 'No registrado'}</p>
                        </div>
                        <div className="pt-2 border-t border-slate-850">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Fondo Fijo</span>
                          <p className="font-mono font-bold text-emerald-400 mt-0.5">${cashFloat.toFixed(2)}</p>
                        </div>
                        <div className="pt-2 border-t border-slate-850">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Comisión / Pedido</span>
                          <p className="font-mono font-bold text-blue-400 mt-0.5">${commission.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Active stats */}
                      <div className="flex items-center justify-between text-xs px-1 text-slate-400">
                        <span>En ruta: <strong className="text-white">{driver.stats?.activeDeliveriesCount || 0}</strong></span>
                        <span>Por liquidar: <strong className="text-amber-400 font-mono">${(driver.stats?.pendingSettlementCash || 0).toFixed(2)}</strong></span>
                      </div>

                      {/* Status toggle actions */}
                      <div className="pt-2 border-t border-slate-850 flex items-center justify-between gap-2">
                        <button
                          onClick={async () => {
                            const next = status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
                            await fetch('/api/drivers', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ driverId: driver.id, status: next }),
                            });
                            fetchDriverData();
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold text-center transition-colors"
                        >
                          {status === 'AVAILABLE' ? 'Poner Offline' : 'Poner Disponible'}
                        </button>

                        <button
                          onClick={() => {
                            setSettlementDriverId(driver.id);
                            setActiveTab('SETTLEMENT');
                          }}
                          className="py-1.5 px-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-bold transition-colors"
                        >
                          Liquidar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: REGISTRAR NUEVO REPARTIDOR */}
        {/* ========================================================================= */}
        {showNewDriverModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-base">Registrar Nuevo Repartidor</h3>
                </div>
                <button
                  onClick={() => setShowNewDriverModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateDriver} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Nombre Completo:</label>
                  <input
                    type="text"
                    required
                    value={newDriverData.name}
                    onChange={(e) => setNewDriverData({ ...newDriverData, name: e.target.value })}
                    placeholder="Ej. Juan Pérez"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Correo Electrónico:</label>
                    <input
                      type="email"
                      required
                      value={newDriverData.email}
                      onChange={(e) => setNewDriverData({ ...newDriverData, email: e.target.value })}
                      placeholder="repartidor@darkflow.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-primary outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Teléfono / WhatsApp:</label>
                    <input
                      type="tel"
                      value={newDriverData.phoneNumber}
                      onChange={(e) => setNewDriverData({ ...newDriverData, phoneNumber: e.target.value })}
                      placeholder="5512345678"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Tipo de Vehículo:</label>
                    <select
                      value={newDriverData.vehicleType}
                      onChange={(e) => setNewDriverData({ ...newDriverData, vehicleType: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-primary outline-none"
                    >
                      <option value="MOTO">Motocicleta</option>
                      <option value="BICI">Bicicleta</option>
                      <option value="AUTO">Automóvil</option>
                      <option value="A_PIE">A pie / Caminando</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Placas de Circulación:</label>
                    <input
                      type="text"
                      value={newDriverData.plateNumber}
                      onChange={(e) => setNewDriverData({ ...newDriverData, plateNumber: e.target.value })}
                      placeholder="ABC-123"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Fondo Fijo de Cambio ($):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newDriverData.activeCashFloat}
                      onChange={(e) => setNewDriverData({ ...newDriverData, activeCashFloat: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-brand-primary outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Comisión por Pedido ($):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newDriverData.commissionPerOrder}
                      onChange={(e) => setNewDriverData({ ...newDriverData, commissionPerOrder: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewDriverModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingDriver}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold disabled:opacity-50"
                  >
                    {savingDriver ? 'Guardando...' : 'Registrar Repartidor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: COMPROBANTE TÉRMICO DE LIQUIDACIÓN */}
        {/* ========================================================================= */}
        {viewingSettlement && (
          <DriverSettlementReceiptModal
            settlement={viewingSettlement}
            onClose={() => setViewingSettlement(null)}
          />
        )}
      </div>
    </DashboardContainer>
  );
}
