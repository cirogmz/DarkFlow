'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import {
  Users,
  Utensils,
  Plus,
  Minus,
  Search,
  Check,
  Clock,
  Flame,
  Receipt,
  DollarSign,
  X,
  Send,
  Volume2,
  VolumeX,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Banknote,
  ChevronRight,
  ArrowLeft,
  Coffee,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { playDispatchChime } from '@/lib/sound';

interface WaiterStaff {
  id: string;
  name: string;
  role: string;
  hasPin: boolean;
}

interface TableItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  status: string; // PENDING, COOKING, DONE, SERVED
  serviceStage?: string | null; // STARTER, MAIN, DESSERT, DRINK
  notes?: string | null;
  modifiers?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  servedAt?: string | null;
}

interface TableOrder {
  id: string;
  orderNumber: string;
  diners: number;
  status: string;
  currentStage: string;
  total: number;
  subtotal: number;
  tax: number;
  createdAt: string;
  elapsedMinutes: number;
  prebillPrintedAt?: string | null;
  prebillPrintedCount?: number;
  itemsCount: number;
  kitchenStats: {
    pending: number;
    cooking: number;
    ready: number;
    served: number;
  };
  items: TableItem[];
}

interface TableData {
  id: string;
  number: string;
  name: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'PREBILL' | 'RESERVED';
  zone: string;
  assignedWaiter?: { id: string; name: string } | null;
  activeOrder?: TableOrder | null;
  reservation?: {
    customerName: string;
    reservationDate: string;
    partySize: number;
  } | null;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  categoryId: string;
  category?: { id: string; name: string };
  modifierGroups?: any[];
}

interface CartItem {
  tempId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  serviceStage: 'STARTER' | 'MAIN' | 'DESSERT' | 'DRINK';
  notes: string;
  modifiers?: any[];
}

