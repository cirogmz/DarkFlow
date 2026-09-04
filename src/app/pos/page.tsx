'use client';

import React, { useEffect, useState } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Coins,
  Printer,
  Crown,
  Sparkles,
  UserCheck
} from 'lucide-react';
import ThermalTicketModal, { ThermalOrderData } from '@/components/ThermalTicketModal';

interface CustomerSuggestion {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  loyaltyPoints: number;
  totalOrders: number;
}

interface Ingredient {
  id: string;
  name: string;
  stock: number;
  unit: string;
}

interface RecipeItem {
  id: string;
  ingredientId: string;
  quantity: number;
  ingredient: Ingredient;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  categoryId: string;
  recipeItems: RecipeItem[];
}

interface Category {
  id: string;
  name: string;
  products: Product[];
}

interface PlacedOrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    name: string;
  };
}

interface PlacedOrder {
  id: string;
  orderNumber: string;
  source: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  notes?: string | null;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  createdAt: string;
  items: PlacedOrderItem[];
  table?: {
    number: string;
    name: string;
  } | null;
  customer?: {
    loyaltyPoints?: number;
    totalOrders?: number;
  } | null;
}

interface TableOption {
  id: string;
  number: string;
  name: string;
  status: string;
  capacity: number;
}

export default function POSPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Customer checkout state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderSource, setOrderSource] = useState<'UBER_EATS' | 'RAPPI' | 'WEB' | 'PHONE' | 'DINE_IN' | 'TAKEAWAY'>('WEB');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [diners, setDiners] = useState<number>(2);
  const [tip, setTip] = useState<number>(0);
  const [orderNotes, setOrderNotes] = useState('');

  // Customer CRM & Loyalty search state
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSuggestion | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  
  // Modal states
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [isThermalOpen, setIsThermalOpen] = useState(false);
  const [thermalInitialMode, setThermalInitialMode] = useState<'CUSTOMER' | 'KITCHEN'>('CUSTOMER');
  const [loading, setLoading] = useState(false);

  const { cart, addToCart, removeFromCart, updateCartQty, updateCartNotes, clearCart, addNotification } = useAppStore();

  const fetchInitialData = React.useCallback(async () => {
    try {
      const [prodRes, tablesRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/tables'),
      ]);

      if (prodRes.ok) {
        const data = await prodRes.json();
        setCategories(data.categories);
        setProducts(data.products);
      }

      if (tablesRes.ok) {
        const tablesData = await tablesRes.json();
        setTables(tablesData.tables || []);
      }
    } catch (err) {
      console.error('Failed to fetch POS initial data', err);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Helper: check if product has enough ingredients stock
  const checkStockStatus = (product: Product) => {
    if (product.recipeItems.length === 0) return { ok: true, msg: 'Listo' };
    
    for (const ri of product.recipeItems) {
      const needed = ri.quantity;
      if (ri.ingredient.stock < needed) {
        return { 
          ok: false, 
          msg: `Sin ${ri.ingredient.name} (${ri.ingredient.stock.toFixed(1)}/${needed} ${ri.ingredient.unit})` 
        };
      }
    }
    return { ok: true, msg: 'Disponible' };
  };

  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory === 'all' || prod.categoryId === selectedCategory;
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (prod.description && prod.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Financial and Loyalty Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const maxPointsDiscount = selectedCustomer ? Math.floor(selectedCustomer.loyaltyPoints / 10) : 0;
  const loyaltyDiscount = (selectedCustomer && redeemPoints) ? Math.min(cartSubtotal, maxPointsDiscount) : 0;
  const redeemedPointsCount = loyaltyDiscount * 10;
  const cartSubtotalAfterDiscount = Math.max(0, cartSubtotal - loyaltyDiscount);
  const cartTax = parseFloat((cartSubtotalAfterDiscount * 0.16).toFixed(2));
  const cartTotal = parseFloat((cartSubtotalAfterDiscount + cartTax + tip).toFixed(2));
  const earnedPoints = Math.floor(cartTotal / 10);

  // Live customer search
  const handleCustomerSearch = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setCustomerSuggestions(data.customers || []);
        setShowSuggestions((data.customers || []).length > 0);
      }
    } catch (err) {
      console.error('Error searching customer:', err);
    }
  };

  const handleSelectCustomer = (cust: CustomerSuggestion) => {
    setSelectedCustomer(cust);
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    if (cust.address) setCustomerAddress(cust.address);
    if (cust.notes) setOrderNotes(cust.notes);
    setShowSuggestions(false);
    setCustomerSuggestions([]);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setRedeemPoints(false);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setOrderNotes('');
  };

  const handlePlaceOrder = async () => {
    const finalCustomerName = customerName || (orderSource === 'DINE_IN' && selectedTableId ? `Mesa ${tables.find(t => t.id === selectedTableId)?.number}` : '');
    
    if (!finalCustomerName) {
      alert('Por favor introduce el nombre del cliente o selecciona una mesa');
      return;
    }

    if (orderSource === 'DINE_IN' && !selectedTableId) {
      alert('Por favor selecciona la mesa para el comensal');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: finalCustomerName,
          customerPhone: customerPhone || (selectedCustomer ? selectedCustomer.phone : null),
          customerAddress,
          source: orderSource,
          notes: orderNotes,
          tip,
          tableId: orderSource === 'DINE_IN' ? selectedTableId : null,
          diners: orderSource === 'DINE_IN' ? diners : 1,
          redeemedPoints: redeemPoints ? redeemedPointsCount : 0,
          discount: loyaltyDiscount,
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
            notes: i.notes,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPlacedOrder(data.order);
        addNotification(`Pedido ${data.order.orderNumber} creado con éxito`, 'success');
        clearCart();
        setIsCheckoutOpen(false);
        // Clear checkout form
        handleClearCustomer();
        setSelectedTableId('');
        setDiners(2);
        setTip(0);
        // Refresh products and tables list
        fetchInitialData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch {
      alert('Error de red al colocar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardContainer>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-130px)] gap-6 overflow-hidden">
        {/* Left Side: Product Menu */}
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar platillos por nombre..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-200 outline-none focus:border-brand-primary"
              />
            </div>
            
            {/* Category Select Buttons */}
            <div className="flex overflow-x-auto gap-2 py-1 scrollbar-none max-w-full">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 text-xs font-bold rounded-lg border shrink-0 transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-brand-primary border-brand-primary text-slate-950 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg border shrink-0 transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-brand-primary border-brand-primary text-slate-950 shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-6">
              {filteredProducts.map((prod) => {
                const stock = checkStockStatus(prod);
                return (
                  <div 
                    key={prod.id} 
                    className={`glass-panel border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 ${
                      stock.ok ? 'border-slate-800' : 'border-red-950/50 bg-red-950/5'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-white text-sm leading-snug">{prod.name}</h4>
                        <span className="font-black text-brand-primary text-sm">${prod.price.toFixed(2)}</span>
                      </div>
                      
                      {prod.imageUrl && (
                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-24 object-cover rounded-lg" />
                      )}
                      
                      <p className="text-xs text-slate-400 leading-relaxed truncate-3-lines">{prod.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                      {stock.ok ? (
                        <span className="text-[10px] bg-emerald-950/50 border border-emerald-900/50 text-emerald-400 font-bold px-2 py-0.5 rounded">
                          {stock.msg}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-red-950/50 border border-red-900/50 text-red-400 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {stock.msg}
                        </span>
                      )}

                      <button
                        onClick={() => addToCart({ id: prod.id, name: prod.name, price: prod.price, imageUrl: prod.imageUrl })}
                        className="p-1.5 rounded-lg bg-brand-primary hover:bg-brand-primary-hover text-slate-950 transition-colors cursor-pointer"
                        title="Agregar al Carrito"
                      >
                        <Plus className="h-4 w-4 stroke-[3px]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Shopping Cart & Checkout Panel */}
        <div className="w-full lg:w-96 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-2xl shrink-0">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-brand-primary" />
              <h3 className="font-bold text-white">Carrito de Pedido</h3>
            </div>
            <span className="text-xs font-bold bg-slate-800 px-2.5 py-1 rounded-full text-slate-300">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} items
            </span>
          </div>

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                <ShoppingBag className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">El carrito está vacío</p>
                <p className="text-xs text-slate-600 mt-1">Agrega platos desde el menú</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="flex flex-col gap-2 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-white leading-tight max-w-[180px]">{item.name}</span>
                    <span className="text-xs font-black text-brand-primary">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  
                  {/* Notes input */}
                  <input
                    type="text"
                    placeholder="Notas (ej. sin cebolla)"
                    value={item.notes || ''}
                    onChange={(e) => updateCartNotes(item.productId, e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[10px] text-slate-300 outline-none placeholder:text-slate-600 focus:border-brand-primary"
                  />

                  {/* Quantity controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                    <button 
                      onClick={() => removeFromCart(item.productId)}
                      className="text-red-500 hover:text-red-400 p-1 rounded hover:bg-red-950/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                        className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-200">{item.quantity}</span>
                      <button 
                        onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                        className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pricing Totals */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/50 space-y-2.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-200">${cartSubtotal.toFixed(2)}</span>
            </div>

            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-purple-400 font-bold">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Descuento Puntos ({redeemedPointsCount} pts)
                </span>
                <span>-${loyaltyDiscount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>IVA (16%)</span>
              <span className="font-semibold text-slate-200">${cartTax.toFixed(2)}</span>
            </div>
            
            {/* Tip controls */}
            <div className="flex items-center justify-between gap-4 py-1">
              <span>Propina</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-500 font-bold">$</span>
                <input
                  type="number"
                  placeholder="0"
                  value={tip || ''}
                  onChange={(e) => setTip(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-center text-slate-200 focus:border-brand-primary outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between border-t border-slate-800 pt-2 text-sm">
              <div>
                <span className="font-bold text-white block">Total</span>
                <span className="text-[10px] text-purple-400 font-medium flex items-center gap-0.5 mt-0.5">
                  <Sparkles className="h-2.5 w-2.5" /> +{earnedPoints} pts a ganar
                </span>
              </div>
              <span className="font-black text-brand-primary text-base">${cartTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={() => setIsCheckoutOpen(true)}
              disabled={cart.length === 0}
              className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-sm rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer transition-colors"
            >
              Proceder al Pago
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Form Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative my-6">
            <button 
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              ✕
            </button>
            <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Coins className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {orderSource === 'DINE_IN' ? 'Comanda de Salón / Mesa' : 'Detalles de Venta y Cliente'}
                </h3>
                <p className="text-[11px] text-slate-400">Completa los datos de la comanda y fidelización</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Order Source */}
              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Tipo / Origen *</label>
                <select
                  value={orderSource}
                  onChange={(e) => {
                    setOrderSource(e.target.value as 'UBER_EATS' | 'RAPPI' | 'WEB' | 'PHONE' | 'DINE_IN' | 'TAKEAWAY');
                    if (e.target.value === 'DINE_IN') handleClearCustomer();
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:border-brand-primary outline-none"
                >
                  <option value="DINE_IN">🍽️ Comer en Salón (Mesa)</option>
                  <option value="TAKEAWAY">🛍️ Para Llevar (Mostrador)</option>
                  <option value="WEB">🌐 Sitio Web Propio</option>
                  <option value="PHONE">📞 Teléfono / WhatsApp</option>
                  <option value="UBER_EATS">🛵 Uber Eats App</option>
                  <option value="RAPPI">🛵 Rappi App</option>
                </select>
              </div>

              {/* Dine-In specific options */}
              {orderSource === 'DINE_IN' && (
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <div className="space-y-1">
                    <label className="font-bold text-brand-primary uppercase text-[10px]">Seleccionar Mesa *</label>
                    <select
                      required
                      value={selectedTableId}
                      onChange={(e) => setSelectedTableId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-2 text-white focus:border-brand-primary outline-none font-bold"
                    >
                      <option value="">-- Elegir Mesa --</option>
                      {tables.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.status !== 'AVAILABLE' && t.id !== selectedTableId}>
                          {t.name} ({t.zone} - {t.capacity}p) {t.status !== 'AVAILABLE' ? '[Ocupada]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-400 uppercase text-[10px]">Comensales</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={diners}
                      onChange={(e) => setDiners(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Customer Recognition & Autocomplete (For Delivery, Takeaway, Phone, Web) */}
              {orderSource !== 'DINE_IN' && (
                <div className="space-y-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                  {selectedCustomer ? (
                    <div className="bg-slate-900 border border-purple-500/40 rounded-xl p-3 relative">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-xs border border-purple-500/30">
                            <UserCheck className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-sm">{selectedCustomer.name}</span>
                              {selectedCustomer.totalOrders >= 3 && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                                  <Crown className="h-2.5 w-2.5" /> VIP
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">Tel: {selectedCustomer.phone}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 font-bold text-[11px] border border-purple-500/20 flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-purple-400" /> {selectedCustomer.loyaltyPoints} pts
                          </span>
                          <button
                            type="button"
                            onClick={handleClearCustomer}
                            className="text-[10px] text-slate-500 hover:text-red-400 underline"
                          >
                            Cambiar
                          </button>
                        </div>
                      </div>

                      {/* Points Redemption Toggle */}
                      {selectedCustomer.loyaltyPoints >= 10 && (
                        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-200 block text-xs">Canjear Puntos de Fidelidad</span>
                            <span className="text-[10px] text-slate-400">
                              Disponibles: {selectedCustomer.loyaltyPoints} pts (Hasta ${maxPointsDiscount.toFixed(2)} MXN desc.)
                            </span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={redeemPoints}
                              onChange={(e) => setRedeemPoints(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1">
                          <Search className="h-3 w-3 text-amber-400" /> Buscar Cliente Existente o Registrar
                        </span>
                        <span className="text-[10px] text-slate-500">Auto-completado por Teléfono / Nombre</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative">
                        {/* Phone input with autocomplete */}
                        <div className="space-y-1 relative">
                          <label className="text-slate-400 font-semibold text-[11px]">Teléfono *</label>
                          <input
                            type="tel"
                            placeholder="ej. 5512345678"
                            value={customerPhone}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomerPhone(val);
                              handleCustomerSearch(val);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 outline-none"
                          />
                        </div>

                        {/* Name input */}
                        <div className="space-y-1">
                          <label className="text-slate-400 font-semibold text-[11px]">Nombre Cliente *</label>
                          <input
                            type="text"
                            placeholder="ej. Mariana López"
                            value={customerName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomerName(val);
                              handleCustomerSearch(val);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 outline-none"
                          />
                        </div>

                        {/* Suggestions Dropdown */}
                        {showSuggestions && customerSuggestions.length > 0 && (
                          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-750 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-800">
                            {customerSuggestions.map((cust) => (
                              <button
                                key={cust.id}
                                type="button"
                                onClick={() => handleSelectCustomer(cust)}
                                className="w-full text-left p-2.5 hover:bg-slate-800 flex items-center justify-between transition-colors group cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white group-hover:text-amber-400">{cust.name}</span>
                                    {cust.totalOrders >= 3 && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 flex items-center gap-0.5">
                                        <Crown className="h-2 w-2" /> VIP
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400">{cust.phone} {cust.address ? `• ${cust.address}` : ''}</span>
                                </div>
                                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-bold text-[10px] border border-purple-500/20 flex items-center gap-1">
                                  <Sparkles className="h-2.5 w-2.5 text-purple-400" /> {cust.loyaltyPoints} pts
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Address input */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400 text-[11px]">Dirección de Entrega</label>
                    <textarea
                      placeholder="Calle, Número, Colonia, Referencias..."
                      rows={2}
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-brand-primary outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Order Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-400 text-[11px]">Notas Especiales / Comanda</label>
                <input
                  type="text"
                  placeholder={orderSource === 'DINE_IN' ? 'Servir todo junto, cubiertos extra...' : 'Tocar timbre, sin cebolla, salsa aparte...'}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-brand-primary outline-none"
                />
              </div>

              {/* Financial Breakdown Preview */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${cartSubtotal.toFixed(2)}</span>
                </div>
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-purple-400 font-bold">
                    <span>Descuento de Puntos (-{redeemedPointsCount} pts):</span>
                    <span>-${loyaltyDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>IVA (16%):</span>
                  <span>${cartTax.toFixed(2)}</span>
                </div>
                {tip > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Propina:</span>
                    <span>${tip.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-black text-sm pt-1 border-t border-slate-800">
                  <span>Total a Pagar:</span>
                  <span className="text-amber-400 font-mono">${cartTotal.toFixed(2)} MXN</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={loading}
                className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-xl shadow-lg cursor-pointer disabled:opacity-50 transition-all active:scale-98"
              >
                {loading ? 'Procesando...' : 'Confirmar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Success & Printer ticket view modal */}
      {placedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setPlacedOrder(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              ✕
            </button>
            
            <div className="flex flex-col items-center text-center space-y-1.5 border-b border-slate-800 pb-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <h3 className="text-lg font-bold text-white">¡Pedido Registrado!</h3>
              <p className="text-xs text-slate-400">Orden número: <strong className="text-white">{placedOrder.orderNumber}</strong></p>
            </div>

            {/* Ticket Simulator view */}
            <div className="flex-1 overflow-y-auto p-4 bg-white text-slate-950 rounded-lg font-mono text-xs border border-slate-700 shadow-inner" id="print-area">
              <div className="text-center border-b border-dashed border-slate-300 pb-2 space-y-1">
                <p className="font-bold text-sm">DARKFLOW MANAGER</p>
                <p className="text-[10px]">Cocina Digital Multi-Marca</p>
                <p className="text-[9px]">{new Date(placedOrder.createdAt).toLocaleString('es-MX')}</p>
              </div>

              <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-[10px]">
                <p><strong>Ticket:</strong> {placedOrder.orderNumber}</p>
                <p><strong>Origen:</strong> {placedOrder.source} {placedOrder.table ? `[${placedOrder.table.name}]` : ''}</p>
                <p><strong>Cliente:</strong> {placedOrder.customerName}</p>
                {placedOrder.customerPhone && <p><strong>Tel:</strong> {placedOrder.customerPhone}</p>}
                {placedOrder.customerAddress && (
                  <p className="truncate-2-lines"><strong>Dir:</strong> {placedOrder.customerAddress}</p>
                )}
                {placedOrder.notes && <p className="italic"><strong>Nota:</strong> {placedOrder.notes}</p>}
              </div>

              <table className="w-full text-left text-[9px] border-b border-dashed border-slate-300 py-2">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-1">Cant</th>
                    <th className="py-1">Plato</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {placedOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1 font-bold">{item.quantity}x</td>
                      <td className="py-1 truncate max-w-[150px]">{item.product.name}</td>
                      <td className="py-1 text-right">${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-2 text-right space-y-1 text-[10px]">
                <p>Subtotal: ${placedOrder.subtotal.toFixed(2)}</p>
                <p>IVA (16%): ${placedOrder.tax.toFixed(2)}</p>
                {placedOrder.tip > 0 && <p>Propina: ${placedOrder.tip.toFixed(2)}</p>}
                <p className="font-bold text-xs border-t border-dashed border-slate-200 pt-1">Total: ${placedOrder.total.toFixed(2)}</p>
              </div>

              <div className="text-center text-[8px] text-slate-500 mt-4 pt-2 border-t border-dashed border-slate-200">
                ¡Gracias por su compra!
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  setThermalInitialMode('CUSTOMER');
                  setIsThermalOpen(true);
                }}
                className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow"
              >
                <Printer className="h-4 w-4" /> Recibo Cliente
              </button>
              <button
                onClick={() => {
                  setThermalInitialMode('KITCHEN');
                  setIsThermalOpen(true);
                }}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <FileText className="h-4 w-4" /> Comanda Cocina
              </button>
            </div>

            <button
              onClick={() => setPlacedOrder(null)}
              className="w-full py-2 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white font-bold text-xs rounded-lg border border-slate-800 cursor-pointer"
            >
              Listo / Finalizar
            </button>
          </div>
        </div>
      )}

      {/* ESC/POS Thermal Printing Dialog */}
      {placedOrder && (
        <ThermalTicketModal
          isOpen={isThermalOpen}
          onClose={() => setIsThermalOpen(false)}
          order={placedOrder as ThermalOrderData}
          initialMode={thermalInitialMode}
        />
      )}
    </DashboardContainer>
  );
}
