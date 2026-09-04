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
  Clock
} from 'lucide-react';

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

export default function PromotionsPage() {
  const { activeBrand, addNotification } = useAppStore();
  const [activeTab, setActiveTab] = useState<'COUPONS' | 'COMBOS'>('COUPONS');
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

  // Load coupons and combos
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [couponsRes, combosRes, prodsRes] = await Promise.all([
        fetch('/api/coupons'),
        fetch('/api/combos'),
        fetch('/api/products'),
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
        // Reset form
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
    if (!confirm(`¿Eliminar el combo "${name}"?`)) return;
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

  // Add/Update item in new combo creation
  const handleAddProductToCombo = (productId: string) => {
    const existing = comboSelectedProducts.find(p => p.productId === productId);
    if (existing) {
      setComboSelectedProducts(comboSelectedProducts.map(p => 
        p.productId === productId ? { ...p, quantity: p.quantity + 1 } : p
      ));
    } else {
      setComboSelectedProducts([...comboSelectedProducts, { productId, quantity: 1 }]);
    }
  };

  const handleRemoveProductFromCombo = (productId: string) => {
    const existing = comboSelectedProducts.find(p => p.productId === productId);
    if (existing && existing.quantity > 1) {
      setComboSelectedProducts(comboSelectedProducts.map(p => 
        p.productId === productId ? { ...p, quantity: p.quantity - 1 } : p
      ));
    } else {
      setComboSelectedProducts(comboSelectedProducts.filter(p => p.productId !== productId));
    }
  };

  // Create combo submit
  const handleCreateCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comboName.trim() || comboSelectedProducts.length === 0 || comboPrice <= 0) {
      addNotification('Ingresa nombre, precio y selecciona al menos un producto', 'error');
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
        addNotification(`¡Combo "${data.combo.name}" creado con éxito!`, 'success');
        setIsComboModalOpen(false);
        setComboName('');
        setComboDesc('');
        setComboPrice(199);
        setComboSelectedProducts([]);
        loadData();
      } else {
        addNotification(data.error || 'Error al crear combo', 'error');
      }
    } catch (err) {
      console.error('Failed to create combo', err);
      addNotification('Error al crear combo', 'error');
    } finally {
      setSubmittingCombo(false);
    }
  };

  // Calculate sum of selected products for combo preview
  const comboPreviewOriginalTotal = comboSelectedProducts.reduce((sum, item) => {
    const prod = products.find(p => p.id === item.productId);
    return sum + (prod ? prod.price * item.quantity : 0);
  }, 0);
  const comboPreviewSavings = Math.max(0, comboPreviewOriginalTotal - comboPrice);
  const comboPreviewSavingsPercent = comboPreviewOriginalTotal > 0 
    ? Math.round((comboPreviewSavings / comboPreviewOriginalTotal) * 100) 
    : 0;

  // Filtered coupons list
  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(couponSearch.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(couponSearch.toLowerCase()))
  );

  // Statistics calculation
  const totalActiveCoupons = coupons.filter(c => c.isActive).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + c.usedCount, 0);
  const totalActiveCombos = combos.filter(c => c.isActive).length;

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
                Promociones, Cupones & Combos
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Crea estrategias de fidelización, descuentos por código y paquetes dinámicos con ahorro para el cliente.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'COUPONS' ? (
              <button
                onClick={() => setIsCouponModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-slate-950 font-bold rounded-xl shadow-lg hover:opacity-95 transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                Nuevo Cupón
              </button>
            ) : (
              <button
                onClick={() => setIsComboModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 text-white font-bold rounded-xl shadow-lg hover:bg-purple-600 transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                Nuevo Combo
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Percent className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Cupones Activos</p>
              <p className="text-2xl font-black text-white">{totalActiveCoupons} <span className="text-sm font-normal text-slate-500">/ {coupons.length}</span></p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Canjes Realizados</p>
              <p className="text-2xl font-black text-white">{totalRedemptions} <span className="text-sm font-normal text-slate-500">veces</span></p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Combos Activos</p>
              <p className="text-2xl font-black text-white">{totalActiveCombos} <span className="text-sm font-normal text-slate-500">paquetes</span></p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
          <button
            onClick={() => setActiveTab('COUPONS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
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
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'COMBOS'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-400" />
            Combos & Paquetes Dinámicos ({combos.length})
          </button>
        </div>

        {/* TAB 1: COUPONS CONTENT */}
        {activeTab === 'COUPONS' && (
          <div className="space-y-4">
            {/* Search Bar */}
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
                  className="px-4 py-2 bg-brand-primary text-slate-950 font-bold rounded-xl text-sm"
                >
                  Crear Primer Cupón
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCoupons.map((coupon) => {
                  const isExpired = coupon.endDate && new Date() > new Date(coupon.endDate);
                  const isExhausted = coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit;

                  return (
                    <div
                      key={coupon.id}
                      className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                        coupon.isActive && !isExpired && !isExhausted
                          ? 'border-slate-800 hover:border-slate-700'
                          : 'border-slate-800/50 opacity-60 bg-slate-950/40'
                      }`}
                    >
                      {/* Top Badges */}
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
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                              Expirado
                            </span>
                          ) : isExhausted ? (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Agotado
                            </span>
                          ) : coupon.isActive ? (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Activo
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">
                              Inactivo
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleCoupon(coupon)}
                            className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
                              coupon.isActive ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                            title={coupon.isActive ? 'Desactivar cupón' : 'Activar cupón'}
                          >
                            {coupon.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                            title="Eliminar cupón"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Code Banner */}
                      <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between mb-4">
                        <div className="font-mono font-black text-lg tracking-wider text-white">
                          {coupon.code}
                        </div>
                        <button
                          onClick={() => handleCopyCode(coupon.code)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                          title="Copiar código"
                        >
                          {copiedCode === coupon.code ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Value & Details */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-brand-primary">
                            {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}%` : `$${coupon.discountValue}`}
                          </span>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                            {coupon.discountType === 'PERCENTAGE' ? 'de descuento' : 'descuento directo'}
                          </span>
                        </div>

                        {coupon.description && (
                          <p className="text-xs text-slate-400 line-clamp-2">{coupon.description}</p>
                        )}

                        <div className="text-xs space-y-1 text-slate-400 pt-2 border-t border-slate-800/60">
                          <div className="flex justify-between">
                            <span>Compra mínima:</span>
                            <span className="text-slate-200 font-medium">
                              {coupon.minOrderAmount > 0 ? `$${coupon.minOrderAmount.toFixed(2)}` : 'Sin mínimo'}
                            </span>
                          </div>
                          {coupon.maxDiscount && (
                            <div className="flex justify-between">
                              <span>Tope máximo:</span>
                              <span className="text-slate-200 font-medium">${coupon.maxDiscount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>Canjes:</span>
                            <span className="text-slate-200 font-medium">
                              {coupon.usedCount} {coupon.usageLimit ? `/ ${coupon.usageLimit}` : 'veces'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Dates */}
                      {(coupon.startDate || coupon.endDate) && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-3 border-t border-slate-800">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {coupon.endDate 
                              ? `Válido hasta ${new Date(coupon.endDate).toLocaleDateString()}` 
                              : 'Vigencia permanente'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COMBOS CONTENT */}
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
                  className="px-4 py-2 bg-purple-500 text-white font-bold rounded-xl text-sm"
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
                      {/* Header */}
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

                      {/* Products Included */}
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

                    {/* Financial Summary */}
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

        {/* MODAL: NUEVO CUPÓN */}
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-brand-primary"
                    >
                      <option value="PERCENTAGE">Porcentaje (%)</option>
                      <option value="FIXED_AMOUNT">Monto Fijo ($ MXN)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Valor del Descuento *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        required
                        value={discountValue}
                        onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-8 py-2.5 text-white text-sm focus:outline-none focus:border-brand-primary font-bold"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                        {discountType === 'PERCENTAGE' ? '%' : '$'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Compra Mínima ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={minOrderAmount}
                      onChange={(e) => setMinOrderAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                    />
                  </div>

                  {discountType === 'PERCENTAGE' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Tope Máximo ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Sin límite"
                        value={maxDiscount}
                        onChange={(e) => setMaxDiscount(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Límite Total de Usos
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ilimitado"
                      value={usageLimit}
                      onChange={(e) => setUsageLimit(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Fecha de Expiración
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={isGlobal}
                      onChange={(e) => setIsGlobal(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-brand-primary"
                    />
                    <span>Cupón global multimarca (aplicable a todas las marcas del grupo)</span>
                  </label>
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

        {/* MODAL: NUEVO COMBO */}
        {isComboModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-white text-lg">Crear Nuevo Combo / Paquete</h3>
                </div>
                <button
                  onClick={() => setIsComboModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateCombo} className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Nombre del Combo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Combo Familiar: 2 Burgers + Papas + 2 Refrescos"
                      value={comboName}
                      onChange={(e) => setComboName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-purple-400 font-bold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Descripción
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Ideal para compartir entre 2 personas"
                      value={comboDesc}
                      onChange={(e) => setComboDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Precio Especial Combo ($) *
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

                  {/* Savings summary */}
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

                {/* Select Products */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Seleccionar Productos a Incluir en el Combo:
                  </label>
                  
                  {/* Product Grid / Picker */}
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
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold"
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

                {/* Selected Items preview */}
                {comboSelectedProducts.length > 0 && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Resumen del Paquete:
                    </p>
                    {comboSelectedProducts.map(item => {
                      const p = products.find(prod => prod.id === item.productId);
                      return (
                        <div key={item.productId} className="flex justify-between text-xs text-slate-300">
                          <span>{item.quantity}x {p?.name}</span>
                          <span className="font-mono text-slate-500">${((p?.price || 0) * item.quantity).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsComboModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCombo || comboSelectedProducts.length === 0}
                    className="px-5 py-2.5 bg-purple-500 text-white font-bold rounded-xl text-sm hover:bg-purple-600 transition-all disabled:opacity-50"
                  >
                    {submittingCombo ? 'Guardando...' : 'Crear Combo'}
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
