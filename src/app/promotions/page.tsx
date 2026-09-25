'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  Tag, 
  Percent, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  UtensilsCrossed, 
  Sparkles, 
  Layers, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Flame,
  CalendarDays,
  DollarSign,
  SlidersHorizontal,
  Edit
} from 'lucide-react';
import { PriceRuleItem, isRuleActiveNow } from '@/lib/priceRules';

interface CouponItem {
  id: string;
  code: string;
  description?: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  brandId?: string | null;
  _count?: {
    orders: number;
  };
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  category?: { name: string };
}

interface ComboItemDetail {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
  };
}

interface ComboData {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isActive: boolean;
  originalPrice: number;
  savings: number;
  savingsPercent: number;
  items: ComboItemDetail[];
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function PromotionsPage() {
  const { activeBrand, addNotification } = useAppStore();
  const [activeTab, setActiveTab] = useState<'COUPONS' | 'COMBOS' | 'PRICE_RULES'>('COUPONS');
  const [loading, setLoading] = useState(true);

  // Coupons state
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [couponSearch, setCouponSearch] = useState('');
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state for coupon
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(15);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(0);
  const [maxDiscount, setMaxDiscount] = useState<string>('');
  const [usageLimit, setUsageLimit] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const [submittingCoupon, setSubmittingCoupon] = useState(false);

  // Combos state
  const [combos, setCombos] = useState<ComboData[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [comboName, setComboName] = useState('');
  const [comboDesc, setComboDesc] = useState('');
  const [comboPrice, setComboPrice] = useState<number>(199);
  const [comboSelectedProducts, setComboSelectedProducts] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [submittingCombo, setSubmittingCombo] = useState(false);

  // Price Rules (Happy Hour / Scheduled Pricing) State
  const [priceRules, setPriceRules] = useState<PriceRuleItem[]>([]);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [ruleType, setRuleType] = useState<'PERCENTAGE_DISCOUNT' | 'FIXED_PRICE' | 'BUY_X_GET_Y'>('PERCENTAGE_DISCOUNT');
  const [ruleDiscountValue, setRuleDiscountValue] = useState<number>(20);
  const [ruleBuyQty, setRuleBuyQty] = useState<number>(2);
  const [ruleGetQty, setRuleGetQty] = useState<number>(1);
  const [ruleDaysOfWeek, setRuleDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [ruleStartTime, setRuleStartTime] = useState('17:00');
  const [ruleEndTime, setRuleEndTime] = useState('20:00');
  const [ruleAppliesToAll, setRuleAppliesToAll] = useState(true);
  const [ruleSelectedProducts, setRuleSelectedProducts] = useState<string[]>([]);
  const [ruleZone, setRuleZone] = useState('');
  const [submittingRule, setSubmittingRule] = useState(false);

  // Load all promotions data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [couponsRes, combosRes, prodsRes, rulesRes] = await Promise.all([
        fetch('/api/coupons'),
        fetch('/api/combos'),
        fetch('/api/products'),
        fetch('/api/price-rules'),
      ]);

      if (couponsRes.ok) {
        const cData = await couponsRes.json();
        setCoupons(cData.coupons || []);
      }

      if (combosRes.ok) {
        const cbData = await combosRes.json();
        setCombos(cbData.combos || []);
      }

      if (prodsRes.ok) {
        const pData = await prodsRes.json();
        setProducts(pData.products || []);
      }

      if (rulesRes.ok) {
        const rData = await rulesRes.json();
        setPriceRules(rData.rules || []);
      }
    } catch (err) {
      console.error('Error loading promotions data:', err);
      addNotification('Error al cargar datos de promociones', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    loadData();
  }, [loadData, activeBrand?.id]);