export default function WaiterPadPage() {
  const router = useRouter();
  const { activeBrand, addNotification } = useAppStore();

  // Navigation State
  const [currentView, setCurrentView] = useState<'TABLES' | 'ORDER_TAKING' | 'TABLE_DETAIL'>('TABLES');
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('TODAS');

  // Operational Data
  const [tables, setTables] = useState<TableData[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [productSearch, setProductSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Active Waiter Identity
  const [activeWaiter, setActiveWaiter] = useState<{ id: string; name: string; role: string } | null>(null);
  const [staffList, setStaffList] = useState<WaiterStaff[]>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Cart / Order Pad State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Item Customization Modal
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemStage, setItemStage] = useState<'STARTER' | 'MAIN' | 'DESSERT' | 'DRINK'>('MAIN');
  const [itemNotes, setItemNotes] = useState('');

  // Open Table Modal State
  const [showOpenTableModal, setShowOpenTableModal] = useState(false);
  const [tableToOpen, setTableToOpen] = useState<TableData | null>(null);
  const [openDiners, setOpenDiners] = useState(2);
  const [openCustomerName, setOpenCustomerName] = useState('');

  // Quick Checkout in Table Modal
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [checkoutTipPct, setCheckoutTipPct] = useState<number>(10);
  const [checkoutCashGiven, setCheckoutCashGiven] = useState<string>('');

  // Audio alerts
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Real-time data fetching
  const loadTablesData = useCallback(async () => {
    try {
      const res = await fetch('/api/waiter/tables');
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
        setZones(['TODAS', ...(data.zones || [])]);

        // Keep selectedTable in sync if currently viewing one
        if (selectedTable) {
          const fresh = (data.tables as TableData[]).find((t) => t.id === selectedTable.id);
          if (fresh) setSelectedTable(fresh);
        }
      }
    } catch (err) {
      console.error('Error fetching tables', err);
    }
  }, [selectedTable]);

  // Load Menu / Catalog
  const loadMenuData = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
      ]);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
      }
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
      }
    } catch (err) {
      console.error('Error loading menu', err);
    }
  }, []);

  // Load Staff
  const loadStaffData = useCallback(async () => {
    try {
      const res = await fetch('/api/waiter/staff');
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff || []);
      }
    } catch (err) {
      console.error('Error loading staff', err);
    }
  }, []);

  // Initial load & Polling
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      // Fetch initial session for waiter name
      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.user) {
            setActiveWaiter({
              id: meData.user.id,
              name: meData.user.name,
              role: meData.user.role,
            });
          }
        }
      } catch (e) {
        console.error('Session error', e);
      }

      await Promise.all([loadTablesData(), loadMenuData(), loadStaffData()]);
      setLoading(false);
    };

    init();

    // Polling every 6 seconds to update tables and kitchen status
    const interval = setInterval(loadTablesData, 6000);
    return () => clearInterval(interval);
  }, [loadTablesData, loadMenuData, loadStaffData]);

  // Handle PIN verification
  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput.trim()) return;

    try {
      const res = await fetch('/api/waiter/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveWaiter(data.user);
        setShowPinModal(false);
        setPinInput('');
        setPinError('');
        addNotification(`Mesero activo: ${data.user.name}`, 'success');
      } else {
        setPinError(data.error || 'PIN incorrecto');
      }
    } catch {
      setPinError('Error de conexión');
    }
  };

  // Open Table action
  const handleConfirmOpenTable = () => {
    if (!tableToOpen) return;
    setShowOpenTableModal(false);
    setSelectedTable(tableToOpen);
    setCartItems([]);
    setCurrentView('ORDER_TAKING');
  };

  // Open item customization modal
  const handleSelectProduct = (product: Product) => {
    setCustomizingProduct(product);
    setItemQty(1);
    setItemNotes('');

    // Detect default kitchen stage by category
    const catName = product.category?.name?.toLowerCase() || '';
    if (catName.includes('bebid') || catName.includes('drink') || catName.includes('trago')) {
      setItemStage('DRINK');
    } else if (catName.includes('entrad') || catName.includes('aperitiv') || catName.includes('botan')) {
      setItemStage('STARTER');
    } else if (catName.includes('postre') || catName.includes('dessert') || catName.includes('dulce')) {
      setItemStage('DESSERT');
    } else {
      setItemStage('MAIN');
    }
  };

  // Add customized item to cart
  const handleAddToCart = () => {
    if (!customizingProduct) return;

    const newItem: CartItem = {
      tempId: `${customizingProduct.id}-${Date.now()}`,
      productId: customizingProduct.id,
      productName: customizingProduct.name,
      quantity: itemQty,
      price: customizingProduct.price,
      serviceStage: itemStage,
      notes: itemNotes.trim(),
    };

    setCartItems([...cartItems, newItem]);
    setCustomizingProduct(null);
    if (soundEnabledRef.current) playDispatchChime();
    addNotification(`+${itemQty} ${customizingProduct.name} agregado`, 'info');
  };

  // Submit cart to Kitchen (Marchar comanda)
  const handleSendOrderToKitchen = async () => {
    if (!selectedTable || cartItems.length === 0) return;

    try {
      const payload = {
        tableId: selectedTable.id,
        diners: selectedTable.activeOrder?.diners || openDiners || 1,
        waiterId: activeWaiter?.id,
        customerName: openCustomerName || undefined,
        items: cartItems.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          price: c.price,
          serviceStage: c.serviceStage,
          notes: c.notes || undefined,
        })),
      };

      const res = await fetch('/api/waiter/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (soundEnabledRef.current) playDispatchChime();
        addNotification(data.message || 'Comanda enviada a cocina', 'success');
        setCartItems([]);
        setIsCartDrawerOpen(false);
        await loadTablesData();

        // Switch to Table Detail view
        const fresh = tables.find((t) => t.id === selectedTable.id);
        if (fresh) setSelectedTable(fresh);
        setCurrentView('TABLE_DETAIL');
      } else {
        alert(data.error || 'Error al enviar comanda');
      }
    } catch {
      alert('Error de red al despachar comanda a cocina');
    }
  };

  // Advance Kitchen Stage (Marchar siguiente tiempo)
  const handleAdvanceStage = async (targetStage: 'STARTER' | 'MAIN' | 'DESSERT') => {
    if (!selectedTable?.activeOrder) return;
    try {
      const res = await fetch(`/api/waiter/orders/${selectedTable.activeOrder.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStage }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (soundEnabledRef.current) playDispatchChime();
        addNotification(data.message, 'success');
        loadTablesData();
      } else {
        alert(data.error || 'Error al marchar tiempo');
      }
    } catch {
      alert('Error de red');
    }
  };

  // Request Prebill
  const handleRequestPrebill = async () => {
    if (!selectedTable) return;
    try {
      const res = await fetch(`/api/waiter/tables/${selectedTable.id}/prebill`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addNotification(data.message, 'success');
        loadTablesData();
      } else {
        alert(data.error || 'Error al solicitar pre-cuenta');
      }
    } catch {
      alert('Error de red');
    }
  };

  // Quick Table Checkout in Waiter Pad
  const handleConfirmCheckout = async () => {
    if (!selectedTable?.activeOrder) return;
    try {
      const tipAmount = (selectedTable.activeOrder.total * checkoutTipPct) / 100;
      const res = await fetch(`/api/waiter/tables/${selectedTable.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: checkoutPaymentMethod,
          tip: tipAmount,
          amountPaid: checkoutCashGiven ? parseFloat(checkoutCashGiven) : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowCheckoutModal(false);
        addNotification(data.message, 'success');
        setSelectedTable(null);
        setCurrentView('TABLES');
        loadTablesData();
      } else {
        alert(data.error || 'Error al cerrar mesa');
      }
    } catch {
      alert('Error de red');
    }
  };

  // Calculations for cart
  const cartSubtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartTax = Number((cartSubtotal * 0.16).toFixed(2));
  const cartTotal = Number((cartSubtotal + cartTax).toFixed(2));

  // Filter products by category & search
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'TODAS' || p.categoryId === selectedCategory;
    const matchesSearch =
      !productSearch.trim() ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.description?.toLowerCase().includes(productSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Table summary counts
  const availableCount = tables.filter((t) => t.status === 'AVAILABLE').length;
  const occupiedCount = tables.filter((t) => t.status === 'OCCUPIED').length;
  const prebillCount = tables.filter((t) => t.status === 'PREBILL').length;

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100 flex-col gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-brand-primary"></div>
        <p className="text-xs text-slate-400">Cargando Comandero Móvil...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* ========================================================================= */}
      {/* COMPACT MOBILE HEADER BAR */}
      {/* ========================================================================= */}
      <header className="h-14 bg-slate-900/95 border-b border-slate-800 px-3 flex items-center justify-between shrink-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          {currentView !== 'TABLES' && (
            <button
              onClick={() => {
                if (currentView === 'ORDER_TAKING' && cartItems.length > 0) {
                  if (confirm('¿Deseas descartar los platillos no enviados?')) {
                    setCartItems([]);
                    setCurrentView(selectedTable?.activeOrder ? 'TABLE_DETAIL' : 'TABLES');
                  }
                } else {
                  setCurrentView(selectedTable?.activeOrder ? 'TABLE_DETAIL' : 'TABLES');
                }
              }}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center text-brand-primary font-bold text-xs">
              WP
            </div>
            <div>
              <h1 className="text-xs font-bold text-white tracking-wide truncate max-w-[120px] sm:max-w-[200px]">
                {activeBrand?.name || 'DarkFlow'}
              </h1>
              <p className="text-[10px] text-slate-400 leading-none">Comandero Móvil</p>
            </div>
          </div>
        </div>

        {/* Right Header: Active Waiter & Actions */}
        <div className="flex items-center gap-2">
          {/* Active Waiter Button */}
          <button
            onClick={() => setShowPinModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <UserCheck className="h-3.5 w-3.5 text-brand-primary" />
            <span className="truncate max-w-[90px]">{activeWaiter?.name || 'Mesero'}</span>
            <span className="text-[9px] bg-slate-900 px-1 py-0.2 rounded text-slate-400">PIN</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded-lg text-xs ${
              soundEnabled ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 bg-slate-800'
            }`}
            title={soundEnabled ? 'Sonido activado' : 'Silenciado'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* Refresh */}
          <button
            onClick={loadTablesData}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            title="Refrescar mesas"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN CONTAINER BY CURRENT VIEW */}
      {/* ========================================================================= */}
      <main className="flex-1 overflow-hidden relative">
        {/* ===================================================================== */}
        {/* VIEW 1: MAPA / SELECTOR DE MESAS */}
        {/* ===================================================================== */}
        {currentView === 'TABLES' && (
          <div className="h-full flex flex-col p-3 overflow-y-auto space-y-3">
            {/* KPI Counter Pill Strip */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold">Libres</span>
                <p className="text-base font-extrabold text-white font-mono">{availableCount}</p>
              </div>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <span className="text-[10px] text-amber-400 uppercase font-semibold">Ocupadas</span>
                <p className="text-base font-extrabold text-white font-mono">{occupiedCount}</p>
              </div>
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                <span className="text-[10px] text-blue-400 uppercase font-semibold">Pre-cuenta</span>
                <p className="text-base font-extrabold text-white font-mono">{prebillCount}</p>
              </div>
            </div>

            {/* Zone Filter Strip (Horizontal Scroll) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 no-scrollbar">
              {zones.map((z) => (
                <button
                  key={z}
                  onClick={() => setSelectedZone(z)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedZone === z
                      ? 'bg-brand-primary text-slate-950 shadow-md shadow-brand-primary/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>

            {/* Tables Grid (Fat-finger friendly) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pb-6">
              {tables
                .filter((t) => selectedZone === 'TODAS' || t.zone === selectedZone)
                .map((table) => {
                  const isAvailable = table.status === 'AVAILABLE';
                  const isOccupied = table.status === 'OCCUPIED';
                  const isPrebill = table.status === 'PREBILL';
                  const isReserved = table.status === 'RESERVED';

                  return (
                    <div
                      key={table.id}
                      onClick={() => {
                        if (isAvailable) {
                          setTableToOpen(table);
                          setOpenDiners(table.capacity || 2);
                          setOpenCustomerName('');
                          setShowOpenTableModal(true);
                        } else {
                          setSelectedTable(table);
                          setCurrentView('TABLE_DETAIL');
                        }
                      }}
                      className={`relative p-3 rounded-2xl border flex flex-col justify-between min-h-[140px] cursor-pointer transition-all active:scale-95 shadow-lg ${
                        isAvailable
                          ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20'
                          : isPrebill
                          ? 'bg-blue-950/40 border-blue-500/50 shadow-blue-500/10'
                          : isOccupied
                          ? 'bg-slate-900 border-amber-500/50 shadow-amber-500/10'
                          : 'bg-purple-950/30 border-purple-500/30'
                      }`}
                    >
                      {/* Top Bar of Table Card */}
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono uppercase">{table.zone}</span>
                          <h3 className="font-extrabold text-base text-white">#{table.number}</h3>
                        </div>

                        {/* Capacity / Diners badge */}
                        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300">
                          <Users className="h-3 w-3 text-slate-400" />
                          {table.activeOrder?.diners || table.capacity}
                        </span>
                      </div>

                      {/* Middle Body */}
                      <div className="my-1">
                        {isAvailable && (
                          <div className="text-center py-2">
                            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Plus className="h-3 w-3" /> Abrir Mesa
                            </span>
                          </div>
                        )}

                        {isOccupied && table.activeOrder && (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400 font-mono">#{table.activeOrder.orderNumber}</span>
                              <span className="font-mono font-extrabold text-emerald-400 text-xs">
                                ${table.activeOrder.total.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-amber-400">
                              <Clock className="h-2.5 w-2.5" />
                              <span>{table.activeOrder.elapsedMinutes}m ocupada</span>
                            </div>
                          </div>
                        )}

                        {isPrebill && table.activeOrder && (
                          <div className="space-y-0.5">
                            <div className="text-[10px] font-bold text-blue-300 bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 rounded text-center">
                              🧾 Pre-cuenta
                            </div>
                            <div className="text-center font-mono font-extrabold text-emerald-400 text-xs mt-1">
                              ${table.activeOrder.total.toFixed(2)}
                            </div>
                          </div>
                        )}

                        {isReserved && table.reservation && (
                          <div className="text-[10px] text-purple-300 bg-purple-500/20 px-1 py-0.5 rounded truncate">
                            Reserva: {table.reservation.customerName}
                          </div>
                        )}
                      </div>

                      {/* Bottom Footer: Waiter & Kitchen Status */}
                      <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="truncate max-w-[80px]">
                          {table.assignedWaiter?.name || table.name || 'Sin asignar'}
                        </span>

                        {table.activeOrder?.kitchenStats && (
                          <div className="flex items-center gap-1">
                            {table.activeOrder.kitchenStats.ready > 0 && (
                              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" title="Platos listos" />
                            )}
                            {table.activeOrder.kitchenStats.cooking > 0 && (
                              <span className="h-2 w-2 rounded-full bg-amber-400" title="Cocinando" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* VIEW 2: COMANDERO TÁCTIL (ORDER TAKING IN TABLE) */}
        {/* ===================================================================== */}
        {currentView === 'ORDER_TAKING' && selectedTable && (
          <div className="h-full flex flex-col">
            {/* Table Header Context Strip */}
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-white">Mesa #{selectedTable.number}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                    👥 {selectedTable.activeOrder?.diners || openDiners} personas
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">{selectedTable.zone} • Mesero: {activeWaiter?.name}</p>
              </div>

              {selectedTable.activeOrder && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400">Total en Mesa:</span>
                  <p className="text-sm font-extrabold font-mono text-emerald-400">
                    ${selectedTable.activeOrder.total.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* Category horizontal scroll & search bar */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/70 space-y-2 shrink-0">
              {/* Search input */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar platillo o bebida..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white focus:border-brand-primary outline-none"
                />
                {productSearch && (
                  <button
                    onClick={() => setProductSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Horizontal Category pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setSelectedCategory('TODAS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === 'TODAS'
                      ? 'bg-brand-primary text-slate-950 shadow-md shadow-brand-primary/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Todas
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === c.id
                        ? 'bg-brand-primary text-slate-950 shadow-md shadow-brand-primary/20'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Products grid */}
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-24">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  className="glass-panel border border-slate-800 hover:border-brand-primary/60 rounded-2xl p-3 flex flex-col justify-between bg-slate-900/60 active:scale-95 transition-all cursor-pointer shadow-md"
                >
                  <div>
                    {p.category && (
                      <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider truncate block">
                        {p.category.name}
                      </span>
                    )}
                    <h4 className="font-bold text-xs text-white mt-0.5 line-clamp-2">{p.name}</h4>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="font-mono font-extrabold text-emerald-400 text-xs">
                      ${p.price.toFixed(2)}
                    </span>
                    <span className="h-6 w-6 rounded-lg bg-brand-primary/20 hover:bg-brand-primary text-brand-primary hover:text-slate-950 flex items-center justify-center font-bold text-xs transition-colors">
                      +
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Floating Cart Bar */}
            {cartItems.length > 0 && (
              <div className="absolute bottom-0 inset-x-0 p-3 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md shadow-2xl z-20">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setIsCartDrawerOpen(true)}
                    className="flex items-center gap-2 text-left"
                  >
                    <div className="h-10 w-10 rounded-xl bg-brand-primary text-slate-950 flex items-center justify-center font-extrabold text-sm shadow-md">
                      {cartItems.reduce((s, i) => s + i.quantity, 0)}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Ver Comanda Pendiente</span>
                      <p className="font-mono font-extrabold text-sm text-white">${cartTotal.toFixed(2)}</p>
                    </div>
                  </button>

                  <button
                    onClick={handleSendOrderToKitchen}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Send className="h-4 w-4" /> Marchar a Cocina ({cartItems.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* VIEW 3: DETALLE & GESTIÓN DE MESA ACTIVA (TABLE DETAIL) */}
        {/* ===================================================================== */}
        {currentView === 'TABLE_DETAIL' && selectedTable && selectedTable.activeOrder && (
          <div className="h-full flex flex-col overflow-y-auto p-4 space-y-4">
            {/* Table Header Summary */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-white">Mesa #{selectedTable.number}</h2>
                    <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full">
                      #{selectedTable.activeOrder.orderNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedTable.zone} • {selectedTable.activeOrder.diners} comensales • Mesero: {selectedTable.assignedWaiter?.name}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Total Acumulado</span>
                  <div className="text-xl font-mono font-extrabold text-emerald-400">
                    ${selectedTable.activeOrder.total.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Service Stage Badge & Timing */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-850 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Abierta hace {selectedTable.activeOrder.elapsedMinutes} minutos</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-slate-500 text-[11px]">Tiempo Activo:</span>
                  <span className="font-bold text-white px-2 py-0.5 rounded bg-slate-800 text-[11px]">
                    {selectedTable.activeOrder.currentStage === 'STARTER'
                      ? '🍲 Entradas'
                      : selectedTable.activeOrder.currentStage === 'MAIN'
                      ? '🥩 Platos Fuertes'
                      : '🍰 Postres'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Action Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => {
                  setCartItems([]);
                  setCurrentView('ORDER_TAKING');
                }}
                className="p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Agregar Platillos</span>
              </button>

              <button
                onClick={() => {
                  const next = selectedTable.activeOrder?.currentStage === 'STARTER' ? 'MAIN' : 'DESSERT';
                  handleAdvanceStage(next);
                }}
                className="p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all"
              >
                <Flame className="h-4 w-4" />
                <span>Marchar Siguiente</span>
              </button>

              <button
                onClick={handleRequestPrebill}
                className="p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all"
              >
                <Receipt className="h-4 w-4" />
                <span>Pedir Pre-cuenta</span>
              </button>

              <button
                onClick={() => setShowCheckoutModal(true)}
                className="p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all"
              >
                <DollarSign className="h-4 w-4" />
                <span>Cobrar en Mesa</span>
              </button>
            </div>

            {/* Items Ordered List */}
            <div className="space-y-2">
              <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">
                Platillos de la Comanda ({selectedTable.activeOrder.items.length}):
              </h3>

              <div className="space-y-2">
                {selectedTable.activeOrder.items.map((item) => {
                  const isDone = item.status === 'DONE';
                  const isCooking = item.status === 'COOKING';
                  const isServed = item.status === 'SERVED';

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-sm">
                            {item.quantity}x {item.productName}
                          </span>
                          <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded text-slate-400 uppercase">
                            {item.serviceStage || 'MAIN'}
                          </span>
                        </div>

                        {item.notes && (
                          <p className="text-[11px] text-amber-300 italic">Nota: {item.notes}</p>
                        )}

                        {/* Kitchen status badge */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isServed
                                ? 'bg-slate-800 text-slate-400'
                                : isDone
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : isCooking
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isDone ? 'bg-emerald-400 animate-ping' : isCooking ? 'bg-amber-400' : 'bg-slate-500'
                              }`}
                            />
                            {isServed ? 'Servido' : isDone ? 'Listo para servir' : isCooking ? 'Cocinando' : 'En cola'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-white text-xs">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL: ABRIR MESA */}
      {/* ========================================================================= */}
      {showOpenTableModal && tableToOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-base">Abrir Mesa #{tableToOpen.number}</h3>
                <p className="text-xs text-slate-400">{tableToOpen.zone} • Capacidad: {tableToOpen.capacity} pers</p>
              </div>
              <button onClick={() => setShowOpenTableModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Diners selector (+ / - big buttons) */}
            <div className="space-y-1 text-center">
              <label className="text-xs font-semibold text-slate-300">Número de Comensales:</label>
              <div className="flex items-center justify-center gap-4 py-2">
                <button
                  type="button"
                  onClick={() => setOpenDiners(Math.max(1, openDiners - 1))}
                  className="h-12 w-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-lg flex items-center justify-center"
                >
                  -
                </button>
                <span className="font-mono font-black text-2xl text-white w-12">{openDiners}</span>
                <button
                  type="button"
                  onClick={() => setOpenDiners(openDiners + 1)}
                  className="h-12 w-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-lg flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            {/* Customer name optional */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Nombre de Referencia (Opcional):</label>
              <input
                type="text"
                value={openCustomerName}
                onChange={(e) => setOpenCustomerName(e.target.value)}
                placeholder="Ej. Familia López"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-primary outline-none"
              />
            </div>

            <button
              onClick={handleConfirmOpenTable}
              className="w-full py-3 bg-brand-primary hover:bg-brand-primary/90 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-brand-primary/20 active:scale-95 transition-all"
            >
              Comenzar Comanda
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PERSONALIZAR ÍTEM & TIEMPO DE COCINA */}
      {/* ========================================================================= */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h3 className="font-bold text-white text-sm">{customizingProduct.name}</h3>
                <span className="font-mono text-emerald-400 font-extrabold text-xs">
                  ${customizingProduct.price.toFixed(2)} c/u
                </span>
              </div>
              <button onClick={() => setCustomizingProduct(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Qty Selector */}
            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-300">Cantidad:</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setItemQty(Math.max(1, itemQty - 1))}
                  className="h-8 w-8 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center"
                >
                  -
                </button>
                <span className="font-mono font-extrabold text-base text-white">{itemQty}</span>
                <button
                  type="button"
                  onClick={() => setItemQty(itemQty + 1)}
                  className="h-8 w-8 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            {/* Kitchen Stage Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Tiempo de Servicio en Cocina:</label>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {[
                  { id: 'STARTER', label: '🍲 Entrada' },
                  { id: 'MAIN', label: '🥩 Plato Fuerte' },
                  { id: 'DESSERT', label: '🍰 Postre' },
                  { id: 'DRINK', label: '🍹 Bebida' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setItemStage(s.id as any)}
                    className={`py-2 px-2.5 rounded-xl font-bold transition-all text-center ${
                      itemStage === s.id
                        ? 'bg-brand-primary text-slate-950 shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Kitchen Notes Chips */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Notas Rápidas para Cocina:</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Sin cebolla',
                  'Salsa aparte',
                  'Término medio',
                  'Bien cocido',
                  'Para compartir',
                  'Sin sal',
                  'Urgente',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setItemNotes(itemNotes ? `${itemNotes}, ${chip}` : chip);
                    }}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition-all"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="Escribe nota especial..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-primary outline-none mt-1"
              />
            </div>

            {/* Total and confirm button */}
            <button
              onClick={handleAddToCart}
              className="w-full py-3 bg-brand-primary hover:bg-brand-primary/90 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              Agregar • ${(customizingProduct.price * itemQty).toFixed(2)}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: VER BANDEJA DE PLATILLOS PENDIENTES */}
      {/* ========================================================================= */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 shadow-2xl max-h-[80vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-extrabold text-white text-base">Comanda Pendiente por Enviar</h3>
              <button onClick={() => setIsCartDrawerOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {cartItems.map((c, index) => (
                <div
                  key={c.tempId}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white">{c.quantity}x {c.productName}</span>
                      <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-400 uppercase">
                        {c.serviceStage}
                      </span>
                    </div>
                    {c.notes && <p className="text-[10px] text-amber-300 italic">{c.notes}</p>}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-emerald-400">
                      ${(c.price * c.quantity).toFixed(2)}
                    </span>
                    <button
                      onClick={() => setCartItems(cartItems.filter((_, i) => i !== index))}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm font-bold text-white">
              <span>Total Comanda:</span>
              <span className="font-mono text-brand-primary text-base">${cartTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={handleSendOrderToKitchen}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <Send className="h-4 w-4" /> Enviar a Cocina (Marchar)
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CAMBIO RÁPIDO DE MESERO POR PIN */}
      {/* ========================================================================= */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-brand-primary" />
                <h3 className="font-bold text-white text-sm">Cambio Rápido de Mesero</h3>
              </div>
              <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Display digits */}
            <div className="text-center py-2">
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-10 w-10 rounded-xl border flex items-center justify-center font-mono font-bold text-lg ${
                      pinInput.length > i
                        ? 'border-brand-primary bg-brand-primary/20 text-brand-primary'
                        : 'border-slate-800 bg-slate-950 text-slate-600'
                    }`}
                  >
                    {pinInput.length > i ? '•' : ''}
                  </div>
                ))}
              </div>
              {pinError && <p className="text-[11px] text-red-400 mt-2">{pinError}</p>}
            </div>

            {/* Numeric Keypad (Fat finger friendly) */}
            <div className="grid grid-cols-3 gap-2 text-sm font-extrabold">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    if (pinInput.length < 6) setPinInput(pinInput + String(num));
                  }}
                  className="h-12 rounded-xl bg-slate-950 hover:bg-slate-800 text-white flex items-center justify-center active:scale-95 transition-all"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPinInput('')}
                className="h-12 rounded-xl bg-slate-950 text-slate-500 hover:text-white text-xs flex items-center justify-center"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pinInput.length < 6) setPinInput(pinInput + '0');
                }}
                className="h-12 rounded-xl bg-slate-950 hover:bg-slate-800 text-white flex items-center justify-center active:scale-95 transition-all"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPinInput(pinInput.slice(0, -1))}
                className="h-12 rounded-xl bg-slate-950 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ⌫
              </button>
            </div>

            <button
              onClick={() => handleVerifyPin()}
              disabled={pinInput.length < 4}
              className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-slate-950 font-extrabold rounded-xl text-xs disabled:opacity-40 transition-all"
            >
              Confirmar PIN
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: COBRO RÁPIDO EN MESA */}
      {/* ========================================================================= */}
      {showCheckoutModal && selectedTable?.activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h3 className="font-extrabold text-white text-base">Cobro en Mesa #{selectedTable.number}</h3>
                <p className="text-xs text-slate-400">Total consumo: ${selectedTable.activeOrder.total.toFixed(2)}</p>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Tip suggestion chips */}
            <div className="space-y-1 text-xs">
              <label className="text-slate-400 font-semibold">Propina Sugerida:</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setCheckoutTipPct(pct)}
                    className={`py-1.5 rounded-xl font-bold text-center ${
                      checkoutTipPct === pct
                        ? 'bg-brand-primary text-slate-950 shadow-md'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {pct === 0 ? 'Sin propina' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment method selector */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCheckoutPaymentMethod('CASH')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 ${
                  checkoutPaymentMethod === 'CASH'
                    ? 'bg-emerald-500 text-slate-950 font-extrabold'
                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                }`}
              >
                <Banknote className="h-4 w-4" /> Efectivo
              </button>
              <button
                type="button"
                onClick={() => setCheckoutPaymentMethod('CARD')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 ${
                  checkoutPaymentMethod === 'CARD'
                    ? 'bg-blue-500 text-white font-extrabold'
                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                }`}
              >
                <CreditCard className="h-4 w-4" /> Tarjeta / POS
              </button>
            </div>

            {/* Cash given input if Cash */}
            {checkoutPaymentMethod === 'CASH' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Efectivo Recibido ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={checkoutCashGiven}
                  onChange={(e) => setCheckoutCashGiven(e.target.value)}
                  placeholder={`Mínimo $${(
                    selectedTable.activeOrder.total * (1 + checkoutTipPct / 100)
                  ).toFixed(2)}`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-brand-primary outline-none"
                />
              </div>
            )}

            {/* Summary */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-850 space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Consumo:</span>
                <span className="font-mono">${selectedTable.activeOrder.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Propina ({checkoutTipPct}%):</span>
                <span className="font-mono text-emerald-400">
                  +${((selectedTable.activeOrder.total * checkoutTipPct) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-white pt-1 border-t border-slate-850">
                <span>Total a Cobrar:</span>
                <span className="font-mono text-brand-primary">
                  ${(selectedTable.activeOrder.total * (1 + checkoutTipPct / 100)).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={handleConfirmCheckout}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <CheckCircle className="h-4 w-4" /> Cobrar y Liberar Mesa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
