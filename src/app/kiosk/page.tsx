'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Utensils,
  ShoppingBag,
  CreditCard,
  Wallet,
  Coins,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Plus,
  Minus,
  X,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  Lock,
  Flame,
  Clock,
  Zap,
  Timer,
  Tag,
  ArrowLeft,
  Search,
  ShieldCheck,
  Check
} from 'lucide-react';
import { PriceRuleItem, calculateItemPriceRule, formatRuleCountdown, getRuleRemainingSeconds } from '@/lib/priceRules';

interface BrandSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  kioskHeroTitle?: string | null;
  kioskHeroSubtitle?: string | null;
  kioskIdleTimeoutSeconds?: number;
  kioskAllowCashAtCounter?: boolean;
  kioskPagersEnabled?: boolean;
}

interface ModifierOption {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: ModifierOption[];
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  categoryId: string;
  allergens?: string | null;
  dietaryTags?: string | null;
  modifierGroups?: ModifierGroup[];
}

interface Category {
  id: string;
  name: string;
  products: Product[];
}

interface CartItem {
  cartId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice: number;
  discountAmount: number;
  promoBadge?: string | null;
  notes?: string;
  modifiers?: { id?: string; name: string; price: number }[];
}

export default function KioskPage({ initialSlug }: { initialSlug?: string }) {
  // Brand & Kiosk state
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<BrandSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceRules, setPriceRules] = useState<PriceRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // Kiosk Modes: 'ATTRACT' | 'ORDER_TYPE' | 'CATALOG' | 'CHECKOUT' | 'SUCCESS'
  const [kioskStep, setKioskStep] = useState<'ATTRACT' | 'ORDER_TYPE' | 'CATALOG' | 'CHECKOUT' | 'SUCCESS'>('ATTRACT');
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Customization modal
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [itemNotePreset, setItemNotePreset] = useState<string>('');

  // Checkout inputs
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [locatorNumber, setLocatorNumber] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'WALLET' | 'CASH_COUNTER'>('CARD');
  const [isPayingSimulation, setIsPayingSimulation] = useState(false);

  // Success state
  const [confirmedOrder, setConfirmedOrder] = useState<{
    turnNumber: string;
    orderNumber: string;
    total: number;
    paymentMethod: string;
  } | null>(null);
  const [successCountdown, setSuccessCountdown] = useState(15);

  // Idle timer for screensaver / attract loop
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Admin / Supervisor Pin Modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [logoTapCount, setLogoTapCount] = useState(0);

  // Real-time second ticker for countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Kiosk Catalog & Brands
  const loadKioskData = useCallback(async (slug?: string) => {
    try {
      setLoading(true);
      const url = slug ? `/api/public/kiosk?slug=${slug}` : '/api/public/kiosk';
      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success) {
        setBrands(data.brands || []);
        setSelectedBrand(data.selectedBrand || null);
        setCategories(data.categories || []);
        setPriceRules(data.priceRules || []);
        if (data.categories && data.categories.length > 0) {
          setSelectedCategory(data.categories[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading kiosk data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKioskData(initialSlug);
  }, [initialSlug, loadKioskData]);

  // Idle Watchdog: return to Attract Loop after configured idle time
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (kioskStep === 'ATTRACT' || kioskStep === 'SUCCESS') return;

    const timeoutSeconds = selectedBrand?.kioskIdleTimeoutSeconds || 60;
    idleTimerRef.current = setTimeout(() => {
      // Clear cart and return to Attract Loop
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setLocatorNumber('');
      setKioskStep('ATTRACT');
    }, timeoutSeconds * 1000);
  }, [kioskStep, selectedBrand]);

  useEffect(() => {
    const handleActivity = () => resetIdleTimer();
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);
    resetIdleTimer();

    return () => {
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // Success auto-reset countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (kioskStep === 'SUCCESS') {
      setSuccessCountdown(15);
      interval = setInterval(() => {
        setSuccessCountdown((prev) => {
          if (prev <= 1) {
            setKioskStep('ATTRACT');
            setConfirmedOrder(null);
            setCart([]);
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [kioskStep]);

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Logo Triple Tap Handler to open Supervisor Settings
  const handleLogoTap = () => {
    setLogoTapCount((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        setShowPinModal(true);
        setPinInput('');
        return 0;
      }
      return next;
    });
    setTimeout(() => setLogoTapCount(0), 1500);
  };

  // Helper to extract modifier groups safely
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getProductModifierGroups = (product: Product): ModifierGroup[] => {
    if (!product.modifierGroups) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return product.modifierGroups.map((mg: any) => mg.modifierGroup || mg);
  };

  // Open Customization Modal for Product
  const openCustomizer = (product: Product) => {
    setCustomizingProduct(product);
    setModalQty(1);
    setItemNotePreset('');

    // Preselect default modifiers
    const initialMods: Record<string, string[]> = {};
    const groups = getProductModifierGroups(product);
    groups.forEach((group) => {
      const defaults = group.options ? group.options.filter((o) => o.isDefault).map((o) => o.id) : [];
      if (defaults.length > 0) {
        initialMods[group.id] = defaults;
      }
    });
    setSelectedModifiers(initialMods);
  };

  // Add customized product to cart
  const handleAddCustomizedToCart = () => {
    if (!customizingProduct) return;

    // Collect all chosen modifier options
    const flatModifiers: { id?: string; name: string; price: number }[] = [];
    const groups = getProductModifierGroups(customizingProduct);
    groups.forEach((group) => {
      const chosenIds = selectedModifiers[group.id] || [];
      if (group.options) {
        group.options
          .filter((opt) => chosenIds.includes(opt.id))
          .forEach((opt) => {
            flatModifiers.push({ id: opt.id, name: opt.name, price: opt.price });
          });
      }
    });

    const extraPrice = flatModifiers.reduce((acc, m) => acc + m.price, 0);

    // Dynamic price rule evaluation
    const ruleEval = calculateItemPriceRule(
      {
        id: customizingProduct.id,
        price: customizingProduct.price,
        categoryId: customizingProduct.categoryId,
      },
      modalQty,
      priceRules,
      now
    );

    const effectiveUnit = ruleEval.hasPromo
      ? ruleEval.effectiveUnitPrice + extraPrice
      : customizingProduct.price + extraPrice;

    const originalUnit = customizingProduct.price + extraPrice;

    const newItem: CartItem = {
      cartId: `kiosk_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: customizingProduct.id,
      name: customizingProduct.name,
      quantity: modalQty,
      unitPrice: effectiveUnit,
      originalUnitPrice: originalUnit,
      discountAmount: ruleEval.hasPromo ? ruleEval.savings : 0,
      promoBadge: ruleEval.badgeText,
      notes: itemNotePreset.trim() || undefined,
      modifiers: flatModifiers.length > 0 ? flatModifiers : undefined,
    };

    setCart((prev) => [...prev, newItem]);
    setCustomizingProduct(null);
  };

  // Cart Totals
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  }, [cart]);

  const cartTotalSavings = useMemo(() => {
    return cart.reduce((acc, i) => acc + (i.discountAmount || 0), 0);
  }, [cart]);

  // Submit Order from Kiosk
  const handlePlaceKioskOrder = async () => {
    if (cart.length === 0) return;
    if (!customerName || !customerName.trim()) {
      alert('Por favor escribe tu nombre para identificarte al recoger tu comida.');
      return;
    }

    if (paymentMethod === 'WALLET' && (!customerPhone || !customerPhone.trim())) {
      alert('Por favor ingresa tu número celular para debitar de tu Monedero Digital.');
      return;
    }

    try {
      setIsPayingSimulation(true);

      // Brief animation pause for terminal/card simulation
      if (paymentMethod === 'CARD') {
        await new Promise((r) => setTimeout(r, 1800));
      }

      const payload = {
        brandSlug: selectedBrand?.slug,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        orderType,
        locatorNumber: locatorNumber.trim() || undefined,
        paymentMethod,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          notes: i.notes,
          modifiers: i.modifiers,
        })),
      };

      const res = await fetch('/api/public/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar pedido');
      }

      setConfirmedOrder({
        turnNumber: data.turnNumber,
        orderNumber: data.order.orderNumber,
        total: data.order.total,
        paymentMethod: data.order.paymentMethod,
      });

      setKioskStep('SUCCESS');
      setIsCartOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al confirmar pedido');
    } finally {
      setIsPayingSimulation(false);
    }
  };

  // Active Promo Banner Calculation
  const activePromoBanner = useMemo(() => {
    if (!priceRules || priceRules.length === 0) return null;
    const active = priceRules.find((r) => r.isActive && r.badgeLabel);
    if (!active) return null;
    const remaining = getRuleRemainingSeconds(active, now);
    return {
      rule: active,
      countdown: remaining !== null ? formatRuleCountdown(remaining) : null,
    };
  }, [priceRules, now]);

  if (loading && !selectedBrand) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <h2 className="text-xl font-black tracking-wide">Iniciando DarkFlow Kiosk...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between select-none overflow-hidden touch-none font-sans">
      {/* ======================================================================= */}
      {/* 1. ATTRACT LOOP / SCREENSAVER SCREEN */}
      {/* ======================================================================= */}
      {kioskStep === 'ATTRACT' && (
        <div
          onClick={() => setKioskStep('ORDER_TYPE')}
          className="relative min-h-screen w-full flex flex-col items-center justify-between p-8 bg-gradient-to-b from-slate-900 via-slate-950 to-black cursor-pointer overflow-hidden animate-fade-in"
        >
          {/* Ambient Glowing Background Orb */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

          {/* Top Bar with Brand & Supervisor tap target */}
          <div className="w-full flex items-center justify-between z-10">
            <div onClick={(e) => { e.stopPropagation(); handleLogoTap(); }} className="flex items-center gap-3">
              {selectedBrand?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedBrand.logoUrl} alt={selectedBrand.name} className="w-16 h-16 rounded-2xl object-cover shadow-2xl border border-slate-700" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-2xl shadow-xl">
                  {selectedBrand?.name.charAt(0) || 'D'}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">{selectedBrand?.name}</h1>
                <p className="text-xs text-amber-400 font-bold uppercase tracking-widest">Kiosco de Autoservicio</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activePromoBanner && (
                <div className="px-4 py-2 bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/40 rounded-full text-xs font-black text-amber-300 flex items-center gap-2 shadow-lg">
                  <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
                  <span>{activePromoBanner.rule.badgeLabel}</span>
                  {activePromoBanner.countdown && (
                    <span className="font-mono bg-slate-900 px-2 py-0.5 rounded-full text-[11px] text-white">
                      {activePromoBanner.countdown}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Middle Hero Section */}
          <div className="text-center space-y-6 z-10 my-auto max-w-2xl">
            <div className="inline-flex p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-2xl animate-bounce">
              <Utensils className="w-16 h-16" />
            </div>

            <div className="space-y-2">
              <h2 className="text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-md">
                {selectedBrand?.kioskHeroTitle || '¡Bienvenido! Ordena aquí'}
              </h2>
              <p className="text-lg md:text-xl text-slate-400 max-w-md mx-auto">
                {selectedBrand?.kioskHeroSubtitle || 'Toca la pantalla para comenzar tu pedido'}
              </p>
            </div>

            {/* Pulsing Touch Indicator Button */}
            <div className="pt-6">
              <div className="inline-block py-5 px-12 rounded-3xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-2xl shadow-2xl shadow-amber-500/40 border border-amber-300 animate-pulse tracking-wide">
                TOCA PARA ORDENAR
              </div>
            </div>
          </div>

          {/* Multi-Brand Food Hall Switcher (if more than 1 brand active) */}
          {brands.length > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-3 z-10 flex items-center justify-center gap-3 backdrop-blur-md"
            >
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-2">Restaurantes:</span>
              <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
                {brands.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBrand(b);
                      loadKioskData(b.slug);
                    }}
                    className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      selectedBrand?.id === b.id
                        ? 'bg-amber-500 text-slate-950 shadow-lg'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>{b.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-600 font-medium z-10 pt-4">
            DarkFlow Touchscreen Kiosk • Versión 1.55.0
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 2. ORDER TYPE SELECTOR (COMER AQUÍ VS LLEVAR) */}
      {/* ======================================================================= */}
      {kioskStep === 'ORDER_TYPE' && (
        <div className="min-h-screen w-full flex flex-col justify-between p-8 bg-slate-950 animate-fade-in">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setKioskStep('ATTRACT')}
              className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl text-sm font-bold flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" /> Cancelar
            </button>
            <h3 className="text-lg font-black text-white">{selectedBrand?.name}</h3>
            <div className="w-20" />
          </div>

          {/* Cards */}
          <div className="max-w-3xl mx-auto w-full my-auto space-y-8 text-center">
            <h2 className="text-4xl md:text-5xl font-black text-white">¿Dónde vas a comer hoy?</h2>

            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => {
                  setOrderType('DINE_IN');
                  setKioskStep('CATALOG');
                }}
                className="p-10 rounded-3xl bg-slate-900 border-2 border-slate-800 hover:border-amber-500 hover:bg-slate-850 flex flex-col items-center justify-center space-y-4 shadow-2xl transition-all active:scale-95 cursor-pointer group"
              >
                <div className="w-24 h-24 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Utensils className="w-12 h-12" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Comer Aquí</h3>
                  <p className="text-xs text-slate-400 mt-1">Disfruta tu comida en nuestras mesas del salón</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setOrderType('TAKEAWAY');
                  setKioskStep('CATALOG');
                }}
                className="p-10 rounded-3xl bg-slate-900 border-2 border-slate-800 hover:border-amber-500 hover:bg-slate-850 flex flex-col items-center justify-center space-y-4 shadow-2xl transition-all active:scale-95 cursor-pointer group"
              >
                <div className="w-24 h-24 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShoppingBag className="w-12 h-12" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Para Llevar</h3>
                  <p className="text-xs text-slate-400 mt-1">Te empacamos tu pedido listo para llevar</p>
                </div>
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-slate-500">
            Puedes cambiar tu opción antes de realizar el pago
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 3. CATALOG SCREEN (TOUCH-FIRST INTERFACE) */}
      {/* ======================================================================= */}
      {kioskStep === 'CATALOG' && (
        <div className="min-h-screen flex flex-col justify-between bg-slate-950">
          {/* Header */}
          <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0 shadow-lg">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setKioskStep('ORDER_TYPE')}
                className="p-2.5 rounded-2xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  {selectedBrand?.name}
                  <span className="text-xs bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-full">
                    {orderType === 'DINE_IN' ? '🍽️ Comer Aquí' : '🛍️ Para Llevar'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Toca cualquier platillo para personalizar</p>
              </div>
            </div>

            {/* Cart Trigger button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="py-3 px-5 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black rounded-2xl flex items-center gap-3 shadow-xl shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <ShoppingBag className="w-6 h-6" />
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold leading-none">Mi Pedido ({cart.reduce((a, b) => a + b.quantity, 0)})</p>
                <p className="text-base font-black leading-tight">${cartSubtotal.toFixed(2)} MXN</p>
              </div>
            </button>
          </header>

          {/* Active Flash Deal Banner in Catalog */}
          {activePromoBanner && (
            <div className="bg-gradient-to-r from-amber-600 to-rose-600 px-6 py-2 text-slate-950 flex items-center justify-between text-xs font-black shadow-md">
              <div className="flex items-center gap-2 text-white">
                <Flame className="w-4 h-4 fill-amber-300 text-amber-300 animate-bounce" />
                <span>¡{activePromoBanner.rule.name}! — {activePromoBanner.rule.badgeLabel}</span>
              </div>
              {activePromoBanner.countdown && (
                <div className="flex items-center gap-1.5 bg-black/40 text-amber-300 px-2.5 py-0.5 rounded-full font-mono text-[11px]">
                  <Timer className="w-3.5 h-3.5" /> Termina en: {activePromoBanner.countdown}
                </div>
              )}
            </div>
          )}

          {/* Body: Left Categories + Right Products */}
          <div className="flex-1 flex overflow-hidden">
            {/* Category Sidebar */}
            <aside className="w-56 bg-slate-900/60 border-r border-slate-800 p-4 space-y-2 overflow-y-auto scrollbar-none shrink-0">
              {categories.map((c) => {
                const isSelected = selectedCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`w-full p-4 rounded-2xl text-left font-black text-sm flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-[1.02]'
                        : 'bg-slate-850/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="text-xs opacity-75">{c.products.length}</span>
                  </button>
                );
              })}
            </aside>

            {/* Product Grid */}
            <main className="flex-1 p-6 overflow-y-auto scrollbar-none grid grid-cols-2 lg:grid-cols-3 gap-6 pb-28">
              {categories
                .find((c) => c.id === selectedCategory)
                ?.products.map((p) => {
                  const ruleEval = calculateItemPriceRule(
                    { id: p.id, price: p.price, categoryId: p.categoryId },
                    1,
                    priceRules,
                    now
                  );

                  return (
                    <div
                      key={p.id}
                      onClick={() => openCustomizer(p)}
                      className="bg-slate-900 border border-slate-800 hover:border-amber-500/70 rounded-3xl p-5 flex flex-col justify-between space-y-4 shadow-xl active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group"
                    >
                      {ruleEval.hasPromo && (
                        <div className="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-black text-[11px] px-2.5 py-0.5 rounded-full shadow-md z-10">
                          {ruleEval.badgeText || 'PROMO'}
                        </div>
                      )}

                      <div className="space-y-2">
                        {p.imageUrl ? (
                          <div className="w-full h-40 rounded-2xl overflow-hidden bg-slate-950 relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          </div>
                        ) : (
                          <div className="w-full h-36 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-600">
                            <Utensils className="w-12 h-12" />
                          </div>
                        )}

                        <h3 className="font-black text-lg text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                          {p.name}
                        </h3>
                        {p.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {p.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <div>
                          <p className="text-lg font-black text-emerald-400">
                            ${ruleEval.effectiveUnitPrice.toFixed(2)}{' '}
                            <span className="text-[10px] text-slate-400">MXN</span>
                          </p>
                          {ruleEval.hasPromo && (
                            <p className="text-xs text-slate-500 line-through">
                              ${p.price.toFixed(2)}
                            </p>
                          )}
                        </div>

                        <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 font-black">
                          <Plus className="w-5 h-5 stroke-[3px]" />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </main>
          </div>

          {/* Floating Bottom Cart Bar */}
          {cart.length > 0 && (
            <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 z-40">
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Total del Pedido</p>
                  <p className="text-2xl font-black text-white">
                    ${cartSubtotal.toFixed(2)} <span className="text-xs text-amber-400">MXN</span>
                  </p>
                  {cartTotalSavings > 0 && (
                    <p className="text-[11px] text-emerald-400 font-bold">
                      ¡Estás ahorrando ${cartTotalSavings.toFixed(2)} MXN con promociones!
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsCartOpen(true)}
                    className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-sm cursor-pointer"
                  >
                    Ver Lista ({cart.reduce((a, b) => a + b.quantity, 0)})
                  </button>

                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      setKioskStep('CHECKOUT');
                    }}
                    className="py-3.5 px-8 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-base rounded-2xl flex items-center gap-2 shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Continuar al Pago</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 4. PRODUCT CUSTOMIZATION MODAL */}
      {/* ======================================================================= */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] flex flex-col justify-between overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-2xl font-black text-white">{customizingProduct.name}</h3>
                <p className="text-xs text-slate-400">${customizingProduct.price.toFixed(2)} MXN c/u</p>
              </div>
              <button
                onClick={() => setCustomizingProduct(null)}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Modifiers */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
              {/* Modifier Groups */}
              {getProductModifierGroups(customizingProduct).length > 0 && (
                <div className="space-y-4">
                  {getProductModifierGroups(customizingProduct).map((group) => (
                    <div key={group.id} className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-white uppercase tracking-wider">{group.name}</span>
                        <span className="text-slate-400">
                          {group.maxSelect === 1 ? 'Elige 1' : `Hasta ${group.maxSelect}`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {group.options.map((opt) => {
                          const isSelected = (selectedModifiers[group.id] || []).includes(opt.id);

                          return (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setSelectedModifiers((prev) => {
                                  const current = prev[group.id] || [];
                                  if (group.maxSelect === 1) {
                                    return { ...prev, [group.id]: [opt.id] };
                                  }
                                  if (current.includes(opt.id)) {
                                    return { ...prev, [group.id]: current.filter((x) => x !== opt.id) };
                                  }
                                  if (current.length < group.maxSelect) {
                                    return { ...prev, [group.id]: [...current, opt.id] };
                                  }
                                  return prev;
                                });
                              }}
                              className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex justify-between items-center ${
                                isSelected
                                  ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                                  : 'bg-slate-850 border-slate-700 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              <span>{opt.name}</span>
                              {opt.price > 0 && <span>+${opt.price}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Special Note Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider">
                  Instrucciones especiales para cocina:
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Sin cebolla', 'Salsa aparte', 'Bien cocido', 'Poco picante', 'Sin sal', 'Extra servilletas'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setItemNotePreset((prev) => (prev === preset ? '' : preset))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        itemNotePreset === preset
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Quantity & Add Button */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 p-1.5 rounded-2xl">
                <button
                  onClick={() => setModalQty((prev) => Math.max(1, prev - 1))}
                  className="w-10 h-10 rounded-xl bg-slate-700 text-white font-black text-lg flex items-center justify-center active:scale-95"
                >
                  -
                </button>
                <span className="font-black text-xl text-white px-2">{modalQty}</span>
                <button
                  onClick={() => setModalQty((prev) => prev + 1)}
                  className="w-10 h-10 rounded-xl bg-slate-700 text-white font-black text-lg flex items-center justify-center active:scale-95"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddCustomizedToCart}
                className="flex-1 py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-base rounded-2xl shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer text-center"
              >
                Agregar al Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 5. CART SLIDE-OVER DRAWER */}
      {/* ======================================================================= */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-amber-400" />
                <h3 className="text-xl font-black text-white">Mi Pedido</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800 my-4 pr-1 scrollbar-none">
              {cart.map((item) => (
                <div key={item.cartId} className="py-3 space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-white">{item.name}</h4>
                      {item.promoBadge && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-black">
                          {item.promoBadge}
                        </span>
                      )}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <p className="text-[11px] text-slate-400">
                          {item.modifiers.map((m) => m.name).join(', ')}
                        </p>
                      )}
                      {item.notes && <p className="text-[11px] text-amber-300 italic">Nota: {item.notes}</p>}
                    </div>
                    <span className="font-black text-sm text-emerald-400">
                      ${(item.unitPrice * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400">Cantidad: {item.quantity}</span>
                    <button
                      onClick={() => setCart((prev) => prev.filter((x) => x.cartId !== item.cartId))}
                      className="text-xs text-rose-400 font-bold hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Drawer Bottom */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-slate-300">
                  <span>Subtotal:</span>
                  <span>${cartSubtotal.toFixed(2)} MXN</span>
                </div>
                {cartTotalSavings > 0 && (
                  <div className="flex justify-between text-xs text-emerald-400 font-bold">
                    <span>Ahorro en Descuentos:</span>
                    <span>-${cartTotalSavings.toFixed(2)} MXN</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-black text-white pt-2 border-t border-slate-800">
                  <span>Total:</span>
                  <span className="text-amber-400">${cartSubtotal.toFixed(2)} MXN</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsCartOpen(false);
                  setKioskStep('CHECKOUT');
                }}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-base rounded-2xl shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Proceder al Pago</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 6. CHECKOUT SCREEN (VIRTUAL KEYBOARDS & PAYMENT) */}
      {/* ======================================================================= */}
      {kioskStep === 'CHECKOUT' && (
        <div className="min-h-screen bg-slate-950 p-8 flex flex-col justify-between max-w-4xl mx-auto animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <button
              onClick={() => setKioskStep('CATALOG')}
              className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl text-sm font-bold flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" /> Volver al Menú
            </button>
            <h2 className="text-2xl font-black text-white">Finalizar Pedido</h2>
            <div className="w-20" />
          </div>

          {/* Form */}
          <div className="space-y-6 my-auto max-w-2xl mx-auto w-full">
            {/* Customer Name */}
            <div className="space-y-2">
              <label className="text-sm font-black text-white uppercase tracking-wider block">
                1. ¿A nombre de quién sale la orden?
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Escribe tu nombre (Ej. Carlos)"
                className="w-full bg-slate-900 border-2 border-slate-800 focus:border-amber-500 rounded-2xl p-4 text-xl font-bold text-white placeholder-slate-600 outline-none"
              />
              {/* Quick touch names or alphabet presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Juan', 'Carlos', 'Sofía', 'Mariana', 'Luis', 'Ana'].map((name) => (
                  <button
                    key={name}
                    onClick={() => setCustomerName(name)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Pager / Locator number */}
            {orderType === 'DINE_IN' && selectedBrand?.kioskPagersEnabled && (
              <div className="space-y-2">
                <label className="text-sm font-black text-white uppercase tracking-wider block">
                  2. Localizador de mesa / Buzzer (Opcional):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={locatorNumber}
                    onChange={(e) => setLocatorNumber(e.target.value)}
                    placeholder="Número de localizador (Ej. 14)"
                    className="w-full bg-slate-900 border-2 border-slate-800 focus:border-amber-500 rounded-2xl p-4 text-lg font-bold text-white placeholder-slate-600 outline-none"
                  />
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        onClick={() => setLocatorNumber(String(num))}
                        className="w-12 h-12 rounded-xl bg-slate-800 text-amber-400 font-black text-base flex items-center justify-center hover:bg-slate-700"
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="text-sm font-black text-white uppercase tracking-wider block">
                {orderType === 'DINE_IN' ? '3' : '2'}. Selecciona tu método de pago:
              </label>

              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-5 rounded-2xl border-2 text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'CARD'
                      ? 'bg-blue-500/15 border-blue-500 text-blue-300 shadow-xl'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <CreditCard className="w-8 h-8" />
                  <span className="text-sm font-black">Tarjeta de Débito / Crédito</span>
                </button>

                <button
                  onClick={() => setPaymentMethod('WALLET')}
                  className={`p-5 rounded-2xl border-2 text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'WALLET'
                      ? 'bg-purple-500/15 border-purple-500 text-purple-300 shadow-xl'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Wallet className="w-8 h-8" />
                  <span className="text-sm font-black">Monedero Digital</span>
                </button>

                {selectedBrand?.kioskAllowCashAtCounter && (
                  <button
                    onClick={() => setPaymentMethod('CASH_COUNTER')}
                    className={`p-5 rounded-2xl border-2 text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'CASH_COUNTER'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-xl'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Coins className="w-8 h-8" />
                    <span className="text-sm font-black">Pagar en Caja / Efectivo</span>
                  </button>
                )}
              </div>

              {/* Wallet phone input */}
              {paymentMethod === 'WALLET' && (
                <div className="pt-2 animate-fade-in space-y-1">
                  <label className="text-xs text-purple-300 font-bold block">
                    Ingresa tu número celular vinculado al Monedero:
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ej. 5512345678"
                    className="w-full bg-slate-900 border-2 border-purple-700 rounded-2xl p-4 text-lg font-bold text-white outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Confirmation Bar */}
          <div className="border-t border-slate-800 pt-6 flex items-center justify-between gap-6 max-w-2xl mx-auto w-full">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Total a Pagar</p>
              <p className="text-3xl font-black text-emerald-400">${cartSubtotal.toFixed(2)} MXN</p>
            </div>

            <button
              onClick={handlePlaceKioskOrder}
              disabled={isPayingSimulation}
              className="py-5 px-10 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-xl rounded-2xl flex items-center gap-3 shadow-2xl shadow-amber-500/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isPayingSimulation ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 border-3 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Procesando pago...</span>
                </div>
              ) : (
                <>
                  <ShieldCheck className="w-6 h-6" />
                  <span>Pagar y Enviar a Cocina</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 7. ORDER SUCCESS / TURN PICK-UP SCREEN */}
      {/* ======================================================================= */}
      {kioskStep === 'SUCCESS' && confirmedOrder && (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-8 text-center animate-fade-in max-w-2xl mx-auto">
          <div className="my-auto space-y-8">
            <div className="inline-flex p-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-2xl">
              <CheckCircle2 className="w-20 h-20" />
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-black text-white">¡Orden Recibida con Éxito!</h1>
              <p className="text-slate-400 text-base">
                Tu pedido se está preparando en este momento en cocina.
              </p>
            </div>

            {/* Giant Turn Folio */}
            <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-8 max-w-sm mx-auto shadow-2xl space-y-2">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Tu Número de Turno</p>
              <h2 className="text-6xl font-black text-white tracking-tight">{confirmedOrder.turnNumber}</h2>
              <p className="text-xs text-slate-500 font-mono">Folio: {confirmedOrder.orderNumber}</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 max-w-md mx-auto space-y-1">
              <p className="font-bold text-white flex items-center justify-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" /> Tiempo estimado: ~12-15 minutos
              </p>
              <p className="text-slate-400">
                Observa las pantallas del mostrador; tu número {confirmedOrder.turnNumber} aparecerá en verde cuando esté listo para recoger.
              </p>
            </div>
          </div>

          {/* Auto reset footer */}
          <div className="space-y-3 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              Regresando a la pantalla principal en <span className="font-bold text-amber-400">{successCountdown}s</span>
            </p>
            <button
              onClick={() => {
                setKioskStep('ATTRACT');
                setConfirmedOrder(null);
                setCart([]);
              }}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-black rounded-2xl text-base cursor-pointer"
            >
              Finalizar y Salir
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 8. SUPERVISOR SETTINGS & PIN MODAL */}
      {/* ======================================================================= */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Configuración del Kiosco</h3>
              </div>
              <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={toggleFullscreen}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span>{isFullscreen ? 'Salir de Pantalla Completa' : 'Modo Pantalla Completa (F11)'}</span>
              </button>

              <button
                onClick={() => {
                  loadKioskData(selectedBrand?.slug);
                  setShowPinModal(false);
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                <span>Recargar Catálogo y Precios</span>
              </button>

              <button
                onClick={() => {
                  setKioskStep('ATTRACT');
                  setShowPinModal(false);
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs"
              >
                Volver a Pantalla de Espera (Screensaver)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