  // Copy code helper
  const handleCopyCode = (codeToCopy: string) => {
    navigator.clipboard.writeText(codeToCopy);
    setCopiedCode(codeToCopy);
    addNotification(`Código ${codeToCopy} copiado al portapapeles`, 'info');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Toggle coupon status
  const handleToggleCoupon = async (coupon: CouponItem) => {
    try {
      const res = await fetch(`/api/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      if (res.ok) {
        setCoupons(coupons.map(c => c.id === coupon.id ? { ...c, isActive: !c.isActive } : c));
        addNotification(`Cupón ${coupon.code} ${!coupon.isActive ? 'activado' : 'desactivado'}`, 'success');
      }
    } catch (err) {
      console.error('Failed to toggle coupon', err);
      addNotification('No se pudo cambiar el estado del cupón', 'error');
    }
  };

  // Delete coupon
  const handleDeleteCoupon = async (id: string, couponCode: string) => {
    if (!confirm(`¿Eliminar permanentemente el cupón ${couponCode}?`)) return;
    try {
      const res = await fetch(`/api/coupons/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCoupons(coupons.filter(c => c.id !== id));
        addNotification(`Cupón ${couponCode} eliminado`, 'success');
      }
    } catch (err) {
      console.error('Failed to delete coupon', err);
      addNotification('Error al eliminar cupón', 'error');
    }
  };

  // Create coupon submit
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || discountValue <= 0) {
      addNotification('Ingresa un código válido y un descuento mayor a cero', 'error');
      return;
    }

    try {
      setSubmittingCoupon(true);
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          description: description.trim() || null,
          discountType,
          discountValue: Number(discountValue),
          minOrderAmount: Number(minOrderAmount || 0),
          maxDiscount: maxDiscount ? Number(maxDiscount) : null,
          usageLimit: usageLimit ? Number(usageLimit) : null,
          startDate: startDate || null,
          endDate: endDate || null,
          isGlobal,
        }),
      });

      const data = await res.json();
      if (res.ok && data.coupon) {
        setCoupons([data.coupon, ...coupons]);
        addNotification(`¡Cupón ${data.coupon.code} creado con éxito!`, 'success');
        setIsCouponModalOpen(false);
        setCode('');
        setDescription('');
        setDiscountType('PERCENTAGE');
        setDiscountValue(15);
        setMinOrderAmount(0);
        setMaxDiscount('');
        setUsageLimit('');
        setStartDate('');
        setEndDate('');
      } else {
        addNotification(data.error || 'Error al crear cupón', 'error');
      }
    } catch (err) {
      console.error('Failed to create coupon', err);
      addNotification('Error de conexión al crear cupón', 'error');
    } finally {
      setSubmittingCoupon(false);
    }
  };

  // Toggle combo status
  const handleToggleCombo = async (combo: ComboData) => {
    try {
      const res = await fetch(`/api/combos/${combo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !combo.isActive }),
      });
      if (res.ok) {
        setCombos(combos.map(c => c.id === combo.id ? { ...c, isActive: !c.isActive } : c));
        addNotification(`Combo "${combo.name}" ${!combo.isActive ? 'activado' : 'desactivado'}`, 'success');
      }
    } catch (err) {
      console.error('Failed to toggle combo', err);
    }
  };

  // Delete combo
  const handleDeleteCombo = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar permanentemente el combo "${name}"?`)) return;
    try {
      const res = await fetch(`/api/combos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCombos(combos.filter(c => c.id !== id));
        addNotification(`Combo "${name}" eliminado`, 'success');
      }
    } catch (err) {
      console.error('Failed to delete combo', err);
    }
  };

  // Add/remove product in combo builder
  const handleAddProductToCombo = (productId: string) => {
    const existing = comboSelectedProducts.find(p => p.productId === productId);
    if (existing) {
      setComboSelectedProducts(
        comboSelectedProducts.map(p => p.productId === productId ? { ...p, quantity: p.quantity + 1 } : p)
      );
    } else {
      setComboSelectedProducts([...comboSelectedProducts, { productId, quantity: 1 }]);
    }
  };

  const handleRemoveProductFromCombo = (productId: string) => {
    const existing = comboSelectedProducts.find(p => p.productId === productId);
    if (!existing) return;
    if (existing.quantity > 1) {
      setComboSelectedProducts(
        comboSelectedProducts.map(p => p.productId === productId ? { ...p, quantity: p.quantity - 1 } : p)
      );
    } else {
      setComboSelectedProducts(comboSelectedProducts.filter(p => p.productId !== productId));
    }
  };

  // Calculate combo totals
  const comboPreviewOriginalTotal = comboSelectedProducts.reduce((sum, item) => {
    const prod = products.find(p => p.id === item.productId);
    return sum + (prod ? prod.price * item.quantity : 0);
  }, 0);

  const comboPreviewSavings = Math.max(0, comboPreviewOriginalTotal - comboPrice);
  const comboPreviewSavingsPercent = comboPreviewOriginalTotal > 0
    ? Math.round((comboPreviewSavings / comboPreviewOriginalTotal) * 100)
    : 0;

  // Create combo submit
  const handleCreateCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comboName.trim() || comboPrice <= 0 || comboSelectedProducts.length === 0) {
      addNotification('Completa el nombre, precio y al menos 1 producto para el combo', 'error');
      return;
    }

    try {
      setSubmittingCombo(true);
      const res = await fetch('/api/combos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: comboName.trim(),
          description: comboDesc.trim() || null,
          price: Number(comboPrice),
          items: comboSelectedProducts,
        }),
      });

      const data = await res.json();
      if (res.ok && data.combo) {
        setCombos([data.combo, ...combos]);
        addNotification(`¡Combo "${data.combo.name}" creado con éxito!`, 'success');
        setIsComboModalOpen(false);
        setComboName('');
        setComboDesc('');
        setComboPrice(199);
        setComboSelectedProducts([]);
      } else {
        addNotification(data.error || 'Error al crear combo', 'error');
      }
    } catch (err) {
      console.error('Failed to create combo', err);
      addNotification('Error de conexión al crear combo', 'error');
    } finally {
      setSubmittingCombo(false);
    }
  };

  // --- PRICE RULES & HAPPY HOUR HANDLERS ---

  const handleTogglePriceRule = async (rule: PriceRuleItem) => {
    try {
      const res = await fetch(`/api/price-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (res.ok) {
        setPriceRules(priceRules.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
        addNotification(`Tarifa "${rule.name}" ${!rule.isActive ? 'activada' : 'desactivada'}`, 'success');
      }
    } catch {
      addNotification('Error al cambiar estado de la regla', 'error');
    }
  };

  const handleDeletePriceRule = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la regla de precio "${name}"?`)) return;
    try {
      const res = await fetch(`/api/price-rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPriceRules(priceRules.filter(r => r.id !== id));
        addNotification(`Regla "${name}" eliminada`, 'info');
      }
    } catch {
      addNotification('Error al eliminar la regla', 'error');
    }
  };

  const openCreateRuleModal = () => {
    setEditingRuleId(null);
    setRuleName('');
    setRuleDesc('');
    setRuleType('PERCENTAGE_DISCOUNT');
    setRuleDiscountValue(20);
    setRuleBuyQty(2);
    setRuleGetQty(1);
    setRuleDaysOfWeek([1, 2, 3, 4, 5]);
    setRuleStartTime('17:00');
    setRuleEndTime('20:00');
    setRuleAppliesToAll(true);
    setRuleSelectedProducts([]);
    setRuleZone('');
    setIsRuleModalOpen(true);
  };

  const openEditRuleModal = (rule: PriceRuleItem) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleDesc(rule.description || '');
    setRuleType(rule.type as any);
    setRuleDiscountValue(rule.discountValue);
    setRuleBuyQty(rule.buyQty || 2);
    setRuleGetQty(rule.getQty || 1);
    const parsedDays = rule.daysOfWeek.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    setRuleDaysOfWeek(parsedDays);
    setRuleStartTime(rule.startTime);
    setRuleEndTime(rule.endTime);
    setRuleAppliesToAll(rule.appliesToAll);
    let pIds: string[] = [];
    if (rule.productIds) {
      try {
        pIds = rule.productIds.startsWith('[') ? JSON.parse(rule.productIds) : rule.productIds.split(',').map(s => s.trim());
      } catch {
        pIds = rule.productIds.split(',').map(s => s.trim());
      }
    }
    setRuleSelectedProducts(pIds);
    setRuleZone(rule.zone || '');
    setIsRuleModalOpen(true);
  };

  const handleSavePriceRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      addNotification('Ingresa un nombre para la regla', 'error');
      return;
    }
    if (ruleDaysOfWeek.length === 0) {
      addNotification('Selecciona al menos un día de la semana', 'error');
      return;
    }

    setSubmittingRule(true);
    try {
      const payload = {
        name: ruleName.trim(),
        description: ruleDesc.trim() || null,
        type: ruleType,
        discountValue: Number(ruleDiscountValue) || 0,
        buyQty: ruleType === 'BUY_X_GET_Y' ? Number(ruleBuyQty) : null,
        getQty: ruleType === 'BUY_X_GET_Y' ? Number(ruleGetQty) : null,
        daysOfWeek: ruleDaysOfWeek.sort().join(','),
        startTime: ruleStartTime,
        endTime: ruleEndTime,
        appliesToAll: ruleAppliesToAll,
        productIds: ruleAppliesToAll ? null : ruleSelectedProducts,
        zone: ruleZone.trim() || null,
      };

      const url = editingRuleId ? `/api/price-rules/${editingRuleId}` : '/api/price-rules';
      const method = editingRuleId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.rule) {
        if (editingRuleId) {
          setPriceRules(priceRules.map(r => r.id === editingRuleId ? data.rule : r));
          addNotification(`Regla "${data.rule.name}" actualizada`, 'success');
        } else {
          setPriceRules([data.rule, ...priceRules]);
          addNotification(`¡Regla "${data.rule.name}" creada con éxito!`, 'success');
        }
        setIsRuleModalOpen(false);
      } else {
        addNotification(data.error || 'Error al guardar regla', 'error');
      }
    } catch {
      addNotification('Error de red al guardar regla', 'error');
    } finally {
      setSubmittingRule(false);
    }
  };

  // Filter coupons
  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(couponSearch.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(couponSearch.toLowerCase()))
  );

  // Metrics
  const totalActiveCoupons = coupons.filter(c => c.isActive).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c._count?.orders || c.usedCount || 0), 0);
  const totalActiveCombos = combos.filter(c => c.isActive).length;
  const now = new Date();
  const totalActivePriceRules = priceRules.filter(r => r.isActive).length;
  const totalLiveNowRules = priceRules.filter(r => isRuleActiveNow(r, now)).length;

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Tag className="w-6 h-6" />
              </span>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Promociones, Tarifas & Happy Hour
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Estrategias comerciales dinámicas: cupones, combos y reglas automáticas de precios por horario para: <strong className="text-white">{activeBrand?.name}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'COUPONS' && (
              <button
                onClick={() => setIsCouponModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-slate-950 font-bold rounded-xl shadow-lg hover:opacity-95 transition-all text-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nuevo Cupón
              </button>
            )}
            {activeTab === 'COMBOS' && (
              <button
                onClick={() => setIsComboModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 text-white font-bold rounded-xl shadow-lg hover:bg-purple-600 transition-all text-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nuevo Combo
              </button>
            )}
            {activeTab === 'PRICE_RULES' && (
              <button
                onClick={openCreateRuleModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-slate-950 font-black rounded-xl shadow-lg hover:bg-amber-400 transition-all text-sm cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                Nueva Tarifa / Happy Hour
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Cupones Activos</p>
              <p className="text-2xl font-black text-white">{totalActiveCoupons} <span className="text-xs font-normal text-slate-500">/ {coupons.length}</span></p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Canjes Realizados</p>
              <p className="text-2xl font-black text-white">{totalRedemptions} <span className="text-xs font-normal text-slate-500">veces</span></p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Combos Activos</p>
              <p className="text-2xl font-black text-white">{totalActiveCombos} <span className="text-xs font-normal text-slate-500">paquetes</span></p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Tarifas / Happy Hour</p>
              <p className="text-2xl font-black text-white">
                {totalActivePriceRules}{' '}
                {totalLiveNowRules > 0 && (
                  <span className="text-xs font-bold text-amber-400">({totalLiveNowRules} en vivo)</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('COUPONS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer shrink-0 ${
              activeTab === 'COUPONS'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Tag className="w-4 h-4 text-brand-primary" />
            Cupones de Descuento ({coupons.length})
          </button>
          <button
            onClick={() => setActiveTab('COMBOS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer shrink-0 ${
              activeTab === 'COMBOS'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-400" />
            Combos & Paquetes Dinámicos ({combos.length})
          </button>
          <button
            onClick={() => setActiveTab('PRICE_RULES')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer shrink-0 ${
              activeTab === 'PRICE_RULES'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-400" />
            Tarifas Dinámicas & Happy Hour ({priceRules.length})
            {totalLiveNowRules > 0 && (
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: COUPONS CONTENT                                   */}
        {/* ======================================================== */}
        {activeTab === 'COUPONS' && (
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={couponSearch}
                onChange={(e) => setCouponSearch(e.target.value)}
                placeholder="Buscar por código o descripción..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary"
              />
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400">Cargando promociones...</div>
            ) : filteredCoupons.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/50 border border-slate-800/80 rounded-2xl">
                <Tag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-white font-bold text-lg mb-1">No hay cupones registrados</p>
                <p className="text-sm text-slate-400 mb-4">Crea cupones como BURGER20 o PROMO50 para atraer más ventas.</p>
                <button
                  onClick={() => setIsCouponModalOpen(true)}
                  className="px-4 py-2 bg-brand-primary text-slate-950 font-bold rounded-xl text-sm cursor-pointer"
                >
                  Crear Primer Cupón
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCoupons.map((coupon) => {
                  const isExpired = coupon.endDate && new Date() > new Date(coupon.endDate);
                  const isExhausted = typeof coupon.usageLimit === 'number' && coupon.usedCount >= coupon.usageLimit;

                  return (
                    <div
                      key={coupon.id}
                      className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                        coupon.isActive && !isExpired && !isExhausted
                          ? 'border-slate-800 hover:border-slate-700'
                          : 'border-slate-800/50 opacity-60 bg-slate-950/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {coupon.brandId ? (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              Marca
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Global
                            </span>
                          )}
                          {isExpired ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Expirado
                            </span>
                          ) : isExhausted ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Agotado
                            </span>
                          ) : coupon.isActive ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Activo
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                              Inactivo
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleCoupon(coupon)}
                            className={`p-1.5 rounded-lg text-xs font-semibold ${
                              coupon.isActive ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                            title={coupon.isActive ? 'Desactivar cupón' : 'Activar cupón'}
                          >
                            {coupon.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                            title="Eliminar cupón"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-xl tracking-wider text-white bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 inline-flex items-center gap-2">
                            {coupon.code}
                            <button
                              onClick={() => handleCopyCode(coupon.code)}
                              className="text-slate-500 hover:text-white"
                              title="Copiar código"
                            >
                              {copiedCode === coupon.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </span>

                          <span className="text-lg font-black text-emerald-400">
                            {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}% OFF` : `$${coupon.discountValue.toFixed(2)} OFF`}
                          </span>
                        </div>

                        {coupon.description && (
                          <p className="text-xs text-slate-400 line-clamp-2">{coupon.description}</p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                        <div className="flex justify-between">
                          <span>Consumo Mínimo:</span>
                          <span className="font-bold text-slate-200">
                            {coupon.minOrderAmount > 0 ? `$${coupon.minOrderAmount.toFixed(2)}` : 'Sin mínimo'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Usos:</span>
                          <span className="font-bold text-slate-200">
                            {coupon.usedCount} {coupon.usageLimit ? `/ ${coupon.usageLimit}` : 'veces (ilimitado)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: COMBOS CONTENT                                    */}
        {/* ======================================================== */}
        {activeTab === 'COMBOS' && (
          <div className="space-y-4">
            {loading ? (
              <div className="p-12 text-center text-slate-400">Cargando combos...</div>
            ) : combos.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/50 border border-slate-800/80 rounded-2xl">
                <UtensilsCrossed className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-white font-bold text-lg mb-1">No hay combos creados</p>
                <p className="text-sm text-slate-400 mb-4">Empaqueta varios platillos en una sola oferta con precio especial.</p>
                <button
                  onClick={() => setIsComboModalOpen(true)}
                  className="px-4 py-2 bg-purple-500 text-white font-bold rounded-xl text-sm cursor-pointer"
                >
                  Crear Primer Combo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {combos.map((combo) => (
                  <div
                    key={combo.id}
                    className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 ${
                      combo.isActive ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/50 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-1.5">
                            <Sparkles className="w-3 h-3" />
                            Combo Especial
                          </span>
                          <h3 className="font-bold text-white text-base leading-tight">{combo.name}</h3>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleCombo(combo)}
                            className={`p-1.5 rounded-lg text-xs font-semibold ${
                              combo.isActive ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                            title={combo.isActive ? 'Desactivar combo' : 'Activar combo'}
                          >
                            {combo.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteCombo(combo.id, combo.name)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                            title="Eliminar combo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {combo.description && (
                        <p className="text-xs text-slate-400 mb-4">{combo.description}</p>
                      )}

                      <div className="space-y-1.5 mb-4 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Incluye ({combo.items.length} productos):
                        </p>
                        {combo.items.map((it) => (
                          <div key={it.id} className="flex justify-between text-xs">
                            <span className="text-slate-200">
                              <span className="font-bold text-purple-400 mr-1.5">{it.quantity}x</span>
                              {it.product.name}
                            </span>
                            <span className="text-slate-500 font-mono">
                              ${(it.product.price * it.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800">
                      <div className="flex items-end justify-between">
                        <div>
                          {combo.savings > 0 && (
                            <p className="text-xs line-through text-slate-500 font-mono mb-0.5">
                              ${combo.originalPrice.toFixed(2)}
                            </p>
                          )}
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-white font-mono">
                              ${combo.price.toFixed(2)}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-400">MXN</span>
                          </div>
                        </div>

                        {combo.savings > 0 && (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black">
                            ¡Ahorra ${combo.savings.toFixed(2)} ({combo.savingsPercent}%)!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: PRICE RULES & HAPPY HOUR                          */}
        {/* ======================================================== */}
        {activeTab === 'PRICE_RULES' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm">Tarifas Programadas & Happy Hour Automático</h3>
                  <p className="text-xs text-slate-400">
                    Se aplican automáticamente en el POS y Menú Móvil QR según la hora y día vigentes.
                  </p>
                </div>
              </div>

              <button
                onClick={openCreateRuleModal}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[3px]" /> Nueva Regla
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400">Cargando tarifas y happy hour...</div>
            ) : priceRules.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/50 border border-slate-800/80 rounded-2xl space-y-3">
                <Flame className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-white font-bold text-lg">No hay reglas de precios configuradas</p>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Crea tu primer Happy Hour (ej. 2x1 en Cervezas de 17:00 a 20:00 o 20% OFF en Alitas los Jueves).
                </p>
                <button
                  onClick={openCreateRuleModal}
                  className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm cursor-pointer"
                >
                  Configurar Primer Happy Hour
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {priceRules.map((rule) => {
                  const isLive = isRuleActiveNow(rule, now);
                  const daysArray = rule.daysOfWeek.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

                  return (
                    <div
                      key={rule.id}
                      className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                        isLive
                          ? 'border-amber-500/60 bg-amber-950/10 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/30'
                          : rule.isActive
                          ? 'border-slate-800 hover:border-slate-700'
                          : 'border-slate-800/50 opacity-60 bg-slate-950/40'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Status Header */}
                        <div className="flex items-center justify-between gap-2">
                          {isLive ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                              <Flame className="w-3.5 h-3.5 text-amber-400" />
                              ¡ACTIVO AHORA!
                            </span>
                          ) : rule.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Programado
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">
                              Inactivo
                            </span>
                          )}

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditRuleModal(rule)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                              title="Editar regla"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleTogglePriceRule(rule)}
                              className={`p-1.5 rounded-lg text-xs font-semibold ${
                                rule.isActive ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={rule.isActive ? 'Desactivar regla' : 'Activar regla'}
                            >
                              {rule.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleDeletePriceRule(rule.id, rule.name)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                              title="Eliminar regla"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Title and Promo Type */}
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="font-extrabold text-white text-base leading-tight">{rule.name}</h3>
                            <span className="text-sm font-black text-amber-400 font-mono shrink-0">
                              {rule.type === 'PERCENTAGE_DISCOUNT' && `-${rule.discountValue}%`}
                              {rule.type === 'FIXED_PRICE' && `$${rule.discountValue.toFixed(2)}`}
                              {rule.type === 'BUY_X_GET_Y' && `${rule.buyQty}x${rule.getQty}`}
                            </span>
                          </div>
                          {rule.description && (
                            <p className="text-xs text-slate-400 mt-1">{rule.description}</p>
                          )}
                        </div>

                        {/* Schedule & Days */}
                        <div className="bg-slate-950/70 border border-slate-850 rounded-xl p-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-slate-300">
                            <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-amber-400" /> Horario:
                            </span>
                            <span className="font-mono font-bold text-amber-300">
                              {rule.startTime} - {rule.endTime} hrs
                            </span>
                          </div>

                          <div className="flex items-center gap-1 pt-1 border-t border-slate-900">
                            <span className="text-[10px] text-slate-500 mr-1">Días:</span>
                            {[0, 1, 2, 3, 4, 5, 6].map((dayNum) => {
                              const isIncluded = daysArray.includes(dayNum);
                              return (
                                <span
                                  key={dayNum}
                                  className={`h-5 w-6 rounded flex items-center justify-center text-[10px] font-bold ${
                                    isIncluded
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : 'text-slate-600 bg-slate-900/40'
                                  }`}
                                >
                                  {DAY_NAMES[dayNum]}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Scope / Zone info */}
                        <div className="text-[11px] text-slate-400 space-y-1">
                          <div className="flex justify-between">
                            <span>Aplica a:</span>
                            <span className="font-bold text-slate-200">
                              {rule.appliesToAll ? 'Todo el Menú' : 'Productos seleccionados'}
                            </span>
                          </div>
                          {rule.zone && (
                            <div className="flex justify-between">
                              <span>Zona:</span>
                              <span className="font-bold text-slate-200">{rule.zone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: NUEVO CUPÓN                                       */}
        {/* ======================================================== */}
        {isCouponModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-brand-primary" />
                  <h3 className="font-bold text-white text-lg">Crear Nuevo Cupón de Descuento</h3>
                </div>
                <button
                  onClick={() => setIsCouponModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateCoupon} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Código del Cupón *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. VERANO20"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold tracking-wider text-sm focus:outline-none focus:border-brand-primary uppercase"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Descripción (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 20% de descuento por temporada"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Tipo de Descuento
                    </label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                    >
                      <option value="PERCENTAGE">Porcentaje (%)</option>
                      <option value="FIXED_AMOUNT">Monto Fijo ($ MXN)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Valor del Descuento *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step={discountType === 'PERCENTAGE' ? '1' : '0.5'}
                      max={discountType === 'PERCENTAGE' ? '100' : '10000'}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm font-bold font-mono focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCouponModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCoupon}
                    className="px-5 py-2.5 bg-brand-primary text-slate-950 font-bold rounded-xl text-sm hover:opacity-95 transition-all disabled:opacity-50"
                  >
                    {submittingCoupon ? 'Guardando...' : 'Crear Cupón'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: NUEVO COMBO                                       */}
        {/* ======================================================== */}
        {isComboModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-white text-lg">Crear Nuevo Paquete o Combo</h3>
                </div>
                <button
                  onClick={() => setIsComboModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateCombo} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Nombre del Combo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Combo Pareja Burger + Refrescos"
                      value={comboName}
                      onChange={(e) => setComboName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Precio Promocional ($ MXN) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.5"
                      value={comboPrice}
                      onChange={(e) => setComboPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm font-bold font-mono focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500">Valor Regular</p>
                      <p className="text-sm font-bold text-slate-300 font-mono">${comboPreviewOriginalTotal.toFixed(2)}</p>
                    </div>
                    {comboPreviewSavings > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                        Ahorro: -${comboPreviewSavings.toFixed(2)} ({comboPreviewSavingsPercent}%)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Seleccionar Productos a Incluir:
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-slate-800 rounded-xl p-2 bg-slate-950/40">
                    {products.map((prod) => {
                      const selectedItem = comboSelectedProducts.find(p => p.productId === prod.id);
                      const qty = selectedItem ? selectedItem.quantity : 0;

                      return (
                        <div
                          key={prod.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-all ${
                            qty > 0 
                              ? 'bg-purple-950/20 border-purple-800/60 text-white' 
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <p className="font-bold truncate">{prod.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">${prod.price.toFixed(2)}</p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {qty > 0 ? (
                              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md px-1 py-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProductFromCombo(prod.id)}
                                  className="px-1 text-slate-400 hover:text-white"
                                >
                                  -
                                </button>
                                <span className="font-bold text-purple-300 px-1">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => handleAddProductToCombo(prod.id)}
                                  className="px-1 text-slate-400 hover:text-white"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddProductToCombo(prod.id)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold cursor-pointer"
                              >
                                + Agregar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsComboModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCombo || comboSelectedProducts.length === 0}
                    className="px-5 py-2.5 bg-purple-500 text-white font-bold rounded-xl text-sm hover:bg-purple-600 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submittingCombo ? 'Guardando...' : 'Crear Combo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: TARIFAS DINÁMICAS & HAPPY HOUR                     */}
        {/* ======================================================== */}
        {isRuleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base">
                      {editingRuleId ? 'Editar Tarifa / Happy Hour' : 'Nueva Tarifa Programada / Happy Hour'}
                    </h3>
                    <p className="text-xs text-slate-400">Regla automática por horario y día de la semana</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRuleModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSavePriceRule} className="p-5 space-y-4 text-xs">
                {/* Name & Description */}
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Nombre de la Promoción *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Happy Hour 2x1 Cervezas, Jueves de Alitas 20% OFF"
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Descripción (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Válido en cervezas nacionales de 17:00 a 20:00"
                      value={ruleDesc}
                      onChange={(e) => setRuleDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Promo Type & Values */}
                <div className="grid grid-cols-2 gap-3 bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Tipo de Beneficio
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setRuleType('PERCENTAGE_DISCOUNT')}
                        className={`p-2 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                          ruleType === 'PERCENTAGE_DISCOUNT'
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        % Descuento
                      </button>
                      <button
                        type="button"
                        onClick={() => setRuleType('FIXED_PRICE')}
                        className={`p-2 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                          ruleType === 'FIXED_PRICE'
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Precio Fijo ($)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRuleType('BUY_X_GET_Y')}
                        className={`p-2 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                          ruleType === 'BUY_X_GET_Y'
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        2x1 / 3x2
                      </button>
                    </div>
                  </div>

                  {ruleType === 'PERCENTAGE_DISCOUNT' && (
                    <div className="col-span-2">
                      <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Porcentaje de Descuento (%) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={ruleDiscountValue}
                        onChange={(e) => setRuleDiscountValue(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  {ruleType === 'FIXED_PRICE' && (
                    <div className="col-span-2">
                      <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Precio Especial Fijo ($ MXN) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        required
                        value={ruleDiscountValue}
                        onChange={(e) => setRuleDiscountValue(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  {ruleType === 'BUY_X_GET_Y' && (
                    <>
                      <div>
                        <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1">
                          Lleva (X unidades)
                        </label>
                        <input
                          type="number"
                          min="2"
                          max="10"
                          required
                          value={ruleBuyQty}
                          onChange={(e) => setRuleBuyQty(parseInt(e.target.value, 10) || 2)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1">
                          Paga (Y unidades)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="9"
                          required
                          value={ruleGetQty}
                          onChange={(e) => setRuleGetQty(parseInt(e.target.value, 10) || 1)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-amber-400"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Days of Week Selector */}
                <div>
                  <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Días de la Semana Vigentes:
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((dayNum) => {
                      const isSelected = ruleDaysOfWeek.includes(dayNum);
                      return (
                        <button
                          key={dayNum}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setRuleDaysOfWeek(ruleDaysOfWeek.filter(d => d !== dayNum));
                            } else {
                              setRuleDaysOfWeek([...ruleDaysOfWeek, dayNum]);
                            }
                          }}
                          className={`flex-1 py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {DAY_NAMES[dayNum]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Schedule Window (startTime - endTime) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Hora Inicio (HH:mm) *
                    </label>
                    <input
                      type="time"
                      required
                      value={ruleStartTime}
                      onChange={(e) => setRuleStartTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Hora Fin (HH:mm) *
                    </label>
                    <input
                      type="time"
                      required
                      value={ruleEndTime}
                      onChange={(e) => setRuleEndTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Scope (All vs Specific products) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-300 uppercase tracking-wider">
                      Alcance de Platillos:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRuleAppliesToAll(true)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                          ruleAppliesToAll ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-400'
                        }`}
                      >
                        Todo el Menú
                      </button>
                      <button
                        type="button"
                        onClick={() => setRuleAppliesToAll(false)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                          !ruleAppliesToAll ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-400'
                        }`}
                      >
                        Seleccionar Específicos
                      </button>
                    </div>
                  </div>

                  {!ruleAppliesToAll && (
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-slate-800 rounded-xl p-2 bg-slate-950/60">
                      {products.map((p) => {
                        const isChecked = ruleSelectedProducts.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setRuleSelectedProducts(ruleSelectedProducts.filter(id => id !== p.id));
                              } else {
                                setRuleSelectedProducts([...ruleSelectedProducts, p.id]);
                              }
                            }}
                            className={`p-2 rounded-lg border text-left flex items-center justify-between cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                                : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                          >
                            <span className="truncate mr-1">{p.name}</span>
                            <span className="font-mono text-[10px] text-amber-400">${p.price}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRuleModalOpen(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRule}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submittingRule ? 'Guardando...' : editingRuleId ? 'Guardar Cambios' : 'Crear Regla'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardContainer>
  );
}
